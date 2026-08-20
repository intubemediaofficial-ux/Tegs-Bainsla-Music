import { NextRequest } from "next/server";
import { z } from "zod";
import { listUsers, saveUser } from "@/lib/users";
import { requireAdmin, isResponse, json, error } from "@/lib/api";

export const runtime = "nodejs";

const schema = z.object({ unlimited: z.boolean() });

/** Flip the unlimited switch for every existing user in one go. */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (isResponse(admin)) return admin;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return error("Invalid update");

  const users = await listUsers();
  let updated = 0;
  for (const user of users) {
    if (Boolean(user.unlimited) === parsed.data.unlimited) continue;
    user.unlimited = parsed.data.unlimited;
    await saveUser(user);
    updated += 1;
  }

  return json({ updated, total: users.length });
}
