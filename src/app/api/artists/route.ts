import { NextRequest } from "next/server";
import { z } from "zod";
import { addArtist, listArtists, removeArtist } from "@/lib/artists";
import { planLimits } from "@/lib/plans";
import { requireUser, isResponse, json, error } from "@/lib/api";
import type { User } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (isResponse(user)) return user;
  return json({ artists: await listArtists((user as User).id) });
}

const createSchema = z.object({
  name: z.string().min(1).max(80),
  language: z.string().max(8).optional(),
  keywords: z.array(z.string()).max(50).optional(),
});

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (isResponse(user)) return user;
  const u = user as User;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return error("name is required");

  const existing = await listArtists(u.id);
  if (existing.length >= planLimits(u.plan).artists) {
    return error("Artist preset limit reached for your plan. Upgrade for more.", 429);
  }

  const artist = await addArtist(
    u.id,
    parsed.data.name,
    parsed.data.language ?? "hi",
    parsed.data.keywords ?? []
  );
  return json({ artist });
}

export async function DELETE(req: NextRequest) {
  const user = await requireUser(req);
  if (isResponse(user)) return user;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return error("id is required");
  const ok = await removeArtist((user as User).id, id);
  if (!ok) return error("Not found", 404);
  return json({ ok: true });
}
