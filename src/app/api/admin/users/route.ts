import { NextRequest } from "next/server";
import { listUsers } from "@/lib/users";
import { toPublic } from "@/lib/auth";
import { getUsage, effectiveLimits } from "@/lib/usage";
import { requireAdmin, isResponse, json } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (isResponse(admin)) return admin;

  const users = await listUsers();
  const rows = await Promise.all(
    users
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map(async (u) => ({
        ...toPublic(u),
        usage: await getUsage(u.id),
        limits: effectiveLimits(u),
      }))
  );
  return json({ users: rows });
}
