"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Section, Stat, StatusPill, type AdminStats } from "./shared";

export function AdminOverview() {
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-black">Overview</h1>
        <p className="mt-1 text-sm text-slate-400">
          Everything on this panel saves instantly to the live site — no deploy needed.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total users" value={stats?.totalUsers ?? "…"} />
        <Stat label="Generations today" value={stats?.generationsToday ?? "…"} />
        <Stat label="Research today" value={stats?.researchToday ?? "…"} />
        <Stat
          label="Unlimited users"
          value={stats?.unlimitedUsers ?? "…"}
          hint="Daily caps switched off"
        />
      </div>

      <Section
        title="Users by plan"
        hint="Change anyone's plan from Users & access. Plan sets the default daily limits."
      >
        <div className="flex flex-wrap gap-2">
          {["free", "starter", "creator", "unlimited", "admin"].map((p) => (
            <span key={p} className="chip">
              {p}: <strong className="ml-1">{stats?.byPlan?.[p] ?? 0}</strong>
            </span>
          ))}
          <span className="chip text-red-300">banned: {stats?.bannedUsers ?? 0}</span>
          <span className="chip text-brand-300">
            channels connected: {stats?.connectedChannels ?? 0}
          </span>
        </div>
      </Section>

      <Section
        title="System status"
        hint="Green means configured and in use right now. Fix anything amber in API & keys."
      >
        <div className="flex flex-wrap gap-2">
          <StatusPill ok={(stats?.status.youtubeApiKeys ?? 0) > 0}>
            YouTube Data API key ({stats?.status.youtubeApiKeys ?? 0})
          </StatusPill>
          <StatusPill ok={!!stats?.status.googleOAuth}>Google OAuth (own-channel analytics)</StatusPill>
          <StatusPill ok={!!stats?.status.cronSecret}>Cron secret</StatusPill>
          <StatusPill ok={(stats?.status.categories ?? 0) > 0}>
            Tracked categories ({stats?.status.categories ?? 0})
          </StatusPill>
          <StatusPill ok={!!stats?.status.signupsEnabled}>
            Sign-ups {stats?.status.signupsEnabled ? "open" : "closed"}
          </StatusPill>
          <span className="chip">default plan: {stats?.status.defaultPlan ?? "…"}</span>
          <span className="chip">app URL: {stats?.status.appUrl ?? "…"}</span>
        </div>
      </Section>

      <Section title="What each section does" hint="Quick map of the menu on the left.">
        <ul className="space-y-2 text-sm text-slate-300">
          <li>
            <Link href="/admin/users" className="font-semibold text-brand-300">
              Users &amp; access
            </Link>{" "}
            — create users, set plan, daily limits, unlimited switch, per-feature access, reset
            password, regenerate the extension API key, ban or delete.
          </li>
          <li>
            <Link href="/admin/plans" className="font-semibold text-brand-300">
              Plans &amp; limits
            </Link>{" "}
            — what every plan allows and how per-user overrides beat plan defaults.
          </li>
          <li>
            <Link href="/admin/integrations" className="font-semibold text-brand-300">
              API &amp; keys
            </Link>{" "}
            — YouTube Data API keys, Google OAuth client, cron secret, app URL. Saved values
            replace the server&apos;s .env values immediately.
          </li>
          <li>
            <Link href="/admin/trending" className="font-semibold text-brand-300">
              Trending &amp; cron
            </Link>{" "}
            — tracked categories plus manual refresh of trending data and the view-pulse sampler.
          </li>
          <li>
            <Link href="/admin/settings" className="font-semibold text-brand-300">
              App settings
            </Link>{" "}
            — open or close sign-ups, the plan new accounts get, and a notice shown in the app.
          </li>
        </ul>
      </Section>
    </div>
  );
}
