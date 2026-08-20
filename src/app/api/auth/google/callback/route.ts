import { NextRequest, NextResponse } from "next/server";
import { completeAuth, consumeState } from "@/lib/google-oauth";
import { primeSettings } from "@/lib/settings";

export const runtime = "nodejs";

function back(req: NextRequest, params: Record<string, string>): NextResponse {
  const url = new URL("/app/settings", req.nextUrl.origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

/** Google sends the user back here after consent. */
export async function GET(req: NextRequest) {
  await primeSettings();
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const denied = req.nextUrl.searchParams.get("error");
  if (denied) return back(req, { channel: "error", reason: denied });
  if (!code || !state) return back(req, { channel: "error", reason: "missing_code" });

  const userId = await consumeState(state);
  if (!userId) return back(req, { channel: "error", reason: "expired" });

  try {
    const conn = await completeAuth(userId, code);
    return back(req, { channel: "connected", name: conn.channelTitle });
  } catch (e) {
    return back(req, {
      channel: "error",
      reason: e instanceof Error ? e.message : "connect_failed",
    });
  }
}
