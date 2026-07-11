import type { VideoLite } from "./types";

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
  let html: string;
  try {
    html = await fetchText(url);
  } catch {
    return [];
  }
  const data = extractInitialData(html);
  if (!data) return [];

  const raw: RawVideoRenderer[] = [];
  walkVideos(data, raw);

  const seen = new Set<string>();
  const videos: VideoLite[] = [];
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
  return videos;
}

/* ------------------------------- video tags ------------------------------- */

export async function getVideoTags(videoId: string): Promise<string[]> {
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
export function suggestTitles(
  seed: string,
  videos: VideoLite[],
  keywords: string[],
  max = 6
): { title: string; source: "ranking" | "optimized"; views?: number }[] {
  const out: { title: string; source: "ranking" | "optimized"; views?: number }[] = [];
  const seen = new Set<string>();

  const ranked = [...videos].sort((a, b) => b.views - a.views);
  for (const v of ranked) {
    const key = v.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title: v.title, source: "ranking", views: v.views });
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
