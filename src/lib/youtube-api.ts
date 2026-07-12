/**
 * Optional YouTube Data API v3 layer. When YOUTUBE_API_KEY is set we use the
 * official API to fetch *fresh, accurate* video stats and real tags, and to
 * search videos/playlists. Public-page scraping is tried first (free) and the
 * API search (100 quota units/call) is used only as a fallback when scraping
 * returns nothing — e.g. datacenter IPs that YouTube blocks. Enrichment via
 * videos.list / playlists.list is cheap (1 unit, batched by 50).
 */

import type { VideoLite, PlaylistLite } from "./types";

const KEY = process.env.YOUTUBE_API_KEY?.trim();
const API = "https://www.googleapis.com/youtube/v3";

export function hasYouTubeApiKey(): boolean {
  return !!KEY;
}

/** Turn an ISO publish date into a "3 days ago" style string (for velocity calc). */
function isoToAgeText(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const hours = Math.max(1, Math.round((Date.now() - then) / 3_600_000));
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.round(days / 7)} weeks ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  return `${Math.round(days / 365)} years ago`;
}

function pickThumb(thumbs?: Record<string, { url?: string }>): string {
  if (!thumbs) return "";
  return (
    thumbs.maxres?.url ||
    thumbs.standard?.url ||
    thumbs.high?.url ||
    thumbs.medium?.url ||
    thumbs.default?.url ||
    ""
  );
}

interface SearchListResponse {
  items?: {
    id?: { videoId?: string; playlistId?: string };
    snippet?: {
      title?: string;
      channelTitle?: string;
      publishedAt?: string;
      thumbnails?: Record<string, { url?: string }>;
    };
  }[];
}

interface PlaylistsListResponse {
  items?: { id?: string; contentDetails?: { itemCount?: number } }[];
}

/**
 * Official search for videos (search.list = 100 quota units) + one batched
 * videos.list for accurate view counts. Used as a fallback when public scraping
 * is blocked (e.g. datacenter IPs). Returns [] on missing key / API error.
 */
export async function apiSearchVideos(
  query: string,
  gl = "IN",
  limit = 20
): Promise<VideoLite[]> {
  if (!KEY) return [];
  const url =
    `${API}/search?part=snippet&type=video&maxResults=${Math.min(limit, 50)}` +
    `&regionCode=${encodeURIComponent(gl)}&q=${encodeURIComponent(query)}&key=${KEY}`;
  let data: SearchListResponse;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    data = (await res.json()) as SearchListResponse;
  } catch {
    return [];
  }
  const items = (data.items ?? []).filter((i) => i.id?.videoId);
  const ids = items.map((i) => i.id!.videoId!);
  const details = await fetchVideoDetails(ids);
  return items.map((i) => {
    const id = i.id!.videoId!;
    const d = details.get(id);
    return {
      videoId: id,
      title: d?.title || i.snippet?.title || "",
      channel: d?.channel || i.snippet?.channelTitle || "",
      views: d?.views ?? 0,
      publishedText: isoToAgeText(d?.publishedAt || i.snippet?.publishedAt || ""),
      thumbnail:
        pickThumb(i.snippet?.thumbnails) || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${id}`,
    };
  });
}

/**
 * Official search for playlists (search.list = 100 units) + one batched
 * playlists.list for accurate video counts. Fallback for blocked scraping.
 */
export async function apiSearchPlaylists(
  query: string,
  gl = "IN",
  limit = 8
): Promise<PlaylistLite[]> {
  if (!KEY) return [];
  const url =
    `${API}/search?part=snippet&type=playlist&maxResults=${Math.min(limit, 50)}` +
    `&regionCode=${encodeURIComponent(gl)}&q=${encodeURIComponent(query)}&key=${KEY}`;
  let data: SearchListResponse;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    data = (await res.json()) as SearchListResponse;
  } catch {
    return [];
  }
  const items = (data.items ?? []).filter((i) => i.id?.playlistId);
  const ids = items.map((i) => i.id!.playlistId!);

  const counts = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    try {
      const res = await fetch(
        `${API}/playlists?part=contentDetails&maxResults=50&id=${chunk.join(",")}&key=${KEY}`,
        { cache: "no-store" }
      );
      if (!res.ok) break;
      const pd = (await res.json()) as PlaylistsListResponse;
      for (const p of pd.items ?? []) {
        if (p.id) counts.set(p.id, p.contentDetails?.itemCount ?? 0);
      }
    } catch {
      break;
    }
  }

  return items.map((i) => {
    const id = i.id!.playlistId!;
    return {
      playlistId: id,
      title: i.snippet?.title || "",
      channel: i.snippet?.channelTitle || "",
      videoCount: counts.get(id) ?? 0,
      thumbnail: pickThumb(i.snippet?.thumbnails),
      url: `https://www.youtube.com/playlist?list=${id}`,
    };
  });
}

export interface ApiVideoDetail {
  views: number;
  tags: string[];
  title: string;
  channel: string;
  publishedAt: string;
  description: string;
}

interface VideosListResponse {
  items?: {
    id?: string;
    snippet?: {
      title?: string;
      channelTitle?: string;
      publishedAt?: string;
      tags?: string[];
      description?: string;
    };
    statistics?: { viewCount?: string };
  }[];
}

/**
 * Accurate stats + real tags for up to any number of video ids (batched by 50,
 * 1 quota unit per batch). Returns an empty map on missing key or API error so
 * callers transparently fall back to scraping.
 */
export async function fetchVideoDetails(
  ids: string[]
): Promise<Map<string, ApiVideoDetail>> {
  const out = new Map<string, ApiVideoDetail>();
  if (!KEY || ids.length === 0) return out;

  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const url =
      `${API}/videos?part=snippet,statistics&maxResults=50` +
      `&id=${chunk.join(",")}&key=${KEY}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) break;
      const data = (await res.json()) as VideosListResponse;
      for (const item of data.items ?? []) {
        if (!item.id) continue;
        out.set(item.id, {
          views: Number(item.statistics?.viewCount ?? 0),
          tags: item.snippet?.tags ?? [],
          title: item.snippet?.title ?? "",
          channel: item.snippet?.channelTitle ?? "",
          publishedAt: item.snippet?.publishedAt ?? "",
          description: item.snippet?.description ?? "",
        });
      }
    } catch {
      break;
    }
  }
  return out;
}

/** Real tags for a single video via the API (empty on missing key / no tags). */
export async function fetchVideoTags(videoId: string): Promise<string[]> {
  const map = await fetchVideoDetails([videoId]);
  return map.get(videoId)?.tags ?? [];
}
