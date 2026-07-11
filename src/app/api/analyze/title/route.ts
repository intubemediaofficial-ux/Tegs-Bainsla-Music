import { NextRequest } from "next/server";
import { z } from "zod";
import { scoreTitle } from "@/lib/scoring";
import { requireUser, isResponse, json, error } from "@/lib/api";

export const runtime = "nodejs";

const schema = z.object({
  title: z.string().min(1).max(200),
  keyword: z.string().max(120).optional(),
});

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (isResponse(user)) return user;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return error("title is required");

  return json(scoreTitle(parsed.data.title, parsed.data.keyword));
}
