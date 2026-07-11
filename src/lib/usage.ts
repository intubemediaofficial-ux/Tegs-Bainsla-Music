import { store } from "./store";
import { planLimits } from "./plans";
import type { UsageRecord, User } from "./types";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function key(userId: string, date: string): string {
  return `usage:${userId}:${date}`;
}

export async function getUsage(userId: string): Promise<UsageRecord> {
  const date = today();
  const rec = await store.get<UsageRecord>(key(userId, date));
  return rec ?? { date, generations: 0, research: 0 };
}

export type QuotaKind = "generations" | "research";

export interface QuotaResult {
  ok: boolean;
  used: number;
  limit: number;
  remaining: number;
}

/**
 * Check remaining quota for a user without consuming it.
 */
export async function checkQuota(user: User, kind: QuotaKind): Promise<QuotaResult> {
  const limits = planLimits(user.plan);
  const usage = await getUsage(user.id);
  const limit = limits[kind];
  const used = usage[kind];
  return { ok: used < limit, used, limit, remaining: Math.max(0, limit - used) };
}

/**
 * Consume one unit of quota. Returns false (and does not increment) when the
 * user is over their daily limit.
 */
export async function consumeQuota(user: User, kind: QuotaKind): Promise<QuotaResult> {
  const check = await checkQuota(user, kind);
  if (!check.ok) return check;
  const date = today();
  const usage = await getUsage(user.id);
  usage[kind] += 1;
  await store.set(key(user.id, date), usage);
  return {
    ok: true,
    used: usage[kind],
    limit: check.limit,
    remaining: Math.max(0, check.limit - usage[kind]),
  };
}
