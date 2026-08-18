import { NextRequest } from "next/server";
import { getFreshSnapshots, listCategories, refreshAll } from "@/lib/trending";
import { requireUser, isResponse, json } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (isResponse(user)) return user;

  // Recomputes any snapshot older than the TTL so the board self-updates.
  const [snapshots, categories] = await Promise.all([getFreshSnapshots(), listCategories()]);
  return json({ snapshots, categories });
}

/** Force an immediate rebuild of every tracked category (“Refresh now”). */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (isResponse(user)) return user;

  await refreshAll();
  const [snapshots, categories] = await Promise.all([getFreshSnapshots(), listCategories()]);
  return json({ snapshots, categories });
}
