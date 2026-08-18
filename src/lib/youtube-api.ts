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
export function isoToAgeText(iso: string): string {
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
  limit = 20,
  opts: { publishedAfterDays?: number; order?: "relevance" | "viewCount" | "date" } = {}
): Promise<VideoLite[]> {
  if (!KEY) return [];
  const since = opts.publishedAfterDays
    ? `&publishedAfter=${new Date(
        Date.now() - opts.publishedAfterDays * 86_400_000
      ).toISOString()}`
    : "";
  const order = opts.order ? `&order=${opts.order}` : "";
  const url =
    `${API}/search?part=snippet&type=video&maxResults=${Math.min(limit, 50)}` +
    `&regionCode=${encodeURIComponent(gl)}&q=${encodeURIComponent(query)}` +
    `${since}${order}&key=${KEY}`;
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
  likes: number;
  comments: number;
  tags: string[];
  title: string;
  channel: string;
  channelId: string;
  publishedAt: string;
  description: string;
  /** ISO-8601 duration as returned by the API, e.g. "PT3M42S". */
  duration: string;
  categoryId: string;
}

interface VideosListResponse {
  items?: {
    id?: string;
    snippet?: {
      title?: string;
      channelTitle?: string;
      channelId?: string;
      publishedAt?: string;
      tags?: string[];
      description?: string;
      categoryId?: string;
    };
    statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
    contentDetails?: { duration?: string };
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
      `${API}/videos?part=snippet,statistics,contentDetails&maxResults=50` +
      `&id=${chunk.join(",")}&key=${KEY}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) break;
      const data = (await res.json()) as VideosListResponse;
      for (const item of data.items ?? []) {
        if (!item.id) continue;
        out.set(item.id, {
          views: Number(item.statistics?.viewCount ?? 0),
          likes: Number(item.statistics?.likeCount ?? 0),
          comments: Number(item.statistics?.commentCount ?? 0),
          tags: item.snippet?.tags ?? [],
          title: item.snippet?.title ?? "",
          channel: item.snippet?.channelTitle ?? "",
          channelId: item.snippet?.channelId ?? "",
          publishedAt: item.snippet?.publishedAt ?? "",
          description: item.snippet?.description ?? "",
          duration: item.contentDetails?.duration ?? "",
          categoryId: item.snippet?.categoryId ?? "",
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

/* ------------------------------- channels --------------------------------- */

export interface ApiChannel {
  channelId: string;
  title: string;
  description: string;
  thumbnail: string;
  subscribers: number;
  videoCount: number;
  views: number;
  /** Channel-level keywords (the "channel tags" set in YouTube Studio). */
  keywords: string[];
  uploadsPlaylistId: string;
}

interface ChannelsListResponse {
  items?: {
    id?: string;
    snippet?: {
      title?: string;
      description?: string;
      thumbnails?: Record<string, { url?: string }>;
    };
    statistics?: { subscriberCount?: string; videoCount?: string; viewCount?: string };
    brandingSettings?: { channel?: { keywords?: string } };
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
  }[];
}

interface PlaylistItemsResponse {
  items?: { contentDetails?: { videoId?: string } }[];
  nextPageToken?: string;
}

export interface ApiChannelStats {
  subscribers: number;
  views: number;
  videoCount: number;
}

/**
 * Subscriber/view totals for many channels at once (batched by 50, 1 quota unit
 * per batch) — used to tell an audience-driven hit from a discovery-driven one.
 */
export async function apiChannelStats(
  channelIds: string[]
): Promise<Map<string, ApiChannelStats>> {
  const out = new Map<string, ApiChannelStats>();
  const ids = [...new Set(channelIds.filter(Boolean))];
  if (!KEY || ids.length === 0) return out;

  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    try {
      const res = await fetch(
        `${API}/channels?part=statistics&maxResults=50&id=${chunk.join(",")}&key=${KEY}`,
        { cache: "no-store" }
      );
      if (!res.ok) break;
      const data = (await res.json()) as ChannelsListResponse;
      for (const item of data.items ?? []) {
        if (!item.id) continue;
        out.set(item.id, {
          subscribers: Number(item.statistics?.subscriberCount ?? 0),
          views: Number(item.statistics?.viewCount ?? 0),
          videoCount: Number(item.statistics?.videoCount ?? 0),
        });
      }
    } catch {
      break;
    }
  }
  return out;
}

/**
 * YouTube keeps channel keywords as one space-separated string where multi-word
 * keywords are double-quoted: `bhajan "krishna bhajan" "new song 2026"`.
 */
export function parseChannelKeywords(raw: string): string[] {
  const out: string[] = [];
  const re = /"([^"]+)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const v = (m[1] ?? m[2] ?? "").trim();
    if (v) out.push(v);
  }
  return out;
}

function parseChannelRef(raw: string): { id?: string; handle?: string; search?: string } {
  const s = raw.trim();
  if (/^UC[\w-]{22}$/.test(s)) return { id: s };
  if (s.startsWith("@")) return { handle: s.slice(1) };

  const idMatch = s.match(/channel\/(UC[\w-]{22})/);
  if (idMatch) return { id: idMatch[1] };
  const handleMatch = s.match(/youtube\.com\/@([^/?&#]+)/);
  if (handleMatch) return { handle: decodeURIComponent(handleMatch[1]) };
  const legacy = s.match(/youtube\.com\/(?:c|user)\/([^/?&#]+)/);
  if (legacy) return { search: decodeURIComponent(legacy[1]) };
  return { search: s };
}

function mapChannel(item: NonNullable<ChannelsListResponse["items"]>[number]): ApiChannel {
  return {
    channelId: item.id ?? "",
    title: item.snippet?.title ?? "",
    description: item.snippet?.description ?? "",
    thumbnail: pickThumb(item.snippet?.thumbnails),
    subscribers: Number(item.statistics?.subscriberCount ?? 0),
    videoCount: Number(item.statistics?.videoCount ?? 0),
    views: Number(item.statistics?.viewCount ?? 0),
    keywords: parseChannelKeywords(item.brandingSettings?.channel?.keywords ?? ""),
    uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads ?? "",
  };
}

const CHANNEL_PARTS = "snippet,statistics,brandingSettings,contentDetails";

/**
 * Resolve a channel URL / @handle / UC id to its public profile *and* its
 * channel keywords. Tries channels.list by id (1 unit), then by handle (1 unit),
 * then falls back to search.list (100 units) for old /c/ and /user/ URLs.
 */
export async function apiGetChannel(ref: string): Promise<ApiChannel | null> {
  if (!KEY) return null;
  const { id, handle, search } = parseChannelRef(ref);

  const byUrl = async (qs: string): Promise<ApiChannel | null> => {
    try {
      const res = await fetch(`${API}/channels?part=${CHANNEL_PARTS}&${qs}&key=${KEY}`, {
        cache: "no-store",
      });
      if (!res.ok) return null;
      const data = (await res.json()) as ChannelsListResponse;
      const item = data.items?.[0];
      return item ? mapChannel(item) : null;
    } catch {
      return null;
    }
  };

  if (id) return byUrl(`id=${encodeURIComponent(id)}`);
  if (handle) {
    const found = await byUrl(`forHandle=${encodeURIComponent(handle)}`);
    if (found) return found;
  }

  const term = search ?? handle ?? "";
  if (!term) return null;
  try {
    const res = await fetch(
      `${API}/search?part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(term)}&key=${KEY}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as SearchListResponse & {
      items?: { id?: { channelId?: string } }[];
    };
    const cid = data.items?.[0]?.id?.channelId;
    return cid ? byUrl(`id=${encodeURIComponent(cid)}`) : null;
  } catch {
    return null;
  }
}

/**
 * Latest uploads of a channel via its uploads playlist (1 unit per 50 items)
 * enriched with accurate views — far cheaper than search.list per channel.
 */
export async function apiChannelUploads(
  uploadsPlaylistId: string,
  limit = 30
): Promise<VideoLite[]> {
  if (!KEY || !uploadsPlaylistId) return [];
  const ids: string[] = [];
  let pageToken = "";
  while (ids.length < limit) {
    const url =
      `${API}/playlistItems?part=contentDetails&maxResults=50` +
      `&playlistId=${encodeURIComponent(uploadsPlaylistId)}` +
      `${pageToken ? `&pageToken=${pageToken}` : ""}&key=${KEY}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) break;
      const data = (await res.json()) as PlaylistItemsResponse;
      for (const it of data.items ?? []) {
        const vid = it.contentDetails?.videoId;
        if (vid) ids.push(vid);
      }
      if (!data.nextPageToken) break;
      pageToken = data.nextPageToken;
    } catch {
      break;
    }
  }

  const details = await fetchVideoDetails(ids.slice(0, limit));
  return ids.slice(0, limit).map((id) => {
    const d = details.get(id);
    return {
      videoId: id,
      title: d?.title ?? "",
      channel: d?.channel ?? "",
      views: d?.views ?? 0,
      publishedText: isoToAgeText(d?.publishedAt ?? ""),
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${id}`,
    };
  });
}
