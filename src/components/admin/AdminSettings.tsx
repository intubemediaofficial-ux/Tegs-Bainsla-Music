"use client";

import { useEffect, useState } from "react";
import { Section, apiSend, errText, useFlash, type AdminSettings as Settings } from "./shared";

const PLAN_OPTS = ["free", "starter", "creator", "unlimited"] as const;

export function AdminSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [busy, setBusy] = useState(false);
  const flash = useFlash();

  async function load() {
    const res = await fetch("/api/admin/settings");
    const data = await res.json();
    const s: Settings | undefined = data.settings;
    if (!s) return;
    setSettings(s);
    setAnnouncement(s.announcement);
  }

  useEffect(() => {
    load();
  }, []);

  async function save(body: Record<string, unknown>, okText: string) {
    setBusy(true);
    const { ok, data } = await apiSend("/api/admin/settings", "PATCH", body);
    flash.show(ok, ok ? okText : errText(data));
    await load();
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">App settings</h1>
          <p className="mt-1 text-sm text-slate-400">Applies to the live site immediately.</p>
        </div>
        {flash.node}
      </header>

      <Section
        title="Sign-ups"
        hint="When closed, /register returns “Sign-ups are closed right now” and only you can create accounts from Users & access. Existing users are unaffected."
      >
        <button
          className={`chip ${settings?.signupsEnabled ? "text-green-300" : "text-amber-300"}`}
          disabled={busy || !settings}
          onClick={() =>
            save(
              { signupsEnabled: !settings?.signupsEnabled },
              settings?.signupsEnabled ? "Sign-ups closed" : "Sign-ups open"
            )
          }
        >
          {settings?.signupsEnabled ? "open — anyone can register" : "closed — invite only"}
        </button>
      </Section>

      <Section
        title="Default plan for new accounts"
        hint="Whatever someone gets the moment they register (or when you create a user without picking a plan). Choose “unlimited” if your staff should never hit a daily cap."
      >
        <select
          className="input w-48"
          value={settings?.defaultPlan ?? "free"}
          disabled={busy || !settings}
          onChange={(e) => save({ defaultPlan: e.target.value }, `New users get ${e.target.value}`)}
        >
          {PLAN_OPTS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </Section>

      <Section
        title="Notice for users"
        hint="Shown as a banner on every dashboard page. Leave it empty to hide the banner."
      >
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={async (e) => {
            e.preventDefault();
            await save({ announcement: announcement.trim() }, "Notice saved");
          }}
        >
          <input
            className="input"
            value={announcement}
            onChange={(e) => setAnnouncement(e.target.value)}
            placeholder="e.g. Maintenance tonight 11pm–12am IST"
            maxLength={500}
          />
          <button className="btn-primary" disabled={busy}>
            Save notice
          </button>
        </form>
      </Section>
    </div>
  );
}
