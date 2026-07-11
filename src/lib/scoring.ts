import type { VideoLite } from "./types";

/**
 * Heuristic keyword metrics derived from real public search data (like the free
 * tiers of RapidTags / KeywordTool). These are smart estimates, not exact
 * Google numbers — swap in a paid data source or YOUTUBE_API_KEY later for
 * precise figures.
 */
export interface KeywordScore {
  difficulty: number; // 0-100 (higher = harder to rank)
  volume: number; // 0-100 relative search interest
  competition: number; // 0-100
  opportunity: number; // 0-100 (higher = better to target)
}

export function scoreKeyword(
  keyword: string,
  suggestionCount: number,
  videos: VideoLite[]
): KeywordScore {
  const topViews = videos.slice(0, 10).map((v) => v.views);
  const avgTopViews =
    topViews.length > 0 ? topViews.reduce((a, b) => a + b, 0) / topViews.length : 0;

  // Volume proxy: autocomplete breadth + how big the top videos are.
  const volume = clamp(
    Math.round(
      Math.min(100, suggestionCount * 1.2) * 0.5 +
        Math.min(100, Math.log10(avgTopViews + 1) * 14) * 0.5
    )
  );

  // Competition proxy: how many strong (high-view) videos already rank.
  const strong = topViews.filter((v) => v > 100_000).length;
  const competition = clamp(Math.round((strong / Math.max(1, topViews.length)) * 100));

  // Difficulty blends competition with the size of the biggest incumbent.
  const maxViews = topViews.length ? Math.max(...topViews) : 0;
  const difficulty = clamp(
    Math.round(competition * 0.6 + Math.min(100, Math.log10(maxViews + 1) * 12) * 0.4)
  );

  const opportunity = clamp(Math.round(volume * 0.6 + (100 - difficulty) * 0.4));
  return { difficulty, volume, competition, opportunity };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/* ------------------------------- title score ------------------------------ */

export interface TitleScore {
  score: number; // 0-100
  reasons: string[];
}

export function scoreTitle(title: string, keyword?: string): TitleScore {
  const reasons: string[] = [];
  let score = 50;
  const len = title.length;

  if (len >= 30 && len <= 70) {
    score += 15;
    reasons.push("Good length (30-70 chars) — shows fully in search.");
  } else if (len < 30) {
    score -= 10;
    reasons.push("Too short — add context/keywords.");
  } else {
    score -= 8;
    reasons.push("Too long — may get truncated in search results.");
  }

  if (keyword && title.toLowerCase().includes(keyword.toLowerCase())) {
    score += 15;
    reasons.push("Contains the target keyword.");
  } else if (keyword) {
    score -= 10;
    reasons.push("Target keyword is missing from the title.");
  }

  if (/\b(20\d{2})\b/.test(title)) {
    score += 6;
    reasons.push("Includes a year — signals freshness.");
  }
  if (/[|\-–—:]/.test(title)) {
    score += 4;
    reasons.push("Uses a separator — reads clean.");
  }
  if (/(official|new|full|video|song|hd|4k)/i.test(title)) {
    score += 6;
    reasons.push("Has high-CTR power words.");
  }
  if (/[A-Z]{4,}/.test(title.replace(/\s/g, ""))) {
    score -= 4;
    reasons.push("Avoid ALL-CAPS words — can look spammy.");
  }
  if ((title.match(/[!?]/g) || []).length > 2) {
    score -= 4;
    reasons.push("Too many !/? marks.");
  }

  return { score: clamp(score), reasons };
}
