"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CopyButton } from "./Copy";
import { isUnlimited } from "@/lib/plans";

interface Me {
  user: { name: string; email: string; plan: string; apiKey: string };
  usage: { generations: number; research: number };
  limits: { generations: number; research: number; artists: number; maxTags: number };
}

interface ChannelLink {
  configured: boolean;
  connected: boolean;
  channel: { channelId: string; title: string; thumbnail: string; connectedAt: string } | null;
}

export function Settings() {
  const [me, setMe] = useState<Me | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [link, setLink] = useState<ChannelLink | null>(null);
  const params = useSearchParams();
  const connectResult = params.get("channel");
  const connectReason = params.get("reason");

  async function load() {
    const r = await fetch("/api/auth/me");
    const j = await r.json();
    setMe(j);
  }

  async function loadLink() {
    const r = await fetch("/api/account/channel");
    if (r.ok) setLink(await r.json());
  }

  useEffect(() => {
    load();
    loadLink();
  }, []);

  async function unlink() {
    await fetch("/api/account/channel", { method: "DELETE" });
    loadLink();
  }

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
          My YouTube channel
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          Connect your own channel to unlock official numbers for your videos — real traffic
          sources (search vs suggested vs browse), the actual search terms bringing views, watch
          time, average viewed % and subscribers gained. YouTube only shares these with the
          channel owner, so other creators&apos; videos stay public-data estimates.
        </p>

        {connectResult === "connected" && (
          <div className="mb-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2 text-xs font-bold text-emerald-200">
            Channel connected{params.get("name") ? ` — ${params.get("name")}` : ""}.
          </div>
        )}
        {connectResult === "error" && (
          <div className="mb-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-2 text-xs font-bold text-rose-200">
            Could not connect{connectReason ? `: ${connectReason}` : ""}.
          </div>
        )}

        {link?.connected && link.channel ? (
          <div className="flex items-center gap-3">
            {link.channel.thumbnail && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={link.channel.thumbnail}
                alt={link.channel.title}
                className="h-10 w-10 rounded-full"
              />
            )}
            <div className="flex-1">
              <div className="text-sm font-black text-slate-100">{link.channel.title}</div>
              <div className="text-xs text-slate-500">Connected — official analytics are on.</div>
            </div>
            <a href="/api/auth/google/start" className="btn-ghost">
              Switch channel
            </a>
            <button onClick={unlink} className="btn-ghost">
              Disconnect
            </button>
          </div>
        ) : link && !link.configured ? (
          <div className="text-xs text-amber-300">
            Google sign-in is not configured on the server yet.
          </div>
        ) : (
          <a href="/api/auth/google/start" className="btn inline-block">
            Connect my channel with Google
          </a>
        )}
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
  const free = isUnlimited(limit);
  const pct = free ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  return (
    <div className="rounded-lg border border-ink-line bg-ink-soft p-3">
      <div className="mb-1 flex justify-between text-xs text-slate-400">
        <span>{label}</span>
        <span>{free ? `${used} / unlimited` : `${used} / ${limit}`}</span>
      </div>
      <div className="h-2 rounded-full bg-ink">
        <div
          className={`h-2 rounded-full ${free ? "bg-emerald-500/60" : "bg-brand-500"}`}
          style={{ width: free ? "100%" : `${pct}%` }}
        />
      </div>
    </div>
  );
}
