export type PlanId = "free" | "starter" | "creator" | "admin";

export interface PlanLimits {
  /** per-day generate calls (tags/titles/hashtags/package each counted together) */
  generations: number;
  /** per-day keyword research + rank checks */
  research: number;
  /** max saved artist presets */
  artists: number;
  /** max tags returned in the 500-char box */
  maxTags: number;
}

export interface Plan {
  id: PlanId;
  name: string;
  price: number; // USD / month
  blurb: string;
  limits: PlanLimits;
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    blurb: "Try Bainsla Music Tags for free",
    limits: { generations: 15, research: 5, artists: 3, maxTags: 40 },
    features: [
      "15 generations / day",
      "5 keyword researches / day",
      "3 saved artist presets",
      "500-char tag box",
      "Trending feed (view)",
    ],
  },
  starter: {
    id: "starter",
    name: "Starter",
    price: 6,
    blurb: "Improved limits & no ads",
    limits: { generations: 60, research: 40, artists: 15, maxTags: 100 },
    features: [
      "60 generations / day",
      "40 keyword researches / day",
      "15 saved artist presets",
      "Full title analyzer",
      "Chrome extension access",
    ],
  },
  creator: {
    id: "creator",
    name: "Creator",
    price: 15,
    blurb: "Power tools for creators & labels",
    limits: { generations: 200, research: 150, artists: 100, maxTags: 200 },
    features: [
      "200 generations / day",
      "150 keyword researches / day",
      "100 saved artist presets",
      "Why-viral analysis + trending alerts",
      "Priority Chrome extension",
      "Bulk export",
    ],
  },
  admin: {
    id: "admin",
    name: "Admin",
    price: 0,
    blurb: "Unlimited (staff)",
    limits: {
      generations: 1_000_000,
      research: 1_000_000,
      artists: 1_000_000,
      maxTags: 200,
    },
    features: ["Unlimited everything", "Admin panel"],
  },
};

export function planLimits(id: PlanId): PlanLimits {
  return (PLANS[id] ?? PLANS.free).limits;
}
