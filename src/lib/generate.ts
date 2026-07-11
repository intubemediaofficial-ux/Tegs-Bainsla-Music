import {
  buildTagString,
  expandKeywords,
  generateHashtags,
  getSuggestions,
  searchVideos,
  suggestTitles,
  getVideoTags,
  DEFAULT_YT_TAGS,
} from "./youtube";
import { scoreKeyword, scoreTitle } from "./scoring";
import type { VideoLite } from "./types";

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

  const [keywords, videos] = await Promise.all([
    expandKeywords(seed, hl, gl),
    searchVideos(seed, hl, gl, 20),
  ]);

  // Merge autocomplete keywords with real tags harvested from the top videos —
  // these are the "premium" tags that already rank.
  const realTagCounts = new Map<string, number>();
  await Promise.all(
    videos.slice(0, 5).map(async (v) => {
      const tags = await getVideoTags(v.videoId);
      for (const t of tags) {
        const norm = t.toLowerCase().trim();
        if (norm && !DEFAULT_YT_TAGS.has(norm)) {
          realTagCounts.set(norm, (realTagCounts.get(norm) ?? 0) + 1);
        }
      }
    })
  );
  const rankedRealTags = [...realTagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);

  // Premium ordering: real ranking tags first, then autocomplete breadth.
  const merged: string[] = [];
  const seen = new Set<string>();
  for (const t of [...rankedRealTags, ...keywords]) {
    if (!seen.has(t)) {
      seen.add(t);
      merged.push(t);
    }
  }
  const limitedTags = merged.slice(0, maxTags);
  const tagBox = buildTagString(limitedTags, 500);

  const titles = suggestTitles(seed, videos, keywords).map((t) => ({
    ...t,
    ...scoreTitle(t.title, seed),
  }));

  const hashtags = generateHashtags(seed, keywords, 20);
  const score = scoreKeyword(seed, keywords.length, videos);

  return {
    seed,
    keywords: limitedTags,
    tagBox,
    titles,
    hashtags,
    questions: pickQuestions(keywords),
    thumbnails: videos.slice(0, 12).map((v) => ({
      videoId: v.videoId,
      title: v.title,
      thumbnail: v.thumbnail,
      url: v.url,
      views: v.views,
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
