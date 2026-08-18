import { NextRequest } from "next/server";
import { z } from "zod";
import { buildTitles } from "@/lib/generate";
import { requireUser, isResponse, json, error } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({
  song: z.string().min(1).max(120),
  singer: z.string().max(120).optional(),
  hl: z.string().max(8).optional(),
  gl: z.string().max(8).optional(),
});

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (isResponse(user)) return user;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return error("song is required");

  try {
    const result = await buildTitles(parsed.data.song, parsed.data.singer ?? "", {
      hl: parsed.data.hl,
      gl: parsed.data.gl,
    });
    return json(result);
  } catch (e) {
    return error(e instanceof Error ? e.message : "Failed to build title", 500);
  }
}
