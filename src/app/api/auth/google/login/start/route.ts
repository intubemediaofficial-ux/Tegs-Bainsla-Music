import { NextRequest, NextResponse } from "next/server";
import { startGoogleLogin, googleConfigured } from "@/lib/google-oauth";
import { primeSettings } from "@/lib/settings";

export const runtime = "nodejs";

/** "Sign in with Google": no password, no API key, straight into the account. */
export async function GET(req: NextRequest) {
  await primeSettings();
  if (!googleConfigured()) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("error", "google_not_configured");
    return NextResponse.redirect(url);
  }
  const next = req.nextUrl.searchParams.get("next") || "/connect";
  return NextResponse.redirect(await startGoogleLogin(next));
}
