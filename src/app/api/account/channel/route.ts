import { NextRequest, NextResponse } from "next/server";
import { getConnection, disconnect, googleConfigured } from "@/lib/google-oauth";
import { requireUser, isResponse, json } from "@/lib/api";

export const runtime = "nodejs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** Connection status for the signed-in user's own YouTube channel. */
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (isResponse(user)) return user;

  const conn = await getConnection(user.id);
  const res = json({
    configured: googleConfigured(),
    connected: Boolean(conn),
    channel: conn
      ? {
          channelId: conn.channelId,
          title: conn.channelTitle,
          thumbnail: conn.thumbnail,
          connectedAt: conn.connectedAt,
        }
      : null,
  });
  for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
  return res;
}

export async function DELETE(req: NextRequest) {
  const user = await requireUser(req);
  if (isResponse(user)) return user;
  await disconnect(user.id);
  return json({ ok: true });
}
