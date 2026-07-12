import { NextRequest } from "next/server";
import { requireUser, isResponse, error } from "@/lib/api";

export const runtime = "nodejs";

/**
 * Proxy a video's thumbnail with an attachment header so the dashboard can
 * offer a real "Download thumbnail" button (cross-origin <a download> to
 * i.ytimg.com won't force a download on its own).
 */
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (isResponse(user)) return user;

  const raw = req.nextUrl.searchParams.get("video") ?? "";
  const idMatch = raw.match(/(?:v=|youtu\.be\/|shorts\/)?([A-Za-z0-9_-]{11})(?:$|&|\?)/);
  const videoId = idMatch?.[1];
  if (!videoId) return error("Could not parse a video id");

  // Prefer max-res; fall back to hq if it doesn't exist.
  const candidates = [
    `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  ];

  for (const url of candidates) {
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok && res.body) {
      return new Response(res.body, {
        headers: {
          "Content-Type": res.headers.get("content-type") ?? "image/jpeg",
          "Content-Disposition": `attachment; filename="${videoId}.jpg"`,
          "Cache-Control": "no-store",
        },
      });
    }
  }
  return error("Thumbnail not available", 404);
}
