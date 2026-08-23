import { randomBytes } from "crypto";
import { store } from "./store";
import type { User } from "./types";

const TTL_DAYS = 14;

export interface Invite {
  token: string;
  userId: string;
  email: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
}

function key(token: string): string {
  return `invite:${token}`;
}

/** One-time link an admin hands out instead of a password. */
export async function createInvite(user: User): Promise<Invite> {
  const token = randomBytes(24).toString("hex");
  const now = Date.now();
  const invite: Invite = {
    token,
    userId: user.id,
    email: user.email,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + TTL_DAYS * 86400_000).toISOString(),
  };
  await store.set(key(token), invite);
  return invite;
}

export async function getInvite(token: string): Promise<Invite | null> {
  const invite = await store.get<Invite>(key(token));
  if (!invite) return null;
  if (invite.usedAt) return null;
  if (Date.parse(invite.expiresAt) < Date.now()) return null;
  return invite;
}

export async function markInviteUsed(invite: Invite): Promise<void> {
  await store.set(key(invite.token), {
    ...invite,
    usedAt: new Date().toISOString(),
  });
}

export function inviteUrl(token: string, appUrl: string): string {
  return `${appUrl.replace(/\/+$/, "")}/invite/${token}`;
}
