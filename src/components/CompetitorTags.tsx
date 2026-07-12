"use client";

import { useState } from "react";
import { CopyButton } from "./Copy";
import { TagRankBlock, type RankedTag } from "./VideoDetail";

interface Result {
  videoId: string;
  title: string;
  channel: string;
  published: string;
  tags: string[];
  count: number;
  onlyDefault?: boolean;
  tagBox: { text: string; used: string[] };
  trending: RankedTag[];
  notTrending: string[];
  suggestions: RankedTag[];
}

export function CompetitorTags() {
  const [video, setVideo] = useState("");
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!video.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/research/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video }),
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
          value={video}
          onChange={(e) => setVideo(e.target.value)}
          placeholder="Competitor video URL or ID"
        />
        <button className="btn-primary" disabled={loading}>
          {loading ? "Reading…" : "Get tags"}
        </button>
      </form>

      {error && <div className="card border-red-500/40 text-red-300">{error}</div>}

      {data && (
        <div className="card space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-semibold text-slate-100">{data.title}</div>
              <div className="text-xs text-slate-500">
                {data.channel}
                {data.published ? ` · uploaded ${data.published}` : ""} · {data.count} tags found
              </div>
            </div>
            {data.count > 0 && <CopyButton text={data.tagBox.text} label="Copy all" />}
          </div>

          {data.count === 0 ? (
            <p className="text-sm text-slate-400">
              {data.onlyDefault
                ? "This video exposes only YouTube's default keywords — the creator hid their custom tags."
                : "This video has no public tags (many creators hide them)."}
            </p>
          ) : (
            <TagRankBlock
              title="Tags used by this video (currently trending — search rank)"
              tags={data.trending}
              emptyNote="None of this video's tags currently rank in live search demand."
            />
          )}

          {data.notTrending.length > 0 && (
            <div>
              <div className="label">Tags NOT trending (drop these)</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {data.notTrending.map((t) => (
                  <span key={t} className="chip text-slate-500 line-through">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          <TagRankBlock
            title="Add these instead (higher search rank)"
            tags={data.suggestions}
            emptyNote="No stronger tags found for this topic."
            highlight
          />
          <p className="text-xs text-slate-500">
            Rank = position in live YouTube autocomplete (what people actually search) — an honest
            demand proxy, not an official metric.
          </p>
        </div>
      )}
    </div>
  );
}
