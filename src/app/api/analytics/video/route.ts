import { NextRequest } from "next/server";
import { ownerVideoStats } from "@/lib/yt-analytics";
import { parseVideoId } from "@/lib/video-report";
import { requireUser, isResponse, json, error } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Official per-video analytics — only works for videos on the connected channel. */
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (isResponse(user)) return user;

  const videoId = parseVideoId(req.nextUrl.searchParams.get("video") ?? "");
  if (!videoId) return error("Could not parse a video id");

  const days = Number(req.nextUrl.searchParams.get("days") ?? 28);
  try {
    const stats = await ownerVideoStats(user.id, videoId, Number.isFinite(days) ? days : 28);
    if (!stats) return error("Connect your YouTube channel first", 409);
    return json(stats);
  } catch (e) {
    return error(e instanceof Error ? e.message : "Analytics request failed", 500);
  }
}
