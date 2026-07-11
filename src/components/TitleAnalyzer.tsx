"use client";

import { useState } from "react";

interface Result {
  score: number;
  reasons: string[];
}

export function TitleAnalyzer() {
  const [title, setTitle] = useState("");
  const [keyword, setKeyword] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/analyze/title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, keyword }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed");
      setRes(j);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={run} className="card space-y-3">
        <div>
          <label className="label">Your title</label>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="DG Mawai New Rasiya 2026 | Official Video"
          />
        </div>
        <div>
          <label className="label">Target keyword (optional)</label>
          <input
            className="input"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="dg mawai"
          />
        </div>
        <button className="btn-primary" disabled={loading}>
          {loading ? "Scoring…" : "Analyze title"}
        </button>
      </form>

      {error && <div className="card border-red-500/40 text-red-300">{error}</div>}

      {res && (
        <div className="card">
          <div className="mb-4 flex items-center gap-4">
            <div
              className={`flex h-20 w-20 items-center justify-center rounded-full text-2xl font-black ${
                res.score >= 70
                  ? "bg-green-500/20 text-green-300"
                  : res.score >= 45
                    ? "bg-yellow-500/20 text-yellow-300"
                    : "bg-red-500/20 text-red-300"
              }`}
            >
              {res.score}
            </div>
            <div className="text-sm text-slate-400">
              Title score out of 100. Higher = better CTR & search fit.
            </div>
          </div>
          <ul className="space-y-2 text-sm">
            {res.reasons.map((r) => (
              <li key={r} className="flex gap-2 text-slate-300">
                <span className="text-brand-400">•</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
