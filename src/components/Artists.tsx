"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Artist {
  id: string;
  name: string;
  language: string;
  keywords: string[];
}

export function Artists() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("hi");
  const [keywords, setKeywords] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    const r = await fetch("/api/artists");
    const j = await r.json();
    setArtists(j.artists ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/artists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          language,
          keywords: keywords
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed");
      setName("");
      setKeywords("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/artists?id=${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="card space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Artist / song name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="DG Mawai" />
          </div>
          <div>
            <label className="label">Language</label>
            <select className="input" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="hi">Hindi</option>
              <option value="pa">Punjabi</option>
              <option value="en">English</option>
            </select>
          </div>
          <div>
            <label className="label">Seed keywords (comma sep)</label>
            <input
              className="input"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="rasiya, new song"
            />
          </div>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button className="btn-primary" disabled={loading}>
          {loading ? "Saving…" : "Save preset"}
        </button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2">
        {artists.length === 0 && (
          <div className="card text-sm text-slate-400">No presets yet. Add your first artist above.</div>
        )}
        {artists.map((a) => (
          <div key={a.id} className="card">
            <div className="flex items-center justify-between">
              <div className="font-semibold">{a.name}</div>
              <button onClick={() => remove(a.id)} className="text-xs text-red-400 hover:underline">
                Delete
              </button>
            </div>
            <div className="mt-1 text-xs text-slate-500">{a.language.toUpperCase()}</div>
            {a.keywords.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {a.keywords.map((k) => (
                  <span key={k} className="chip">
                    {k}
                  </span>
                ))}
              </div>
            )}
            <Link
              href={`/app?q=${encodeURIComponent(a.name)}`}
              className="btn-ghost mt-3 w-full"
            >
              Generate package
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
