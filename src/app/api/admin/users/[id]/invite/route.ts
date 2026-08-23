import { NextRequest } from "next/server";
import { store } from "@/lib/store";
import { createInvite, inviteUrl } from "@/lib/invites";
import { getSettings } from "@/lib/settings";
import { requireAdmin, isResponse, json, error } from "@/lib/api";
import type { User } from "@/lib/types";

export const runtime = "nodejs";

/** Fresh one-time link so an existing user can set their own password. */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(req);
  if (isResponse(admin)) return admin;

  const { id } = await ctx.params;
  const user = await store.get<User>(`user:${id}`);
  if (!user) return error("User not found", 404);
  if (user.banned) return error("Unban this account before inviting them", 400);

  const invite = await createInvite(user);
  const settings = await getSettings();
  return json({
    inviteUrl: inviteUrl(invite.token, settings.appUrl),
    email: user.email,
  });
}
