// YouTube Studio — Tag Studio panel.
// Sits under the video's own Tags box: scores the tags already there, proposes
// stronger ones from live search demand and from the videos that rank, drills
// into any tag (searches / competition / related) and writes tags straight into
// Studio's chip bar. No API key to paste — the dashboard sign-in carries over.
(function () {
  if (window.__bmtStudio) return;
  window.__bmtStudio = true;

  const LIMIT = 500;
  const insightCache = new Map();
  let report = null;
  let status = "";
  let openTag = null;
  let openTab = "yours";
  let busy = false;

  /* ------------------------------ Studio DOM ------------------------------ */

  function chipBar() {
    const bars = [...document.querySelectorAll("ytcp-chip-bar")];
    if (!bars.length) return null;
    const tagged = bars.find((bar) => {
      const box = bar.closest("ytcp-form-input-container, #tags-container, div");
      return /\btags\b/i.test(box?.textContent?.slice(0, 200) || "");
    });
    return tagged || bars[bars.length - 1];
  }

  function chips() {
    const bar = chipBar();
    if (!bar) return [];
    return [...bar.querySelectorAll("ytcp-chip")];
  }

  function chipText(chip) {
    const node = chip.querySelector("#chip-text, .chip-text, span");
    return (node?.textContent || chip.textContent || "").replace(/[✕✖×]\s*$/, "").trim();
  }

  function currentTags() {
    return chips().map(chipText).filter(Boolean);
  }

  function tagsLength(list) {
    return list.join(",").length;
  }

  function chipInput() {
    const bar = chipBar();
    if (!bar) return null;
    return bar.querySelector("input#text-input, input, textarea");
  }

  /** Type a tag into Studio's chip bar and commit it the way a user would. */
  function addTag(tag) {
    const input = chipInput();
    if (!input) return false;
    const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
    const setValue = Object.getOwnPropertyDescriptor(proto.prototype, "value").set;
    input.focus();
    setValue.call(input, tag);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    for (const type of ["keydown", "keypress", "keyup"]) {
      input.dispatchEvent(
        new KeyboardEvent(type, {
          bubbles: true,
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
        })
      );
    }
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function removeTag(tag) {
    const chip = chips().find((c) => chipText(c).toLowerCase() === tag.toLowerCase());
    if (!chip) return false;
    const btn = chip.querySelector(
      "#delete-icon, ytcp-icon-button, tp-yt-iron-icon, button, [aria-label]"
    );
    if (!btn) return false;
    btn.click();
    return true;
  }

  /** Add tags one by one, stopping before YouTube's 500-character limit. */
  function addMany(tags) {
    const have = currentTags();
    let len = tagsLength(have);
    const used = new Set(have.map((t) => t.toLowerCase()));
    let added = 0;
    for (const tag of tags) {
      const n = tag.trim();
      if (!n || used.has(n.toLowerCase())) continue;
      const cost = len === 0 ? n.length : n.length + 1;
      if (len + cost > LIMIT) break;
      if (!addTag(n)) break;
      used.add(n.toLowerCase());
      len += cost;
      added += 1;
    }
    return added;
  }

  function detectTitle() {
    const sels = [
      "ytcp-social-suggestions-textbox#title-textarea #textbox",
      "#title-textarea #textbox",
      "#title-wrapper #textbox",
      "textarea#textbox",
      'div#textbox[aria-label*="title" i]',
    ];
    for (const s of sels) {
      const el = document.querySelector(s);
      const text = (el?.value || el?.textContent || "").trim();
      if (text) return text;
    }
    return "";
  }

  /* -------------------------------- helpers ------------------------------- */

  function h(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function band(score) {
    return score >= 60 ? "hi" : score >= 35 ? "mid" : "lo";
  }

  function nice(n) {
    if (!Number.isFinite(n)) return "—";
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return String(n);
  }

  function copyBtn(label, text) {
    const b = h("button", "bmt-ts-mini", label);
    b.addEventListener("click", () => {
      navigator.clipboard.writeText(text);
      const old = b.textContent;
      b.textContent = "Copied!";
      setTimeout(() => (b.textContent = old), 1200);
    });
    return b;
  }

  /* --------------------------------- data --------------------------------- */

  async function loadReport() {
    const title = detectTitle();
    if (!title) {
      status = "Open a video's details page to research its tags.";
      render();
      return;
    }
    busy = true;
    status = "Reading live search demand…";
    render();
    const resp = await chrome.runtime.sendMessage({
      type: "tagReport",
      title,
      tags: currentTags(),
    });
    busy = false;
    if (resp?.error) {
      status = resp.error;
      report = null;
      render(resp.needsAuth);
      return;
    }
    report = resp.data;
    status = "";
    render();
  }

  async function loadInsight(tag) {
    if (insightCache.has(tag)) return insightCache.get(tag);
    insightCache.set(tag, null); // mark as loading
    render();
    const resp = await chrome.runtime.sendMessage({
      type: "keywordInsight",
      keyword: tag,
      // Keep the related tags inside this video's own topic.
      context: [detectTitle(), ...currentTags()].join(" ").slice(0, 1200),
    });
    const value = resp?.error ? { error: resp.error } : resp.data;
    insightCache.set(tag, value);
    render();
    return value;
  }

  /* ---------------------------------- UI ---------------------------------- */

  function mount() {
    let panel = document.getElementById("bmt-tagstudio");
    const bar = chipBar();
    const anchor = bar
      ? bar.closest("ytcp-form-input-container") || bar.parentElement
      : null;
    if (!anchor) return null;

    if (!panel) {
      panel = h("div");
      panel.id = "bmt-tagstudio";
    }
    if (panel.parentElement !== anchor.parentElement || panel.previousElementSibling !== anchor) {
      anchor.parentElement.insertBefore(panel, anchor.nextSibling);
    }
    return panel;
  }

  /**
   * One tag card for the two-column grid. Returns the card plus, when the tag is
   * open, a full-width drill-down that sits right under it.
   */
  function tagCard(item, opts) {
    const card = h("div", `bmt-ts-card${openTag === item.tag ? " bmt-ts-open" : ""}`);

    const top = h("div", "bmt-ts-row");
    const score = h("span", `bmt-ts-score bmt-ts-${band(item.score)}`, `${item.score}%`);
    score.title = "Search-demand strength (0-100%) from live YouTube autocomplete";
    top.appendChild(score);

    const name = h("button", "bmt-ts-name", item.tag);
    name.title = "Click for searches, competition and related tags";
    name.addEventListener("click", () => {
      openTag = openTag === item.tag ? null : item.tag;
      if (openTag) loadInsight(openTag);
      render();
    });
    top.appendChild(name);

    if (opts?.add) {
      const add = h("button", "bmt-ts-act", "+");
      add.title = "Add this tag to the box";
      add.addEventListener("click", () => {
        addMany([item.tag]);
        render();
      });
      top.appendChild(add);
    }
    if (opts?.remove) {
      const del = h("button", "bmt-ts-act", "✕");
      del.title = "Remove this tag from the box";
      del.addEventListener("click", () => {
        removeTag(item.tag);
        setTimeout(render, 200);
      });
      top.appendChild(del);
    }
    card.appendChild(top);

    const meta = h("div", "bmt-ts-meta");
    const rank = h("span", "bmt-ts-pill", item.rank ? `Rank #${item.rank}` : "No live demand");
    rank.title = "Position in live autocomplete demand (proxy, not an official YouTube rank)";
    meta.appendChild(rank);
    const cached = insightCache.get(item.tag);
    if (cached && !cached.error) {
      const vol = h("span", "bmt-ts-pill", `${nice(cached.monthlySearches)}/mo est.`);
      vol.title = "Estimated monthly searches";
      meta.appendChild(vol);
      meta.appendChild(h("span", "bmt-ts-pill", `${cached.competitionLabel} competition`));
    }
    card.appendChild(meta);

    if (openTag !== item.tag) return [card];
    const drill = insightBox(item.tag);
    drill.classList.add("bmt-ts-wide");
    return [card, drill];
  }

  function insightBox(tag) {
    const box = h("div", "bmt-ts-insight");
    const data = insightCache.get(tag);
    if (data === null || data === undefined) {
      box.appendChild(h("div", "bmt-ts-muted", "Loading…"));
      return box;
    }
    if (data.error) {
      box.appendChild(h("div", "bmt-ts-muted", data.error));
      return box;
    }

    const head = h("div", "bmt-ts-gauge");
    head.appendChild(h("span", `bmt-ts-big bmt-ts-${band(data.score)}`, String(data.score)));
    head.appendChild(h("span", "bmt-ts-muted", "Overall score"));
    box.appendChild(head);

    const stats = h("div", "bmt-ts-stats");
    const stat = (k, v) => {
      const r = h("div", "bmt-ts-stat");
      r.appendChild(h("span", "bmt-ts-muted", k));
      r.appendChild(h("strong", null, v));
      stats.appendChild(r);
    };
    stat("Monthly searches (est.)", nice(data.monthlySearches));
    stat("Competition", data.competitionLabel);
    stat("Difficulty", `${data.difficulty}/100`);
    stat("Opportunity", `${data.opportunity}/100`);
    box.appendChild(stats);

    if (data.related?.length) {
      box.appendChild(h("div", "bmt-ts-sub", `Related tags for "${tag}"`));
      const picks = data.related.slice(0, 5);
      const chipsWrap = h("div", "bmt-ts-chips");
      for (const r of picks) {
        const c = h("button", `bmt-ts-chip bmt-ts-${band(r.score)}b`);
        c.appendChild(h("span", `bmt-ts-cscore bmt-ts-${band(r.score)}`, `${r.score}%`));
        c.appendChild(h("span", "bmt-ts-ctext", r.tag));
        c.appendChild(h("span", "bmt-ts-cadd", "+"));
        c.title = r.rank ? `Rank #${r.rank} in live demand — click to add` : "Click to add";
        c.addEventListener("click", () => {
          addMany([r.tag]);
          render();
        });
        chipsWrap.appendChild(c);
      }
      box.appendChild(chipsWrap);

      const addAll = h("button", "bmt-ts-mini", `Add these ${picks.length} tags`);
      addAll.addEventListener("click", () => {
        addMany(picks.map((r) => r.tag));
        render();
      });
      box.appendChild(addAll);
    }

    if (data.topVideos?.length) {
      box.appendChild(h("div", "bmt-ts-sub", "Ranking now"));
      for (const v of data.topVideos.slice(0, 4)) {
        const a = h("a", "bmt-ts-vid", `${nice(v.views)} · ${v.title}`);
        a.href = `https://www.youtube.com/watch?v=${v.videoId}`;
        a.target = "_blank";
        a.rel = "noreferrer";
        box.appendChild(a);
      }
    }

    box.appendChild(
      h("div", "bmt-ts-note", "Searches are estimates from live YouTube demand, not exact figures.")
    );
    return box;
  }

  /** Two-column card grid (vidIQ-style) instead of one long vertical list. */
  function section(title, items, opts) {
    const s = h("div", "bmt-ts-sec");
    const head = h("div", "bmt-ts-head");
    head.appendChild(h("span", null, title));
    if (opts?.extra) head.appendChild(opts.extra);
    s.appendChild(head);

    const grid = h("div", "bmt-ts-grid");
    if (!items.length) {
      grid.appendChild(h("div", "bmt-ts-muted bmt-ts-wide", opts?.empty || "Nothing here yet."));
    }
    for (const item of items) {
      for (const node of tagCard(item, opts?.card || {})) grid.appendChild(node);
    }
    s.appendChild(grid);
    if (opts?.foot) s.appendChild(opts.foot);
    return s;
  }

  function render(needsAuth) {
    const panel = mount();
    if (!panel) return;
    panel.innerHTML = "";

    /* header */
    const head = h("div", "bmt-ts-top");
    const brand = h("span", "bmt-ts-brand");
    const logo = h("img", "bmt-ts-logo");
    logo.src = chrome.runtime.getURL("icons/icon48.png");
    logo.alt = "";
    brand.appendChild(logo);
    brand.appendChild(h("strong", null, "Bainsla Tag Studio"));
    head.appendChild(brand);

    const tags = currentTags();
    const len = tagsLength(tags);
    const meter = h(
      "span",
      `bmt-ts-meter bmt-ts-${len > LIMIT ? "lo" : len >= 420 ? "hi" : "mid"}`,
      `${len}/${LIMIT} · ${tags.length} tags`
    );
    head.appendChild(meter);

    const refresh = h("button", "bmt-ts-mini", busy ? "Working…" : "Refresh");
    refresh.disabled = busy;
    refresh.addEventListener("click", loadReport);
    head.appendChild(refresh);
    panel.appendChild(head);

    if (status) {
      const s = h("div", "bmt-ts-status", status);
      panel.appendChild(s);
    }
    if (needsAuth) {
      const btn = h("button", "bmt-ts-cta", "Sign in / Sign up");
      btn.addEventListener("click", () => chrome.runtime.sendMessage({ type: "openConnect" }));
      panel.appendChild(btn);
      return;
    }
    if (!report) return;

    /* title score */
    const t = h("div", "bmt-ts-title");
    t.appendChild(
      h("span", `bmt-ts-score bmt-ts-${band(report.titleScore.score)}`, String(report.titleScore.score))
    );
    t.appendChild(h("span", null, "Title score"));
    panel.appendChild(t);
    const tips = h("ul", "bmt-ts-tips");
    for (const r of report.titleScore.reasons.slice(0, 3)) tips.appendChild(h("li", null, r));
    panel.appendChild(tips);

    /* one-click actions */
    const actions = h("div", "bmt-ts-actions");
    const fit = h("button", "bmt-ts-cta", `Auto-fit best tags (${report.autofit.length}/500)`);
    fit.title = "Replace the box with the strongest set that fits in 500 characters";
    fit.addEventListener("click", () => {
      const keep = new Set(report.autofit.used.map((t) => t.toLowerCase()));
      for (const tag of currentTags()) {
        if (!keep.has(tag.toLowerCase())) removeTag(tag);
      }
      setTimeout(() => {
        addMany(report.autofit.used);
        render();
      }, 400);
    });
    actions.appendChild(fit);
    actions.appendChild(copyBtn("Copy 500-char set", report.autofit.text));
    if (report.hashtags?.length)
      actions.appendChild(copyBtn("Copy hashtags", report.hashtags.join(" ")));
    panel.appendChild(actions);

    /* tabs */
    const tabs = [
      ["suggestions", `Suggestions (${report.suggestions.length})`],
      ["ranking", `From ranking videos (${report.fromRanking.length})`],
      ["yours", `Your tags (${report.yours.length + report.weak.length})`],
      ["weak", `Weak (${report.weak.length})`],
    ];
    const bar = h("div", "bmt-ts-tabs");
    for (const [id, label] of tabs) {
      const b = h("button", `bmt-ts-tab${openTab === id ? " bmt-ts-on" : ""}`, label);
      b.addEventListener("click", () => {
        openTab = id;
        render();
      });
      bar.appendChild(b);
    }
    panel.appendChild(bar);

    if (openTab === "suggestions") {
      const addAll = h("button", "bmt-ts-mini", "Add all that fit");
      addAll.addEventListener("click", () => {
        addMany(report.suggestions.map((x) => x.tag));
        render();
      });
      panel.appendChild(
        section("Tags people are searching now", report.suggestions, {
          extra: addAll,
          card: { add: true },
          empty: "No on-topic tag with live demand right now.",
          foot: h(
            "div",
            "bmt-ts-note",
            "Only tags from this video's own topic are shown. % = live search-demand strength, rank = autocomplete position (proxy, not an official YouTube number)."
          ),
        })
      );
    } else if (openTab === "ranking") {
      const addAll = h("button", "bmt-ts-mini", "Add all that fit");
      addAll.addEventListener("click", () => {
        addMany(report.fromRanking.map((x) => x.tag));
        render();
      });
      const comps = h("div", "bmt-ts-comps");
      for (const c of report.competitors.slice(0, 5)) {
        const a = h("a", "bmt-ts-vid", `${nice(c.views)} · ${c.channel} — ${c.title}`);
        a.href = `https://www.youtube.com/watch?v=${c.videoId}`;
        a.target = "_blank";
        a.rel = "noreferrer";
        comps.appendChild(a);
      }
      panel.appendChild(
        section("Tags the top-ranking videos use", report.fromRanking, {
          extra: addAll,
          card: { add: true },
          empty: "The ranking videos hide their tags.",
          foot: comps,
        })
      );
    } else if (openTab === "yours") {
      panel.appendChild(
        section("Tags in the box, strongest first", [...report.yours, ...report.weak], {
          card: { remove: true },
          empty: "No tags in the box yet — add some from Suggestions.",
          foot: h(
            "div",
            "bmt-ts-note",
            "Click any tag you already use to see its estimated searches, competition and 5 related tags you can add in one click."
          ),
        })
      );
    } else {
      panel.appendChild(
        section("No measurable search demand — safe to drop", report.weak, {
          card: { remove: true },
          empty: "Every tag in the box has search demand. 👍",
        })
      );
    }
  }

  /* ------------------------------ life cycle ------------------------------ */

  let lastKey = "";
  function tick() {
    if (!chipBar()) return;
    // Keyed on the video, not the title text: typing in the title box must not
    // fire a fresh research call (and burn quota) on every keystroke.
    const key = location.pathname;
    if (key !== lastKey && detectTitle()) {
      lastKey = key;
      report = null;
      openTag = null;
      insightCache.clear();
      loadReport();
      return;
    }
    if (!document.getElementById("bmt-tagstudio")) render();
  }

  setInterval(tick, 1500);
  tick();
})();
