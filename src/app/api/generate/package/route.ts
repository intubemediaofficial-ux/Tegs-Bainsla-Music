import { NextRequest } from "next/server";
import { z } from "zod";
import { generatePackage } from "@/lib/generate";
import { planLimits } from "@/lib/plans";
import { requireUser, enforceQuota, isResponse, json, error } from "@/lib/api";

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

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return error("query is required");

  const limited = await enforceQuota(user, "generations");
  if (limited) return limited;

  try {
    const result = await generatePackage(parsed.data.query, {
      hl: parsed.data.hl,
      gl: parsed.data.gl,
      maxTags: planLimits(user.plan).maxTags,
    });
    return json(result);
  } catch (e) {
    return error(e instanceof Error ? e.message : "Generation failed", 500);
  }
}
