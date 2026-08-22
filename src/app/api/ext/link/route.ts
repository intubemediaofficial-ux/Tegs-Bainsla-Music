import { getCurrentUser } from "@/lib/auth";
import { PLANS } from "@/lib/plans";
import { primeSettings } from "@/lib/settings";
import { json, error } from "@/lib/api";

export const runtime = "nodejs";

/**
 * Hands the signed-in browser session its extension credentials so the
 * extension can connect itself. Session-cookie only — never an API key.
 */
export async function POST() {
  await primeSettings();
  const user = await getCurrentUser();
  if (!user) return error("Not signed in", 401);

  return json({
    apiKey: user.apiKey,
    email: user.email,
    name: user.name || "",
    plan: user.plan,
    planLabel: PLANS[user.plan].name,
  });
}
