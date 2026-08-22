// Runs on the dashboard itself. The page cannot see chrome.* APIs, so it asks
// us over a DOM event; we pull the key with the page's own session cookie and
// hand it to the background worker.
(() => {
  const manifest = chrome.runtime.getManifest();
  document.documentElement.setAttribute("data-bmt-extension", manifest.version);

  function done(detail) {
    window.dispatchEvent(new CustomEvent("bmt:connect-done", { detail }));
  }

  async function connect() {
    try {
      const res = await fetch("/api/ext/link", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok || !data.apiKey) {
        done({ error: data.error || "Sign in to the dashboard first." });
        return;
      }
      const stored = await chrome.runtime.sendMessage({
        type: "link",
        account: {
          apiBase: location.origin,
          apiKey: data.apiKey,
          email: data.email,
          plan: data.plan,
          planLabel: data.planLabel,
        },
      });
      if (stored?.error) done({ error: stored.error });
      else done({ email: data.email, planLabel: data.planLabel });
    } catch (e) {
      done({ error: "Could not reach the dashboard. Reload and try again." });
    }
  }

  window.addEventListener("bmt:connect-request", connect);
})();
