import { NextRequest } from "next/server";
import { refreshAll } from "@/lib/trending";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { json, error } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 300;

async function authorized(req: NextRequest): Promise<boolean> {
  const { cronSecret: secret } = await getSettings();
  const auth = req.headers.get("authorization");
  const headerSecret = req.headers.get("x-cron-secret");
  if (secret && (auth === `Bearer ${secret}` || headerSecret === secret)) return true;
  // Allow an admin to trigger manually from the dashboard.
  const user = await getCurrentUser();
  return user?.role === "admin";
}

async function run(req: NextRequest) {
  if (!(await authorized(req))) return error("Unauthorized", 401);
  const result = await refreshAll();
  return json({ ok: true, ...result, at: new Date().toISOString() });
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
