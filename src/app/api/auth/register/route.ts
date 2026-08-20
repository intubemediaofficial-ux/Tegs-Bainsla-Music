import { NextRequest } from "next/server";
import { z } from "zod";
import { createUser } from "@/lib/users";
import { setSessionCookie, toPublic } from "@/lib/auth";
import { json, error } from "@/lib/api";
import { getSettings } from "@/lib/settings";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(80).optional(),
  password: z.string().min(6).max(200),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return error("Invalid input: email + password (min 6 chars) required");

  const settings = await getSettings();
  if (!settings.signupsEnabled) {
    return error("Sign-ups are closed right now. Ask the admin for an account.", 403);
  }

  try {
    const user = await createUser({
      email: parsed.data.email,
      name: parsed.data.name ?? "",
      password: parsed.data.password,
      plan: settings.defaultPlan === "admin" ? "free" : settings.defaultPlan,
    });
    await setSessionCookie(user.id);
    return json({ user: toPublic(user) });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Registration failed", 409);
  }
}
