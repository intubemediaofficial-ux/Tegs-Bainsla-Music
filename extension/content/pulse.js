// vidIQ-style overlay for the video currently open: a compact strip inside the
// YouTube header (60 min / 48 h / views per hour) plus a full stats panel.
(function () {
  const POLL_MS = 60_000;

  let currentId = "";
  let timer = null;
  let latest = null;

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function compact(n) {
    const v = Number(n) || 0;
    if (v >= 10_000_000) return `${(v / 10_000_000).toFixed(1)}Cr`;
    if (v >= 100_000) return `${(v / 100_000).toFixed(1)}L`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return String(v);
  }

  function videoIdFromUrl() {
    const m = location.href.match(/[?&]v=([A-Za-z0-9_-]{11})/);
    return m ? m[1] : "";
  }

  /* --------------------------------- strip -------------------------------- */

  function buildStrip() {
    let strip = document.getElementById("bmt-strip");
    if (strip) return strip;
    strip = el("div", null);
    strip.id = "bmt-strip";
    strip.title = "Bainsla Tags — click for the full report";
    strip.addEventListener("click", () => {
      const panel = document.getElementById("bmt-pulse-panel");
      if (panel) panel.classList.toggle("open");
    });

    const host =
      document.querySelector("ytd-masthead #end") ||
      document.querySelector("#masthead #end") ||
      null;
    if (host) host.insertBefore(strip, host.firstChild);
    else document.body.appendChild(strip), strip.classList.add("bmt-strip-float");
    return strip;
  }

  function renderStrip(data) {
    const strip = buildStrip();
    strip.innerHTML = "";
    if (!data) {
      strip.appendChild(el("span", "bmt-s-item", "…"));
      return;
    }
    const p = data.pulse;
    const items = [
      { icon: "👁", value: compact(p.last60m.views), hint: "last 60 min", live: p.last60m.measured },
      { icon: "🕐", value: compact(p.last48h.views), hint: "last 48 h", live: p.last48h.measured },
      { icon: "⚡", value: `${compact(p.currentVph)}/hr`, hint: "views per hour", live: p.tracking },
      { icon: "📊", value: compact(data.video.views), hint: "total views", live: true },
    ];
    for (const it of items) {
      const box = el("span", `bmt-s-item${it.live ? "" : " bmt-est"}`);
      box.title = it.live ? it.hint : `${it.hint} (estimate — tracking just started)`;
      box.appendChild(el("span", "bmt-s-ico", it.icon));
      box.appendChild(el("span", "bmt-s-val", it.value));
      strip.appendChild(box);
    }
  }

  /* --------------------------------- panel -------------------------------- */

  function copyBtn(text, label) {
    const b = el("button", "bmt-copy", label || "Copy");
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(text);
      const old = b.textContent;
      b.textContent = "Copied!";
      setTimeout(() => (b.textContent = old), 1200);
    });
    return b;
  }

  function section(title, node, copyText) {
    const s = el("div", "bmt-sec");
    const head = el("h4");
    head.appendChild(el("span", null, title));
    if (copyText) head.appendChild(copyBtn(copyText, "Copy all"));
    s.appendChild(head);
    s.appendChild(node);
    return s;
  }

  function statGrid(rows) {
    const grid = el("div", "bmt-grid");
    for (const [label, value, hint] of rows) {
      const cell = el("div", "bmt-cell");
      cell.appendChild(el("div", "bmt-cell-v", value));
      cell.appendChild(el("div", "bmt-cell-l", label));
      if (hint) cell.title = hint;
      grid.appendChild(cell);
    }
    return grid;
  }

  function sparkline(samples) {
    const wrap = el("div", "bmt-spark");
    if (!samples || samples.length < 2) return wrap;
    const pts = samples.slice(-40);
    const deltas = [];
    for (let i = 1; i < pts.length; i += 1) {
      const hours = (pts[i].t - pts[i - 1].t) / 3600000;
      deltas.push(hours > 0 ? Math.max(0, pts[i].views - pts[i - 1].views) / hours : 0);
    }
    const max = Math.max(...deltas, 1);
    for (const d of deltas) {
      const bar = el("span", "bmt-bar");
      bar.style.height = `${Math.max(6, Math.round((d / max) * 100))}%`;
      bar.title = `${Math.round(d)} views/hr`;
      wrap.appendChild(bar);
    }
    return wrap;
  }

  function buildPanel() {
    let panel = document.getElementById("bmt-pulse-panel");
    if (panel) return panel;
    panel = el("div", null);
    panel.id = "bmt-pulse-panel";
    document.body.appendChild(panel);
    return panel;
  }

  function renderPanel(data) {
    const panel = buildPanel();
    const wasOpen = panel.classList.contains("open");
    panel.innerHTML = "";
    if (wasOpen) panel.classList.add("open");

    const head = el("div", "bmt-p-head");
    head.appendChild(el("strong", null, "Bainsla Tags — this video"));
    const close = el("button", "bmt-x", "✕");
    close.addEventListener("click", () => panel.classList.remove("open"));
    head.appendChild(close);
    panel.appendChild(head);

    const v = data.video;
    const p = data.pulse;

    // Realtime block
    const rt = el("div");
    rt.appendChild(
      statGrid([
        ["last 60 min", compact(p.last60m.views)],
        ["last 24 h", compact(p.last24h.views)],
        ["last 48 h", compact(p.last48h.views)],
        ["views / hr", compact(p.currentVph)],
      ])
    );
    rt.appendChild(sparkline(p.samples));
    rt.appendChild(
      el(
        "div",
        "bmt-note",
        p.tracking
          ? `Measured here (${p.samples.length} samples, ~${p.last48h.coveredHours}h covered) — YouTube's own realtime is private to the owner.`
          : "Tracking started just now — these are lifetime-average estimates until the next samples land."
      )
    );
    panel.appendChild(section("Realtime", rt));

    // Video block
    const vid = el("div");
    vid.appendChild(
      statGrid([
        ["views", compact(v.views)],
        ["likes", `${compact(v.likes)} · ${v.likeRate}%`],
        ["comments", `${compact(v.comments)} · ${v.commentRate}%`],
        ["age", v.publishedText || `${v.ageHours}h`],
        ["length", v.durationText || "—"],
        ["title score", `${v.titleScore}/100`],
      ])
    );
    if (v.titleTips && v.titleTips.length) {
      const tips = el("ul", "bmt-tips");
      v.titleTips.slice(0, 3).forEach((t) => tips.appendChild(el("li", null, t)));
      vid.appendChild(tips);
    }
    const dl = el("a", "bmt-dl", "⬇ Download thumbnail");
    dl.href = v.thumbnail;
    dl.target = "_blank";
    dl.rel = "noreferrer";
    vid.appendChild(dl);
    panel.appendChild(section("Video", vid));

    // Why it is winning
    if (data.why) {
      const why = el("div", "bmt-why");
      why.appendChild(el("div", "bmt-why-l", data.why.label));
      why.appendChild(el("div", "bmt-note", data.why.note));
      panel.appendChild(section("Why it is winning (estimate)", why));
    }

    // Tags
    const tagWrap = el("div");
    if (data.tags.hidden) {
      tagWrap.appendChild(el("div", "bmt-note", "This video has no public tags."));
    } else {
      const chips = el("div", "bmt-chips");
      data.tags.trending.forEach((t) => {
        const c = el("span", "bmt-chip bmt-chip-ok");
        c.appendChild(el("span", null, t.tag));
        c.appendChild(el("span", "bmt-rank", `#${t.rank}`));
        c.appendChild(copyBtn(t.tag, "⧉"));
        chips.appendChild(c);
      });
      data.tags.notTrending.slice(0, 12).forEach((t) => {
        const c = el("span", "bmt-chip");
        c.appendChild(el("span", null, t));
        c.appendChild(copyBtn(t, "⧉"));
        chips.appendChild(c);
      });
      tagWrap.appendChild(chips);
      tagWrap.appendChild(
        el(
          "div",
          "bmt-note",
          `${data.tags.trending.length}/${data.tags.all.length} tags carry live search demand. Rank = live autocomplete order (demand proxy), not an official YouTube number.`
        )
      );
    }
    panel.appendChild(
      section(`Tags on this video (${data.tags.all.length})`, tagWrap, data.tags.all.join(", "))
    );

    // Better tags
    if (data.tags.suggestions.length) {
      const chips = el("div", "bmt-chips");
      data.tags.suggestions.forEach((t) => {
        const c = el("span", "bmt-chip bmt-chip-new");
        c.appendChild(el("span", null, t.tag));
        c.appendChild(el("span", "bmt-rank", `#${t.rank}`));
        c.appendChild(copyBtn(t.tag, "⧉"));
        chips.appendChild(c);
      });
      panel.appendChild(
        section(
          "Stronger tags to use",
          chips,
          data.tags.suggestions.map((t) => t.tag).join(", ")
        )
      );
    }

    // Hashtags
    if (data.hashtagIdeas.length) {
      const chips = el("div", "bmt-chips");
      data.hashtagIdeas.forEach((h) => chips.appendChild(el("span", "bmt-chip", h)));
      panel.appendChild(section("Hashtags", chips, data.hashtagIdeas.join(" ")));
    }

    // Channel
    if (data.channel) {
      const c = data.channel;
      const box = el("div");
      box.appendChild(
        statGrid([
          ["subscribers", compact(c.subscribers)],
          ["channel views", compact(c.views)],
          ["videos", compact(c.videoCount)],
          ["avg / video", compact(c.avgViews)],
          ["uploads / week", String(c.uploadsPerWeek)],
        ])
      );
      if (c.keywords.length) {
        const chips = el("div", "bmt-chips");
        c.keywords.slice(0, 18).forEach((k) => {
          const chip = el("span", "bmt-chip");
          chip.appendChild(el("span", null, k));
          chip.appendChild(copyBtn(k, "⧉"));
          chips.appendChild(chip);
        });
        const kw = el("div");
        const h = el("div", "bmt-sub");
        h.appendChild(el("span", null, `Channel tags (${c.keywords.length})`));
        h.appendChild(copyBtn(c.keywords.join(", "), "Copy all"));
        kw.appendChild(h);
        kw.appendChild(chips);
        box.appendChild(kw);
      }
      const list = el("div", "bmt-list");
      c.recent.forEach((r) => {
        const row = el("a", "bmt-row-link");
        row.href = r.url;
        const img = el("img");
        img.src = r.thumbnail;
        row.appendChild(img);
        const meta = el("div");
        meta.appendChild(el("div", "bmt-row-t", r.title));
        meta.appendChild(
          el("div", "bmt-note", `${compact(r.views)} views · ${r.publishedText} · ${compact(r.vph)}/hr`)
        );
        row.appendChild(meta);
        list.appendChild(row);
      });
      const sub = el("div", "bmt-sub");
      sub.appendChild(el("span", null, "Latest uploads"));
      box.appendChild(sub);
      box.appendChild(list);
      panel.appendChild(section(`Channel — ${c.title}`, box));
    }
  }

  /* --------------------------------- flow --------------------------------- */

  async function load() {
    const id = videoIdFromUrl();
    if (!id) return;
    const resp = await chrome.runtime.sendMessage({ type: "pulse", videoId: id });
    if (resp?.error) {
      const strip = buildStrip();
      strip.innerHTML = "";
      const warn = el("span", "bmt-s-item bmt-est", resp.error.slice(0, 40));
      strip.appendChild(warn);
      return;
    }
    latest = resp.data;
    renderStrip(latest);
    renderPanel(latest);
  }

  function start() {
    const id = videoIdFromUrl();
    if (!id || id === currentId) return;
    currentId = id;
    renderStrip(null);
    load();
    if (timer) clearInterval(timer);
    timer = setInterval(load, POLL_MS);
  }

  // YouTube is a SPA: re-init on navigation and when the strip gets wiped.
  document.addEventListener("yt-navigate-finish", () => setTimeout(start, 600));
  window.addEventListener("focus", () => {
    if (latest) load();
  });
  setInterval(() => {
    if (videoIdFromUrl() && !document.getElementById("bmt-strip") && latest) renderStrip(latest);
  }, 3000);

  setTimeout(start, 1200);
})();
