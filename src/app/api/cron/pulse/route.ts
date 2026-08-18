import { NextRequest } from "next/server";
import { sampleWatched } from "@/lib/pulse";
import { getCurrentUser } from "@/lib/auth";
import { json, error } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 120;

async function authorized(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const headerSecret = req.headers.get("x-cron-secret");
  if (secret && (auth === `Bearer ${secret}` || headerSecret === secret)) return true;
  const user = await getCurrentUser();
  return user?.role === "admin";
}

/**
 * Re-sample the view counters of recently watched videos so the realtime
 * windows keep filling with measured data. Cheap: 1 API unit per 50 videos.
 */
async function run(req: NextRequest) {
  if (!(await authorized(req))) return error("Unauthorized", 401);
  const result = await sampleWatched();
  return json({ ok: true, ...result, at: new Date().toISOString() });
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
