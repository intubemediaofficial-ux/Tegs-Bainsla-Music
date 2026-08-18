import { NextRequest } from "next/server";
import { ownerChannelStats } from "@/lib/yt-analytics";
import { requireUser, isResponse, json, error } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Official analytics for the user's own connected channel. */
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (isResponse(user)) return user;

  const days = Number(req.nextUrl.searchParams.get("days") ?? 28);
  try {
    const stats = await ownerChannelStats(user.id, Number.isFinite(days) ? days : 28);
    if (!stats) return error("Connect your YouTube channel first", 409);
    return json(stats);
  } catch (e) {
    return error(e instanceof Error ? e.message : "Analytics request failed", 500);
  }
}
