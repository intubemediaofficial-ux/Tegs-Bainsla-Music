const DEFAULTS = { apiBase: "https://tag.bainslamusic.com", apiKey: "", email: "", planLabel: "" };
const $ = (id) => document.getElementById(id);

async function load() {
  const cfg = { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) };
  $("apiBase").value = cfg.apiBase || DEFAULTS.apiBase;

  const connected = Boolean(cfg.apiKey);
  $("who").textContent = connected ? cfg.email || "Connected" : "Not connected";
  $("detail").textContent = connected
    ? `${cfg.planLabel ? cfg.planLabel + " plan — " : ""}open any YouTube video to see the pulse strip.`
    : "Sign in once and the extension connects itself — no API key to copy.";
  $("connect").textContent = connected ? "Reconnect" : "Sign in / Connect";
  $("disconnect").hidden = !connected;
}

/** Self-hosted dashboards need their host granted before we can call them. */
async function grantHost(apiBase) {
  try {
    const origin = `${new URL(apiBase).origin}/*`;
    if (await chrome.permissions.contains({ origins: [origin] })) return true;
    return chrome.permissions.request({ origins: [origin] });
  } catch {
    return false;
  }
}

$("connect").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "openConnect" });
});

$("disconnect").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "signOut" });
  load();
});

$("save").addEventListener("click", async () => {
  const apiBase = $("apiBase").value.trim();
  const ok = $("ok");
  if (!(await grantHost(apiBase))) {
    ok.textContent = "Allow access to that address to continue.";
    return;
  }
  await chrome.storage.sync.set({ apiBase });
  ok.textContent = "Saved!";
  setTimeout(() => (ok.textContent = ""), 1500);
});

chrome.storage.onChanged.addListener(load);
load();
