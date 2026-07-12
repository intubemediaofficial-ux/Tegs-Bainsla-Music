import {
  buildTagString,
  expandKeywords,
  generateHashtags,
  getSuggestions,
  searchVideos,
  searchPlaylists,
  suggestTitles,
  getVideoTags,
  cleanTags,
  isUsefulTag,
} from "./youtube";
import { hasYouTubeApiKey, fetchVideoDetails } from "./youtube-api";
import { scoreKeyword, scoreTitle } from "./scoring";
import type { VideoLite } from "./types";

const cap = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

export interface BuiltTitle {
  title: string;
  score: number;
  reasons: string[];
}

/**
 * Title Builder: from just a song name + singer, assemble ready-to-use full
 * titles that embed the highest-demand search keywords (autocomplete order =
 * what people actually search), each scored /100.
 */
export async function buildTitles(song: string, singer: string, opts: GenerateOptions = {}) {
  const hl = opts.hl ?? "en";
  const gl = opts.gl ?? "IN";
  const s = song.trim();
  const singerName = singer.trim();
  const seed = [s, singerName].filter(Boolean).join(" ").trim() || s;
  const year = new Date().getFullYear();

  const keywords = await expandKeywords(s || seed, hl, gl);

  const stop = new Set(
    [...s.toLowerCase().split(/\s+/), ...singerName.toLowerCase().split(/\s+/)].filter(Boolean)
  );
  const topKw = keywords
    .filter((k) => isUsefulTag(k) && !stop.has(k) && k !== s.toLowerCase())
    .slice(0, 8);

  const songC = cap(s);
  const singerC = cap(singerName);
  const kw1 = topKw[0] ? cap(topKw[0]) : "";
  const kw2 = topKw[1] ? cap(topKw[1]) : "";

  const templates: string[][] = [
    [songC, singerC, kw1, `New Song ${year}`, "(Official Video)"],
    [songC, singerC, `Full Video Song ${year}`],
    [songC, kw1, singerC, `${year}`],
    [singerC, songC, "Official Video", kw1],
    [songC, singerC, kw1, kw2, "HD"],
  ];

  const seen = new Set<string>();
  const titles: BuiltTitle[] = [];
  for (const parts of templates) {
    const title = parts.filter(Boolean).join(" | ");
    const key = title.toLowerCase();
    if (!title || seen.has(key)) continue;
    seen.add(key);
    const { score, reasons } = scoreTitle(title, s || singerName);
    titles.push({ title, score, reasons });
  }
  titles.sort((a, b) => b.score - a.score);

  const keywordsUsed = topKw.slice(0, 6).map((k, i) => ({ tag: k, rank: i + 1 }));
  return { song: s, singer: singerName, titles, keywordsUsed };
}

export interface GenerateOptions {
  hl?: string;
  gl?: string;
  maxTags?: number;
}

const QUESTION_WORDS = ["how", "what", "why", "when", "where", "who", "kaise", "kya", "kaun"];

function pickQuestions(keywords: string[]): string[] {
  return keywords.filter((k) => QUESTION_WORDS.some((q) => k.startsWith(q + " "))).slice(0, 12);
}

/** Full package: titles + 500-char tags + hashtags + thumbnails in one call. */
export async function generatePackage(seed: string, opts: GenerateOptions = {}) {
  const hl = opts.hl ?? "en";
  const gl = opts.gl ?? "IN";
  const maxTags = opts.maxTags ?? 200;

  const [keywords, videos, playlists] = await Promise.all([
    expandKeywords(seed, hl, gl),
    searchVideos(seed, hl, gl, 20),
    searchPlaylists(seed, hl, gl, 8),
  ]);

  // Harvest each top video's real, cleaned tags once and reuse everywhere
  // (tag box, per-title tags, thumbnail tags).
  const tagsByVideo = new Map<string, string[]>();
  if (hasYouTubeApiKey()) {
    // One cheap batched API call: accurate fresh view counts + real tags for
    // every video (the public page hides most videos' tags).
    const details = await fetchVideoDetails(videos.map((v) => v.videoId));
    for (const v of videos) {
      const d = details.get(v.videoId);
      if (!d) continue;
      if (d.views > 0) v.views = d.views;
      tagsByVideo.set(v.videoId, cleanTags(d.tags));
    }
  } else {
    await Promise.all(
      videos.slice(0, 8).map(async (v) => {
        const tags = cleanTags(await getVideoTags(v.videoId));
        tagsByVideo.set(v.videoId, tags);
      })
    );
  }

  // Merge autocomplete keywords with real tags harvested from the top videos —
  // these are the "premium" tags that already rank.
  const realTagCounts = new Map<string, number>();
  for (const tags of tagsByVideo.values()) {
    for (const t of tags) {
      const norm = t.toLowerCase().trim();
      realTagCounts.set(norm, (realTagCounts.get(norm) ?? 0) + 1);
    }
  }
  const rankedRealTags = [...realTagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);

  // Premium ordering: real ranking tags first, then autocomplete breadth —
  // then drop stale-year / junk tags and keep only useful ones.
  const merged: string[] = [];
  const seen = new Set<string>();
  for (const t of [...rankedRealTags, ...keywords]) {
    if (!seen.has(t)) {
      seen.add(t);
      merged.push(t);
    }
  }
  const limitedTags = cleanTags(merged).slice(0, maxTags);
  const tagBox = buildTagString(limitedTags, 500);

  // Attach each ranking video's real tags to its title suggestion.
  const titles = suggestTitles(seed, videos, keywords).map((t) => ({
    ...t,
    ...scoreTitle(t.title, seed),
    tags: t.videoId ? tagsByVideo.get(t.videoId) ?? [] : [],
  }));

  const hashtags = generateHashtags(seed, keywords, 20);
  const score = scoreKeyword(seed, keywords.length, videos);

  return {
    seed,
    keywords: limitedTags,
    tagBox,
    titles,
    hashtags,
    playlists,
    questions: pickQuestions(keywords),
    thumbnails: videos.slice(0, 12).map((v) => ({
      videoId: v.videoId,
      title: v.title,
      channel: v.channel,
      thumbnail: v.thumbnail,
      url: v.url,
      views: v.views,
      tags: tagsByVideo.get(v.videoId) ?? [],
    })),
    videos,
    score,
    realTags: rankedRealTags.slice(0, 30),
  };
}

/** Keyword research: scores + related + top videos + questions. */
export async function researchKeyword(seed: string, opts: GenerateOptions = {}) {
  const hl = opts.hl ?? "en";
  const gl = opts.gl ?? "IN";

  const [keywords, videos, related] = await Promise.all([
    expandKeywords(seed, hl, gl),
    searchVideos(seed, hl, gl, 15),
    getSuggestions(seed, hl, gl),
  ]);

  if (hasYouTubeApiKey()) {
    const details = await fetchVideoDetails(videos.map((v) => v.videoId));
    for (const v of videos) {
      const d = details.get(v.videoId);
      if (d && d.views > 0) v.views = d.views;
    }
  }

  const score = scoreKeyword(seed, keywords.length, videos);
  return {
    seed,
    score,
    related: related.slice(0, 15),
    keywords: keywords.slice(0, 60),
    questions: pickQuestions(keywords),
    hashtags: generateHashtags(seed, keywords, 15),
    videos: videos.map((v) => ({
      ...v,
      // per-video estimated rank difficulty by view size
      strength: v.views > 1_000_000 ? "high" : v.views > 100_000 ? "medium" : "low",
    })),
  };
}

export interface RankResult {
  keyword: string;
  target: string;
  found: boolean;
  position: number | null;
  matched?: VideoLite;
  scanned: number;
}

/**
 * Rank checker: search the keyword and find where a target video/channel appears.
 * `target` may be a videoId, a watch URL, or a channel name substring.
 */
export async function checkRank(
  keyword: string,
  target: string,
  opts: GenerateOptions = {}
): Promise<RankResult> {
  const hl = opts.hl ?? "en";
  const gl = opts.gl ?? "IN";
  const videos = await searchVideos(keyword, hl, gl, 50);

  const idMatch = target.match(/(?:v=|youtu\.be\/|\/)?([A-Za-z0-9_-]{11})(?:$|&|\?)/);
  const targetId = idMatch?.[1];
  const targetLower = target.toLowerCase().trim();

  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    const hit =
      (targetId && v.videoId === targetId) ||
      v.channel.toLowerCase().includes(targetLower) ||
      v.title.toLowerCase().includes(targetLower);
    if (hit) {
      return {
        keyword,
        target,
        found: true,
        position: i + 1,
        matched: v,
        scanned: videos.length,
      };
    }
  }
  return { keyword, target, found: false, position: null, scanned: videos.length };
}
