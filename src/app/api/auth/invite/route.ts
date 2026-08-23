import { NextRequest } from "next/server";
import { z } from "zod";
import { store } from "@/lib/store";
import { getInvite, markInviteUsed } from "@/lib/invites";
import { saveUser } from "@/lib/users";
import { hashPassword, setSessionCookie, toPublic } from "@/lib/auth";
import { json, error } from "@/lib/api";
import type { User } from "@/lib/types";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(10).max(200),
  password: z.string().min(6).max(200),
  name: z.string().trim().max(80).optional(),
});

/** Redeem an admin invite: set the first password and sign in. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return error("A password of 6+ characters is required");

  const invite = await getInvite(parsed.data.token);
  if (!invite) return error("This invite link is invalid or has expired", 410);

  const user = await store.get<User>(`user:${invite.userId}`);
  if (!user || user.banned)
    return error("This account is no longer available", 410);

  user.passwordHash = await hashPassword(parsed.data.password);
  if (parsed.data.name) user.name = parsed.data.name;
  await saveUser(user);
  await markInviteUsed(invite);
  await setSessionCookie(user.id);

  return json({ user: toPublic(user) });
}
