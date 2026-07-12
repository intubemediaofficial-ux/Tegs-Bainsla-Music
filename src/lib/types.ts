import type { PlanId } from "./plans";

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  plan: PlanId;
  role: "user" | "admin";
  apiKey: string;
  createdAt: string;
  banned?: boolean;
}

export type PublicUser = Omit<User, "passwordHash">;

export interface UsageRecord {
  date: string; // YYYY-MM-DD (UTC)
  generations: number;
  research: number;
}

export interface ArtistPreset {
  id: string;
  userId: string;
  name: string;
  language: string;
  keywords: string[];
  createdAt: string;
}

export interface TrackedCategory {
  id: string;
  label: string; // e.g. "Haryanvi Music"
  query: string; // e.g. "haryanvi song"
  language: string;
  createdAt: string;
}

export interface VideoLite {
  videoId: string;
  title: string;
  channel: string;
  views: number;
  publishedText: string;
  thumbnail: string;
  url: string;
}

export interface PlaylistLite {
  playlistId: string;
  title: string;
  channel: string;
  videoCount: number;
  thumbnail: string;
  url: string;
}

export interface TrendingVideo extends VideoLite {
  ageHours: number;
  velocity: number; // views per hour since publish
  viralScore: number; // 0-100
}

export interface TrendingSnapshot {
  categoryId: string;
  label: string;
  query: string;
  updatedAt: string;
  videos: TrendingVideo[];
  // Why-viral aggregate insight across the fastest-rising videos
  insight: {
    topTags: { tag: string; count: number }[];
    topHashtags: { tag: string; count: number }[];
    titleWords: { word: string; count: number }[];
    recommendation: string;
  };
}
