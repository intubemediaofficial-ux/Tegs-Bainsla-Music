import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getUserByApiKey } from "./auth";
import { consumeQuota, type QuotaKind } from "./usage";
import { featureLabel, hasFeature, type FeatureId } from "./access";
import { primeSettings } from "./settings";
import type { User } from "./types";

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function error(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/** Resolve the caller from a session cookie OR an x-api-key header (extension). */
export async function resolveUser(req: NextRequest): Promise<User | null> {
  await primeSettings();
  const apiKey = req.headers.get("x-api-key");
  if (apiKey) {
    const user = await getUserByApiKey(apiKey);
    if (user) return user;
  }
  return getCurrentUser();
}

export async function requireUser(req: NextRequest): Promise<User | NextResponse> {
  const user = await resolveUser(req);
  if (!user) return error("Unauthorized", 401);
  return user;
}

export async function requireAdmin(req: NextRequest): Promise<User | NextResponse> {
  const user = await resolveUser(req);
  if (!user) return error("Unauthorized", 401);
  if (user.role !== "admin") return error("Forbidden", 403);
  return user;
}

/** 403 unless the admin has left this feature enabled for the user. */
export function requireFeature(user: User, feature: FeatureId): NextResponse | null {
  if (hasFeature(user, feature)) return null;
  return error(`${featureLabel(feature)} is disabled for your account.`, 403);
}

/** Enforce + consume a daily quota, returning a 429 response when exhausted. */
export async function enforceQuota(
  user: User,
  kind: QuotaKind
): Promise<NextResponse | null> {
  const result = await consumeQuota(user, kind);
  if (!result.ok) {
    return NextResponse.json(
      {
        error: "Daily limit reached for your plan. Upgrade for more.",
        quota: result,
      },
      { status: 429 }
    );
  }
  return null;
}

export function isResponse(x: unknown): x is NextResponse {
  return x instanceof NextResponse;
}
