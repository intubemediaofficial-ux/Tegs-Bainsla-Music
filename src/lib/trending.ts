import { randomUUID } from "crypto";
import { store } from "./store";
import {
  ageTextToHours,
  getVideoTags,
  searchVideos,
  generateHashtags,
  titleKeywordCounts,
  DEFAULT_YT_TAGS,
} from "./youtube";
import { hasYouTubeApiKey, fetchVideoDetails } from "./youtube-api";
import type {
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
];

/* ----------------------------- categories CRUD ---------------------------- */

export async function listCategories(): Promise<TrackedCategory[]> {
  let cats = await store.list<TrackedCategory>("category:");
  if (cats.length === 0) {
    cats = [];
    for (const c of DEFAULT_CATEGORIES) {
      const cat: TrackedCategory = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        ...c,
      };
      await store.set(`category:${cat.id}`, cat);
      cats.push(cat);
    }
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

function toTrending(videos: VideoLite[]): TrendingVideo[] {
  const enriched = videos.map((v) => {
    const ageHours = ageTextToHours(v.publishedText);
    const velocity = v.views / ageHours;
    return { ...v, ageHours, velocity, viralScore: 0 };
  });
  const maxVel = Math.max(1, ...enriched.map((v) => v.velocity));
  for (const v of enriched) {
    // Blend raw velocity (log-scaled) with recency: newer + faster = more viral.
    const velScore = Math.min(100, (Math.log10(v.velocity + 1) / Math.log10(maxVel + 1)) * 100);
    const recencyBoost = v.ageHours <= 24 * 7 ? 15 : v.ageHours <= 24 * 30 ? 5 : 0;
    v.viralScore = Math.round(Math.min(100, velScore + recencyBoost));
  }
  return enriched.sort((a, b) => b.viralScore - a.viralScore);
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

/* ------------------------------- refresh ---------------------------------- */

export async function refreshCategory(cat: TrackedCategory): Promise<TrendingSnapshot> {
  const videos = await searchVideos(cat.query, "en", "IN", 25);
  // Fresh, accurate view counts from the official API (cheap, one batched call).
  if (hasYouTubeApiKey()) {
    const details = await fetchVideoDetails(videos.map((v) => v.videoId));
    for (const v of videos) {
      const d = details.get(v.videoId);
      if (d && d.views > 0) v.views = d.views;
    }
  }
  const trending = toTrending(videos);
  const risers = trending.slice(0, 8);

  // Why-viral: aggregate real tags across the fastest-rising videos.
  const tagCounts = new Map<string, number>();
  await Promise.all(
    risers.map(async (v) => {
      const tags = await getVideoTags(v.videoId);
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

  const titles = risers.map((v) => v.title);
  const topHashtags = extractHashtags(titles).slice(0, 15);
  const titleWords = titleKeywordCounts(titles).slice(0, 12);

  // If titles carried no hashtags, synthesize suggestions from common words.
  const hashtags =
    topHashtags.length > 0
      ? topHashtags
      : generateHashtags(cat.query, titleWords.map((w) => w.word), 12).map((tag) => ({
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
        sharedTag ?? cat.query
      }" and the word "${sharedWord ?? cat.query}" in the title. Add these tags + the top hashtags to ride the trend.`
    : `Not enough data yet for "${cat.label}". Try refreshing again shortly.`;

  const snapshot: TrendingSnapshot = {
    categoryId: cat.id,
    label: cat.label,
    query: cat.query,
    updatedAt: new Date().toISOString(),
    videos: trending.slice(0, 20),
    insight: {
      topTags,
      topHashtags: hashtags,
      titleWords,
      recommendation,
    },
  };
  await store.set(`trending:${cat.id}`, snapshot);
  return snapshot;
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
