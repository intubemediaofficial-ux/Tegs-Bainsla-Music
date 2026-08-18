"use client";

import { useState } from "react";
import { CopyButton } from "./Copy";
import { VideoDetailModal, type VideoRef } from "./VideoDetail";

interface VideoRow {
  videoId: string;
  title: string;
  channel: string;
  views: number;
  publishedText: string;
  url: string;
  strength: "high" | "medium" | "low";
}
interface Result {
  seed: string;
  score: { difficulty: number; volume: number; competition: number; opportunity: number };
  related: string[];
  keywords: string[];
  questions: string[];
  hashtags: string[];
  videos: VideoRow[];
}

export function KeywordResearch() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openVideo, setOpenVideo] = useState<VideoRef | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/research/keyword", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed");
      setData(j);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={run} className="card flex gap-3">
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Keyword e.g. haryanvi song"
        />
        <button className="btn-primary" disabled={loading}>
          {loading ? "Researching…" : "Research"}
        </button>
      </form>

      {error && <div className="card border-red-500/40 text-red-300">{error}</div>}

      {data && (
        <>
          <div className="card grid grid-cols-2 gap-3 sm:grid-cols-4 text-center">
            {(
              [
                ["Opportunity", data.score.opportunity],
                ["Volume", data.score.volume],
                ["Difficulty", data.score.difficulty],
                ["Competition", data.score.competition],
              ] as const
            ).map(([label, val]) => (
              <div key={label} className="rounded-lg border border-ink-line bg-ink-soft p-3">
                <div className="text-2xl font-black">{val}</div>
                <div className="text-xs text-slate-400">{label}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Related keywords (search rank)
              </h3>
              {data.related.length > 0 && (
                <CopyButton
                  text={data.related.join(", ")}
                  label="Copy all"
                  className="btn-ghost px-2 py-1"
                />
              )}
            </div>
            {data.related.length === 0 ? (
              <span className="text-xs text-slate-500">None found.</span>
            ) : (
              <ol className="grid gap-1 sm:grid-cols-2">
                {data.related.map((k, i) => (
                  <li
                    key={k}
                    className="flex items-center gap-2 rounded-lg border border-ink-line bg-ink-soft px-2 py-1 text-sm"
                  >
                    <span className="w-8 shrink-0 rounded bg-brand-600/30 text-center text-xs font-bold text-brand-200">
                      #{i + 1}
                    </span>
                    <span className="flex-1 truncate text-slate-200">{k}</span>
                    <CopyButton text={k} label="Copy" className="btn-ghost px-1.5 py-0.5 text-xs" />
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ChipCard title="Questions" items={data.questions} />
            <ChipCard title="Hashtags" items={data.hashtags} />
          </div>

          <div className="card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Top ranking videos
              </h2>
              <CopyButton text={data.keywords.join(", ")} label="Copy all keywords" />
            </div>
            <p className="mb-2 text-xs text-slate-500">
              Click a title to open its description + real tags (with search rank) — it won&apos;t
              jump to YouTube.
            </p>
            <div className="space-y-2">
              {data.videos.map((v, i) => (
                <button
                  key={v.videoId}
                  onClick={() =>
                    setOpenVideo({
                      videoId: v.videoId,
                      title: v.title,
                      channel: v.channel,
                      views: v.views,
                      publishedText: v.publishedText,
                      url: v.url,
                      rank: i + 1,
                    })
                  }
                  className="flex w-full items-center gap-3 rounded-lg border border-ink-line bg-ink-soft p-2 text-left text-sm hover:border-brand-500"
                >
                  <span className="w-6 text-center text-slate-500">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-slate-100">{v.title}</div>
                    <div className="text-xs text-slate-500">
                      {v.channel} · {v.views.toLocaleString()} views · {v.publishedText}
                    </div>
                  </div>
                  <span
                    className={`chip ${
                      v.strength === "high"
                        ? "text-red-300"
                        : v.strength === "medium"
                          ? "text-yellow-300"
                          : "text-green-300"
                    }`}
                  >
                    {v.strength}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {openVideo && (
        <VideoDetailModal
          video={openVideo}
          seed={data?.seed || query}
          onClose={() => setOpenVideo(null)}
        />
      )}
    </div>
  );
}

function ChipCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
        {items.length > 0 && <CopyButton text={items.join(", ")} label="Copy" className="btn-ghost px-2 py-1" />}
      </div>
      <div className="flex flex-wrap gap-2">
        {items.length === 0 ? (
          <span className="text-xs text-slate-500">None found.</span>
        ) : (
          items.map((k) => (
            <span key={k} className="chip">
              {k}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
