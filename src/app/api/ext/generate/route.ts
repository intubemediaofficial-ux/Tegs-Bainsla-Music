import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generatePackage } from "@/lib/generate";
import { getUserByApiKey } from "@/lib/auth";
import { enforceQuota, json, error } from "@/lib/api";
import { effectiveLimits } from "@/lib/usage";

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

const schema = z.object({
  query: z.string().min(1).max(120),
  hl: z.string().max(8).optional(),
  gl: z.string().max(8).optional(),
});

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key") ?? "";
  const user = await getUserByApiKey(apiKey);
  if (!user) return error("Invalid API key", 401);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return error("query is required");

  const limited = await enforceQuota(user, "generations");
  if (limited) {
    limited.headers.set("Access-Control-Allow-Origin", "*");
    return limited;
  }

  try {
    const result = await generatePackage(parsed.data.query, {
      hl: parsed.data.hl,
      gl: parsed.data.gl,
      maxTags: effectiveLimits(user).maxTags,
    });
    const res = json(result);
    for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
    return res;
  } catch (e) {
    return error(e instanceof Error ? e.message : "Generation failed", 500);
  }
}
