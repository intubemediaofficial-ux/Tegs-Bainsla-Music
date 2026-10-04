import { randomUUID } from "crypto";
import { store } from "./store";
import {
  ageTextToHours,
  expandKeywords,
  getVideoTags,
  searchVideos,
  generateHashtags,
  titleKeywordCounts,
  topicWords,
  DEFAULT_YT_TAGS,
} from "./youtube";
import {
  hasYouTubeApiKey,
  fetchVideoDetails,
  apiChannelStats,
  apiGetChannel,
  isoToAgeText as isoAge,
} from "./youtube-api";
import { explainVideo } from "./why-viral";
import type {
  CompetitorTrend,
  RelatedTrend,
  TrackedCategory,
  TrendingSnapshot,
  TrendingVideo,
  VideoLite,
} from "./types";

const DEFAULT_CATEGORIES: Omit<TrackedCategory, "id" | "createdAt">[] = [
  { label: "Haryanvi Music", query: "new haryanvi song", language: "hi" },
  { label: "Rajasthani Music", query: "new rajasthani song", language: "hi" },
  { label: "Bhajan / Devotional", query: "new bhajan", language: "hi" },
  { label: "Haryanvi DJ Remix", query: "haryanvi dj remix", language: "hi" },
  { label: "Gurjar Rasiya", query: "gurjar rasiya", language: "hi" },
  { label: "Devotional Bhajan", query: "new devotional bhajan", language: "hi" },
];

/* ----------------------------- categories CRUD ---------------------------- */

export async function listCategories(): Promise<TrackedCategory[]> {
  const cats = await store.list<TrackedCategory>("category:");
  // Seed any default category that isn't tracked yet (also covers new defaults
  // added after a store already exists).
  const have = new Set(cats.map((c) => c.label.toLowerCase()));
  for (const c of DEFAULT_CATEGORIES) {
    if (have.has(c.label.toLowerCase())) continue;
    const cat: TrackedCategory = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      ...c,
    };
    await store.set(`category:${cat.id}`, cat);
    cats.push(cat);
  }
  return cats.sort((a, b) => a.label.localeCompare(b.label));
}

export async function addCategory(
  label: string,
  query: string,
  language = "hi"
): Promise<TrackedCategory> {
  const cat: TrackedCategory = {
    id: randomUUID(),
    label: label.trim(),
    query: query.trim(),
    language,
    createdAt: new Date().toISOString(),
  };
  await store.set(`category:${cat.id}`, cat);
  return cat;
}

export async function removeCategory(id: string): Promise<void> {
  await store.del(`category:${id}`);
  await store.del(`trending:${id}`);
}

/* ------------------------------ virality math ----------------------------- */

/** Trends only count uploads from this window — older hits are not "trending". */
const TREND_WINDOW_DAYS = 30;
/** A stored snapshot older than this is recomputed on the next page load. */
const SNAPSHOT_TTL_MS = 30 * 60 * 1000;

function toTrending(videos: VideoLite[], windowDays = TREND_WINDOW_DAYS): TrendingVideo[] {
  const maxAge = windowDays * 24;
  const enriched = videos
    .map((v) => {
      const ageHours = ageTextToHours(v.publishedText);
      const velocity = v.views / ageHours;
      return { ...v, ageHours, velocity, viralScore: 0 };
    })
    .filter((v) => v.ageHours <= maxAge);
  const maxVel = Math.max(1, ...enriched.map((v) => v.velocity));
  for (const v of enriched) {
    // Blend raw velocity (log-scaled) with recency: newer + faster = more viral.
    // Velocity carries 75 points and recency 25, so only the genuinely fastest
    // fresh upload reaches 100 instead of half the board tying at 100.
    const velScore = (Math.log10(v.velocity + 1) / Math.log10(maxVel + 1)) * 75;
    // This week's uploads are what "trending now" means, so they outrank a
    // three-week-old video with similar velocity.
    const recencyBoost =
      v.ageHours <= 48 ? 25 : v.ageHours <= 24 * 7 ? 15 : v.ageHours <= 24 * 30 ? 4 : 0;
    v.viralScore = Math.round(Math.min(100, velScore + recencyBoost));
  }
  return enriched.sort((a, b) => b.viralScore - a.viralScore);
}

/**
 * Label the top risers with what public data says is driving them (thumbnail vs
 * tags vs title vs channel). One batched channels.list call for the whole board.
 */
async function attachWhy(
  risers: TrendingVideo[],
  tagsOf: Map<string, string[]>,
  demandTags: string[],
  channelIdOf: Map<string, string>
): Promise<void> {
  if (risers.length === 0) return;
  const stats = await apiChannelStats(risers.map((v) => channelIdOf.get(v.videoId) ?? ""));

  const velocities = risers.map((v) => v.velocity).sort((a, b) => a - b);
  const boardVelocity = velocities[Math.floor(velocities.length / 2)] ?? 0;

  for (const v of risers) {
    const ch = stats.get(channelIdOf.get(v.videoId) ?? "");
    v.why = explainVideo({
      velocity: v.velocity,
      boardVelocity,
      views: v.views,
      tags: tagsOf.get(v.videoId) ?? [],
      demandTags,
      title: v.title,
      topKeyword: demandTags[0] ?? "",
      channelSubscribers: ch?.subscribers ?? 0,
      channelAvgViews: ch && ch.videoCount > 0 ? Math.round(ch.views / ch.videoCount) : 0,
    });
  }
}

function extractHashtags(titles: string[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const t of titles) {
    const tags = t.match(/#[\p{L}\p{N}_]+/gu) ?? [];
    for (const tag of tags) {
      const norm = tag.toLowerCase();
      counts.set(norm, (counts.get(norm) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

/* ------------------------------- relevance -------------------------------- */

/** Same-meaning spellings a category word shows up as in titles and tags. */
const TOPIC_ALIASES: Record<string, string[]> = {
  bhajan: ["भजन", "bhakti", "भक्ति", "aarti", "आरती", "kirtan", "कीर्तन", "devotional", "bhajans"],
  devotional: ["bhajan", "भजन", "bhakti", "भक्ति", "aarti", "आरती", "kirtan", "कीर्तन"],
  haryanvi: ["हरियाणवी", "haryanavi", "hariyanvi", "हरयाणवी"],
  rajasthani: ["राजस्थानी", "marwadi", "मारवाड़ी", "marwari", "rajsthani"],
  rasiya: ["रसिया", "rashiya"],
  gurjar: ["गुर्जर", "gujjar", "गूजर"],
  remix: ["dj", "डीजे", "remixes"],
};

/** Uploads a music board should never show even when the title name-drops it. */
const NOT_MUSIC =
  /short\s*film|comedy|कॉमेडी|web\s*series|\bnews\b|न्यूज़|vlog|podcast|prank|natak|नाटक|movie|फिल्म|interview/i;
const MUSIC_QUERY = /song|music|bhajan|rasiya|remix|dj|gana|geet|kirtan|aarti/i;

/**
 * Keep only videos that are really about the category: the title, channel or
 * the video's own tags must carry one of the query's topic words (or a known
 * spelling of it). Falls back to the unfiltered list when that leaves the board
 * nearly empty, so a niche category still shows something.
 */
function onCategory(
  query: string,
  videos: VideoLite[],
  tagsOf: Map<string, string[]>
): VideoLite[] {
  const words = topicWords(query);
  const needles = new Set<string>();
  for (const w of words) {
    needles.add(w);
    for (const a of TOPIC_ALIASES[w] ?? []) needles.add(a.toLowerCase());
  }
  const music = MUSIC_QUERY.test(query);
  const keep = videos.filter((v) => {
    const hay = `${v.title} ${v.channel} ${(tagsOf.get(v.videoId) ?? []).join(" ")}`.toLowerCase();
    if (music && NOT_MUSIC.test(v.title)) return false;
    return needles.size === 0 || [...needles].some((n) => hay.includes(n));
  });
  return keep.length >= 10 ? keep : videos;
}

/**
 * The same song re-uploaded by several channels (or as a dozen Shorts) would
 * fill the top of the board with one hit. Keep its best-scoring upload only.
 */
function oneUploadPerSong(videos: TrendingVideo[]): TrendingVideo[] {
  const seen = new Set<string>();
  const out = videos.filter((v) => {
    const key = v.title
      .toLowerCase()
      .replace(/#[\p{L}\p{N}_]+/gu, " ")
      .split(/[|•\-–(\[]/)[0]
      .replace(/[^\p{L}\p{N}\p{M}\s]/gu, " ")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 4)
      .join(" ");
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return out.length >= 12 ? out : videos;
}

/* ------------------------------- refresh ---------------------------------- */

async function computeSnapshot(
  categoryId: string,
  label: string,
  query: string
): Promise<TrendingSnapshot> {
  // Ask YouTube for *recent* uploads only so the board moves every day instead
  // of pinning one old hit forever. Three windows keep a category board dozens
  // of videos deep rather than a handful.
  const [today, thisWeek, thisMonth] = await Promise.all([
    searchVideos(query, "en", "IN", 50, { recentDays: 1 }),
    searchVideos(query, "en", "IN", 50, { recentDays: 7 }),
    searchVideos(query, "en", "IN", 50, { recentDays: 30 }),
  ]);
  const byId = new Map<string, VideoLite>();
  for (const v of [...today, ...thisWeek, ...thisMonth]) {
    if (!byId.has(v.videoId)) byId.set(v.videoId, v);
  }
  let videos = [...byId.values()];
  // Nothing recent found (blocked scrape / niche query) — fall back to all-time.
  if (videos.length === 0) videos = await searchVideos(query, "en", "IN", 50);

  // Fresh, accurate view counts from the official API (cheap, one batched call).
  const channelIdOf = new Map<string, string>();
  const tagsOf = new Map<string, string[]>();
  if (hasYouTubeApiKey()) {
    const details = await fetchVideoDetails(videos.map((v) => v.videoId));
    for (const v of videos) {
      const d = details.get(v.videoId);
      if (d && d.views > 0) v.views = d.views;
      if (d?.publishedAt) v.publishedText = isoAge(d.publishedAt);
      if (d?.channelId) channelIdOf.set(v.videoId, d.channelId);
      if (d?.tags?.length) tagsOf.set(v.videoId, d.tags);
    }
  }
  videos = onCategory(query, videos, tagsOf);
  // Keep a board even when everything found is older than the trend window.
  const recent = toTrending(videos);
  const trending = oneUploadPerSong(recent.length > 0 ? recent : toTrending(videos, 3650));
  // Every video on the board gets a "why viral" label, not just the top few.
  const risers = trending.slice(0, 24);

  // Why-viral: aggregate real tags across the fastest-rising videos.
  const tagCounts = new Map<string, number>();
  await Promise.all(
    risers.map(async (v, i) => {
      const tags = tagsOf.get(v.videoId) ?? (i < 8 ? await getVideoTags(v.videoId) : []);
      tagsOf.set(v.videoId, tags);
      if (i >= 8) return;
      for (const tag of tags.slice(0, 30)) {
        const norm = tag.toLowerCase().trim();
        if (norm && !DEFAULT_YT_TAGS.has(norm)) {
          tagCounts.set(norm, (tagCounts.get(norm) ?? 0) + 1);
        }
      }
    })
  );
  const topTags = [...tagCounts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 25);

  await attachWhy(risers, tagsOf, topTags.map((t) => t.tag), channelIdOf);

  const titles = risers.slice(0, 8).map((v) => v.title);
  const topHashtags = extractHashtags(titles).slice(0, 15);
  const titleWords = titleKeywordCounts(titles).slice(0, 12);

  // If titles carried no hashtags, synthesize suggestions from common words.
  const hashtags =
    topHashtags.length > 0
      ? topHashtags
      : generateHashtags(query, titleWords.map((w) => w.word), 12).map((tag) => ({
          tag,
          count: 0,
        }));

  const top = risers[0];
  const sharedTag = topTags[0]?.tag;
  const sharedWord = titleWords[0]?.word;
  const recommendation = top
    ? `Right now "${top.title}" is rising fastest (~${Math.round(
        top.velocity
      ).toLocaleString()} views/hr). Winning videos commonly use the tag "${
        sharedTag ?? query
      }" and the word "${sharedWord ?? query}" in the title. Add these tags + the top hashtags to ride the trend.`
    : `Not enough data yet for "${label}". Try refreshing again shortly.`;

  return {
    categoryId,
    label,
    query,
    updatedAt: new Date().toISOString(),
    videos: trending.slice(0, 60),
    insight: {
      topTags,
      topHashtags: hashtags,
      titleWords,
      recommendation,
    },
  };
}

export async function refreshCategory(cat: TrackedCategory): Promise<TrendingSnapshot> {
  const snapshot = await computeSnapshot(cat.id, cat.label, cat.query);
  await store.set(`trending:${cat.id}`, snapshot);
  return snapshot;
}

const CHANNEL_REF = /youtube\.com\/(channel\/|@|c\/|user\/)|^UC[\w-]{22}$|^@/;

/**
 * Ad-hoc trend search for anything typed: category, singer, artist, song title
 * or a channel link. Adds what's trending for *related* searches and for the
 * competitor channels ranking on the same query, so a singer's whole space is
 * visible at once. Not stored — always computed live.
 */
export async function searchTrending(query: string): Promise<TrendingSnapshot> {
  const raw = query.trim();
  let q = raw;
  let label = raw;

  // A channel link/handle: trend on the channel's own name instead of the URL.
  if (CHANNEL_REF.test(raw) && hasYouTubeApiKey()) {
    const ch = await apiGetChannel(raw);
    if (ch?.title) {
      q = ch.title;
      label = ch.title;
    }
  }

  const base = await computeSnapshot(`adhoc:${q.toLowerCase()}`, label, q);

  const [related, competitors] = await Promise.all([
    relatedTrends(q),
    competitorTrends(base.videos),
  ]);
  return { ...base, related, competitors };
}

/** What's trending for the nearest real searches around this query. */
async function relatedTrends(query: string): Promise<RelatedTrend[]> {
  const keywords = (await expandKeywords(query, "hi", "IN"))
    .filter((k) => k.toLowerCase() !== query.toLowerCase())
    .slice(0, 3);

  const out = await Promise.all(
    keywords.map(async (k) => {
      const vids = await searchVideos(k, "en", "IN", 10, { recentDays: 30 });
      return { query: k, videos: toTrending(vids).slice(0, 4) };
    })
  );
  return out.filter((r) => r.videos.length > 0);
}

/** The channels competing on this query, each with its best current upload. */
function competitorTrends(videos: TrendingVideo[]): CompetitorTrend[] {
  const byChannel = new Map<string, TrendingVideo[]>();
  for (const v of videos) {
    if (!v.channel) continue;
    const list = byChannel.get(v.channel) ?? [];
    if (list.length < 2) list.push(v);
    byChannel.set(v.channel, list);
  }
  return [...byChannel.entries()]
    .map(([channel, vids]) => ({ channel, videos: vids }))
    .sort((a, b) => b.videos[0].viralScore - a.videos[0].viralScore)
    .slice(0, 6);
}

export async function refreshAll(): Promise<{ refreshed: number }> {
  const cats = await listCategories();
  let refreshed = 0;
  for (const cat of cats) {
    try {
      await refreshCategory(cat);
      refreshed += 1;
    } catch {
      /* keep going */
    }
  }
  return { refreshed };
}

export async function getSnapshot(categoryId: string): Promise<TrendingSnapshot | null> {
  return store.get<TrendingSnapshot>(`trending:${categoryId}`);
}

export async function getAllSnapshots(): Promise<TrendingSnapshot[]> {
  const snaps = await store.list<TrendingSnapshot>("trending:");
  return snaps.sort((a, b) => a.label.localeCompare(b.label));
}

function isStale(snap: TrendingSnapshot | null): boolean {
  if (!snap) return true;
  const at = Date.parse(snap.updatedAt);
  return Number.isNaN(at) || Date.now() - at > SNAPSHOT_TTL_MS;
}

/**
 * Snapshots for every tracked category, recomputing any that are missing or
 * older than the TTL. Keeps the board fresh without a cron job while staying
 * inside the daily API quota.
 */
export async function getFreshSnapshots(): Promise<TrendingSnapshot[]> {
  const cats = await listCategories();
  const out: TrendingSnapshot[] = [];
  for (const cat of cats) {
    const existing = await getSnapshot(cat.id);
    if (!isStale(existing)) {
      out.push(existing!);
      continue;
    }
    try {
      out.push(await refreshCategory(cat));
    } catch {
      if (existing) out.push(existing);
    }
  }
  return dedupeAcrossBoards(out.sort((a, b) => a.label.localeCompare(b.label)));
}

/**
 * Overlapping categories ("Haryanvi Music" vs "Haryanvi DJ Remix") would show
 * the same hit on every board. Show each video only on the board where it
 * scores best, as long as every board keeps a useful depth.
 */
function dedupeAcrossBoards(snaps: TrendingSnapshot[]): TrendingSnapshot[] {
  const home = new Map<string, { idx: number; score: number }>();
  snaps.forEach((s, idx) => {
    for (const v of s.videos) {
      const prev = home.get(v.videoId);
      if (!prev || v.viralScore > prev.score) home.set(v.videoId, { idx, score: v.viralScore });
    }
  });
  return snaps.map((s, idx) => {
    const own = s.videos.filter((v) => home.get(v.videoId)?.idx === idx);
    return own.length >= 12 ? { ...s, videos: own } : s;
  });
}
