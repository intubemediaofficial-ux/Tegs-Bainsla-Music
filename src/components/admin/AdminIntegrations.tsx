"use client";

import { useEffect, useState } from "react";
import { Section, StatusPill, apiSend, errText, useFlash, type AdminSettings } from "./shared";

export function AdminIntegrations() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [cronSecret, setCronSecret] = useState("");
  const [appUrl, setAppUrl] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const flash = useFlash();

  async function load() {
    const res = await fetch("/api/admin/settings");
    const data = await res.json();
    const s: AdminSettings | undefined = data.settings;
    if (!s) return;
    setSettings(s);
    setClientId(s.googleClientId);
    setAppUrl(s.appUrl);
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

  async function testKey() {
    setBusy(true);
    setTestResult("Testing…");
    const { data } = await apiSend("/api/admin/settings/test", "POST");
    setTestResult(typeof data.message === "string" ? data.message : "No answer from the server");
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">API &amp; keys</h1>
          <p className="mt-1 text-sm text-slate-400">
            Saved here, values take effect on the live site at once and override the server&apos;s
            .env. Existing secrets are only ever shown masked.
          </p>
        </div>
        {flash.node}
      </header>

      <Section
        title="YouTube Data API v3 keys"
        hint="Used for fresh view counts, real tags, channel stats and search fallback. The first key is used; add a second one as a spare for when the daily quota (10,000 units) runs out. Removing every key falls back to YOUTUBE_API_KEY from .env."
        action={
          <button className="btn-ghost" onClick={testKey} disabled={busy}>
            Test key now
          </button>
        }
      >
        <div className="mb-3 flex flex-wrap gap-2">
          {(settings?.youtubeApiKeys.length ?? 0) === 0 && (
            <span className="text-xs text-amber-300">No key configured — API data is off.</span>
          )}
          {settings?.youtubeApiKeys.map((masked, i) => (
            <span key={`${masked}-${i}`} className="chip">
              {i === 0 ? "active" : "spare"}: {masked}
              <button
                className="ml-2 text-red-400 hover:text-red-300"
                disabled={busy}
                onClick={() =>
                  confirm("Remove this key?") &&
                  save({ removeYoutubeApiKeyIndex: i }, "Key removed")
                }
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        {testResult && <p className="mb-3 text-xs text-slate-300">{testResult}</p>}
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={async (e) => {
            e.preventDefault();
            if (newKey.trim().length < 10) return;
            await save({ addYoutubeApiKey: newKey.trim() }, "Key saved and now active");
            setNewKey("");
          }}
        >
          <input
            className="input"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="Paste a new API key (AIza…)"
          />
          <button className="btn-primary" disabled={busy}>
            Add key
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-500">
          Create keys at console.cloud.google.com → APIs &amp; Services → Credentials, with
          “YouTube Data API v3” enabled.
        </p>
      </Section>

      <Section
        title="Google OAuth client (own-channel analytics)"
        hint="Powers “Connect my channel with Google”. Only the connected owner's channel gets official YouTube Analytics; everyone else's videos stay on public data. Redirect URI must be <app URL>/api/auth/google/callback."
      >
        <div className="mb-3 flex flex-wrap gap-2">
          <StatusPill ok={!!settings?.googleClientId && !!settings?.googleClientSecretMask}>
            {settings?.googleClientId
              ? `client configured (${settings.googleClientSecretMask || "secret missing"})`
              : "not configured"}
          </StatusPill>
        </div>
        <form
          className="grid gap-2 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const body: Record<string, unknown> = {};
            if (clientId !== settings?.googleClientId) body.googleClientId = clientId.trim();
            if (clientSecret.trim()) body.googleClientSecret = clientSecret.trim();
            if (Object.keys(body).length === 0) return;
            await save(body, "Google OAuth updated");
            setClientSecret("");
          }}
        >
          <input
            className="input"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Client ID (…apps.googleusercontent.com)"
          />
          <input
            className="input"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder={
              settings?.googleClientSecretMask
                ? `Client secret (${settings.googleClientSecretMask}) — leave blank to keep`
                : "Client secret (GOCSPX-…)"
            }
          />
          <div>
            <button className="btn-primary" disabled={busy}>
              Save OAuth client
            </button>
          </div>
        </form>
        <p className="mt-2 text-xs text-slate-500">
          Authorised redirect URI: <code>{(settings?.appUrl ?? "") + "/api/auth/google/callback"}</code>
        </p>
      </Section>

      <Section
        title="Cron secret"
        hint="Protects /api/cron/refresh (trending) and /api/cron/pulse (view sampling) so only your scheduler can call them: send it as “Authorization: Bearer <secret>” or the x-cron-secret header. Admins logged into this panel can always trigger them by hand from Trending & cron."
      >
        <div className="mb-3">
          <StatusPill ok={!!settings?.cronSecretMask}>
            {settings?.cronSecretMask ? `configured (${settings.cronSecretMask})` : "not set"}
          </StatusPill>
        </div>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!cronSecret.trim()) return;
            await save({ cronSecret: cronSecret.trim() }, "Cron secret replaced");
            setCronSecret("");
          }}
        >
          <input
            className="input"
            value={cronSecret}
            onChange={(e) => setCronSecret(e.target.value)}
            placeholder="New cron secret"
          />
          <button className="btn-primary" disabled={busy}>
            Replace secret
          </button>
        </form>
      </Section>

      <Section
        title="App URL"
        hint="Used to build the Google redirect URI and the links the Chrome extension opens. Change it only if the domain changes."
      >
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={async (e) => {
            e.preventDefault();
            await save({ appUrl: appUrl.trim() }, "App URL saved");
          }}
        >
          <input
            className="input"
            value={appUrl}
            onChange={(e) => setAppUrl(e.target.value)}
            placeholder="https://tag.bainslamusic.com"
          />
          <button className="btn-primary" disabled={busy || !appUrl.trim()}>
            Save
          </button>
        </form>
      </Section>
    </div>
  );
}
