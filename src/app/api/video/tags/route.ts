import { NextRequest } from "next/server";
import { getVideoTags, cleanTags, DEFAULT_YT_TAGS } from "@/lib/youtube";
import { requireUser, isResponse, json, error, requireFeature } from "@/lib/api";

export const runtime = "nodejs";

/**
 * Lightweight, quota-free lookup of a single video's real tags — used by the
 * dashboard thumbnail viewer / expandable title rows. Auth still required.
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

  try {
    const all = await getVideoTags(videoId);
    const tags = cleanTags(all);
    const onlyDefault =
      all.length > 0 && all.every((t) => DEFAULT_YT_TAGS.has(t.toLowerCase().trim()));
    return json({ videoId, tags, count: tags.length, onlyDefault });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Failed to read tags", 500);
  }
}
