import { NextRequest } from "next/server";
import { getSettings } from "@/lib/settings";
import { requireAdmin, isResponse, json } from "@/lib/api";

export const runtime = "nodejs";

interface YouTubeError {
  error?: { message?: string; errors?: { reason?: string }[] };
}

/**
 * Spend 1 quota unit on videos.list to prove the configured key still works and
 * that today's quota is not exhausted.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (isResponse(admin)) return admin;

  const { youtubeApiKeys } = await getSettings();
  const key = youtubeApiKeys[0];
  if (!key) return json({ ok: false, message: "No YouTube API key is configured." });

  const url = `https://www.googleapis.com/youtube/v3/videos?part=id&id=dQw4w9WgXcQ&key=${encodeURIComponent(key)}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) return json({ ok: true, message: "Key works — quota available." });
    const body = (await res.json().catch(() => ({}))) as YouTubeError;
    const reason = body.error?.errors?.[0]?.reason ?? "";
    const message =
      reason === "quotaExceeded"
        ? "Key is valid but today's quota is used up. It resets at 00:00 US Pacific time."
        : (body.error?.message ?? `YouTube rejected the key (HTTP ${res.status}).`);
    return json({ ok: false, reason, message });
  } catch {
    return json({ ok: false, message: "Could not reach the YouTube API from the server." });
  }
}
