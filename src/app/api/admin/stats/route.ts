import { NextRequest } from "next/server";
import { listUsers } from "@/lib/users";
import { getUsage } from "@/lib/usage";
import { requireAdmin, isResponse, json } from "@/lib/api";
import type { PlanId } from "@/lib/plans";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (isResponse(admin)) return admin;

  const users = await listUsers();
  const byPlan: Record<PlanId, number> = {
    free: 0,
    starter: 0,
    creator: 0,
    unlimited: 0,
    admin: 0,
  };
  let generationsToday = 0;
  let researchToday = 0;

  await Promise.all(
    users.map(async (u) => {
      byPlan[u.plan] = (byPlan[u.plan] ?? 0) + 1;
      const usage = await getUsage(u.id);
      generationsToday += usage.generations;
      researchToday += usage.research;
    })
  );

  return json({
    totalUsers: users.length,
    byPlan,
    generationsToday,
    researchToday,
  });
}
