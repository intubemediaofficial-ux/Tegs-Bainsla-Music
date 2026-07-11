import { NextRequest } from "next/server";
import { regenerateApiKey } from "@/lib/users";
import { requireUser, isResponse, json } from "@/lib/api";
import type { User } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (isResponse(user)) return user;
  const updated = await regenerateApiKey(user as User);
  return json({ apiKey: updated.apiKey });
}
