import { randomBytes } from "crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { createUser, listUsers, saveUser } from "@/lib/users";
import { createInvite, inviteUrl } from "@/lib/invites";
import { getSettings } from "@/lib/settings";
import { toPublic } from "@/lib/auth";
import { getUsage, effectiveLimits } from "@/lib/usage";
import { requireAdmin, isResponse, json, error } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (isResponse(admin)) return admin;

  const users = await listUsers();
  const rows = await Promise.all(
    users
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map(async (u) => ({
        ...toPublic(u),
        usage: await getUsage(u.id),
        limits: effectiveLimits(u),
      })),
  );
  return json({ users: rows });
}

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().max(80).optional(),
  /** Omit to hand out a one-time invite link instead of a password. */
  password: z.string().min(6).max(200).optional(),
  plan: z.enum(["free", "starter", "creator", "unlimited", "admin"]).optional(),
  role: z.enum(["user", "admin"]).optional(),
  unlimited: z.boolean().optional(),
});

/** Create an account for a staff member / client straight from the panel. */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (isResponse(admin)) return admin;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success)
    return error("A valid email is required (password must be 6+ characters)");

  const invited = !parsed.data.password;

  try {
    const user = await createUser({
      email: parsed.data.email,
      name: parsed.data.name ?? "",
      // Invited accounts get an unusable random password until the link is used.
      password: parsed.data.password ?? randomBytes(24).toString("hex"),
      plan: parsed.data.plan ?? "free",
      role: parsed.data.role ?? "user",
    });
    if (parsed.data.unlimited) {
      user.unlimited = true;
      await saveUser(user);
    }
    if (!invited) return json({ user: toPublic(user) });

    const invite = await createInvite(user);
    const settings = await getSettings();
    return json({
      user: toPublic(user),
      inviteUrl: inviteUrl(invite.token, settings.appUrl),
    });
  } catch (e) {
    return error(
      e instanceof Error ? e.message : "Could not create the user",
      409,
    );
  }
}
