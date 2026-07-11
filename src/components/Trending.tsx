"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { CopyButton } from "./Copy";

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

export function Trending({ isAdmin }: { isAdmin: boolean }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
      await fetch("/api/cron/refresh", { method: "POST" });
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) return <div className="card text-slate-400">Loading trending data…</div>;

  const current = snapshots.find((s) => s.categoryId === active) ?? snapshots[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {snapshots.map((s) => (
          <button
            key={s.categoryId}
            onClick={() => setActive(s.categoryId)}
            className={`rounded-full px-3 py-1 text-sm ${
              current?.categoryId === s.categoryId
                ? "bg-brand-600 text-white"
                : "border border-ink-line bg-ink-card text-slate-300"
            }`}
          >
            {s.label}
          </button>
        ))}
        {isAdmin && (
          <button onClick={refresh} disabled={refreshing} className="btn-ghost ml-auto">
            {refreshing ? "Refreshing…" : "Refresh now"}
          </button>
        )}
      </div>

      {!current ? (
        <div className="card text-slate-400">
          No trending snapshots yet.{" "}
          {isAdmin ? "Click “Refresh now” to populate." : "Ask an admin to refresh."}
          {categories.length > 0 && (
            <div className="mt-2 text-xs">Tracked: {categories.map((c) => c.label).join(", ")}</div>
          )}
        </div>
      ) : (
        <>
          <div className="card border-brand-500/40">
            <div className="mb-1 text-sm font-semibold text-brand-300">Why it&apos;s viral</div>
            <p className="text-sm text-slate-200">{current.insight.recommendation}</p>
            <div className="mt-3 flex flex-col gap-3 md:flex-row">
              <InsightList
                title="Common tags"
                items={current.insight.topTags.map((t) => t.tag)}
                copyable
              />
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
              Updated {new Date(current.updatedAt).toLocaleString()}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {current.videos.slice(0, 12).map((v) => (
              <a
                key={v.videoId}
                href={v.url}
                target="_blank"
                rel="noreferrer"
                className="flex gap-3 rounded-lg border border-ink-line bg-ink-card p-2 hover:border-brand-500"
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
                  <div className="line-clamp-2 text-sm text-slate-100">{v.title}</div>
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
              </a>
            ))}
          </div>
        </>
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
