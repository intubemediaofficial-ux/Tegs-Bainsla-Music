import { NextRequest } from "next/server";
import { z } from "zod";
import { getVideoTags } from "@/lib/youtube";
import { buildTagString } from "@/lib/youtube";
import { requireUser, enforceQuota, isResponse, json, error } from "@/lib/api";

export const runtime = "nodejs";

const schema = z.object({
  video: z.string().min(1).max(200), // videoId or watch URL
});

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (isResponse(user)) return user;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return error("video (id or url) is required");

  const idMatch = parsed.data.video.match(
    /(?:v=|youtu\.be\/|shorts\/)?([A-Za-z0-9_-]{11})(?:$|&|\?)/
  );
  const videoId = idMatch?.[1];
  if (!videoId) return error("Could not parse a video id");

  const limited = await enforceQuota(user, "research");
  if (limited) return limited;

  try {
    const tags = await getVideoTags(videoId);
    return json({ videoId, tags, count: tags.length, tagBox: buildTagString(tags, 500) });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Failed to read tags", 500);
  }
}
