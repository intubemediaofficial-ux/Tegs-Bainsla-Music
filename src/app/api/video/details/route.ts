import { NextRequest } from "next/server";
import {
  getVideoInfo,
  cleanTags,
  rankTags,
  seedFromTitle,
  DEFAULT_YT_TAGS,
} from "@/lib/youtube";
import { requireUser, isResponse, json, error, requireFeature } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Full public detail for one video — description, upload date and its real tags
 * ranked against live search demand (+ better tags to add). Quota-free; used by
 * the dashboard video panels (keyword research, competitor tags, trending).
 */
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (isResponse(user)) return user;
  const denied = requireFeature(user, "research");
  if (denied) return denied;

  const raw = req.nextUrl.searchParams.get("video") ?? "";
  const idMatch = raw.match(/(?:v=|youtu\.be\/|shorts\/)?([A-Za-z0-9_-]{11})(?:$|&|\?)/);
  const videoId = idMatch?.[1];
  if (!videoId) return error("Could not parse a video id");

  const seedOverride = req.nextUrl.searchParams.get("seed") ?? "";

  try {
    const info = await getVideoInfo(videoId);
    const tags = cleanTags(info.tags);
    const onlyDefault =
      info.tags.length > 0 && info.tags.every((t) => DEFAULT_YT_TAGS.has(t.toLowerCase().trim()));

    const seed = (seedOverride || seedFromTitle(info.title) || info.title).trim();
    const ranking = seed ? await rankTags(tags, seed) : { trending: [], notTrending: tags, suggestions: [] };

    return json({
      videoId,
      title: info.title,
      channel: info.channel,
      published: info.published,
      description: info.description,
      tags,
      onlyDefault,
      ...ranking,
    });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Failed to read video", 500);
  }
}
