import { NextRequest } from "next/server";
import { z } from "zod";
import { store } from "@/lib/store";
import { saveUser, regenerateApiKey } from "@/lib/users";
import { toPublic, hashPassword } from "@/lib/auth";
import { requireAdmin, isResponse, json, error } from "@/lib/api";
import { type FeatureAccess, type FeatureId } from "@/lib/access";
import type { User } from "@/lib/types";
import type { PlanLimits } from "@/lib/plans";

export const runtime = "nodejs";

const limitField = z.number().int().min(0).max(1_000_000).nullable();
const accessField = z.boolean().nullable().optional();

/** Strict so a mistyped field fails loudly instead of silently saving nothing. */
const schema = z
  .object({
    plan: z
      .enum(["free", "starter", "creator", "unlimited", "admin"])
      .optional(),
    role: z.enum(["user", "admin"]).optional(),
    banned: z.boolean().optional(),
    unlimited: z.boolean().optional(),
    limitOverrides: z
      .object({
        generations: limitField.optional(),
        research: limitField.optional(),
        artists: limitField.optional(),
        maxTags: limitField.optional(),
      })
      .optional(),
    regenerateApiKey: z.boolean().optional(),
    name: z.string().trim().min(1).max(80).optional(),
    /** Set a new password for the user (they can change it later themselves). */
    password: z.string().min(6).max(200).optional(),
    /** Feature switches; `true`/`null` clears the override and re-allows it. */
    access: z
      .object({
        generate: accessField,
        research: accessField,
        trending: accessField,
        extension: accessField,
        analytics: accessField,
      })
      .optional(),
  })
  .strict();

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(req);
  if (isResponse(admin)) return admin;

  const { id } = await ctx.params;
  let user = await store.get<User>(`user:${id}`);
  if (!user) return error("User not found", 404);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return error(`Invalid update: ${parsed.error.issues[0]?.message}`);

  if (parsed.data.plan) user.plan = parsed.data.plan;
  if (parsed.data.role) user.role = parsed.data.role;
  if (typeof parsed.data.banned === "boolean") user.banned = parsed.data.banned;
  if (typeof parsed.data.unlimited === "boolean")
    user.unlimited = parsed.data.unlimited;
  if (parsed.data.name) user.name = parsed.data.name;
  if (parsed.data.password)
    user.passwordHash = await hashPassword(parsed.data.password);
  if (parsed.data.access) {
    const next: FeatureAccess = { ...user.access };
    for (const [feature, value] of Object.entries(parsed.data.access)) {
      if (value === undefined) continue;
      const id = feature as FeatureId;
      if (value === null || value === true) delete next[id];
      else next[id] = false;
    }
    user.access = Object.keys(next).length > 0 ? next : undefined;
  }
  if (parsed.data.limitOverrides) {
    const next: Partial<PlanLimits> = { ...user.limitOverrides };
    for (const [kind, value] of Object.entries(parsed.data.limitOverrides)) {
      const field = kind as keyof PlanLimits;
      if (value === null) delete next[field];
      else if (typeof value === "number") next[field] = value;
    }
    user.limitOverrides = Object.keys(next).length > 0 ? next : undefined;
  }
  await saveUser(user);
  if (parsed.data.regenerateApiKey) user = await regenerateApiKey(user);

  return json({ user: toPublic(user) });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(req);
  if (isResponse(admin)) return admin;

  const { id } = await ctx.params;
  const user = await store.get<User>(`user:${id}`);
  if (!user) return error("User not found", 404);
  if (user.id === (admin as User).id)
    return error("Cannot delete yourself", 400);

  await store.del(`user:${id}`);
  await store.del(`email:${user.email}`);
  await store.del(`apikey:${user.apiKey}`);
  return json({ ok: true });
}
