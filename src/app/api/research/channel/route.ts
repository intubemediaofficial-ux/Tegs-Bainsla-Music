import { NextRequest } from "next/server";
import { z } from "zod";
import { buildTagString, cleanTags, rankTags, shortSeedOf } from "@/lib/youtube";
import { apiGetChannel, apiChannelUploads, hasYouTubeApiKey } from "@/lib/youtube-api";
import { requireUser, enforceQuota, isResponse, json, error } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({
  channel: z.string().min(1).max(300), // channel URL, @handle or UC… id
});

/**
 * Channel Tags: read a channel's own keywords (the "channel tags" from Studio),
 * rank them against live search demand, and list its latest videos so any one
 * of them can be opened for its own ranked tags.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (isResponse(user)) return user;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return error("channel (url, @handle or id) is required");

  if (!hasYouTubeApiKey()) {
    return error("Channel lookup needs the YouTube API key to be configured", 503);
  }

  const limited = await enforceQuota(user, "research");
  if (limited) return limited;

  try {
    const channel = await apiGetChannel(parsed.data.channel);
    if (!channel) return error("Could not find that channel — check the link");

    const keywords = cleanTags(channel.keywords);
    const videos = await apiChannelUploads(channel.uploadsPlaylistId, 30);

    const seed = shortSeedOf(keywords[0] || channel.title);
    const ranking =
      keywords.length > 0 && seed
        ? await rankTags(keywords, seed)
        : { trending: [], notTrending: keywords, suggestions: [] };

    return json({
      channelId: channel.channelId,
      title: channel.title,
      thumbnail: channel.thumbnail,
      subscribers: channel.subscribers,
      videoCount: channel.videoCount,
      views: channel.views,
      keywords,
      count: keywords.length,
      tagBox: buildTagString(keywords, 500),
      ...ranking,
      videos: videos.map((v) => ({
        videoId: v.videoId,
        title: v.title,
        channel: v.channel,
        views: v.views,
        publishedText: v.publishedText,
        thumbnail: v.thumbnail,
        url: v.url,
      })),
    });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Failed to read channel", 500);
  }
}
