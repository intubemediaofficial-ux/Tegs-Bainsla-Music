import { NextRequest } from "next/server";
import { z } from "zod";
import { addCategory, listCategories, removeCategory, refreshCategory } from "@/lib/trending";
import { requireAdmin, isResponse, json, error } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (isResponse(admin)) return admin;
  return json({ categories: await listCategories() });
}

const createSchema = z.object({
  label: z.string().min(1).max(60),
  query: z.string().min(1).max(120),
  language: z.string().max(8).optional(),
});

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (isResponse(admin)) return admin;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return error("label and query are required");

  const cat = await addCategory(parsed.data.label, parsed.data.query, parsed.data.language);
  // Populate an initial snapshot right away (best-effort).
  refreshCategory(cat).catch(() => {});
  return json({ category: cat });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (isResponse(admin)) return admin;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return error("id is required");
  await removeCategory(id);
  return json({ ok: true });
}
