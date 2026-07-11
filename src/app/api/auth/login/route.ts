import { NextRequest } from "next/server";
import { z } from "zod";
import { findUserByEmail, ensureAdmin } from "@/lib/users";
import { setSessionCookie, toPublic, verifyPassword } from "@/lib/auth";
import { json, error } from "@/lib/api";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return error("Email and password required");

  // Make sure the seeded admin exists so first login always works.
  await ensureAdmin();

  const user = await findUserByEmail(parsed.data.email);
  if (!user || user.banned) return error("Invalid credentials", 401);
  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) return error("Invalid credentials", 401);

  await setSessionCookie(user.id);
  return json({ user: toPublic(user) });
}
