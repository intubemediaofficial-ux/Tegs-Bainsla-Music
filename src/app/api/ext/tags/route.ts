import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { keywordInsight, tagStudioReport } from "@/lib/tag-studio";
import { requireUser, isResponse, json, error, requireFeature, enforceQuota } from "@/lib/api";

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

const schema = z.union([
  z.object({
    action: z.literal("report"),
    title: z.string().min(1).max(200),
    tags: z.array(z.string().max(120)).max(120).optional(),
    hl: z.string().max(8).optional(),
    gl: z.string().max(8).optional(),
  }),
  z.object({
    action: z.literal("keyword"),
    keyword: z.string().min(1).max(120),
    hl: z.string().max(8).optional(),
    gl: z.string().max(8).optional(),
  }),
]);

/**
 * Powers the tag panel inside YouTube Studio: `report` scores the tags in the
 * box and proposes stronger ones, `keyword` is the drill-down when a tag is
 * clicked. Only `report` consumes a generation (keyword drill-downs are cheap
 * and clicked constantly).
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (isResponse(user)) return withCors(user);

  const denied = requireFeature(user, "extension");
  if (denied) return withCors(denied);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return withCors(error("action is required"));
  const body = parsed.data;

  try {
    if (body.action === "keyword") {
      const data = await keywordInsight(body.keyword, { hl: body.hl, gl: body.gl });
      return withCors(json(data));
    }

    const limited = await enforceQuota(user, "generations");
    if (limited) return withCors(limited);

    const data = await tagStudioReport(body.title, body.tags ?? [], {
      hl: body.hl,
      gl: body.gl,
    });
    return withCors(json(data));
  } catch (e) {
    return withCors(error(e instanceof Error ? e.message : "Tag research failed", 500));
  }
}

function withCors(res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
  return res;
}
