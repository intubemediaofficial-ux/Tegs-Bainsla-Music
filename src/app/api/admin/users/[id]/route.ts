import { NextRequest } from "next/server";
import { z } from "zod";
import { store } from "@/lib/store";
import { saveUser, regenerateApiKey } from "@/lib/users";
import { toPublic } from "@/lib/auth";
import { requireAdmin, isResponse, json, error } from "@/lib/api";
import type { User } from "@/lib/types";
import type { PlanLimits } from "@/lib/plans";

export const runtime = "nodejs";

const limitField = z.number().int().min(0).max(1_000_000).nullable();

const schema = z.object({
  plan: z.enum(["free", "starter", "creator", "unlimited", "admin"]).optional(),
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
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (isResponse(admin)) return admin;

  const { id } = await ctx.params;
  let user = await store.get<User>(`user:${id}`);
  if (!user) return error("User not found", 404);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return error("Invalid update");

  if (parsed.data.plan) user.plan = parsed.data.plan;
  if (parsed.data.role) user.role = parsed.data.role;
  if (typeof parsed.data.banned === "boolean") user.banned = parsed.data.banned;
  if (typeof parsed.data.unlimited === "boolean") user.unlimited = parsed.data.unlimited;
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

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (isResponse(admin)) return admin;

  const { id } = await ctx.params;
  const user = await store.get<User>(`user:${id}`);
  if (!user) return error("User not found", 404);
  if (user.id === (admin as User).id) return error("Cannot delete yourself", 400);

  await store.del(`user:${id}`);
  await store.del(`email:${user.email}`);
  await store.del(`apikey:${user.apiKey}`);
  return json({ ok: true });
}
