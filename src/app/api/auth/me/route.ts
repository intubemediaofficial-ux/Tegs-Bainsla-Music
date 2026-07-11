import { getCurrentUser, toPublic } from "@/lib/auth";
import { getUsage } from "@/lib/usage";
import { planLimits } from "@/lib/plans";
import { json } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return json({ user: null });
  const usage = await getUsage(user.id);
  return json({ user: toPublic(user), usage, limits: planLimits(user.plan) });
}
