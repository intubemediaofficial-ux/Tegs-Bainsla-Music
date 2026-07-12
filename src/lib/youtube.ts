import type { VideoLite, PlaylistLite } from "./types";
import {
  hasYouTubeApiKey,
  fetchVideoTags,
  fetchVideoDetails,
  apiSearchVideos,
  apiSearchPlaylists,
} from "./youtube-api";

/**
 * YouTube data engine — uses only YouTube's free public endpoints, no API key:
 *  - suggestqueries autocomplete  -> keyword / tag ideas
 *  - /results search page (ytInitialData) -> real ranking videos, thumbnails, views
 *  - /watch page <meta name="keywords"> -> a video's real tags
 *
 * If YOUTUBE_API_KEY is set it is used to improve search accuracy, otherwise we
 * fall back to scraping the public pages (which works out of the box).
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept-Language": "en-US,en;q=0.9",
      // Skip the EU consent interstitial so we get real markup.
      Cookie: "CONSENT=YES+1; SOCS=CAI",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  return res.text();
}

// YouTube auto-adds these generic keywords to videos with no custom tags.
export const DEFAULT_YT_TAGS = new Set([
  "video",
  "sharing",
  "camera phone",
  "video phone",
  "free",
  "upload",
]);

const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");
const PREFIXES = ["new", "latest", "best", "top", "old", "full", "official"];

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Keep only genuinely useful tags:
 *  - drop YouTube's generic defaults,
 *  - drop tags tied to a past year (e.g. "song 2024" once it's 2026) — they lose
 *    search value; current/future years are kept and autocomplete naturally
 *    surfaces the new year,
 *  - drop noisy name/keyword pile-ups (too many words / too long).
 */
export function isUsefulTag(tag: string): boolean {
  const t = tag.trim().toLowerCase();
  if (!t) return false;
  if (DEFAULT_YT_TAGS.has(t)) return false;
  const years = t.match(/\b(19|20)\d{2}\b/g);
  if (years && years.some((y) => parseInt(y, 10) < CURRENT_YEAR)) return false;
  const words = t.split(/\s+/);
  if (words.length > 6) return false;
  if (t.length > 45) return false;
  return true;
}

/** Filter + de-duplicate a tag list, preserving order (already ~popularity ranked). */
export function cleanTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = raw.trim();
    if (!isUsefulTag(t)) continue;
    const norm = t.toLowerCase();
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(t);
  }
  return out;
}

/* ------------------------------- autocomplete ------------------------------ */

export async function getSuggestions(
  query: string,
  hl = "en",
  gl = "IN"
): Promise<string[]> {
  const q = query.trim();
  if (!q) return [];
  const url =
    `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt` +
    `&hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}&q=${encodeURIComponent(q)}`;
  try {
    const text = await fetchText(url);
    const parsed = JSON.parse(text) as [string, string[]];
    return Array.isArray(parsed?.[1]) ? parsed[1] : [];
  } catch {
    return [];
  }
}

/**
 * Expand a seed into a large, de-duplicated keyword list the way RapidTags /
 * KeywordTool do: base suggestions + suggestions for "seed a".."seed z" and a
 * few prefixes. `depth` controls how many alphabet probes run.
 */
export async function expandKeywords(
  seed: string,
  hl = "en",
  gl = "IN",
  depth = 26
): Promise<string[]> {
  const base = seed.trim().toLowerCase();
  if (!base) return [];

  const probes = [
    base,
    ...LETTERS.slice(0, depth).map((c) => `${base} ${c}`),
    ...PREFIXES.map((p) => `${p} ${base}`),
  ];

  const results = await Promise.all(probes.map((p) => getSuggestions(p, hl, gl)));

  const seen = new Set<string>();
  const out: string[] = [];
  // Always keep the seed first.
  seen.add(base);
  out.push(base);
  for (const list of results) {
    for (const s of list) {
      const norm = s.trim().toLowerCase();
      if (!norm || seen.has(norm)) continue;
      seen.add(norm);
      out.push(norm);
    }
  }
  return out;
}

/* --------------------------------- search --------------------------------- */

function parseCount(text: string | undefined): number {
  if (!text) return 0;
  const m = text.replace(/,/g, "").match(/([\d.]+)\s*([KMB]?)/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const unit = m[2].toUpperCase();
  const mult = unit === "B" ? 1e9 : unit === "M" ? 1e6 : unit === "K" ? 1e3 : 1;
  return Math.round(n * mult);
}

export function ageTextToHours(text: string | undefined): number {
  if (!text) return 24 * 30;
  const m = text.match(/(\d+)\s*(second|minute|hour|day|week|month|year)/i);
  if (!m) return 24 * 30;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  const hours: Record<string, number> = {
    second: 1 / 3600,
    minute: 1 / 60,
    hour: 1,
    day: 24,
    week: 24 * 7,
    month: 24 * 30,
    year: 24 * 365,
  };
  return Math.max(1, Math.round(n * (hours[unit] ?? 24)));
}

function extractInitialData(html: string): unknown | null {
  const patterns = [
    /var ytInitialData\s*=\s*({.+?});<\/script>/s,
    /window\["ytInitialData"\]\s*=\s*({.+?});/s,
    /ytInitialData\s*=\s*({.+?});\s*<\/script>/s,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) {
      try {
        return JSON.parse(m[1]);
      } catch {
        /* try next */
      }
    }
  }
  return null;
}

interface RawVideoRenderer {
  videoId?: string;
  title?: { runs?: { text: string }[]; simpleText?: string };
  ownerText?: { runs?: { text: string }[] };
  longBylineText?: { runs?: { text: string }[] };
  viewCountText?: { simpleText?: string; runs?: { text: string }[] };
  publishedTimeText?: { simpleText?: string };
  thumbnail?: { thumbnails?: { url: string }[] };
}

function walkVideos(node: unknown, out: RawVideoRenderer[]): void {
  if (!node || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  if (obj.videoRenderer) out.push(obj.videoRenderer as RawVideoRenderer);
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (Array.isArray(val)) val.forEach((v) => walkVideos(v, out));
    else if (val && typeof val === "object") walkVideos(val, out);
  }
}

function runsText(r?: { runs?: { text: string }[]; simpleText?: string }): string {
  if (!r) return "";
  if (r.simpleText) return r.simpleText;
  if (r.runs) return r.runs.map((x) => x.text).join("");
  return "";
}

export async function searchVideos(
  query: string,
  hl = "en",
  gl = "IN",
  limit = 20
): Promise<VideoLite[]> {
  const url =
    `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}` +
    `&hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}`;
  let html = "";
  try {
    html = await fetchText(url);
  } catch {
    /* fall through to API fallback */
  }
  const data = html ? extractInitialData(html) : null;

  const seen = new Set<string>();
  const videos: VideoLite[] = [];
  if (data) {
    const raw: RawVideoRenderer[] = [];
    walkVideos(data, raw);
    for (const v of raw) {
      if (!v.videoId || seen.has(v.videoId)) continue;
      seen.add(v.videoId);
      const title = runsText(v.title);
      if (!title) continue;
      const channel = runsText(v.ownerText) || runsText(v.longBylineText);
      const thumbs = v.thumbnail?.thumbnails ?? [];
      videos.push({
        videoId: v.videoId,
        title,
        channel,
        views: parseCount(runsText(v.viewCountText)),
        publishedText: v.publishedTimeText?.simpleText ?? "",
        thumbnail:
          thumbs[thumbs.length - 1]?.url ||
          `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${v.videoId}`,
      });
      if (videos.length >= limit) break;
    }
  }

  // Scraping is blocked from some IPs (datacenters) — fall back to the official API.
  if (videos.length === 0 && hasYouTubeApiKey()) {
    return apiSearchVideos(query, gl, limit);
  }
  return videos;
}

/* -------------------------------- playlists ------------------------------- */

// YouTube now returns playlists in search as `lockupViewModel` nodes.
interface LockupViewModel {
  contentId?: string;
  contentType?: string;
  metadata?: {
    lockupMetadataViewModel?: {
      title?: { content?: string };
      metadata?: {
        contentMetadataViewModel?: {
          metadataRows?: { metadataParts?: { text?: { content?: string } }[] }[];
        };
      };
    };
  };
  contentImage?: {
    collectionThumbnailViewModel?: {
      primaryThumbnail?: {
        thumbnailViewModel?: { image?: { sources?: { url?: string }[] } };
      };
    };
  };
}

function walkLockups(node: unknown, out: LockupViewModel[]): void {
  if (!node || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  if (obj.lockupViewModel) out.push(obj.lockupViewModel as LockupViewModel);
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (Array.isArray(val)) val.forEach((v) => walkLockups(v, out));
    else if (val && typeof val === "object") walkLockups(val, out);
  }
}

/**
 * Real trending playlists for a query — YouTube search filtered to playlists
 * (sp=EgIQAw%3D%3D). These are the actual playlists a song can be added to for
 * playlist-driven views. No fabricated data — only what YouTube returns.
 */
export async function searchPlaylists(
  query: string,
  hl = "en",
  gl = "IN",
  limit = 8
): Promise<PlaylistLite[]> {
  const url =
    `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}` +
    `&sp=EgIQAw%3D%3D&hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}`;
  let html = "";
  try {
    html = await fetchText(url);
  } catch {
    /* fall through to API fallback */
  }
  const data = html ? extractInitialData(html) : null;

  const seen = new Set<string>();
  const out: PlaylistLite[] = [];
  const raw: LockupViewModel[] = [];
  if (data) walkLockups(data, raw);
  for (const p of raw) {
    if (p.contentType !== "LOCKUP_CONTENT_TYPE_PLAYLIST") continue;
    const id = p.contentId;
    if (!id || seen.has(id)) continue;
    const meta = p.metadata?.lockupMetadataViewModel;
    const title = meta?.title?.content;
    if (!title) continue;
    seen.add(id);
    const rows = meta?.metadata?.contentMetadataViewModel?.metadataRows ?? [];
    const channel = rows[0]?.metadataParts?.[0]?.text?.content ?? "";
    const countMatch = JSON.stringify(p).match(/(\d[\d,]*)\s+videos?/i);
    const sources =
      p.contentImage?.collectionThumbnailViewModel?.primaryThumbnail?.thumbnailViewModel?.image
        ?.sources ?? [];
    out.push({
      playlistId: id,
      title,
      channel,
      videoCount: countMatch ? parseCount(countMatch[1]) : 0,
      thumbnail: sources[sources.length - 1]?.url || "",
      url: `https://www.youtube.com/playlist?list=${id}`,
    });
    if (out.length >= limit) break;
  }

  // Scraping is blocked from some IPs (datacenters) — fall back to the official API.
  if (out.length === 0 && hasYouTubeApiKey()) {
    return apiSearchPlaylists(query, gl, limit);
  }
  return out;
}

/* ------------------------------- video tags ------------------------------- */

export async function getVideoTags(videoId: string): Promise<string[]> {
  // Prefer the official API (returns real tags even when the public page hides
  // them) and fall back to scraping when no key is configured or it returns none.
  if (hasYouTubeApiKey()) {
    const apiTags = await fetchVideoTags(videoId);
    if (apiTags.length) return apiTags;
  }
  const url = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=en&gl=IN`;
  let html: string;
  try {
    html = await fetchText(url);
  } catch {
    return [];
  }
  const meta = html.match(/<meta name="keywords" content="([^"]*)"/i);
  if (meta?.[1]) {
    return meta[1]
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }
  // Fallback: keywords array inside the player response JSON.
  const kw = html.match(/"keywords":\[(.*?)\]/s);
  if (kw?.[1]) {
    try {
      return (JSON.parse(`[${kw[1]}]`) as string[]).map((t) => t.trim()).filter(Boolean);
    } catch {
      /* ignore */
    }
  }
  return [];
}

export interface RankedTag {
  tag: string;
  rank: number; // position in the search-popularity (autocomplete) universe
}

export interface TagRanking {
  trending: RankedTag[]; // tags people actually search, best (lowest) rank first
  notTrending: string[]; // tags absent from live search demand
  suggestions: RankedTag[]; // higher-ranking tags to add that aren't used yet
}

/** Reduce a noisy video title to a short seed for autocomplete expansion. */
export function seedFromTitle(title: string): string {
  return title
    .split(/[|(\[\]:•]|[-–—]\s|\s[-–—]/)[0]
    .replace(/#[^\s]+/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join(" ")
    .toLowerCase();
}

/**
 * Rank tags against live YouTube search demand (autocomplete popularity order).
 * Tags that appear in what people actually search get a rank number; tags that
 * don't are flagged not-trending; and the highest-demand unused terms are
 * returned as better tags to add. Honest proxy — not an official metric.
 */
export async function rankTags(
  tags: string[],
  seed: string,
  hl = "en",
  gl = "IN"
): Promise<TagRanking> {
  const universe = await expandKeywords(seed, hl, gl);
  const rankOf = new Map<string, number>();
  universe.forEach((u, i) => {
    if (!rankOf.has(u)) rankOf.set(u, i + 1);
  });

  const findRank = (norm: string): number | null => {
    const exact = rankOf.get(norm);
    if (exact) return exact;
    if (norm.length < 3) return null;
    // Pick the most *specific* matching search term (longest overlap), so tags
    // don't all collapse onto the generic seed at rank #1.
    let bestRank: number | null = null;
    let bestLen = -1;
    for (let i = 0; i < universe.length; i++) {
      const u = universe[i];
      if (u.length < 3) continue;
      if (u.includes(norm) || norm.includes(u)) {
        if (u.length > bestLen) {
          bestLen = u.length;
          bestRank = i + 1;
        }
      }
    }
    return bestRank;
  };

  const usedNorms = new Set<string>();
  const trending: RankedTag[] = [];
  const notTrending: string[] = [];
  for (const raw of tags) {
    const t = raw.trim();
    const norm = t.toLowerCase();
    if (!norm || usedNorms.has(norm)) continue;
    usedNorms.add(norm);
    const rank = findRank(norm);
    if (rank) trending.push({ tag: t, rank });
    else notTrending.push(t);
  }
  trending.sort((a, b) => a.rank - b.rank);

  const suggestions: RankedTag[] = [];
  for (let i = 0; i < universe.length && suggestions.length < 15; i++) {
    const u = universe[i];
    if (usedNorms.has(u) || !isUsefulTag(u)) continue;
    suggestions.push({ tag: u, rank: i + 1 });
  }

  return { trending, notTrending, suggestions };
}

export interface VideoInfo {
  videoId: string;
  title: string;
  channel: string;
  published: string; // human-readable upload date/time
  description: string;
  tags: string[];
}

function isoToNiceDate(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Full public info for one video — description, real tags and upload date.
 * Prefers the official API (also works when the watch page hides tags) and
 * falls back to scraping the watch page.
 */
export async function getVideoInfo(videoId: string): Promise<VideoInfo> {
  if (hasYouTubeApiKey()) {
    const map = await fetchVideoDetails([videoId]);
    const d = map.get(videoId);
    if (d && (d.title || d.description || d.tags.length)) {
      return {
        videoId,
        title: d.title,
        channel: d.channel,
        published: isoToNiceDate(d.publishedAt),
        description: d.description,
        tags: d.tags,
      };
    }
  }

  const url = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=en&gl=IN`;
  let html = "";
  try {
    html = await fetchText(url);
  } catch {
    return { videoId, title: "", channel: "", published: "", description: "", tags: [] };
  }

  const tags = await getVideoTags(videoId);
  const descMatch = html.match(/"shortDescription":"((?:\\.|[^"\\])*)"/);
  let description = "";
  if (descMatch?.[1]) {
    try {
      description = JSON.parse(`"${descMatch[1]}"`);
    } catch {
      description = descMatch[1];
    }
  }
  const dateMatch =
    html.match(/"dateText":\{"simpleText":"([^"]+)"/) ||
    html.match(/<meta itemprop="datePublished" content="([^"]+)"/);
  const title =
    html.match(/<meta name="title" content="([^"]*)"/i)?.[1] ??
    html.match(/"title":"((?:\\.|[^"\\])*)"/)?.[1] ??
    "";
  const channel = html.match(/"ownerChannelName":"((?:\\.|[^"\\])*)"/)?.[1] ?? "";

  return {
    videoId,
    title,
    channel,
    published: dateMatch?.[1] ? isoToNiceDate(dateMatch[1]) : "",
    description,
    tags,
  };
}

/* --------------------------- builders / generators ------------------------- */

/** Pack tags into a comma-separated string within `limit` characters (YouTube = 500). */
export function buildTagString(
  tags: string[],
  limit = 500
): { text: string; used: string[] } {
  const used: string[] = [];
  let len = 0;
  for (const t of tags) {
    const tag = t.trim();
    if (!tag) continue;
    const add = used.length === 0 ? tag.length : tag.length + 1; // +1 for comma
    if (len + add > limit) continue;
    used.push(tag);
    len += add;
  }
  return { text: used.join(","), used };
}

const HASHTAG_STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "song",
  "video",
  "official",
  "new",
  "full",
  "latest",
]);

export function generateHashtags(seed: string, keywords: string[], max = 20): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    // skip hashtags tied to a past year (e.g. #song2024 when it's 2026)
    const years = raw.match(/\b(19|20)\d{2}\b/g);
    if (years && years.some((y) => parseInt(y, 10) < CURRENT_YEAR)) return;
    const tag =
      "#" +
      raw
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .trim()
        .split(/\s+/)
        .filter((w) => w && !HASHTAG_STOP.has(w))
        .join("");
    if (tag.length > 1 && !seen.has(tag)) {
      seen.add(tag);
      out.push(tag);
    }
  };
  push(seed);
  for (const k of keywords) {
    push(k);
    if (out.length >= max) break;
  }
  return out.slice(0, max);
}

const TITLE_STOP = new Set([
  "the",
  "a",
  "an",
  "of",
  "to",
  "in",
  "on",
  "and",
  "for",
  "with",
  "|",
  "-",
]);

export function titleKeywordCounts(titles: string[]): { word: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const t of titles) {
    const words = t
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s#]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !TITLE_STOP.has(w));
    for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Real, searchable title suggestions: takes the actual top-ranking video titles
 * (highest views) and returns the strongest ones, plus a couple of optimized
 * variations built from the seed + trending keywords. Not AI-hallucinated.
 */
export interface TitleSuggestion {
  title: string;
  source: "ranking" | "optimized";
  views?: number;
  videoId?: string;
  rank?: number; // position in the live YouTube search results
}

export function suggestTitles(
  seed: string,
  videos: VideoLite[],
  keywords: string[],
  max = 6
): TitleSuggestion[] {
  const out: TitleSuggestion[] = [];
  const seen = new Set<string>();

  // remember each video's original position in the search results = its rank
  const rankOf = new Map<string, number>();
  videos.forEach((v, i) => {
    if (!rankOf.has(v.videoId)) rankOf.set(v.videoId, i + 1);
  });

  const ranked = [...videos].sort((a, b) => b.views - a.views);
  for (const v of ranked) {
    const key = v.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      title: v.title,
      source: "ranking",
      views: v.views,
      videoId: v.videoId,
      rank: rankOf.get(v.videoId),
    });
    if (out.length >= max - 2) break;
  }

  const cap = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
  const kw = keywords.filter((k) => k !== seed.toLowerCase()).slice(0, 4);
  const year = new Date().getFullYear();
  const optimized = [
    `${cap(seed)} | New Song ${year} (Official Video)`,
    kw[0] ? `${cap(seed)} - ${cap(kw[0])} | Full Video Song ${year}` : "",
  ].filter(Boolean);
  for (const t of optimized) {
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title: t, source: "optimized" });
    if (out.length >= max) break;
  }
  return out;
}
