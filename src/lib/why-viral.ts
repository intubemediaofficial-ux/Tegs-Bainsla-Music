/**
 * Best-effort attribution for *why* a public video is winning.
 *
 * YouTube keeps CTR, watch time and traffic sources private to a video's owner,
 * so nothing here is an official metric. It compares only public signals — view
 * velocity, the video's own tags against the demand the category actually
 * searches, title placement, and how far the video outran its channel's normal
 * performance — and reports the strongest of them as an estimate.
 */

export type ViralReason = "THUMBNAIL" | "TAGS" | "TITLE" | "CHANNEL" | "SPEED";

export interface ViralWhy {
  reason: ViralReason;
  /** Short badge text, e.g. "Thumbnail is pulling the clicks". */
  label: string;
  /** One line of evidence + the weakest part to improve. */
  note: string;
}

export interface WhyInput {
  velocity: number;
  /** Median velocity of the other videos on the same board. */
  boardVelocity: number;
  views: number;
  /** The video's own public tags (empty when the creator hides them). */
  tags: string[];
  /** Tags that actually carry search demand for this topic. */
  demandTags: string[];
  title: string;
  /** Keyword the category really searches for (rank 1 demand tag). */
  topKeyword: string;
  channelSubscribers: number;
  /** Lifetime views / video count for the channel, 0 when unknown. */
  channelAvgViews: number;
}

const HOT = 1.4; // velocity multiple over the board that counts as "fast"

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Share of the video's tags that carry real search demand (0-1). */
function tagHitRate(tags: string[], demandTags: string[]): number {
  if (tags.length === 0) return 0;
  const demand = new Set(demandTags.map(norm));
  const hits = tags.filter((t) => demand.has(norm(t))).length;
  return hits / tags.length;
}

export function explainVideo(input: WhyInput): ViralWhy {
  const {
    velocity,
    boardVelocity,
    views,
    tags,
    demandTags,
    title,
    topKeyword,
    channelSubscribers,
    channelAvgViews,
  } = input;

  const speedRatio = boardVelocity > 0 ? velocity / boardVelocity : 1;
  const hitRate = tagHitRate(tags, demandTags);
  const keyword = norm(topKeyword);
  const head = norm(title).slice(0, 45);
  const titleEarly = keyword.length > 0 && head.includes(keyword);
  // Did it beat what this channel normally gets? >2x means discovery, not just subs.
  const overperform = channelAvgViews > 0 ? views / channelAvgViews : 1;

  if (channelAvgViews > 0 && overperform < 1.2 && channelSubscribers >= 200_000) {
    return {
      reason: "CHANNEL",
      label: "Channel audience is carrying it",
      note: `${fmt(channelSubscribers)} subscribers and views are around this channel's normal (${fmt(
        channelAvgViews
      )}/video) — subscribers, not new search traffic. ${weakest(hitRate, titleEarly)}`,
    };
  }

  if (tags.length > 0 && hitRate >= 0.4) {
    return {
      reason: "TAGS",
      label: "Tags / search are pulling it",
      note: `${Math.round(hitRate * 100)}% of its tags are ones people actually search (${
        tags.length
      } tags total)${titleEarly ? " and the top keyword sits early in the title" : ""}. Copy these tags.`,
    };
  }

  if (titleEarly) {
    return {
      reason: "TITLE",
      label: "Title keyword is winning",
      note: `The searched keyword "${topKeyword}" sits in the first few words of the title. ${weakest(
        hitRate,
        true
      )}`,
    };
  }

  if (speedRatio >= HOT) {
    return {
      reason: "THUMBNAIL",
      label: "Thumbnail is pulling the clicks",
      note: `${Math.round(speedRatio * 10) / 10}x the views/hr of the rest of this board while its tags${
        tags.length === 0 ? " are hidden" : " barely rank"
      } and the title has no top keyword — the clicks are coming from the thumbnail. Study it, then fix your tags/title too.`,
    };
  }

  return {
    reason: "SPEED",
    label: "Steady climb",
    note: `Growing at ${Math.round(velocity).toLocaleString()} views/hr, in line with the rest of the board. ${weakest(
      hitRate,
      titleEarly
    )}`,
  };
}

function weakest(hitRate: number, titleEarly: boolean): string {
  if (hitRate < 0.3) return "Its tags hardly rank — that's the gap you can beat it on.";
  if (!titleEarly) return "Its title misses the top keyword — put yours in the first few words.";
  return "";
}

function fmt(n: number): string {
  if (n >= 10_000_000) return `${Math.round(n / 1_000_000)}M`;
  if (n >= 100_000) return `${Math.round(n / 1000)}K`;
  return n.toLocaleString();
}
