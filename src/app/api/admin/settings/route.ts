import { NextRequest } from "next/server";
import { z } from "zod";
import { getSettings, updateSettings, maskSecret } from "@/lib/settings";
import { requireAdmin, isResponse, json, error } from "@/lib/api";
import type { AppSettings } from "@/lib/settings";

export const runtime = "nodejs";

/** Secrets are never echoed back in full — only a masked hint of what is live. */
function publicView(s: AppSettings) {
  return {
    youtubeApiKeys: s.youtubeApiKeys.map(maskSecret),
    youtubeApiKeyCount: s.youtubeApiKeys.length,
    googleClientId: s.googleClientId,
    googleClientSecretMask: maskSecret(s.googleClientSecret),
    cronSecretMask: maskSecret(s.cronSecret),
    appUrl: s.appUrl,
    signupsEnabled: s.signupsEnabled,
    defaultPlan: s.defaultPlan,
    announcement: s.announcement,
  };
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (isResponse(admin)) return admin;
  return json({ settings: publicView(await getSettings()) });
}

const schema = z.object({
  /** Append a key (the UI only ever sees masked keys, so it cannot resend them). */
  addYoutubeApiKey: z.string().trim().min(10).max(200).optional(),
  /** Drop the key at this position in the list. */
  removeYoutubeApiKeyIndex: z.number().int().min(0).max(9).optional(),
  googleClientId: z.string().trim().max(200).optional(),
  googleClientSecret: z.string().trim().max(200).optional(),
  cronSecret: z.string().trim().max(200).optional(),
  appUrl: z.string().trim().url().max(200).optional(),
  signupsEnabled: z.boolean().optional(),
  defaultPlan: z.enum(["free", "starter", "creator", "unlimited"]).optional(),
  announcement: z.string().max(500).optional(),
});

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (isResponse(admin)) return admin;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return error("Invalid settings");

  const { addYoutubeApiKey, removeYoutubeApiKeyIndex, ...patch } = parsed.data;
  if (patch.appUrl) patch.appUrl = patch.appUrl.replace(/\/+$/, "");

  if (addYoutubeApiKey || removeYoutubeApiKeyIndex !== undefined) {
    const current = (await getSettings()).youtubeApiKeys;
    const keys = [...current];
    if (removeYoutubeApiKeyIndex !== undefined) keys.splice(removeYoutubeApiKeyIndex, 1);
    if (addYoutubeApiKey && !keys.includes(addYoutubeApiKey)) keys.unshift(addYoutubeApiKey);
    const next = await updateSettings({ ...patch, youtubeApiKeys: keys });
    return json({ settings: publicView(next) });
  }

  const next = await updateSettings(patch);
  return json({ settings: publicView(next) });
}
