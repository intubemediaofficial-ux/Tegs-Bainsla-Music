"use client";

import { useState } from "react";

interface Result {
  keyword: string;
  target: string;
  found: boolean;
  position: number | null;
  scanned: number;
  matched?: { title: string; channel: string; url: string };
}

export function RankChecker() {
  const [keyword, setKeyword] = useState("");
  const [target, setTarget] = useState("");
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!keyword.trim() || !target.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/research/rank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, target }),
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
      <form onSubmit={run} className="card space-y-3">
        <div>
          <label className="label">Keyword</label>
          <input
            className="input"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="dg mawai new song"
          />
        </div>
        <div>
          <label className="label">Your video (URL / ID) or channel name</label>
          <input
            className="input"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="https://youtube.com/watch?v=… or channel name"
          />
        </div>
        <button className="btn-primary" disabled={loading}>
          {loading ? "Checking…" : "Check rank"}
        </button>
      </form>

      {error && <div className="card border-red-500/40 text-red-300">{error}</div>}

      {data && (
        <div className="card text-center">
          {data.found ? (
            <>
              <div className="text-5xl font-black text-brand-300">#{data.position}</div>
              <p className="mt-2 text-sm text-slate-400">
                out of top {data.scanned} results for “{data.keyword}”
              </p>
              {data.matched && (
                <a
                  href={data.matched.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-sm text-brand-400 hover:underline"
                >
                  {data.matched.title} — {data.matched.channel}
                </a>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-300">
              Not found in the top {data.scanned} results. Improve tags/title and try again.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
