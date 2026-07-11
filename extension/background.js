// Central fetch proxy so content scripts / popup share one code path and the
// API key never leaks into page context.
const DEFAULTS = { apiBase: "http://localhost:3000", apiKey: "" };

async function getConfig() {
  const cfg = await chrome.storage.sync.get(DEFAULTS);
  return { ...DEFAULTS, ...cfg };
}

async function generate(query, hl, gl) {
  const { apiBase, apiKey } = await getConfig();
  if (!apiKey) return { error: "No API key set. Open the extension options and paste your key." };
  const base = apiBase.replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}/api/ext/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ query, hl: hl || "en", gl: gl || "IN" }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || `Request failed (${res.status})` };
    return { data };
  } catch (e) {
    return { error: `Cannot reach ${base}. Check the dashboard URL in options.` };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "generate") {
    generate(msg.query, msg.hl, msg.gl).then(sendResponse);
    return true; // async
  }
  if (msg?.type === "getConfig") {
    getConfig().then(sendResponse);
    return true;
  }
});
