import { NextRequest } from "next/server";
import { getAllSnapshots, listCategories } from "@/lib/trending";
import { requireUser, isResponse, json } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (isResponse(user)) return user;

  const [snapshots, categories] = await Promise.all([getAllSnapshots(), listCategories()]);
  return json({ snapshots, categories });
}
