import { NextRequest } from "next/server";
import { listUsers } from "@/lib/users";
import { getUsage } from "@/lib/usage";
import { listCategories } from "@/lib/trending";
import { store } from "@/lib/store";
import { getSettings } from "@/lib/settings";
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

  const [categories, settings, connections] = await Promise.all([
    listCategories(),
    getSettings(),
    store.list<{ userId: string }>("ytconn:"),
  ]);

  return json({
    totalUsers: users.length,
    byPlan,
    generationsToday,
    researchToday,
    bannedUsers: users.filter((u) => u.banned).length,
    unlimitedUsers: users.filter((u) => u.unlimited).length,
    connectedChannels: connections.length,
    status: {
      youtubeApiKeys: settings.youtubeApiKeys.length,
      googleOAuth: Boolean(settings.googleClientId && settings.googleClientSecret),
      cronSecret: Boolean(settings.cronSecret),
      appUrl: settings.appUrl,
      signupsEnabled: settings.signupsEnabled,
      defaultPlan: settings.defaultPlan,
      categories: categories.length,
    },
  });
}
