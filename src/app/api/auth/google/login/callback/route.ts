import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { completeGoogleLogin, consumeLoginState } from "@/lib/google-oauth";
import { createUser, findUserByEmail } from "@/lib/users";
import { setSessionCookie } from "@/lib/auth";
import { getSettings, primeSettings } from "@/lib/settings";

export const runtime = "nodejs";

function toLogin(req: NextRequest, reason: string): NextResponse {
  const url = new URL("/login", req.nextUrl.origin);
  url.searchParams.set("error", reason);
  return NextResponse.redirect(url);
}

/** Google sends the person back here after they pick their account. */
export async function GET(req: NextRequest) {
  await primeSettings();
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (req.nextUrl.searchParams.get("error")) return toLogin(req, "google_cancelled");
  if (!code || !state) return toLogin(req, "google_missing_code");

  const next = await consumeLoginState(state);
  if (!next) return toLogin(req, "google_expired");

  try {
    const identity = await completeGoogleLogin(code);
    let user = await findUserByEmail(identity.email);
    if (user?.banned) return toLogin(req, "banned");

    if (!user) {
      const settings = await getSettings();
      if (!settings.signupsEnabled) return toLogin(req, "signups_closed");
      user = await createUser({
        email: identity.email,
        name: identity.name,
        // Google is the credential here; a random one keeps the record complete.
        password: randomBytes(24).toString("hex"),
        plan: settings.defaultPlan === "admin" ? "free" : settings.defaultPlan,
      });
    }

    await setSessionCookie(user.id);
    return NextResponse.redirect(new URL(next, req.nextUrl.origin));
  } catch {
    return toLogin(req, "google_failed");
  }
}
