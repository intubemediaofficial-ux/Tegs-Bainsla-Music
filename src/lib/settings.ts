import { store } from "./store";
import type { PlanId } from "./plans";

/**
 * Runtime settings the admin panel can change without a redeploy.
 *
 * Every value falls back to the matching environment variable, so an untouched
 * deployment behaves exactly as before. Values are cached in memory and the
 * cache is refreshed by `primeSettings()` (called on every authenticated API
 * request) so synchronous callers such as `hasYouTubeApiKey()` stay accurate.
 */

export interface AppSettings {
  /** YouTube Data API v3 keys, used in order until one is not rate-limited. */
  youtubeApiKeys: string[];
  googleClientId: string;
  googleClientSecret: string;
  cronSecret: string;
  appUrl: string;
  /** Allow new self-service sign-ups on /register. */
  signupsEnabled: boolean;
  /** Plan given to a self-service sign-up. */
  defaultPlan: PlanId;
  /** Banner shown to every signed-in user (empty = hidden). */
  announcement: string;
}

const KEY = "settings:app";

const ENV_DEFAULTS = (): AppSettings => ({
  youtubeApiKeys: (process.env.YOUTUBE_API_KEY ?? "")
    .split(/[\s,]+/)
    .map((k) => k.trim())
    .filter(Boolean),
  googleClientId: process.env.GOOGLE_CLIENT_ID?.trim() ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "",
  cronSecret: process.env.CRON_SECRET?.trim() ?? "",
  appUrl: (process.env.APP_URL ?? "https://tag.bainslamusic.com").replace(/\/+$/, ""),
  signupsEnabled: true,
  defaultPlan: "free",
  announcement: "",
});

/** What is actually persisted: only the fields an admin has changed. */
type StoredSettings = Partial<AppSettings>;

let cache: AppSettings = ENV_DEFAULTS();
let loaded = false;

function merge(stored: StoredSettings | null): AppSettings {
  const base = ENV_DEFAULTS();
  if (!stored) return base;
  return {
    youtubeApiKeys: stored.youtubeApiKeys?.length ? stored.youtubeApiKeys : base.youtubeApiKeys,
    googleClientId: stored.googleClientId || base.googleClientId,
    googleClientSecret: stored.googleClientSecret || base.googleClientSecret,
    cronSecret: stored.cronSecret || base.cronSecret,
    appUrl: stored.appUrl || base.appUrl,
    signupsEnabled: stored.signupsEnabled ?? base.signupsEnabled,
    defaultPlan: stored.defaultPlan ?? base.defaultPlan,
    announcement: stored.announcement ?? base.announcement,
  };
}

export async function getSettings(): Promise<AppSettings> {
  const stored = await store.get<StoredSettings>(KEY);
  cache = merge(stored);
  loaded = true;
  return cache;
}

/** Refresh the in-memory cache once per process, then keep it warm cheaply. */
export async function primeSettings(): Promise<void> {
  await getSettings();
}

/** Last known settings without hitting the store (see `primeSettings`). */
export function settingsSync(): AppSettings {
  return cache;
}

export function settingsLoaded(): boolean {
  return loaded;
}

export async function updateSettings(patch: StoredSettings): Promise<AppSettings> {
  const stored = (await store.get<StoredSettings>(KEY)) ?? {};
  const next: StoredSettings = { ...stored, ...patch };
  await store.set(KEY, next);
  cache = merge(next);
  loaded = true;
  return cache;
}

/** First configured YouTube Data API key, if any. */
export function youtubeApiKey(): string | undefined {
  return settingsSync().youtubeApiKeys[0];
}

/** Show a secret as `AIza…7f2c` so an admin can confirm which key is live. */
export function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "•".repeat(value.length);
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}
