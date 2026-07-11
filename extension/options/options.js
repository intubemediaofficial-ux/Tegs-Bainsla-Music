const DEFAULTS = { apiBase: "http://localhost:3000", apiKey: "" };

async function load() {
  const cfg = await chrome.storage.sync.get(DEFAULTS);
  document.getElementById("apiBase").value = cfg.apiBase || DEFAULTS.apiBase;
  document.getElementById("apiKey").value = cfg.apiKey || "";
}

document.getElementById("save").addEventListener("click", async () => {
  const apiBase = document.getElementById("apiBase").value.trim();
  const apiKey = document.getElementById("apiKey").value.trim();
  await chrome.storage.sync.set({ apiBase, apiKey });
  const ok = document.getElementById("ok");
  ok.textContent = "Saved!";
  setTimeout(() => (ok.textContent = ""), 1500);
});

load();
