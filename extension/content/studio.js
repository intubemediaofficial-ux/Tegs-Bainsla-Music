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
  let busy = false;
  let refreshedAt = 0;
  /** Tags this panel put into the box, so their badge shows a ✓. */
  const addedByUs = new Set();

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
      addedByUs.add(n.toLowerCase());
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
    if (score == null) return "na";
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

  async function loadReport(manual) {
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
    if (manual === true) {
      refreshedAt = Date.now();
      setTimeout(render, 2600);
    }
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

  /* ------------------------------ tag scores ------------------------------ */

  /** Every score we know for a tag: the report, related tags, drill-downs. */
  function scoreBook() {
    const book = new Map();
    const put = (t) => {
      const n = t.tag.toLowerCase();
      if (!book.has(n)) book.set(n, t);
    };
    if (report) {
      [...report.yours, ...report.weak].forEach(put);
      [...report.suggestions, ...report.fromRanking].forEach(put);
    }
    for (const data of insightCache.values()) {
      if (data && !data.error) {
        if (Number.isFinite(data.score)) put({ tag: data.keyword, score: data.score, rank: null });
        (data.related || []).forEach(put);
      }
    }
    return book;
  }

  function inBox() {
    return new Set(currentTags().map((t) => t.toLowerCase()));
  }

  /** Better tags not chosen yet (plus the ones just added, shown ticked). */
  function recommended() {
    if (!report) return [];
    const seen = new Set();
    const own = new Set(
      [...report.yours, ...report.weak].map((t) => t.tag.toLowerCase())
    );
    return [...report.suggestions, ...report.fromRanking]
      .filter((t) => {
        const n = t.tag.toLowerCase();
        if (seen.has(n) || own.has(n)) return false;
        seen.add(n);
        return true;
      })
      .sort((a, b) => b.score - a.score);
  }

  function addWithFeedback(tags) {
    const added = addMany(tags);
    if (!added && tags.some((t) => !inBox().has(t.toLowerCase()))) {
      status = "Tag box is full (500 characters). Remove a weak tag first.";
    } else {
      status = "";
    }
    setTimeout(render, 250);
    return added;
  }

  /** A suggestion chip: score %, tag, and + (adds to the box) or ✓ (already in). */
  function addChip(item, box) {
    const done = box.has(item.tag.toLowerCase());
    const c = h("button", `bmt-ts-chip bmt-ts-${band(item.score)}b${done ? " bmt-ts-done" : ""}`);
    c.appendChild(h("span", `bmt-ts-cscore bmt-ts-${band(item.score)}`, `${item.score}%`));
    c.appendChild(h("span", "bmt-ts-ctext", item.tag));
    c.appendChild(h("span", "bmt-ts-cadd", done ? "✓" : "+"));
    c.title = done ? "Already in your tags" : "Click + to add this tag to the video";
    c.disabled = done;
    c.addEventListener("click", () => addWithFeedback([item.tag]));
    return c;
  }

  /** A tag that is already in the box: score %, rank, drill-down, remove. */
  function ownChip(tag, item) {
    const chip = h("span", `bmt-ts-tag${openTag === tag ? " bmt-ts-open" : ""}`);
    const open = h("button", "bmt-ts-tagbtn");
    open.title = "Click for searches, competition and related tags";
    const score = item ? item.score : null;
    open.appendChild(
      h("span", `bmt-ts-score bmt-ts-${score == null ? "na" : band(score)}`, score == null ? "…" : `${score}%`)
    );
    open.appendChild(h("span", "bmt-ts-name", tag));
    if (item?.rank) open.appendChild(h("span", "bmt-ts-rank", `#${item.rank}`));
    open.addEventListener("click", () => openInsight(tag));
    chip.appendChild(open);

    const del = h("button", "bmt-ts-act", "✕");
    del.title = "Remove this tag from the box";
    del.addEventListener("click", () => {
      removeTag(tag);
      setTimeout(render, 250);
    });
    chip.appendChild(del);
    return chip;
  }

  function openInsight(tag) {
    openTag = openTag === tag ? null : tag;
    if (openTag) loadInsight(openTag);
    render();
  }

  function badgeLayer() {
    let layer = document.getElementById("bmt-chip-badges");
    if (!layer) {
      layer = h("div");
      layer.id = "bmt-chip-badges";
      document.body.appendChild(layer);
    }
    return layer;
  }

  /**
   * Score badges for the tags already in Studio's box, vidIQ-style. Studio's
   * chips are custom elements that render their own text, so a badge injected
   * into a chip can end up unslotted and invisible; instead the badges live in
   * one layer of our own, pinned to each chip's top-left corner. Clicking one
   * opens that tag's drill-down (searches, competition, related tags).
   */
  function paintNativeChips() {
    const layer = badgeLayer();
    const book = scoreBook();

    const alive = new Set();
    chips().forEach((chip, index) => {
      const text = chipText(chip);
      const item = book.get(text.toLowerCase());
      if (!item) return;
      const box = chip.getBoundingClientRect();
      if (!box.width || !box.height) return;

      const key = String(index);
      alive.add(key);
      let badge = layer.querySelector(`[data-bmt-key="${key}"]`);
      if (!badge) {
        badge = h("button", "bmt-chip-badge");
        badge.dataset.bmtKey = key;
        badge.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          openInsight(badge.dataset.bmtTag);
          document.getElementById("bmt-tagstudio")?.scrollIntoView({ block: "nearest" });
        });
        layer.appendChild(badge);
      }
      const ours = addedByUs.has(text.toLowerCase());
      badge.dataset.bmtTag = text;
      badge.className = `bmt-chip-badge bmt-native-${band(item.score)}`;
      badge.textContent = `${ours ? "✓ " : ""}${item.score}%`;
      badge.title = item.rank
        ? `${text} — ${item.score}% search demand, rank #${item.rank}. Click for related tags.`
        : `${text} — ${item.score}% score. Click for related tags.`;
      badge.style.left = `${box.left + window.scrollX - 3}px`;
      badge.style.top = `${box.top + window.scrollY - 8}px`;
    });

    for (const badge of [...layer.children]) {
      if (!alive.has(badge.dataset.bmtKey)) badge.remove();
    }
  }

  function insightBox(tag) {
    const box = h("div", "bmt-ts-insight");
    const data = insightCache.get(tag);
    if (data === null || data === undefined) {
      box.appendChild(h("div", "bmt-ts-muted", `Finding tags for "${tag}"…`));
      return box;
    }
    if (data.error) {
      box.appendChild(h("div", "bmt-ts-muted", data.error));
      return box;
    }

    const head = h("div", "bmt-ts-gauge");
    head.appendChild(h("span", `bmt-ts-big bmt-ts-${band(data.score)}`, String(data.score)));
    head.appendChild(h("span", "bmt-ts-muted", `Score for "${tag}"`));
    const close = h("button", "bmt-ts-mini", "Close");
    close.addEventListener("click", () => {
      openTag = null;
      render();
    });
    head.appendChild(close);
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
      const picks = data.related.slice(0, 24);
      const have = inBox();
      box.appendChild(h("div", "bmt-ts-sub", `Related tags for "${tag}" (${picks.length})`));
      const chipsWrap = h("div", "bmt-ts-chips");
      for (const r of picks) chipsWrap.appendChild(addChip(r, have));
      box.appendChild(chipsWrap);

      const left = picks.filter((r) => !have.has(r.tag.toLowerCase()));
      if (left.length) {
        const addAll = h("button", "bmt-ts-mini", `+ Add ${left.length === 1 ? "this tag" : `these ${left.length} tags`}`);
        addAll.addEventListener("click", () => addWithFeedback(left.map((r) => r.tag)));
        box.appendChild(addAll);
      }
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

  function sectionHead(title, extra) {
    const head = h("div", "bmt-ts-head");
    head.appendChild(h("span", null, title));
    if (extra) head.appendChild(extra);
    return head;
  }

  /** Overall SEO score for the video: title + how strong the tag set is + fill. */
  function seoScore(tags, book) {
    if (!report) return null;
    const scores = tags.map((t) => book.get(t.toLowerCase())?.score ?? 0);
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const fill = Math.min(1, tagsLength(tags) / 400);
    return Math.round(report.titleScore.score * 0.35 + avg * 0.45 + fill * 20);
  }

  let searchText = "";

  function render(needsAuth) {
    const panel = mount();
    if (!panel) return;
    paintNativeChips();
    const focused = document.activeElement?.id === "bmt-ts-search";
    panel.innerHTML = "";

    const tags = currentTags();
    const have = new Set(tags.map((t) => t.toLowerCase()));
    const book = scoreBook();
    lastPainted = tags.join("\n");

    /* header */
    const head = h("div", "bmt-ts-top");
    const brand = h("span", "bmt-ts-brand");
    const logo = h("img", "bmt-ts-logo");
    logo.src = chrome.runtime.getURL("icons/icon48.png");
    logo.alt = "";
    brand.appendChild(logo);
    brand.appendChild(h("strong", null, "Bainsla Tag Studio"));
    head.appendChild(brand);

    const seo = seoScore(tags, book);
    if (seo != null) {
      const pill = h("span", `bmt-ts-seo bmt-ts-${band(seo)}`, `SEO ${seo}/100`);
      pill.title = "Title score + strength of your tags + how much of the 500 characters you use";
      head.appendChild(pill);
    }

    const len = tagsLength(tags);
    head.appendChild(
      h(
        "span",
        `bmt-ts-meter bmt-ts-${len > LIMIT ? "lo" : len >= 420 ? "hi" : "mid"}`,
        `${len}/${LIMIT} · ${tags.length} tags`
      )
    );

    const refresh = h(
      "button",
      "bmt-ts-mini",
      busy ? "Working…" : Date.now() - refreshedAt < 2500 ? "✓ Updated" : "⟳ Refresh"
    );
    refresh.disabled = busy;
    refresh.title = "Re-score your tags and fetch fresh suggestions";
    refresh.addEventListener("click", () => loadReport(true));
    head.appendChild(refresh);
    panel.appendChild(head);

    if (status) panel.appendChild(h("div", "bmt-ts-status", status));
    if (needsAuth) {
      const btn = h("button", "bmt-ts-cta", "Sign in / Sign up");
      btn.addEventListener("click", () => chrome.runtime.sendMessage({ type: "openConnect" }));
      panel.appendChild(btn);
      return;
    }

    /* 1. your tags, each with its score */
    const yours = h("div", "bmt-ts-sec");
    yours.appendChild(sectionHead(`Your tags (${tags.length})`));
    const wrap = h("div", "bmt-ts-wrap");
    if (!tags.length) wrap.appendChild(h("div", "bmt-ts-muted", "No tags yet — add some with + below."));
    for (const tag of tags) wrap.appendChild(ownChip(tag, book.get(tag.toLowerCase())));
    yours.appendChild(wrap);
    if (openTag && have.has(openTag.toLowerCase())) yours.appendChild(insightBox(openTag));
    panel.appendChild(yours);

    if (!report) return;

    /* 2. recommended tags — the better ones not in the box yet */
    const recs = recommended().slice(0, 40);
    const pending = recs.filter((t) => !have.has(t.tag.toLowerCase()));
    const rec = h("div", "bmt-ts-sec");
    let addAll = null;
    if (pending.length) {
      addAll = h("button", "bmt-ts-cta", `+ Add all that fit (${pending.length})`);
      addAll.addEventListener("click", () => addWithFeedback(pending.map((t) => t.tag)));
    }
    rec.appendChild(sectionHead(`Recommended tags (${recs.length})`, addAll));
    const recWrap = h("div", "bmt-ts-chips");
    if (!recs.length) recWrap.appendChild(h("div", "bmt-ts-muted", "No stronger on-topic tag found right now."));
    for (const t of recs) recWrap.appendChild(addChip(t, have));
    rec.appendChild(recWrap);
    rec.appendChild(
      h(
        "div",
        "bmt-ts-note",
        "Better tags from live YouTube search demand and the videos ranking for this topic. Click + to add — it moves into your Tags box and gets a ✓."
      )
    );
    panel.appendChild(rec);

    /* 3. tag research box (type any keyword) */
    const research = h("div", "bmt-ts-sec");
    research.appendChild(sectionHead("Find more tags"));
    const form = h("form", "bmt-ts-form");
    const input = h("input", "bmt-ts-input");
    input.id = "bmt-ts-search";
    input.placeholder = "Type a keyword, e.g. gurjar rasiya";
    input.value = searchText;
    input.addEventListener("input", () => (searchText = input.value));
    form.appendChild(input);
    form.appendChild(h("button", "bmt-ts-mini", "Search"));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const k = input.value.trim();
      if (!k) return;
      openTag = k;
      loadInsight(k);
      render();
    });
    research.appendChild(form);
    if (openTag && !have.has(openTag.toLowerCase())) research.appendChild(insightBox(openTag));
    panel.appendChild(research);
    if (focused) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }

    /* 4. one-click actions */
    const actions = h("div", "bmt-ts-actions");
    const fit = h("button", "bmt-ts-mini", `Auto-fit best tags (${report.autofit.length}/500)`);
    fit.title = "Replace the box with the strongest set that fits in 500 characters";
    fit.addEventListener("click", () => {
      const keep = new Set(report.autofit.used.map((t) => t.toLowerCase()));
      for (const tag of currentTags()) {
        if (!keep.has(tag.toLowerCase())) removeTag(tag);
      }
      setTimeout(() => addWithFeedback(report.autofit.used), 400);
    });
    actions.appendChild(fit);
    actions.appendChild(copyBtn("Copy my tags", tags.join(", ")));
    actions.appendChild(copyBtn("Copy 500-char set", report.autofit.text));
    if (report.hashtags?.length)
      actions.appendChild(copyBtn("Copy hashtags", report.hashtags.join(" ")));
    panel.appendChild(actions);

    /* 5. title score + who ranks */
    const t = h("div", "bmt-ts-title");
    t.appendChild(
      h("span", `bmt-ts-score bmt-ts-${band(report.titleScore.score)}`, String(report.titleScore.score))
    );
    t.appendChild(h("span", null, "Title score"));
    panel.appendChild(t);
    const tips = h("ul", "bmt-ts-tips");
    for (const r of report.titleScore.reasons.slice(0, 3)) tips.appendChild(h("li", null, r));
    panel.appendChild(tips);

    if (report.competitors?.length) {
      const comps = h("div", "bmt-ts-comps");
      comps.appendChild(h("div", "bmt-ts-sub", "Top ranking videos for this topic"));
      for (const c of report.competitors.slice(0, 5)) {
        const a = h("a", "bmt-ts-vid", `${nice(c.views)} · ${c.channel} — ${c.title}`);
        a.href = `https://www.youtube.com/watch?v=${c.videoId}`;
        a.target = "_blank";
        a.rel = "noreferrer";
        comps.appendChild(a);
      }
      panel.appendChild(comps);
    }
  }

  /* ------------------------------ life cycle ------------------------------ */

  /**
   * Only a video's own details page (or the upload dialog) has a Tags box for
   * us. Studio is a single-page app and keeps the old edit page in the DOM
   * after you go back to Content, so the chip bar must also be visible.
   */
  function onEditPage() {
    const bar = chipBar();
    if (!bar) return false;
    if (/\/video\/[^/]+\/(edit|details)/.test(location.pathname)) return true;
    const r = bar.getBoundingClientRect();
    return !!bar.closest("ytcp-uploads-dialog") && r.width > 0 && r.height > 0;
  }

  function teardown() {
    document.getElementById("bmt-chip-badges")?.remove();
    document.getElementById("bmt-tagstudio")?.remove();
  }

  let lastKey = "";
  let lastPainted = "";
  function tick() {
    if (!onEditPage()) {
      teardown();
      lastKey = "";
      return;
    }
    // Keyed on the video, not the title text: typing in the title box must not
    // fire a fresh research call (and burn quota) on every keystroke.
    const key = location.pathname + location.search;
    if (key !== lastKey && detectTitle()) {
      lastKey = key;
      report = null;
      openTag = null;
      insightCache.clear();
      addedByUs.clear();
      loadReport();
      return;
    }
    const typing = document.activeElement?.id === "bmt-ts-search";
    if (!document.getElementById("bmt-tagstudio")) render();
    else if (!typing && currentTags().join("\n") !== lastPainted) render();
    else paintNativeChips();
  }

  // The badges are pinned to chip positions, so any scroll or resize has to
  // move them with the chips.
  addEventListener("scroll", () => paintNativeChips(), true);
  addEventListener("resize", () => paintNativeChips());

  setInterval(tick, 1500);
  tick();
})();
