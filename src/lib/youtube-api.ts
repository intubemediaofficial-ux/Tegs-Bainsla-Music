/**
 * Optional YouTube Data API v3 layer. When YOUTUBE_API_KEY is set we use the
 * official API to fetch *fresh, accurate* video stats and real tags, and to
 * search playlists. Public-page scraping stays as the free fallback and still
 * provides the ranking ORDER (search.list would burn 100 quota units per call),
 * so we only spend the cheap 1-unit videos.list / playlists.list calls here.
 */

const KEY = process.env.YOUTUBE_API_KEY?.trim();
const API = "https://www.googleapis.com/youtube/v3";

export function hasYouTubeApiKey(): boolean {
  return !!KEY;
}

export interface ApiVideoDetail {
  views: number;
  tags: string[];
  title: string;
  channel: string;
  publishedAt: string;
}

interface VideosListResponse {
  items?: {
    id?: string;
    snippet?: {
      title?: string;
      channelTitle?: string;
      publishedAt?: string;
      tags?: string[];
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
