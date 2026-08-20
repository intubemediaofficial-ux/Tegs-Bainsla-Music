"use client";

import { useEffect, useState } from "react";
import { Section, apiSend, errText, useFlash } from "./shared";

interface Category {
  id: string;
  label: string;
  query: string;
  language?: string;
}

export function AdminTrending() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [label, setLabel] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<null | "refresh" | "pulse" | "category">(null);
  const flash = useFlash();

  async function load() {
    const res = await fetch("/api/admin/categories");
    const data = await res.json();
    setCategories(data.categories ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function run(kind: "refresh" | "pulse") {
    setBusy(kind);
    const { ok, data } = await apiSend(`/api/cron/${kind}`, "POST");
    flash.show(
      ok,
      ok
        ? kind === "refresh"
          ? "Trending data refreshed"
          : "View counts sampled"
        : errText(data, "Job failed")
    );
    setBusy(null);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Trending &amp; cron</h1>
          <p className="mt-1 text-sm text-slate-400">
            The trending board is built from the categories below.
          </p>
        </div>
        {flash.node}
      </header>

      <Section
        title="Jobs"
        hint="Refresh trending re-searches every category and rebuilds the board. Sample view counts stores the current view number of tracked videos — that is what makes the extension's measured 60-minute and 48-hour numbers possible, so it should run on a schedule (every 5 minutes) as well."
      >
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" disabled={busy !== null} onClick={() => run("refresh")}>
            {busy === "refresh" ? "Refreshing…" : "Refresh trending now"}
          </button>
          <button className="btn-ghost" disabled={busy !== null} onClick={() => run("pulse")}>
            {busy === "pulse" ? "Sampling…" : "Sample view counts now"}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Scheduled callers must send the cron secret; from this panel your admin session is
          enough.
        </p>
      </Section>

      <Section
        title={`Tracked categories (${categories.length})`}
        hint="Each category is a YouTube search that gets monitored for fast-rising videos. Label is what users see; query is what is searched."
      >
        <form
          className="mb-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!label.trim() || !query.trim()) return;
            setBusy("category");
            const { ok, data } = await apiSend("/api/admin/categories", "POST", { label, query });
            flash.show(ok, ok ? `${label} added` : errText(data));
            setLabel("");
            setQuery("");
            await load();
            setBusy(null);
          }}
        >
          <input
            className="input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label e.g. Punjabi Music"
          />
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search query e.g. new punjabi song"
          />
          <button className="btn-primary" disabled={busy !== null}>
            Add
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <span key={c.id} className="chip">
              {c.label} — “{c.query}”
              <button
                className="ml-1 text-red-400 hover:text-red-300"
                onClick={async () => {
                  if (!confirm(`Remove ${c.label}?`)) return;
                  const { ok, data } = await apiSend(
                    `/api/admin/categories?id=${c.id}`,
                    "DELETE"
                  );
                  flash.show(ok, ok ? `${c.label} removed` : errText(data));
                  await load();
                }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      </Section>
    </div>
  );
}
