"use client";

import { useState } from "react";

export interface AdminStats {
  totalUsers: number;
  byPlan: Record<string, number>;
  generationsToday: number;
  researchToday: number;
  bannedUsers: number;
  unlimitedUsers: number;
  connectedChannels: number;
  status: {
    youtubeApiKeys: number;
    googleOAuth: boolean;
    cronSecret: boolean;
    appUrl: string;
    signupsEnabled: boolean;
    defaultPlan: string;
    categories: number;
  };
}

export interface AdminSettings {
  youtubeApiKeys: string[];
  youtubeApiKeyCount: number;
  googleClientId: string;
  googleClientSecretMask: string;
  cronSecretMask: string;
  appUrl: string;
  signupsEnabled: boolean;
  defaultPlan: "free" | "starter" | "creator" | "unlimited";
  announcement: string;
}

export function Section({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-200">
            {title}
          </h2>
          {hint && <p className="mt-1 max-w-2xl text-xs text-slate-500">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card bg-gradient-to-br from-brand-600/20 via-ink-card/70 to-accent-cyan/10 text-center">
      <div className="grad-text text-3xl font-black">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
      {hint && <div className="mt-1 text-[11px] text-slate-500">{hint}</div>}
    </div>
  );
}

export function StatusPill({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`chip ${
        ok
          ? "border-accent-lime/40 bg-accent-lime/10 text-accent-lime"
          : "border-accent-amber/40 bg-accent-amber/10 text-accent-amber"
      }`}
      title={ok ? "Configured" : "Not configured"}
    >
      {ok ? "●" : "○"} {children}
    </span>
  );
}

/** Small inline "Saved"/"Error" flash used after every admin write. */
export function useFlash() {
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  function show(ok: boolean, text: string) {
    setFlash({ ok, text });
    setTimeout(() => setFlash(null), 4000);
  }

  const node = flash ? (
    <span className={`text-xs ${flash.ok ? "text-green-300" : "text-red-300"}`}>{flash.text}</span>
  ) : null;

  return { show, node };
}

export async function apiSend(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown
): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, data };
}

export function errText(data: Record<string, unknown>, fallback = "Could not save"): string {
  return typeof data.error === "string" ? data.error : fallback;
}
