"use client";

import { useEffect, useState } from "react";
import { CopyButton } from "./Copy";

interface Me {
  user: { name: string; email: string; plan: string; apiKey: string };
  usage: { generations: number; research: number };
  limits: { generations: number; research: number; artists: number; maxTags: number };
}

export function Settings() {
  const [me, setMe] = useState<Me | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  async function load() {
    const r = await fetch("/api/auth/me");
    const j = await r.json();
    setMe(j);
  }

  useEffect(() => {
    load();
  }, []);

  async function regen() {
    setRegenerating(true);
    try {
      const r = await fetch("/api/account/apikey", { method: "POST" });
      const j = await r.json();
      if (me && j.apiKey) setMe({ ...me, user: { ...me.user, apiKey: j.apiKey } });
    } finally {
      setRegenerating(false);
    }
  }

  if (!me?.user) return <div className="card text-slate-400">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Account
        </h2>
        <div className="grid gap-2 text-sm">
          <Row label="Name" value={me.user.name} />
          <Row label="Email" value={me.user.email} />
          <Row label="Plan" value={me.user.plan} />
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Usage today
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Meter label="Generations" used={me.usage.generations} limit={me.limits.generations} />
          <Meter label="Research" used={me.usage.research} limit={me.limits.research} />
        </div>
      </div>

      <div className="card">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Chrome extension API key
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          Paste this into the Bainsla Tags extension options to connect it to your account.
        </p>
        <div className="flex gap-2">
          <input readOnly className="input font-mono text-xs" value={me.user.apiKey} />
          <CopyButton text={me.user.apiKey} label="Copy" />
          <button onClick={regen} disabled={regenerating} className="btn-ghost">
            {regenerating ? "…" : "Regenerate"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-ink-line py-1">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-100">{value}</span>
    </div>
  );
}

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  return (
    <div className="rounded-lg border border-ink-line bg-ink-soft p-3">
      <div className="mb-1 flex justify-between text-xs text-slate-400">
        <span>{label}</span>
        <span>
          {used} / {limit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-ink">
        <div className="h-2 rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
