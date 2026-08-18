import { NextRequest, NextResponse } from "next/server";
import { buildVideoReport, parseVideoId } from "@/lib/video-report";
import { requireUser, isResponse, json, error } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 60;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * Everything the extension overlay needs for the video currently open: public
 * counters, the measured 60-minute / 24-hour / 48-hour pulse, real tags ranked
 * against live search demand, channel stats and the why-it-is-winning estimate.
 *
 * Quota-free (it is polled while watching) but still key/session authenticated.
 */
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (isResponse(user)) {
    for (const [k, v] of Object.entries(CORS)) user.headers.set(k, v);
    return user;
  }

  const videoId = parseVideoId(req.nextUrl.searchParams.get("video") ?? "");
  if (!videoId) return withCors(error("Could not parse a video id"));

  try {
    const report = await buildVideoReport(videoId, user.id);
    return withCors(json(report));
  } catch (e) {
    return withCors(error(e instanceof Error ? e.message : "Failed to read video", 500));
  }
}

function withCors(res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
  return res;
}
