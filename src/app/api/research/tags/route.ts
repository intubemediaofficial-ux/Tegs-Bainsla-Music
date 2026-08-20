import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getVideoInfo,
  buildTagString,
  cleanTags,
  rankTags,
  seedFromTitle,
  DEFAULT_YT_TAGS,
} from "@/lib/youtube";
import { requireUser, enforceQuota, isResponse, json, error, requireFeature } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({
  video: z.string().min(1).max(200), // videoId or watch URL
});

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (isResponse(user)) return user;
  const denied = requireFeature(user, "research");
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return error("video (id or url) is required");

  const idMatch = parsed.data.video.match(
    /(?:v=|youtu\.be\/|shorts\/)?([A-Za-z0-9_-]{11})(?:$|&|\?)/
  );
  const videoId = idMatch?.[1];
  if (!videoId) return error("Could not parse a video id");

  const limited = await enforceQuota(user, "research");
  if (limited) return limited;

  try {
    const info = await getVideoInfo(videoId);
    const tags = cleanTags(info.tags);
    const onlyDefault =
      info.tags.length > 0 && info.tags.every((t) => DEFAULT_YT_TAGS.has(t.toLowerCase().trim()));

    const seed = seedFromTitle(info.title) || info.title;
    const ranking = seed
      ? await rankTags(tags, seed)
      : { trending: [], notTrending: tags, suggestions: [] };

    return json({
      videoId,
      title: info.title,
      channel: info.channel,
      published: info.published,
      tags,
      count: tags.length,
      onlyDefault,
      tagBox: buildTagString(tags, 500),
      ...ranking,
    });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Failed to read tags", 500);
  }
}
