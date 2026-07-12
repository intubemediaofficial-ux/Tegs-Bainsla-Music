"use client";

import { useState } from "react";
import { CopyButton } from "./Copy";

interface Result {
  score: number;
  reasons: string[];
}

interface BuiltTitle {
  title: string;
  score: number;
  reasons: string[];
}
interface BuildResult {
  song: string;
  singer: string;
  titles: BuiltTitle[];
  keywordsUsed: { tag: string; rank: number }[];
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
    <div className="space-y-6">
      <div className="space-y-4">
        <form onSubmit={run} className="card space-y-3">
          <div className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Analyze a title
          </div>
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

      <TitleBuilder />
    </div>
  );
}

function TitleBuilder() {
  const [song, setSong] = useState("");
  const [singer, setSinger] = useState("");
  const [data, setData] = useState<BuildResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function build(e: React.FormEvent) {
    e.preventDefault();
    if (!song.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/build/title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ song, singer }),
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
      <form onSubmit={build} className="card space-y-3">
        <div className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Build a full title
        </div>
        <p className="text-xs text-slate-500">
          Bas gaane ka naam + singer daalo — hum top / fastest search keywords laga ke poora title
          bana denge.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Song name</label>
            <input
              className="input"
              value={song}
              onChange={(e) => setSong(e.target.value)}
              placeholder="Kabootar Bole Gutru Gutru"
            />
          </div>
          <div>
            <label className="label">Singer / artist (optional)</label>
            <input
              className="input"
              value={singer}
              onChange={(e) => setSinger(e.target.value)}
              placeholder="DG Mawai"
            />
          </div>
        </div>
        <button className="btn-primary" disabled={loading}>
          {loading ? "Building…" : "Build title"}
        </button>
      </form>

      {error && <div className="card border-red-500/40 text-red-300">{error}</div>}

      {data && (
        <div className="card space-y-3">
          <div className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Ready-to-use titles
          </div>
          {data.titles.length === 0 ? (
            <p className="text-sm text-slate-400">Couldn&apos;t build a title — try another name.</p>
          ) : (
            data.titles.map((t) => (
              <div
                key={t.title}
                className="flex items-start gap-3 rounded-lg border border-ink-line bg-ink-soft p-3"
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                    t.score >= 70
                      ? "bg-green-500/20 text-green-300"
                      : t.score >= 45
                        ? "bg-yellow-500/20 text-yellow-300"
                        : "bg-red-500/20 text-red-300"
                  }`}
                >
                  {t.score}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-slate-100">{t.title}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{t.title.length} chars</div>
                </div>
                <CopyButton text={t.title} label="Copy" className="btn-ghost px-2 py-1 text-xs" />
              </div>
            ))
          )}

          {data.keywordsUsed.length > 0 && (
            <div>
              <div className="label">Top search keywords used</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {data.keywordsUsed.map((k) => (
                  <span key={k.tag} className="chip flex items-center gap-1">
                    <span className="rounded bg-brand-600/40 px-1 text-[10px] font-bold text-brand-100">
                      #{k.rank}
                    </span>
                    {k.tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
