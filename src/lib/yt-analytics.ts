import { accessTokenFor, getConnection } from "./google-oauth";

/**
 * Owner-only analytics for a connected channel (YouTube Analytics API v2).
 *
 * This is the only place in the app with *official* private metrics — watch
 * time, average view percentage, subscribers gained and real traffic sources
 * (search vs suggested vs browse) plus the actual search terms. It works solely
 * for the channel the user connected; every other channel stays public-data
 * only.
 *
 * Note on realtime: the Analytics API has no 60-minute report (that lives in
 * Studio) and its daily rows lag a few hours, so the minute-level pulse still
 * comes from `pulse.ts` sampling. What this adds is *why* the views arrived.
 */

const BASE = "https://youtubeanalytics.googleapis.com/v2/reports";

interface QueryResponse {
  columnHeaders?: { name?: string }[];
  rows?: (string | number)[][];
  error?: { message?: string };
}

interface QueryOptions {
  metrics: string;
  dimensions?: string;
  filters?: string;
  sort?: string;
  maxResults?: number;
  startDate: string;
  endDate: string;
}

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function daysAgo(days: number): string {
  return ymd(new Date(Date.now() - days * 86400_000));
}

export function today(): string {
  return ymd(new Date());
}

async function query(
  token: string,
  channelId: string,
  opts: QueryOptions
): Promise<{ headers: string[]; rows: (string | number)[][] }> {
  const params = new URLSearchParams({
    ids: `channel==${channelId}`,
    startDate: opts.startDate,
    endDate: opts.endDate,
    metrics: opts.metrics,
  });
  if (opts.dimensions) params.set("dimensions", opts.dimensions);
  if (opts.filters) params.set("filters", opts.filters);
  if (opts.sort) params.set("sort", opts.sort);
  if (opts.maxResults) params.set("maxResults", String(opts.maxResults));

  const res = await fetch(`${BASE}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = (await res.json()) as QueryResponse;
  if (!res.ok) throw new Error(data.error?.message || `Analytics request failed (${res.status})`);
  return {
    headers: (data.columnHeaders ?? []).map((h) => h.name ?? ""),
    rows: data.rows ?? [],
  };
}

export interface DayPoint {
  day: string;
  views: number;
  minutesWatched: number;
  subscribersGained: number;
}

export interface TrafficSource {
  source: string;
  views: number;
  share: number;
}

export interface OwnerVideoStats {
  videoId: string;
  views: number;
  minutesWatched: number;
  averageViewPercentage: number;
  averageViewDurationSec: number;
  likes: number;
  shares: number;
  subscribersGained: number;
  /** Where the views really came from — official, not an estimate. */
  traffic: TrafficSource[];
  /** Actual YouTube search terms that brought views (top 10). */
  searchTerms: { term: string; views: number }[];
  /** Days covered by the report window. */
  windowDays: number;
}

export interface OwnerChannelStats {
  channelId: string;
  channelTitle: string;
  days: DayPoint[];
  totals: { views: number; minutesWatched: number; subscribersGained: number };
  traffic: TrafficSource[];
  topVideos: { videoId: string; views: number; minutesWatched: number }[];
}

const SOURCE_LABELS: Record<string, string> = {
  YT_SEARCH: "YouTube search",
  RELATED_VIDEO: "Suggested videos",
  BROWSE: "Browse / home",
  PLAYLIST: "Playlists",
  YT_CHANNEL: "Channel page",
  EXT_URL: "External sites",
  NOTIFICATION: "Notifications",
  SHORTS: "Shorts feed",
  SUBSCRIBER: "Subscriptions feed",
  NO_LINK_OTHER: "Direct / unknown",
  NO_LINK_EMBEDDED: "Embedded players",
  ADVERTISING: "Ads",
  HASHTAGS: "Hashtag pages",
  END_SCREEN: "End screens",
  YT_OTHER_PAGE: "Other YouTube pages",
};

function labelSource(raw: string): string {
  return SOURCE_LABELS[raw] ?? raw.replace(/_/g, " ").toLowerCase();
}

function toTraffic(rows: (string | number)[][]): TrafficSource[] {
  const total = rows.reduce((sum, r) => sum + Number(r[1] ?? 0), 0);
  return rows
    .map((r) => ({
      source: labelSource(String(r[0] ?? "")),
      views: Number(r[1] ?? 0),
      share: total > 0 ? Math.round((Number(r[1] ?? 0) / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.views - a.views);
}

/** Is this video on the channel the user connected? */
export async function ownsChannel(userId: string, channelId: string): Promise<boolean> {
  const conn = await getConnection(userId);
  return Boolean(conn && channelId && conn.channelId === channelId);
}

/** Official per-video report for a video on the connected channel. */
export async function ownerVideoStats(
  userId: string,
  videoId: string,
  windowDays = 28
): Promise<OwnerVideoStats | null> {
  const conn = await getConnection(userId);
  const token = await accessTokenFor(userId);
  if (!conn || !token) return null;

  const window = { startDate: daysAgo(windowDays), endDate: today() };
  const filters = `video==${videoId}`;

  const [totals, traffic, terms] = await Promise.all([
    query(token, conn.channelId, {
      ...window,
      filters,
      metrics:
        "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,shares,subscribersGained",
    }),
    query(token, conn.channelId, {
      ...window,
      filters,
      dimensions: "insightTrafficSourceType",
      metrics: "views",
      sort: "-views",
    }),
    query(token, conn.channelId, {
      ...window,
      filters: `${filters};insightTrafficSourceType==YT_SEARCH`,
      dimensions: "insightTrafficSourceDetail",
      metrics: "views",
      sort: "-views",
      maxResults: 10,
    }).catch(() => ({ headers: [], rows: [] })),
  ]);

  const row = totals.rows[0] ?? [];
  const num = (i: number) => Number(row[i] ?? 0);
  return {
    videoId,
    views: num(0),
    minutesWatched: num(1),
    averageViewDurationSec: num(2),
    averageViewPercentage: Math.round(num(3) * 10) / 10,
    likes: num(4),
    shares: num(5),
    subscribersGained: num(6),
    traffic: toTraffic(traffic.rows),
    searchTerms: terms.rows.map((r) => ({ term: String(r[0] ?? ""), views: Number(r[1] ?? 0) })),
    windowDays,
  };
}

/** Official channel dashboard for the connected channel. */
export async function ownerChannelStats(
  userId: string,
  windowDays = 28
): Promise<OwnerChannelStats | null> {
  const conn = await getConnection(userId);
  const token = await accessTokenFor(userId);
  if (!conn || !token) return null;

  const window = { startDate: daysAgo(windowDays), endDate: today() };
  const [daily, traffic, top] = await Promise.all([
    query(token, conn.channelId, {
      ...window,
      dimensions: "day",
      metrics: "views,estimatedMinutesWatched,subscribersGained",
      sort: "day",
    }),
    query(token, conn.channelId, {
      ...window,
      dimensions: "insightTrafficSourceType",
      metrics: "views",
      sort: "-views",
    }),
    query(token, conn.channelId, {
      ...window,
      dimensions: "video",
      metrics: "views,estimatedMinutesWatched",
      sort: "-views",
      maxResults: 10,
    }),
  ]);

  const days: DayPoint[] = daily.rows.map((r) => ({
    day: String(r[0] ?? ""),
    views: Number(r[1] ?? 0),
    minutesWatched: Number(r[2] ?? 0),
    subscribersGained: Number(r[3] ?? 0),
  }));

  return {
    channelId: conn.channelId,
    channelTitle: conn.channelTitle,
    days,
    totals: {
      views: days.reduce((s, d) => s + d.views, 0),
      minutesWatched: days.reduce((s, d) => s + d.minutesWatched, 0),
      subscribersGained: days.reduce((s, d) => s + d.subscribersGained, 0),
    },
    traffic: toTraffic(traffic.rows),
    topVideos: top.rows.map((r) => ({
      videoId: String(r[0] ?? ""),
      views: Number(r[1] ?? 0),
      minutesWatched: Number(r[2] ?? 0),
    })),
  };
}
