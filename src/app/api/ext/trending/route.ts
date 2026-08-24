import { NextRequest, NextResponse } from "next/server";
import { getFreshSnapshots } from "@/lib/trending";
import { requireUser, isResponse, json, error, requireFeature } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 120;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * Category-wise viral board for the extension panel: the same self-refreshing
 * snapshots the dashboard shows, trimmed to what fits YouTube's sidebar (top
 * risers + the tags they share). Quota-free, read-only.
 */
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (isResponse(user)) {
    for (const [k, v] of Object.entries(CORS)) user.headers.set(k, v);
    return user;
  }

  const denied = requireFeature(user, "trending");
  if (denied) return withCors(denied);

  try {
    const snapshots = await getFreshSnapshots();
    return withCors(
      json({
        categories: snapshots.map((s) => ({
          id: s.categoryId,
          label: s.label,
          query: s.query,
          updatedAt: s.updatedAt,
          recommendation: s.insight.recommendation,
          topTags: s.insight.topTags.slice(0, 12).map((t) => t.tag),
          hashtags: s.insight.topHashtags.slice(0, 10).map((h) => h.tag),
          videos: s.videos.slice(0, 6).map((v) => ({
            videoId: v.videoId,
            title: v.title,
            channel: v.channel,
            url: v.url,
            thumbnail: v.thumbnail,
            views: v.views,
            publishedText: v.publishedText,
            velocity: Math.round(v.velocity),
            viralScore: v.viralScore,
            why: v.why?.label ?? "",
          })),
        })),
      })
    );
  } catch (e) {
    return withCors(error(e instanceof Error ? e.message : "Failed to read trending", 500));
  }
}

function withCors(res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
  return res;
}
