import { getCurrentUser, toPublic } from "@/lib/auth";
import { getUsage, effectiveLimits } from "@/lib/usage";
import { json } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return json({ user: null });
  const usage = await getUsage(user.id);
  return json({ user: toPublic(user), usage, limits: effectiveLimits(user) });
}
