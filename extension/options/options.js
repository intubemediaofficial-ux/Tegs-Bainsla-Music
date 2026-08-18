const DEFAULTS = { apiBase: "https://tag.bainslamusic.com", apiKey: "" };

async function load() {
  const cfg = await chrome.storage.sync.get(DEFAULTS);
  document.getElementById("apiBase").value = cfg.apiBase || DEFAULTS.apiBase;
  document.getElementById("apiKey").value = cfg.apiKey || "";
}

/** Self-hosted dashboards need their host granted at save time. */
async function grantHost(apiBase) {
  try {
    const origin = `${new URL(apiBase).origin}/*`;
    if (await chrome.permissions.contains({ origins: [origin] })) return true;
    return chrome.permissions.request({ origins: [origin] });
  } catch {
    return false;
  }
}

document.getElementById("save").addEventListener("click", async () => {
  const apiBase = document.getElementById("apiBase").value.trim();
  const apiKey = document.getElementById("apiKey").value.trim();
  const ok = document.getElementById("ok");

  if (!(await grantHost(apiBase))) {
    ok.textContent = "Allow access to that dashboard address to continue.";
    return;
  }
  await chrome.storage.sync.set({ apiBase, apiKey });
  ok.textContent = "Saved!";
  setTimeout(() => (ok.textContent = ""), 1500);
});

load();
