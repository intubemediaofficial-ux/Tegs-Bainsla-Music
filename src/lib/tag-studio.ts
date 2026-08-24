/**
 * Tag Studio: the data behind the in-Studio tag panel.
 *
 * Everything here is derived from public YouTube data — live autocomplete
 * demand order, the tags real ranking videos use and their view sizes. Search
 * volume is an estimate from that demand, never an exact Google figure, so the
 * UI labels it as such.
 */
import {
  buildTagString,
  cleanTags,
  expandKeywords,
  generateHashtags,
  getSuggestions,
  getVideoTags,
  isUsefulTag,
  searchVideos,
  seedFromTitle,
  shortSeedOf,
} from "./youtube";
import { hasYouTubeApiKey, fetchVideoTags } from "./youtube-api";
import { scoreKeyword, scoreTitle } from "./scoring";
import type { VideoLite } from "./types";

const DEVANAGARI = /[\u0900-\u097F]/;
export const TAG_BOX_LIMIT = 500;

export interface ScoredTag {
  tag: string;
  score: number; // 0-100 search-demand strength
  rank: number | null; // position in the live autocomplete universe
  source: "yours" | "search" | "ranking";
}

/** Demand rank -> 0-100 score (rank 1 ≈ 100, rank 40 ≈ 41, rank 80 ≈ 17). */
function rankScore(rank: number): number {
  return clamp(Math.round(100 * Math.exp(-(rank - 1) / 40)));
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Score a tag with no measurable search demand by how well it fits the title. */
function relevanceScore(tag: string, titleWords: Set<string>): number {
  const words = tag.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return 0;
  const hits = words.filter((w) => titleWords.has(w)).length;
  return clamp(8 + Math.round((hits / words.length) * 22));
}

/**
 * Autocomplete sometimes drifts into a spell-corrected neighbour ("rasiya" ->
 * "russian"). Keep only phrases that still share the seed's own words.
 */
function makeSeedRelevance(seed: string) {
  const words = seed
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  // The longest word carries the meaning ("rasiya" in "new rasiya song"), so a
  // candidate that drops it is a different search, not a variation.
  const core = words.reduce((a, b) => (b.length > a.length ? b : a), "");
  return (candidate: string): boolean => {
    if (!words.length) return true;
    const c = candidate.toLowerCase();
    if (c.includes(seed.toLowerCase())) return true;
    if (core.length >= 4 && !c.includes(core)) return false;
    const hits = words.filter((w) => c.includes(w)).length;
    return hits / words.length >= 0.5;
  };
}

/** Relevant to *any* of the seeds we researched (title + the user's own tags). */
function makeRelevance(seeds: string[]) {
  const tests = seeds.filter(Boolean).map(makeSeedRelevance);
  return (candidate: string): boolean =>
    tests.length === 0 || tests.some((t) => t(candidate));
}

function normalise(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const t = raw.trim();
    const n = t.toLowerCase();
    if (!t || seen.has(n)) continue;
    seen.add(n);
    out.push(t);
  }
  return out;
}

/**
 * Build the live search-demand universe. The main seed is expanded fully; the
 * extra seeds (the other script half of the title, the strongest tags already
 * in the box) get a shallow probe so Hinglish *and* Devanagari tags both get
 * ranked instead of only the script the title happens to start with.
 */
async function buildUniverse(
  seed: string,
  extras: string[],
  hl: string,
  gl: string
): Promise<string[]> {
  const base = shortSeedOf(seed);
  if (!base) return [];
  const lists = await Promise.all([
    expandKeywords(base, hl, gl),
    // Hindi market: probe the other script too so mixed tag sets get ranked.
    expandKeywords(base, "hi", gl, 8),
    ...extras
      .map((s) => shortSeedOf(s))
      .filter((s) => s && s !== base)
      .slice(0, 4)
      .map((s) => expandKeywords(s, hl, gl, 6)),
  ]);
  const universe: string[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const u of list) {
      const n = u.trim().toLowerCase();
      if (!n || seen.has(n)) continue;
      seen.add(n);
      universe.push(n);
    }
  }
  return universe;
}

function ranker(universe: string[]) {
  const index = new Map<string, number>();
  universe.forEach((u, i) => {
    if (!index.has(u)) index.set(u, i + 1);
  });
  return (tag: string): number | null => {
    const n = tag.trim().toLowerCase();
    if (!n) return null;
    const exact = index.get(n);
    if (exact) return exact;
    // Substring demand: "dg mawai rasiya" gets credit from "dg mawai rasiya new".
    for (const [u, i] of index) {
      if (u.includes(n) || n.includes(u)) return i + 4;
    }
    return null;
  };
}

/**
 * A tag's own search demand: ask autocomplete for the tag itself. A tag people
 * really type comes back with its own completions (and often as an exact hit),
 * so a Hinglish tag stays strong even when the title is in Devanagari.
 */
async function selfDemand(
  tags: string[],
  hl: string,
  gl: string
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const probes = tags.slice(0, 30);
  const lists = await Promise.all(probes.map((t) => getSuggestions(t, hl, gl).catch(() => [])));
  probes.forEach((tag, i) => {
    const n = tag.trim().toLowerCase();
    const list = lists[i].map((s) => s.trim().toLowerCase());
    if (!list.length) {
      out.set(n, 0);
      return;
    }
    const exact = list.indexOf(n);
    const words = n.split(/\s+/).length;
    const score =
      Math.min(45, list.length * 4.5) + // breadth of demand around the tag
      (exact >= 0 ? Math.max(6, 35 - exact * 4) : 0) + // typed as-is by people
      (words > 4 ? -12 : words === 1 ? 4 : 0); // very long tags dilute
    out.set(n, clamp(Math.round(score)));
  });
  return out;
}

/** Tags used by the videos that already rank for this seed. */
async function tagsFromRankingVideos(videos: VideoLite[], max = 6): Promise<string[]> {
  const ids = videos.slice(0, max).map((v) => v.videoId);
  const lists = await Promise.all(
    ids.map((id) => (hasYouTubeApiKey() ? fetchVideoTags(id) : getVideoTags(id)).catch(() => []))
  );
  const counts = new Map<string, { tag: string; count: number }>();
  for (const list of lists) {
    for (const tag of cleanTags(list)) {
      const n = tag.toLowerCase();
      const prev = counts.get(n);
      if (prev) prev.count += 1;
      else counts.set(n, { tag, count: 1 });
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .map((x) => x.tag)
    .filter(isUsefulTag);
}

export interface TagStudioReport {
  seed: string;
  titleScore: { score: number; reasons: string[] };
  yours: ScoredTag[]; // the tags currently in the box, best demand first
  weak: ScoredTag[]; // tags with no measurable demand — candidates to drop
  suggestions: ScoredTag[]; // high-demand tags not in the box yet
  fromRanking: ScoredTag[]; // tags the ranking videos use
  hashtags: string[];
  autofit: { text: string; used: string[]; length: number; limit: number };
  competitors: {
    videoId: string;
    title: string;
    channel: string;
    views: number;
    thumbnail: string;
  }[];
}

/**
 * One call for the Studio panel: scores the tags already in the box, proposes
 * stronger ones (live demand + what ranking videos use) and packs the best set
 * into YouTube's 500-character limit.
 */
export async function tagStudioReport(
  title: string,
  currentTags: string[],
  opts: { hl?: string; gl?: string } = {}
): Promise<TagStudioReport> {
  const hl = opts.hl ?? "en";
  const gl = opts.gl ?? "IN";
  const seed = seedFromTitle(title) || shortSeedOf(title);

  const mine = normalise(currentTags);
  const [universe, videos, demand] = await Promise.all([
    buildUniverse(seed || title, [title, ...mine.slice(0, 3)], hl, gl),
    searchVideos(seed || title, hl, gl, 12),
    selfDemand(mine, hl, gl),
  ]);
  const rankOf = ranker(universe);
  const rankingTags = await tagsFromRankingVideos(videos);

  const titleWords = new Set(
    title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\p{M}\s]/gu, " ")
      .split(/\s+/)
      .filter(Boolean)
  );

  const used = new Set(mine.map((t) => t.toLowerCase()));

  const yours: ScoredTag[] = [];
  const weak: ScoredTag[] = [];
  for (const tag of mine) {
    const rank = rankOf(tag);
    const own = demand.get(tag.toLowerCase()) ?? 0;
    const score = Math.max(rank ? rankScore(rank) : 0, own);
    const entry: ScoredTag = { tag, score, rank: rank ?? null, source: "yours" };
    // "Weak" means nobody searches it — not merely that it is off-title.
    if (score >= 20) yours.push(entry);
    else weak.push({ ...entry, score: Math.max(score, relevanceScore(tag, titleWords)) });
  }
  yours.sort((a, b) => b.score - a.score);
  weak.sort((a, b) => b.score - a.score);

  const relevant = makeRelevance([seed || title, ...mine.slice(0, 3)]);
  const suggestions: ScoredTag[] = [];
  universe.forEach((u, i) => {
    if (suggestions.length >= 25) return;
    if (used.has(u) || !isUsefulTag(u) || u.length > 60 || !relevant(u)) return;
    used.add(u);
    suggestions.push({ tag: u, score: rankScore(i + 1), rank: i + 1, source: "search" });
  });
  if (suggestions.length < 12) {
    // Long or fully Devanagari titles can filter down to almost nothing; keep
    // the demand order rather than showing an empty list.
    universe.forEach((u, i) => {
      if (suggestions.length >= 12) return;
      if (used.has(u) || !isUsefulTag(u) || u.length > 60) return;
      used.add(u);
      suggestions.push({ tag: u, score: rankScore(i + 1), rank: i + 1, source: "search" });
    });
    suggestions.sort((a, b) => b.score - a.score);
  }

  const rankingPicks: string[] = [];
  for (const tag of rankingTags) {
    if (rankingPicks.length >= 20) break;
    const n = tag.toLowerCase();
    if (used.has(n)) continue;
    used.add(n);
    rankingPicks.push(tag);
  }
  const rankingDemand = await selfDemand(rankingPicks, hl, gl);
  const fromRanking: ScoredTag[] = rankingPicks.map((tag) => {
    const rank = rankOf(tag);
    const own = rankingDemand.get(tag.toLowerCase()) ?? 0;
    return {
      tag,
      score: Math.max(rank ? rankScore(rank) : 0, own, relevanceScore(tag, titleWords)),
      rank,
      source: "ranking",
    };
  });
  fromRanking.sort((a, b) => b.score - a.score);

  // Auto-fit: keep the user's strong tags first, then fill with the best new
  // ones (drop near-duplicates so the 500 characters are not wasted).
  const best = dedupeOverlap([
    ...yours.map((t) => t.tag),
    ...suggestions.slice(0, 20).map((t) => t.tag),
    ...fromRanking.slice(0, 15).map((t) => t.tag),
  ]);
  const packed = buildTagString(best, TAG_BOX_LIMIT);

  return {
    seed: seed || title,
    titleScore: scoreTitle(title, seed),
    yours,
    weak,
    suggestions,
    fromRanking,
    hashtags: generateHashtags(
      seed || title,
      universe.filter(relevant),
      12
    ),
    autofit: {
      text: packed.text,
      used: packed.used,
      length: packed.text.length,
      limit: TAG_BOX_LIMIT,
    },
    competitors: videos.slice(0, 8).map((v) => ({
      videoId: v.videoId,
      title: v.title,
      channel: v.channel,
      views: v.views,
      thumbnail: v.thumbnail,
    })),
  };
}

/**
 * Drop tags that are fully contained in a tag we already kept — YouTube already
 * matches those, so spending characters on both wastes the 500-char budget.
 */
function dedupeOverlap(tags: string[]): string[] {
  const kept: string[] = [];
  for (const raw of tags) {
    const t = raw.trim();
    const n = t.toLowerCase();
    if (!n) continue;
    if (kept.some((k) => k.toLowerCase() === n)) continue;
    // A short tag that is a substring of a longer kept tag is redundant.
    if (n.split(/\s+/).length > 1 && kept.some((k) => k.toLowerCase().includes(n))) continue;
    kept.push(t);
  }
  return kept;
}

export interface KeywordInsight {
  keyword: string;
  score: number; // 0-100 overall (vidIQ-style)
  monthlySearches: number; // estimate, from live demand + top-video sizes
  competitionLabel: "Low" | "Medium" | "High";
  volume: number;
  competition: number;
  difficulty: number;
  opportunity: number;
  related: ScoredTag[];
  topVideos: { videoId: string; title: string; channel: string; views: number }[];
}

function round2(n: number): number {
  if (n < 100) return Math.round(n);
  const mag = Math.pow(10, Math.floor(Math.log10(n)) - 1);
  return Math.round(n / mag) * mag;
}

/**
 * Clicking a tag: what people around it search, how contested it is and which
 * neighbouring tags to add. Volume is an estimate derived from autocomplete
 * breadth and the view size of the videos that rank for it.
 */
export async function keywordInsight(
  keyword: string,
  opts: { hl?: string; gl?: string } = {}
): Promise<KeywordInsight> {
  const hl = opts.hl ?? "en";
  const gl = opts.gl ?? "IN";
  const k = keyword.trim();

  const [universe, videos, direct] = await Promise.all([
    expandKeywords(k, hl, gl, DEVANAGARI.test(k) ? 8 : 14),
    searchVideos(k, hl, gl, 12),
    getSuggestions(k, hl, gl),
  ]);

  const metrics = scoreKeyword(k, universe.length, videos);
  const relevant = makeRelevance([k]);
  const related: ScoredTag[] = [];
  const seen = new Set([k.toLowerCase()]);
  for (const list of [direct, universe]) {
    list.forEach((u, i) => {
      const n = u.trim().toLowerCase();
      if (related.length >= 20 || !n || seen.has(n) || !isUsefulTag(n) || !relevant(n)) return;
      seen.add(n);
      related.push({ tag: n, score: rankScore(i + 1), rank: i + 1, source: "search" });
    });
  }

  const avgTopViews =
    videos.length > 0
      ? videos.slice(0, 10).reduce((a, v) => a + v.views, 0) / Math.min(10, videos.length)
      : 0;
  const estimate = Math.pow(10, 2 + metrics.volume / 25) * (avgTopViews > 0 ? 1 : 0.3);

  return {
    keyword: k,
    score: clamp(Math.round(metrics.volume * 0.6 + metrics.opportunity * 0.4)),
    monthlySearches: round2(estimate),
    competitionLabel:
      metrics.competition >= 66 ? "High" : metrics.competition >= 33 ? "Medium" : "Low",
    volume: metrics.volume,
    competition: metrics.competition,
    difficulty: metrics.difficulty,
    opportunity: metrics.opportunity,
    related,
    topVideos: videos.slice(0, 6).map((v) => ({
      videoId: v.videoId,
      title: v.title,
      channel: v.channel,
      views: v.views,
    })),
  };
}
