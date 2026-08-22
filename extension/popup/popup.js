const $ = (id) => document.getElementById(id);

$("options").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

$("go").addEventListener("click", run);
$("q").addEventListener("keydown", (e) => {
  if (e.key === "Enter") run();
});

$("signIn").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "openConnect" });
  window.close();
});

$("signOut").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "signOut" });
  showAccount();
});

async function showAccount() {
  const cfg = await chrome.runtime.sendMessage({ type: "getConfig" });
  const signedIn = Boolean(cfg?.apiKey);
  $("signedIn").hidden = !signedIn;
  $("signedOut").hidden = signedIn;
  if (signedIn) {
    $("email").textContent = cfg.email || "Connected";
    $("plan").textContent = cfg.planLabel ? `${cfg.planLabel} plan` : "";
  }
}

chrome.storage.onChanged.addListener(showAccount);
showAccount();

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function copyBtn(text) {
  const b = el("button", "copy", "Copy");
  b.addEventListener("click", () => {
    navigator.clipboard.writeText(text);
    b.textContent = "Copied!";
    setTimeout(() => (b.textContent = "Copy"), 1200);
  });
  return b;
}

async function run() {
  const query = $("q").value.trim();
  if (!query) return;
  $("go").disabled = true;
  $("status").textContent = "Generating…";
  $("out").innerHTML = "";

  const resp = await chrome.runtime.sendMessage({ type: "generate", query });
  $("go").disabled = false;

  if (resp?.error) {
    $("status").textContent = resp.error;
    if (resp.needsAuth) showAccount();
    return;
  }
  $("status").textContent = "";
  render(resp.data);
}

function section(title, node, copyText) {
  const s = el("div", "section");
  const h = el("h4", null, title);
  if (copyText) {
    const wrap = el("div");
    wrap.style.display = "flex";
    wrap.style.justifyContent = "space-between";
    wrap.appendChild(h);
    wrap.appendChild(copyBtn(copyText));
    s.appendChild(wrap);
  } else {
    s.appendChild(h);
  }
  s.appendChild(node);
  return s;
}

function chips(items) {
  const c = el("div", "chips");
  items.forEach((i) => c.appendChild(el("span", "chip", i)));
  return c;
}

function render(d) {
  const out = $("out");

  // Titles
  const titlesWrap = el("div");
  d.titles.slice(0, 4).forEach((t) => {
    const row = el("div", "title");
    row.appendChild(el("span", null, t.title));
    row.appendChild(el("span", null, String(t.score)));
    titlesWrap.appendChild(row);
  });
  out.appendChild(section("Titles", titlesWrap));

  // Tags
  const ta = el("textarea");
  ta.readOnly = true;
  ta.value = d.tagBox.text;
  out.appendChild(section(`Tags (${d.tagBox.text.length}/500)`, ta, d.tagBox.text));

  // Hashtags
  out.appendChild(section("Hashtags", chips(d.hashtags), d.hashtags.join(" ")));
}
