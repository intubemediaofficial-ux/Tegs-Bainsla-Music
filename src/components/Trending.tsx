"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { CopyButton } from "./Copy";
import { VideoDetailModal, TagRankBlock, type VideoRef } from "./VideoDetail";

interface TrendingVideo {
  videoId: string;
  title: string;
  channel: string;
  views: number;
  publishedText: string;
  thumbnail: string;
  url: string;
  velocity: number;
  viralScore: number;
}
interface Snapshot {
  categoryId: string;
  label: string;
  query: string;
  updatedAt: string;
  videos: TrendingVideo[];
  insight: {
    topTags: { tag: string; count: number }[];
    topHashtags: { tag: string; count: number }[];
    titleWords: { word: string; count: number }[];
    recommendation: string;
  };
}
interface Category {
  id: string;
  label: string;
  query: string;
}

function freshness(updatedAt: string): string {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(updatedAt)) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} days ago`;
}

export function Trending({ isAdmin }: { isAdmin: boolean }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openVideo, setOpenVideo] = useState<VideoRef | null>(null);

  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [adhoc, setAdhoc] = useState<Snapshot | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/trending");
    const j = await r.json();
    setSnapshots(j.snapshots ?? []);
    setCategories(j.categories ?? []);
    if (!active && j.snapshots?.[0]) setActive(j.snapshots[0].categoryId);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    setRefreshing(true);
    try {
      const r = await fetch("/api/trending", { method: "POST" });
      const j = await r.json();
      if (r.ok) {
        setSnapshots(j.snapshots ?? []);
        setCategories(j.categories ?? []);
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const r = await fetch("/api/trending/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed");
      setAdhoc(j.snapshot);
      setActive(j.snapshot.categoryId);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSearching(false);
    }
  }

  if (loading) return <div className="card text-slate-400">Loading trending data…</div>;

  const all = adhoc ? [adhoc, ...snapshots] : snapshots;
  const current = all.find((s) => s.categoryId === active) ?? all[0];

  return (
    <div className="space-y-4">
      <form onSubmit={search} className="card flex flex-wrap gap-3">
        <input
          className="input flex-1"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search any category / singer / artist / song — e.g. krishna bhajan, kd desirock"
        />
        <button className="btn-primary" disabled={searching}>
          {searching ? "Searching…" : "Search trends"}
        </button>
      </form>
      {searchError && <div className="card border-red-500/40 text-red-300">{searchError}</div>}

      <div className="flex flex-wrap items-center gap-2">
        {adhoc && (
          <button
            onClick={() => setActive(adhoc.categoryId)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              current?.categoryId === adhoc.categoryId
                ? "bg-brand-600 text-white shadow-lg shadow-brand-600/20"
                : "border border-brand-500/50 bg-ink-card text-brand-200"
            }`}
          >
            🔎 {adhoc.label}
          </button>
        )}
        {snapshots.map((s) => (
          <button
            key={s.categoryId}
            onClick={() => setActive(s.categoryId)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              current?.categoryId === s.categoryId
                ? "bg-brand-600 text-white shadow-lg shadow-brand-600/20"
                : "border border-ink-line bg-ink-card text-slate-300 hover:border-brand-500/60"
            }`}
          >
            {s.label}
          </button>
        ))}
        <button onClick={refresh} disabled={refreshing} className="btn-ghost ml-auto font-bold">
          {refreshing ? "Refreshing…" : "↻ Refresh now"}
        </button>
      </div>

      {!current ? (
        <div className="card text-slate-400">
          No trending snapshots yet.{" "}
          {isAdmin ? "Click “Refresh now” to populate, or search a query above." : "Search a query above, or ask an admin to refresh."}
          {categories.length > 0 && (
            <div className="mt-2 text-xs">Tracked: {categories.map((c) => c.label).join(", ")}</div>
          )}
        </div>
      ) : (
        <>
          <div className="card border-brand-500/40 bg-gradient-to-br from-brand-600/10 via-ink-card to-ink-card">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-black text-brand-200">🔥 Why it&apos;s viral</h2>
              <span className="chip text-[11px]">Updated {freshness(current.updatedAt)}</span>
            </div>
            <p className="text-sm font-medium text-slate-200">{current.insight.recommendation}</p>
            <div className="mt-3 flex flex-col gap-4 md:flex-row">
              <div className="flex-1">
                <TagRankBlock
                  title="Common tags (trend rank)"
                  tags={current.insight.topTags.map((t, i) => ({ tag: t.tag, rank: i + 1 }))}
                  emptyNote="No public tags found on the top videos."
                />
              </div>
              <InsightList
                title="Common hashtags"
                items={current.insight.topHashtags.map((t) => t.tag)}
                copyable
              />
              <InsightList
                title="Title words"
                items={current.insight.titleWords.map((t) => t.word)}
              />
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Only uploads from the last 30 days count as trending. Auto-refreshes every few hours —
              hit “Refresh now” for this second&apos;s data. Last built{" "}
              {new Date(current.updatedAt).toLocaleString()}.
            </p>
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-black text-slate-100">
              Trending now · {current.label}
            </h2>
            <p className="text-xs text-slate-500">
              Click a video for its description + real tags (with search rank) — no jump to YouTube.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {current.videos.slice(0, 12).map((v) => (
              <button
                key={v.videoId}
                onClick={() =>
                  setOpenVideo({
                    videoId: v.videoId,
                    title: v.title,
                    channel: v.channel,
                    views: v.views,
                    publishedText: v.publishedText,
                    thumbnail: v.thumbnail,
                    url: v.url,
                  })
                }
                className="flex gap-3 rounded-xl border border-ink-line bg-ink-card p-2 text-left transition hover:border-brand-500"
              >
                <Image
                  src={v.thumbnail}
                  alt={v.title}
                  width={140}
                  height={80}
                  unoptimized
                  className="h-20 w-32 shrink-0 rounded object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-sm font-bold text-slate-100">{v.title}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {v.views.toLocaleString()} views · {v.publishedText}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    <span className="rounded bg-brand-600/30 px-1.5 py-0.5 text-brand-200">
                      🔥 {v.viralScore}
                    </span>
                    <span className="text-slate-500">
                      {Math.round(v.velocity).toLocaleString()} views/hr
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {openVideo && (
        <VideoDetailModal
          video={openVideo}
          seed={current?.query}
          onClose={() => setOpenVideo(null)}
        />
      )}
    </div>
  );
}

function InsightList({
  title,
  items,
  copyable = false,
}: {
  title: string;
  items: string[];
  copyable?: boolean;
}) {
  return (
    <div className="flex-1">
      <div className="mb-1 flex items-center justify-between">
        <div className="label mb-0">{title}</div>
        {copyable && items.length > 0 && (
          <CopyButton text={items.join(", ")} label="Copy" className="btn-ghost px-2 py-0.5 text-xs" />
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {items.slice(0, 12).map((i) => (
          <span key={i} className="chip">
            {i}
          </span>
        ))}
      </div>
    </div>
  );
}
