"use client";

import { useState } from "react";
import { CopyButton } from "./Copy";

interface Result {
  videoId: string;
  tags: string[];
  count: number;
  tagBox: { text: string; used: string[] };
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
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              {data.count} tags found
            </h2>
            {data.count > 0 && <CopyButton text={data.tagBox.text} label="Copy all" />}
          </div>
          {data.count === 0 ? (
            <p className="text-sm text-slate-400">
              This video has no public tags (many creators hide them).
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.tags.map((t) => (
                <span key={t} className="chip">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
