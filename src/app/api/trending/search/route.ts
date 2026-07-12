import { NextRequest } from "next/server";
import { z } from "zod";
import { searchTrending } from "@/lib/trending";
import { requireUser, enforceQuota, isResponse, json, error } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({
  query: z.string().min(1).max(120),
});

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (isResponse(user)) return user;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return error("query is required");

  const limited = await enforceQuota(user, "research");
  if (limited) return limited;

  try {
    const snapshot = await searchTrending(parsed.data.query);
    return json({ snapshot });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Trend search failed", 500);
  }
}
