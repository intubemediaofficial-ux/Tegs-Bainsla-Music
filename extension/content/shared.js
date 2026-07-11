// Shared panel UI used by both the Studio and watch-page content scripts.
// Attached to window so each content script can call it (they load separately).
(function () {
  if (window.__bmtPanelInit) return;
  window.__bmtPanelInit = true;

  function h(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function copyLink(text) {
    const b = h("button", "bmt-copy", "Copy");
    b.addEventListener("click", () => {
      navigator.clipboard.writeText(text);
      b.textContent = "Copied!";
      setTimeout(() => (b.textContent = "Copy"), 1200);
    });
    return b;
  }

  window.bmtBuildPanel = function (defaultQuery) {
    if (document.getElementById("bmt-fab")) return;

    const fab = h("button", null, "🎵 Bainsla Tags");
    fab.id = "bmt-fab";
    const panel = h("div");
    panel.id = "bmt-panel";

    panel.appendChild(h("h3", null, "Tag & Title Suggestions"));
    const row = h("div", "bmt-row");
    const input = h("input");
    input.placeholder = "Singer / song / keyword";
    input.value = defaultQuery || "";
    const go = h("button", "bmt-go", "Go");
    row.appendChild(input);
    row.appendChild(go);
    panel.appendChild(row);

    const status = h("div", "bmt-status");
    panel.appendChild(status);
    const out = h("div");
    panel.appendChild(out);

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    fab.addEventListener("click", () => panel.classList.toggle("open"));
    go.addEventListener("click", run);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") run();
    });

    function sec(title, node, copyText) {
      const s = h("div", "bmt-sec");
      const head = h("h4");
      head.appendChild(h("span", null, title));
      if (copyText) head.appendChild(copyLink(copyText));
      s.appendChild(head);
      s.appendChild(node);
      return s;
    }

    async function run() {
      const query = input.value.trim();
      if (!query) return;
      status.textContent = "Generating…";
      out.innerHTML = "";
      const resp = await chrome.runtime.sendMessage({ type: "generate", query });
      if (resp?.error) {
        status.textContent = resp.error;
        return;
      }
      status.textContent = "";
      const d = resp.data;

      const titles = h("div");
      d.titles.slice(0, 4).forEach((t) => {
        const r = h("div", "bmt-chip");
        r.style.display = "block";
        r.style.marginBottom = "4px";
        r.textContent = `(${t.score}) ${t.title}`;
        titles.appendChild(r);
      });
      out.appendChild(sec("Titles", titles));

      const ta = h("textarea");
      ta.readOnly = true;
      ta.value = d.tagBox.text;
      out.appendChild(sec(`Tags (${d.tagBox.text.length}/500)`, ta, d.tagBox.text));

      const chips = h("div", "bmt-chips");
      d.hashtags.forEach((x) => chips.appendChild(h("span", "bmt-chip", x)));
      out.appendChild(sec("Hashtags", chips, d.hashtags.join(" ")));
    }

    if (defaultQuery) run();
  };
})();
