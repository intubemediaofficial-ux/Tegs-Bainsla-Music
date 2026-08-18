import {
  cleanTags,
  rankTags,
  seedFromTitle,
  generateHashtags,
  ageTextToHours,
  DEFAULT_YT_TAGS,
  type TagRanking,
} from "./youtube";
import {
  fetchVideoDetails,
  apiGetChannel,
  apiChannelUploads,
  isoToAgeText,
  hasYouTubeApiKey,
} from "./youtube-api";
import { explainVideo, type ViralWhy } from "./why-viral";
import { ownerVideoStats, ownsChannel, type OwnerVideoStats } from "./yt-analytics";
import { trackVideo, type VideoPulse } from "./pulse";
import { scoreTitle } from "./scoring";

/**
 * Everything the extension overlay shows for the video currently open, in one
 * request: public counters, the measured 60-minute / 48-hour pulse, the video's
 * real tags ranked against live search demand, and how the channel is doing.
 */

export interface ReportVideo {
  videoId: string;
  title: string;
  channel: string;
  channelId: string;
  publishedText: string;
  ageHours: number;
  views: number;
  likes: number;
  comments: number;
  /** Percentages of views, rounded to 2 decimals. */
  likeRate: number;
  commentRate: number;
  durationText: string;
  thumbnail: string;
  description: string;
  titleScore: number;
  titleTips: string[];
  hashtagsUsed: string[];
}

export interface ReportChannel {
  channelId: string;
  title: string;
  thumbnail: string;
  subscribers: number;
  views: number;
  videoCount: number;
  avgViews: number;
  keywords: string[];
  /** Uploads per week over the recent uploads we could see. */
  uploadsPerWeek: number;
  recent: {
    videoId: string;
    title: string;
    views: number;
    publishedText: string;
    ageHours: number;
    vph: number;
    thumbnail: string;
    url: string;
  }[];
}

export interface VideoReport {
  video: ReportVideo;
  pulse: VideoPulse;
  tags: {
    all: string[];
    onlyDefault: boolean;
    hidden: boolean;
    tagBoxChars: number;
  } & TagRanking;
  hashtagIdeas: string[];
  channel: ReportChannel | null;
  why: ViralWhy | null;
  /**
   * Official owner-only metrics — traffic sources, retention, subscribers
   * gained. Present only when the caller connected this very channel.
   */
  owner: OwnerVideoStats | null;
}

function durationText(iso: string): string {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return "";
  const h = Number(m[1] ?? 0);
  const min = Number(m[2] ?? 0);
  const s = Number(m[3] ?? 0);
  const two = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(min)}:${two(s)}` : `${min}:${two(s)}`;
}

function hoursSince(iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  return Math.max(0.1, (Date.now() - t) / 3600_000);
}

function rate(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 10000) / 100;
}

function hashtagsIn(text: string): string[] {
  const found = text.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const h of found) {
    const norm = h.toLowerCase();
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(h);
  }
  return out.slice(0, 15);
}

export function parseVideoId(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m?.[1] ?? null;
}

/**
 * Full report for one video, sampling its counters into the pulse history.
 * Pass `userId` to also attach official analytics when the video belongs to
 * that user's connected channel.
 */
export async function buildVideoReport(
  videoId: string,
  userId?: string
): Promise<VideoReport> {
  if (!hasYouTubeApiKey()) throw new Error("YouTube API key is not configured on the server");

  const details = await fetchVideoDetails([videoId]);
  const d = details.get(videoId);
  if (!d) throw new Error("Video not found");

  const ageHours = hoursSince(d.publishedAt);
  const pulse = await trackVideo(
    videoId,
    { views: d.views, likes: d.likes, comments: d.comments },
    ageHours
  );

  const tags = cleanTags(d.tags);
  const onlyDefault =
    d.tags.length > 0 && d.tags.every((t) => DEFAULT_YT_TAGS.has(t.toLowerCase().trim()));
  const seed = (seedFromTitle(d.title) || d.title).trim();
  const ranking: TagRanking = seed
    ? await rankTags(tags, seed)
    : { trending: [], notTrending: tags, suggestions: [] };

  const channelInfo = d.channelId ? await apiGetChannel(d.channelId) : null;
  let channel: ReportChannel | null = null;
  if (channelInfo) {
    const uploads = await apiChannelUploads(channelInfo.uploadsPlaylistId, 8);
    const recent = uploads.map((u) => {
      const hours = Math.max(0.1, ageTextToHours(u.publishedText));
      return {
        videoId: u.videoId,
        title: u.title,
        views: u.views,
        publishedText: u.publishedText,
        ageHours: Math.round(hours),
        vph: Math.round(u.views / hours),
        thumbnail: u.thumbnail,
        url: u.url,
      };
    });
    const spanHours = recent.length > 1 ? Math.max(...recent.map((r) => r.ageHours)) : 0;
    channel = {
      channelId: channelInfo.channelId,
      title: channelInfo.title,
      thumbnail: channelInfo.thumbnail,
      subscribers: channelInfo.subscribers,
      views: channelInfo.views,
      videoCount: channelInfo.videoCount,
      avgViews:
        channelInfo.videoCount > 0
          ? Math.round(channelInfo.views / channelInfo.videoCount)
          : 0,
      keywords: channelInfo.keywords,
      uploadsPerWeek:
        spanHours > 0 ? Math.round(((recent.length - 1) / (spanHours / 168)) * 10) / 10 : 0,
      recent,
    };
  }

  const demandTags = ranking.trending
    .map((t) => t.tag)
    .concat(ranking.suggestions.map((s) => s.tag));
  const why = explainVideo({
    velocity: pulse.currentVph,
    boardVelocity:
      channel && channel.recent.length > 0
        ? median(channel.recent.map((r) => r.vph))
        : pulse.lifetimeVph,
    views: d.views,
    tags,
    demandTags,
    title: d.title,
    topKeyword: ranking.trending[0]?.tag ?? ranking.suggestions[0]?.tag ?? "",
    channelSubscribers: channel?.subscribers ?? 0,
    channelAvgViews: channel?.avgViews ?? 0,
  });

  const scored = scoreTitle(d.title, seed);

  let owner: OwnerVideoStats | null = null;
  if (userId && d.channelId && (await ownsChannel(userId, d.channelId))) {
    owner = await ownerVideoStats(userId, videoId).catch(() => null);
  }

  return {
    video: {
      videoId,
      title: d.title,
      channel: d.channel,
      channelId: d.channelId,
      publishedText: isoToAgeText(d.publishedAt),
      ageHours: Math.round(ageHours),
      views: d.views,
      likes: d.likes,
      comments: d.comments,
      likeRate: rate(d.likes, d.views),
      commentRate: rate(d.comments, d.views),
      durationText: durationText(d.duration),
      thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
      description: d.description,
      titleScore: scored.score,
      titleTips: scored.reasons,
      hashtagsUsed: hashtagsIn(`${d.title} ${d.description}`),
    },
    pulse,
    tags: {
      all: tags,
      onlyDefault,
      hidden: d.tags.length === 0,
      tagBoxChars: tags.join(", ").length,
      ...ranking,
    },
    hashtagIdeas: generateHashtags(seed, demandTags, 15),
    channel,
    why,
    owner,
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
