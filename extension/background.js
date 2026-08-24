// Central fetch proxy so content scripts / popup share one code path and the
// API key never leaks into page context.
const DEFAULTS = {
  apiBase: "https://tag.bainslamusic.com",
  apiKey: "",
  email: "",
  plan: "",
  planLabel: "",
};

const SIGN_IN_HINT = "Sign in from the extension icon to start.";

async function getConfig() {
  const cfg = await chrome.storage.sync.get(DEFAULTS);
  return { ...DEFAULTS, ...cfg };
}

function connectUrl(apiBase) {
  return `${(apiBase || DEFAULTS.apiBase).replace(/\/+$/, "")}/connect`;
}

/** Opens the dashboard page that hands the extension its key. */
async function openConnect() {
  const { apiBase } = await getConfig();
  await chrome.tabs.create({ url: connectUrl(apiBase) });
  return { ok: true };
}

async function saveAccount(account) {
  if (!account?.apiKey) return { error: "No key received from the dashboard." };
  await chrome.storage.sync.set({
    apiBase: account.apiBase || DEFAULTS.apiBase,
    apiKey: account.apiKey,
    email: account.email || "",
    plan: account.plan || "",
    planLabel: account.planLabel || "",
  });
  return { ok: true };
}

async function signOut() {
  await chrome.storage.sync.set({ apiKey: "", email: "", plan: "", planLabel: "" });
  return { ok: true };
}

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason !== "install") return;
  const { apiKey, apiBase } = await getConfig();
  if (!apiKey) await chrome.tabs.create({ url: connectUrl(apiBase) });
});

async function generate(query, hl, gl) {
  const { apiBase, apiKey } = await getConfig();
  if (!apiKey) return { error: SIGN_IN_HINT, needsAuth: true };
  const base = apiBase.replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}/api/ext/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ query, hl: hl || "en", gl: gl || "IN" }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) return { error: SIGN_IN_HINT, needsAuth: true };
      return { error: data.error || `Request failed (${res.status})` };
    }
    return { data };
  } catch (e) {
    return { error: `Cannot reach ${base}. Check your connection.` };
  }
}

async function pulse(videoId) {
  const { apiBase, apiKey } = await getConfig();
  if (!apiKey) return { error: SIGN_IN_HINT, needsAuth: true };
  const base = apiBase.replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}/api/ext/pulse?video=${encodeURIComponent(videoId)}`, {
      headers: { "x-api-key": apiKey },
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) return { error: SIGN_IN_HINT, needsAuth: true };
      return { error: data.error || `Request failed (${res.status})` };
    }
    return { data };
  } catch (e) {
    return { error: `Cannot reach ${base}. Check your connection.` };
  }
}

/**
 * Category-wise viral board for the panel's Viral tab. Cached in memory for a
 * few minutes: the snapshots refresh server-side, and the panel re-renders on
 * every tab click.
 */
let trendingCache = { at: 0, payload: null };
const TRENDING_TTL_MS = 5 * 60 * 1000;

async function trending() {
  if (trendingCache.payload && Date.now() - trendingCache.at < TRENDING_TTL_MS) {
    return trendingCache.payload;
  }
  const { apiBase, apiKey } = await getConfig();
  if (!apiKey) return { error: SIGN_IN_HINT, needsAuth: true };
  const base = apiBase.replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}/api/ext/trending`, { headers: { "x-api-key": apiKey } });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) return { error: SIGN_IN_HINT, needsAuth: true };
      return { error: data.error || `Request failed (${res.status})` };
    }
    trendingCache = { at: Date.now(), payload: { data } };
    return trendingCache.payload;
  } catch (e) {
    return { error: `Cannot reach ${base}. Check your connection.` };
  }
}

/** Tag Studio panel: `report` scores the box, `keyword` drills into one tag. */
async function tagStudio(payload) {
  const { apiBase, apiKey } = await getConfig();
  if (!apiKey) return { error: SIGN_IN_HINT, needsAuth: true };
  const base = apiBase.replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}/api/ext/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ hl: "en", gl: "IN", ...payload }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) return { error: SIGN_IN_HINT, needsAuth: true };
      return { error: data.error || `Request failed (${res.status})` };
    }
    return { data };
  } catch (e) {
    return { error: `Cannot reach ${base}. Check your connection.` };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "tagReport") {
    tagStudio({ action: "report", title: msg.title, tags: msg.tags || [] }).then(sendResponse);
    return true;
  }
  if (msg?.type === "keywordInsight") {
    tagStudio({ action: "keyword", keyword: msg.keyword }).then(sendResponse);
    return true;
  }
  if (msg?.type === "trending") {
    trending().then(sendResponse);
    return true;
  }
  if (msg?.type === "pulse") {
    pulse(msg.videoId).then(sendResponse);
    return true; // async
  }
  if (msg?.type === "generate") {
    generate(msg.query, msg.hl, msg.gl).then(sendResponse);
    return true; // async
  }
  if (msg?.type === "getConfig") {
    getConfig().then(sendResponse);
    return true;
  }
  if (msg?.type === "link") {
    saveAccount(msg.account).then(sendResponse);
    return true;
  }
  if (msg?.type === "openConnect") {
    openConnect().then(sendResponse);
    return true;
  }
  if (msg?.type === "download") {
    chrome.downloads
      .download({ url: msg.url, filename: msg.filename || "thumbnail.jpg" })
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ error: "Could not save the thumbnail." }));
    return true;
  }
  if (msg?.type === "signOut") {
    signOut().then(sendResponse);
    return true;
  }
});
