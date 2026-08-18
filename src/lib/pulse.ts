import { store } from "./store";
import { fetchVideoDetails } from "./youtube-api";

/**
 * View-count history for individual videos.
 *
 * YouTube's official "last 60 minutes / last 48 hours" realtime report only
 * exists for a channel's *own* videos (see `analytics.ts`). For every other
 * video all we have is the public lifetime view count — so we sample it every
 * time someone looks at the video and diff consecutive samples. After the
 * second sample the deltas below are *measured*, not estimated.
 */

export interface PulseSample {
  /** Epoch ms. */
  t: number;
  views: number;
  likes: number;
  comments: number;
}

export interface PulseDelta {
  /** Views gained inside the window. */
  views: number;
  /** Hours actually covered by the samples (< window when history is short). */
  coveredHours: number;
  /** False when derived from the lifetime average instead of real samples. */
  measured: boolean;
}

export interface VideoPulse {
  last60m: PulseDelta;
  last24h: PulseDelta;
  last48h: PulseDelta;
  /** Views per hour over the whole life of the video. */
  lifetimeVph: number;
  /** Views per hour measured from the most recent samples (falls back to lifetime). */
  currentVph: number;
  /** True once at least two samples exist, i.e. real measurement is happening. */
  tracking: boolean;
  samples: PulseSample[];
}

const MAX_SAMPLES = 240;
const MAX_AGE_MS = 8 * 24 * 60 * 60 * 1000;
/** Ignore samples closer together than this so a page refresh doesn't spam history. */
const MIN_GAP_MS = 60 * 1000;

const key = (videoId: string) => `pulse:${videoId}`;

async function readSamples(videoId: string): Promise<PulseSample[]> {
  const raw = await store.get<PulseSample[]>(key(videoId));
  if (!Array.isArray(raw)) return [];
  const cutoff = Date.now() - MAX_AGE_MS;
  return raw
    .filter((s) => typeof s?.t === "number" && s.t >= cutoff && typeof s.views === "number")
    .sort((a, b) => a.t - b.t);
}

/** Append a sample (deduped by MIN_GAP_MS) and return the full history. */
export async function recordSample(
  videoId: string,
  sample: Omit<PulseSample, "t">
): Promise<PulseSample[]> {
  const now = Date.now();
  const history = await readSamples(videoId);
  const last = history[history.length - 1];

  let next: PulseSample[];
  if (last && now - last.t < MIN_GAP_MS) {
    // Same minute: keep one row but refresh its counters.
    next = [...history.slice(0, -1), { ...last, views: sample.views, likes: sample.likes, comments: sample.comments }];
  } else {
    next = [...history, { t: now, ...sample }];
  }
  if (next.length > MAX_SAMPLES) next = next.slice(next.length - MAX_SAMPLES);

  await store.set(key(videoId), next);
  return next;
}

/**
 * Views gained inside `windowHours`, using the oldest sample that still falls
 * inside the window (or the oldest sample we have, reporting the shorter span).
 */
function windowDelta(samples: PulseSample[], windowHours: number, fallbackVph: number): PulseDelta {
  const latest = samples[samples.length - 1];
  if (!latest || samples.length < 2) {
    return {
      views: Math.round(fallbackVph * windowHours),
      coveredHours: 0,
      measured: false,
    };
  }

  const cutoff = latest.t - windowHours * 3600_000;
  // Prefer the newest sample at/older than the cutoff so the window is fully covered.
  const inside = samples.filter((s) => s.t >= cutoff);
  const before = samples.filter((s) => s.t < cutoff);
  const base = before.length > 0 ? before[before.length - 1] : inside[0];
  if (!base || base === latest) {
    return { views: Math.round(fallbackVph * windowHours), coveredHours: 0, measured: false };
  }

  const coveredHours = (latest.t - base.t) / 3600_000;
  return {
    views: Math.max(0, latest.views - base.views),
    coveredHours: Math.round(coveredHours * 100) / 100,
    measured: true,
  };
}

/** Recent views-per-hour from the last samples, falling back to the lifetime rate. */
function recentVph(samples: PulseSample[], lifetimeVph: number): number {
  if (samples.length < 2) return lifetimeVph;
  const latest = samples[samples.length - 1];
  // Walk back until at least 20 minutes are covered to smooth out noise.
  for (let i = samples.length - 2; i >= 0; i -= 1) {
    const hours = (latest.t - samples[i].t) / 3600_000;
    if (hours >= 1 / 3) {
      return Math.round(Math.max(0, latest.views - samples[i].views) / hours);
    }
  }
  const first = samples[0];
  const hours = (latest.t - first.t) / 3600_000;
  return hours > 0 ? Math.round(Math.max(0, latest.views - first.views) / hours) : lifetimeVph;
}

/* ------------------------------- watchlist -------------------------------- */

/**
 * Videos someone has opened recently. A cron job re-samples these every few
 * minutes so the 60-minute window fills with real measurements instead of
 * waiting for the next page view.
 */
const WATCH_KEY = "pulse:watchlist";
const WATCH_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_WATCHED = 300;

type Watchlist = Record<string, number>;

export async function markWatched(videoId: string): Promise<void> {
  const raw = (await store.get<Watchlist>(WATCH_KEY)) ?? {};
  const cutoff = Date.now() - WATCH_TTL_MS;
  const next: Watchlist = { [videoId]: Date.now() };
  for (const [id, seen] of Object.entries(raw)) {
    if (id !== videoId && typeof seen === "number" && seen >= cutoff) next[id] = seen;
  }
  const trimmed = Object.entries(next)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_WATCHED);
  await store.set(WATCH_KEY, Object.fromEntries(trimmed));
}

export async function listWatched(): Promise<string[]> {
  const raw = (await store.get<Watchlist>(WATCH_KEY)) ?? {};
  const cutoff = Date.now() - WATCH_TTL_MS;
  return Object.entries(raw)
    .filter(([, seen]) => typeof seen === "number" && seen >= cutoff)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
}

/**
 * Record the current counters for a video and return its measured pulse.
 * `ageHours` is the video's age, used for the lifetime fallback before any
 * second sample exists.
 */
export async function trackVideo(
  videoId: string,
  counters: Omit<PulseSample, "t">,
  ageHours: number
): Promise<VideoPulse> {
  const samples = await recordSample(videoId, counters);
  await markWatched(videoId);
  const lifetimeVph = ageHours > 0 ? Math.round(counters.views / ageHours) : counters.views;

  return {
    last60m: windowDelta(samples, 1, lifetimeVph),
    last24h: windowDelta(samples, 24, lifetimeVph),
    last48h: windowDelta(samples, 48, lifetimeVph),
    lifetimeVph,
    currentVph: recentVph(samples, lifetimeVph),
    tracking: samples.length >= 2,
    samples,
  };
}

/**
 * Re-sample every watched video in one batched `videos.list` call (1 quota unit
 * per 50 videos). Called by the pulse cron so the 60-minute window keeps moving
 * even while nobody is looking at the page.
 */
export async function sampleWatched(limit = 150): Promise<{ sampled: number }> {
  const ids = (await listWatched()).slice(0, limit);
  if (ids.length === 0) return { sampled: 0 };

  const details = await fetchVideoDetails(ids);
  let sampled = 0;
  for (const id of ids) {
    const d = details.get(id);
    if (!d) continue;
    await recordSample(id, { views: d.views, likes: d.likes, comments: d.comments });
    sampled += 1;
  }
  return { sampled };
}
