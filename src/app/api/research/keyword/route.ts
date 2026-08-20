import { NextRequest } from "next/server";
import { z } from "zod";
import { researchKeyword } from "@/lib/generate";
import { requireUser, enforceQuota, isResponse, json, error, requireFeature } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({
  query: z.string().min(1).max(120),
  hl: z.string().max(8).optional(),
  gl: z.string().max(8).optional(),
});

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (isResponse(user)) return user;
  const denied = requireFeature(user, "research");
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return error("query is required");

  const limited = await enforceQuota(user, "research");
  if (limited) return limited;

  try {
    const result = await researchKeyword(parsed.data.query, {
      hl: parsed.data.hl,
      gl: parsed.data.gl,
    });
    return json(result);
  } catch (e) {
    return error(e instanceof Error ? e.message : "Research failed", 500);
  }
}
