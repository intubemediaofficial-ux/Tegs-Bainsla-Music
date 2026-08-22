"use client";

import { useCallback, useEffect, useState } from "react";

const STORE_URL =
  "https://chromewebstore.google.com/search/Bainsla%20Music%20Tags";

type Status = "detecting" | "missing" | "connecting" | "connected" | "failed";

interface ConnectedDetail {
  email?: string;
  planLabel?: string;
  error?: string;
}

/**
 * Talks to the extension's content script through DOM events:
 * the script marks `documentElement[data-bmt-extension]`, we ask it to
 * connect, and it pulls the key from /api/ext/link with our session cookie.
 */
export function ConnectExtension({ email }: { email: string }) {
  const [status, setStatus] = useState<Status>("detecting");
  const [plan, setPlan] = useState<string>("");
  const [message, setMessage] = useState<string>("");

  const request = useCallback(() => {
    setStatus("connecting");
    window.dispatchEvent(new CustomEvent("bmt:connect-request"));
  }, []);

  useEffect(() => {
    function onDone(event: Event) {
      const detail = (event as CustomEvent<ConnectedDetail>).detail || {};
      if (detail.error) {
        setStatus("failed");
        setMessage(detail.error);
        return;
      }
      setPlan(detail.planLabel || "");
      setStatus("connected");
    }
    window.addEventListener("bmt:connect-done", onDone);

    const installed = () => document.documentElement.hasAttribute("data-bmt-extension");
    if (installed()) {
      request();
    } else {
      const timer = window.setTimeout(() => {
        if (installed()) request();
        else setStatus("missing");
      }, 1200);
      return () => {
        window.clearTimeout(timer);
        window.removeEventListener("bmt:connect-done", onDone);
      };
    }
    return () => window.removeEventListener("bmt:connect-done", onDone);
  }, [request]);

  return (
    <div className="card bg-gradient-to-br from-brand-600/25 via-ink-card/80 to-accent-cyan/10">
      <h1 className="text-xl font-bold text-white">Connect the Chrome extension</h1>
      <p className="mt-1 text-sm text-slate-400">
        Signed in as <span className="text-slate-200">{email}</span>. No API key to copy —
        the extension picks it up from here.
      </p>

      <div className="mt-5 space-y-3 text-sm">
        {status === "detecting" && (
          <p className="text-slate-300">Looking for the extension…</p>
        )}

        {status === "connecting" && (
          <p className="text-brand-200">Connecting your account…</p>
        )}

        {status === "connected" && (
          <div className="rounded-xl border border-accent-lime/40 bg-accent-lime/10 p-4">
            <p className="font-semibold text-accent-lime">Extension connected ✓</p>
            <p className="mt-1 text-slate-300">
              {plan ? `${plan} plan is active. ` : ""}Open any YouTube video — the pulse
              strip appears in the header automatically.
            </p>
            <a
              className="btn-primary mt-3 inline-flex"
              href="https://www.youtube.com/"
              target="_blank"
              rel="noreferrer"
            >
              Open YouTube
            </a>
          </div>
        )}

        {status === "failed" && (
          <div className="rounded-xl border border-accent-amber/40 bg-accent-amber/10 p-4">
            <p className="font-semibold text-accent-amber">Could not connect</p>
            <p className="mt-1 text-slate-300">{message || "Please try again."}</p>
            <button className="btn-ghost mt-3" onClick={request}>
              Try again
            </button>
          </div>
        )}

        {status === "missing" && (
          <div className="rounded-xl border border-ink-line bg-ink-soft/70 p-4">
            <p className="font-semibold text-white">Extension not installed yet</p>
            <p className="mt-1 text-slate-300">
              Add it to Chrome, then come back to this page — it connects on its own.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a className="btn-primary" href={STORE_URL} target="_blank" rel="noreferrer">
                Get it on Chrome
              </a>
              <button className="btn-ghost" onClick={() => window.location.reload()}>
                I have installed it
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
