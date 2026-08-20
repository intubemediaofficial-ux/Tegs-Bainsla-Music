import type { User } from "./types";

/**
 * Per-user feature access. Everything is allowed unless an admin explicitly
 * switches a feature off for that user (`user.access[feature] === false`), so
 * existing accounts keep working untouched.
 */

export const FEATURES = [
  {
    id: "generate",
    label: "Tag & title generation",
    hint: "Full Package, Tag Generator, Title Analyzer",
  },
  {
    id: "research",
    label: "Keyword research",
    hint: "Keyword Research, Rank Checker, Channel & Competitor tags",
  },
  { id: "trending", label: "Trending / viral board", hint: "Trending pages and search" },
  { id: "extension", label: "Chrome extension", hint: "Extension API calls with the API key" },
  {
    id: "analytics",
    label: "Own-channel analytics",
    hint: "Google connect + official YouTube Analytics",
  },
] as const;

export type FeatureId = (typeof FEATURES)[number]["id"];

export const FEATURE_IDS = FEATURES.map((f) => f.id) as readonly FeatureId[];

export type FeatureAccess = Partial<Record<FeatureId, boolean>>;

export function hasFeature(user: User, feature: FeatureId): boolean {
  if (user.role === "admin") return true;
  return user.access?.[feature] !== false;
}

export function featureLabel(feature: FeatureId): string {
  return FEATURES.find((f) => f.id === feature)?.label ?? feature;
}
