import { NextRequest, NextResponse } from "next/server";
import { startAuth, googleConfigured } from "@/lib/google-oauth";
import { requireUser, isResponse, error } from "@/lib/api";

export const runtime = "nodejs";

/** Kick off "connect my channel": redirects the signed-in user to Google. */
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (isResponse(user)) return user;
  if (!googleConfigured()) return error("Google sign-in is not configured on the server", 500);

  const url = await startAuth(user.id);
  return NextResponse.redirect(url);
}
