// vidIQ-style overlay for the video currently open: a compact strip inside the
// YouTube header (60 min / 48 h / views per hour) plus a full stats panel.
(function () {
  const POLL_MS = 60_000;

  let currentId = "";
  let timer = null;
  let latest = null;
  let dismissedId = "";
  let activeTab = "overview";
  let storyOpen = false;
  let viral = null; // { categories: [...] } once the Viral tab has loaded
  let viralError = "";
  let viralCat = ""; // which category is expanded

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

  /**
   * The view count YouTube itself prints on the page. The API counter can lag
   * minutes behind (and reads 0 on a brand-new upload), so whichever number is
   * higher is the one the viewer should see.
   */
  function pageViews() {
    const hosts = document.querySelectorAll(
      "ytd-watch-metadata #info-container, ytd-watch-metadata #info, ytd-watch-info-text, #count .view-count"
    );
    for (const host of hosts) {
      const m = (host.textContent || "").match(/([\d,.\u0966-\u096F]{1,20})\s*(?:views|व्यू)/i);
      if (m) {
        const n = Number(m[1].replace(/[,.]/g, ""));
        if (Number.isFinite(n) && n > 0) return n;
      }
    }
    return 0;
  }

  function viewsOf(video) {
    return Math.max(Number(video.views) || 0, pageViews());
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
      { icon: "👁", ...windowCell("last 60 min", p.last60m) },
      { icon: "🕐", ...windowCell("last 48 h", p.last48h) },
      {
        icon: "⚡",
        value: `${compact(p.currentVph)}/hr`,
        hint: p.tracking ? "views per hour, measured" : "views per hour — lifetime average so far",
        live: p.tracking,
      },
      { icon: "📊", value: compact(viewsOf(data.video)), hint: "total views", live: true },
    ];
    for (const it of items) {
      const box = el("span", `bmt-s-item${it.live ? "" : " bmt-est"}`);
      box.title = it.hint;
      box.appendChild(el("span", "bmt-s-ico", it.icon));
      box.appendChild(el("span", "bmt-s-val", it.value));
      strip.appendChild(box);
    }
  }

  /**
   * A window's number, never pretending a 10-minute sample covers 48 hours.
   * Fully covered -> the measured number. Barely covered -> a dash, because
   * "0 views in the last 48 h" on a live video reads as dead when it only means
   * "we have been watching for 10 minutes". In between -> "1.2K+ in 6h".
   */
  function windowCell(name, d) {
    const target = d.windowHours || 1;
    if (!d.measured) {
      return {
        label: name,
        value: `~${compact(d.views)}`,
        hint: `${name} — estimate from this video's lifetime average, real tracking starts in a few minutes`,
        live: false,
      };
    }
    if (!d.partial) {
      return { label: name, value: compact(d.views), hint: `${name} — measured`, live: true };
    }
    const covered = `${d.coveredHours}h tracked so far`;
    if (d.coveredHours < target * 0.25) {
      return {
        label: `${name} (${covered})`,
        value: "—",
        hint: `${name} — not enough history yet, only ${covered}`,
        live: false,
      };
    }
    return {
      label: `${name} (${covered})`,
      value: `${compact(d.views)}+`,
      hint: `${name} — ${compact(d.views)} views measured in the last ${d.coveredHours}h`,
      live: false,
    };
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

  /* ---------------------------- realtime story ---------------------------- */

  const HOUR = 3600000;

  function timeLabel(t, bucketHours) {
    const d = new Date(t);
    return bucketHours >= 24
      ? d.toLocaleDateString(undefined, { day: "numeric", month: "short" })
      : d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric" });
  }

  /**
   * Group the raw 5-minute samples into readable blocks (half-hourly for a
   * short history, daily once we have days of it) with the views gained and the
   * rate inside each block.
   */
  function buckets(samples) {
    if (!samples || samples.length < 3) return [];
    const first = samples[0];
    const last = samples[samples.length - 1];
    const spanH = (last.t - first.t) / HOUR;
    if (spanH < 1) return [];
    const size = spanH > 72 ? 24 : spanH > 24 ? 6 : spanH > 6 ? 2 : 0.5;
    const out = [];
    for (let i = 1; i < samples.length; i += 1) {
      const prev = samples[i - 1];
      const cur = samples[i];
      const hours = (cur.t - prev.t) / HOUR;
      if (hours <= 0) continue;
      const slot = Math.floor((cur.t - first.t) / (size * HOUR));
      const b = out[out.length - 1];
      if (b && b.slot === slot) {
        b.views += Math.max(0, cur.views - prev.views);
        b.hours += hours;
        b.end = cur.t;
        b.total = cur.views;
      } else {
        out.push({
          slot,
          start: prev.t,
          end: cur.t,
          views: Math.max(0, cur.views - prev.views),
          hours,
          total: cur.views,
        });
      }
    }
    return out
      .filter((b) => b.hours > 0)
      .map((b) => ({ ...b, rate: Math.round(b.views / b.hours), size }));
  }

  function median(nums) {
    if (!nums.length) return 0;
    const s = [...nums].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  }

  /**
   * Plain-language history of the video: how long it stayed quiet, when it woke
   * up, its best hour and where it stands now. Built from the same samples the
   * sparkline uses — public counters only, so it is honest for any video.
   */
  function storyText(pulse, video) {
    const b = buckets(pulse.samples);
    if (b.length < 2) return null;
    const spanH = (b[b.length - 1].end - b[0].start) / HOUR;
    const now = b[b.length - 1];
    const before = b.slice(0, -1);
    const base = median(before.map((x) => x.rate)) || 1;
    const peak = b.reduce((a, x) => (x.rate > a.rate ? x : a), b[0]);
    const tracked =
      spanH >= 48 ? `${(spanH / 24).toFixed(1)} days` : `${Math.round(spanH)} hours`;

    const parts = [`Tracked here for ${tracked}.`];
    const ratio = now.rate / base;
    if (ratio >= 1.6) {
      const quiet = before.filter((x) => x.rate <= base * 1.2).length;
      parts.push(
        `It stayed slow at about ${compact(base)} views/hr for ${quiet || before.length} of the last ${
          b.length
        } blocks, then picked up around ${timeLabel(now.start, now.size)}.`
      );
      parts.push(`Right now it is doing ${compact(now.rate)} views/hr — ${ratio.toFixed(1)}× that quiet rate.`);
    } else if (ratio <= 0.6) {
      parts.push(
        `It was running at about ${compact(base)} views/hr and has cooled down to ${compact(
          now.rate
        )} views/hr since ${timeLabel(now.start, now.size)}.`
      );
    } else {
      parts.push(`It is holding steady around ${compact(now.rate)} views/hr.`);
    }
    parts.push(
      `Best block so far: ${timeLabel(peak.start, peak.size)} with ${compact(peak.views)} views (${compact(
        peak.rate
      )}/hr). Total now ${compact(viewsOf(video))}.`
    );
    return { text: parts.join(" "), blocks: b };
  }

  /** The point-by-point list behind the story paragraph. */
  function storyTimeline(blocks) {
    const list = el("div", "bmt-timeline");
    [...blocks]
      .reverse()
      .slice(0, 24)
      .forEach((b) => {
        const row = el("div", "bmt-tl-row");
        row.appendChild(el("span", "bmt-tl-t", timeLabel(b.start, b.size)));
        row.appendChild(el("span", "bmt-tl-v", `+${compact(b.views)}`));
        row.appendChild(el("span", "bmt-tl-r", `${compact(b.rate)}/hr`));
        row.appendChild(el("span", "bmt-tl-tot", compact(b.total)));
        list.appendChild(row);
      });
    const head = el("div", "bmt-tl-row bmt-tl-head");
    head.appendChild(el("span", "bmt-tl-t", "when"));
    head.appendChild(el("span", "bmt-tl-v", "views"));
    head.appendChild(el("span", "bmt-tl-r", "rate"));
    head.appendChild(el("span", "bmt-tl-tot", "total"));
    list.insertBefore(head, list.firstChild);
    return list;
  }

  /* -------------------------------- viral tab ------------------------------ */

  function viralPane(rerender) {
    const wrap = el("div");
    if (viralError) {
      wrap.appendChild(el("div", "bmt-note", viralError));
      return wrap;
    }
    if (!viral) {
      wrap.appendChild(el("div", "bmt-note", "Loading what is viral right now…"));
      chrome.runtime
        .sendMessage({ type: "trending" })
        .then((resp) => {
          if (resp?.error) viralError = resp.error;
          else viral = resp?.data || { categories: [] };
          rerender();
        })
        .catch(() => {
          viralError = "Could not load the viral board.";
          rerender();
        });
      return wrap;
    }

    const cats = viral.categories || [];
    if (!cats.length) {
      wrap.appendChild(el("div", "bmt-note", "No categories tracked yet — add them in the dashboard."));
      return wrap;
    }
    if (!cats.some((c) => c.id === viralCat)) viralCat = cats[0].id;

    const picker = el("div", "bmt-cats");
    cats.forEach((c) => {
      const b = el("button", `bmt-cat${c.id === viralCat ? " bmt-cat-on" : ""}`, c.label);
      b.addEventListener("click", () => {
        viralCat = c.id;
        rerender();
      });
      picker.appendChild(b);
    });
    wrap.appendChild(picker);

    const cat = cats.find((c) => c.id === viralCat);
    const list = el("div", "bmt-list");
    cat.videos.forEach((v) => {
      const row = el("a", "bmt-row-link");
      row.href = v.url;
      row.target = "_blank";
      const img = el("img");
      img.src = v.thumbnail;
      row.appendChild(img);
      const meta = el("div");
      meta.appendChild(el("div", "bmt-row-t", v.title));
      meta.appendChild(
        el(
          "div",
          "bmt-note",
          `${compact(v.views)} views · ${v.publishedText} · ${compact(v.velocity)}/hr · viral ${v.viralScore}/100`
        )
      );
      if (v.why) meta.appendChild(el("div", "bmt-why-l", v.why));
      meta.appendChild(el("div", "bmt-note", v.channel));
      row.appendChild(meta);
      list.appendChild(row);
    });
    wrap.appendChild(section(`Rising now — ${cat.label}`, list));

    if (cat.topTags.length) {
      const chips = el("div", "bmt-chips");
      cat.topTags.forEach((t) => {
        const c = el("span", "bmt-chip bmt-chip-ok");
        c.appendChild(el("span", null, t));
        c.appendChild(copyBtn(t, "⧉"));
        chips.appendChild(c);
      });
      wrap.appendChild(section("Tags these videos share", chips, cat.topTags.join(", ")));
    }
    if (cat.hashtags.length) {
      const chips = el("div", "bmt-chips");
      cat.hashtags.forEach((h) => chips.appendChild(el("span", "bmt-chip", h)));
      wrap.appendChild(section("Hashtags trending here", chips, cat.hashtags.join(" ")));
    }
    if (cat.recommendation) {
      wrap.appendChild(section("What to do", el("div", "bmt-note", cat.recommendation)));
    }
    wrap.appendChild(
      el(
        "div",
        "bmt-note",
        `Public data, refreshed on the server${
          cat.updatedAt ? ` (${new Date(cat.updatedAt).toLocaleString()})` : ""
        }. Viral score is our estimate, not a YouTube number.`
      )
    );
    return wrap;
  }

  /**
   * Lives inside YouTube's own right-hand column (above the related videos) so
   * it never covers the player. Falls back to a floating card when that column
   * is missing (theater mode, Shorts, early page load).
   */
  function buildPanel() {
    const column =
      document.querySelector("#secondary #secondary-inner") ||
      document.querySelector("#secondary");
    let panel = document.getElementById("bmt-pulse-panel");
    if (!panel) {
      panel = el("div", null);
      panel.id = "bmt-pulse-panel";
    }
    const wanted = column || document.body;
    if (panel.parentElement !== wanted) wanted.insertBefore(panel, wanted.firstChild);
    panel.classList.toggle("bmt-inline", Boolean(column));
    return panel;
  }

  function tabBar(tabs, panel, render) {
    const bar = el("div", "bmt-tabs");
    for (const [id, label] of tabs) {
      const b = el("button", `bmt-tab${activeTab === id ? " bmt-tab-on" : ""}`, label);
      b.addEventListener("click", () => {
        activeTab = id;
        render();
      });
      bar.appendChild(b);
    }
    panel.appendChild(bar);
  }

  /** YouTube's stored files, biggest first. Not every video has every size. */
  const THUMB_FILES = [
    ["maxresdefault", "Original 1280×720"],
    ["sddefault", "SD 640×480"],
    ["hqdefault", "HQ 480×360"],
    ["mqdefault", "MQ 320×180"],
    ["default", "Small 120×90"],
  ];

  function thumbUrl(id, file) {
    return `https://i.ytimg.com/vi/${id}/${file}.jpg`;
  }

  /** A missing size still returns YouTube's 120px grey placeholder. */
  function probeThumb(url) {
    return new Promise((resolve) => {
      const probe = new Image();
      probe.onload = () => resolve(probe.naturalWidth > 200);
      probe.onerror = () => resolve(false);
      probe.src = url;
    });
  }

  function safeName(title) {
    return (
      (title || "thumbnail").replace(/[^\w\u0900-\u097F -]+/g, "").trim().slice(0, 60) ||
      "thumbnail"
    );
  }

  function saveThumb(url, title, file, note) {
    note.textContent = "Saving…";
    chrome.runtime
      .sendMessage({
        type: "download",
        url,
        filename: `${safeName(title)} - ${file}.jpg`,
      })
      .then((resp) => {
        note.textContent = resp?.error || "Saved to your Downloads folder.";
      })
      .catch(() => {
        note.textContent = "Could not save the thumbnail.";
      });
  }

  /**
   * Big, highlighted thumbnail card: preview plus one-click download of the
   * original file YouTube stores (no right-click → Save image).
   */
  function thumbnailBox(video) {
    const id = video.videoId || videoIdFromUrl();
    const box = el("div", "bmt-thumb");

    const shot = el("div", "bmt-thumb-shot");
    const img = el("img");
    img.src = video.thumbnail || thumbUrl(id, "hqdefault");
    shot.appendChild(img);
    const badge = el("span", "bmt-thumb-badge", "checking size…");
    shot.appendChild(badge);
    box.appendChild(shot);

    const note = el("div", "bmt-note", "One click saves the original file — no right-click needed.");
    const sizes = el("div", "bmt-thumb-sizes");

    const btn = el("button", "bmt-dl bmt-dl-big", "⬇ Download original thumbnail");
    btn.addEventListener("click", () => {
      const file = btn.dataset.file || "hqdefault";
      saveThumb(thumbUrl(id, file), video.title, file, note);
    });
    box.appendChild(btn);
    box.appendChild(sizes);
    box.appendChild(note);

    // Find the largest file this video actually has, then offer the rest too.
    (async () => {
      let best = null;
      for (const [file, label] of THUMB_FILES) {
        const url = thumbUrl(id, file);
        // eslint-disable-next-line no-await-in-loop
        const ok = await probeThumb(url);
        if (!ok) continue;
        if (!best) {
          best = { file, label };
          img.src = url;
          badge.textContent = label;
          btn.dataset.file = file;
          btn.textContent = `⬇ Download original (${label.replace(/^[^ ]+ /, "")})`;
          continue;
        }
        const alt = el("button", "bmt-thumb-size", label);
        alt.addEventListener("click", () => saveThumb(url, video.title, file, note));
        sizes.appendChild(alt);
      }
      if (!best) badge.textContent = "Preview only";
    })();

    return box;
  }

  function brand() {
    const wrap = el("span", "bmt-brand");
    const logo = el("img", "bmt-logo");
    logo.src = chrome.runtime.getURL("icons/icon48.png");
    logo.alt = "";
    wrap.appendChild(logo);
    wrap.appendChild(el("strong", null, "Bainsla Tags"));
    return wrap;
  }

  function renderSignIn() {
    const panel = buildPanel();
    panel.innerHTML = "";
    const head = el("div", "bmt-p-head");
    head.appendChild(brand());
    const close = el("button", "bmt-x", "✕");
    close.addEventListener("click", () => {
      dismissedId = currentId;
      panel.classList.remove("open");
    });
    head.appendChild(close);
    panel.appendChild(head);

    const box = el("div");
    box.appendChild(
      el(
        "div",
        "bmt-note",
        "Sign in once and every video you open shows its tags, hashtags, title score and the 60-minute / 48-hour view pulse right here."
      )
    );
    const btn = el("button", "bmt-dl", "Sign in / Sign up");
    btn.addEventListener("click", () => chrome.runtime.sendMessage({ type: "openConnect" }));
    box.appendChild(btn);
    panel.appendChild(section("Welcome", box));
    if (currentId !== dismissedId) panel.classList.add("open");
  }

  function renderPanel(data) {
    const panel = buildPanel();
    const wasOpen = panel.classList.contains("open");
    panel.innerHTML = "";
    if (wasOpen) panel.classList.add("open");

    const head = el("div", "bmt-p-head");
    head.appendChild(brand());
    const close = el("button", "bmt-x", "✕");
    close.addEventListener("click", () => {
      dismissedId = currentId;
      panel.classList.remove("open");
    });
    head.appendChild(close);
    panel.appendChild(head);

    const rerender = () => renderPanel(data);
    tabBar(
      [
        ["overview", "Overview"],
        ["views", "Realtime"],
        ["thumb", "Thumbnail"],
        ["tags", "Tags"],
        ["viral", "Viral"],
      ],
      panel,
      rerender
    );

    // One pane per tab, so the sidebar stays short instead of one long scroll.
    const panes = {
      overview: el("div", "bmt-tabpane"),
      views: el("div", "bmt-tabpane"),
      thumb: el("div", "bmt-tabpane"),
      tags: el("div", "bmt-tabpane"),
      viral: el("div", "bmt-tabpane"),
    };
    const views = panes.views;
    const overview = panes.overview;
    const tags = panes.tags;
    panel.appendChild(panes[activeTab] || panes.overview);

    const v = data.video;
    const p = data.pulse;

    // Realtime block
    const rt = el("div");
    const cells = [
      windowCell("last 60 min", p.last60m),
      windowCell("last 24 h", p.last24h),
      windowCell("last 48 h", p.last48h),
    ];
    rt.appendChild(
      statGrid([
        ...cells.map((c) => [c.label, c.value, c.hint]),
        ["views / hr", compact(p.currentVph)],
      ])
    );
    rt.appendChild(sparkline(p.samples));
    rt.appendChild(
      el(
        "div",
        "bmt-note",
        p.tracking
          ? `Measured here every 5 min (${p.samples.length} samples, ${p.last48h.coveredHours}h tracked so far). YouTube keeps its own realtime report private to the video's owner.`
          : "Tracking just started — these are lifetime-average estimates until the next samples land (about 5 minutes)."
      )
    );
    views.appendChild(section("Realtime", rt));

    // The story of this video's views, in words. Click it for the exact points.
    const story = storyText(p, v);
    if (story) {
      const box = el("div");
      const para = el("div", "bmt-story", story.text);
      para.title = "Click for the point-by-point history";
      para.addEventListener("click", () => {
        storyOpen = !storyOpen;
        rerender();
      });
      box.appendChild(para);
      box.appendChild(
        el("div", "bmt-note", storyOpen ? "Click the text to hide the points." : "Click the text for point-by-point views.")
      );
      if (storyOpen) box.appendChild(storyTimeline(story.blocks));
      views.appendChild(section("What happened with this video", box));
    }

    panes.thumb.appendChild(section("Thumbnail", thumbnailBox(v)));
    panes.viral.appendChild(section("Viral by category", viralPane(rerender)));

    // Video block
    const vid = el("div");
    vid.appendChild(
      statGrid([
        ["views", compact(viewsOf(v))],
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
    overview.appendChild(section("Video", vid));

    // Why it is winning
    if (data.why) {
      const why = el("div", "bmt-why");
      why.appendChild(el("div", "bmt-why-l", data.why.label));
      why.appendChild(el("div", "bmt-note", data.why.note));
      overview.appendChild(section("Why it is winning (estimate)", why));
    }

    // Official owner analytics (only for your own connected channel)
    if (data.owner) {
      const o = data.owner;
      const box = el("div");
      box.appendChild(
        statGrid([
          [`views ${o.windowDays}d`, compact(o.views)],
          ["watch time", `${compact(o.minutesWatched)}m`],
          ["avg viewed", `${o.averageViewPercentage}%`],
          ["subs gained", compact(o.subscribersGained)],
        ])
      );
      if (o.traffic.length) {
        const list = el("div", "bmt-bars");
        o.traffic.slice(0, 6).forEach((t) => {
          const row = el("div", "bmt-bar-row");
          row.appendChild(el("span", "bmt-bar-l", t.source));
          const track = el("span", "bmt-bar-track");
          const fill = el("span", "bmt-bar-fill");
          fill.style.width = `${Math.max(2, t.share)}%`;
          track.appendChild(fill);
          row.appendChild(track);
          row.appendChild(el("span", "bmt-bar-v", `${t.share}%`));
          list.appendChild(row);
        });
        const sub = el("div", "bmt-sub");
        sub.appendChild(el("span", null, "Where views really came from"));
        box.appendChild(sub);
        box.appendChild(list);
      }
      if (o.searchTerms.length) {
        const chips = el("div", "bmt-chips");
        o.searchTerms.forEach((s) => {
          const c = el("span", "bmt-chip bmt-chip-ok");
          c.appendChild(el("span", null, s.term));
          c.appendChild(el("span", "bmt-rank", compact(s.views)));
          c.appendChild(copyBtn(s.term, "⧉"));
          chips.appendChild(c);
        });
        const sub = el("div", "bmt-sub");
        sub.appendChild(el("span", null, "Real search terms bringing views"));
        sub.appendChild(copyBtn(o.searchTerms.map((s) => s.term).join(", "), "Copy all"));
        box.appendChild(sub);
        box.appendChild(chips);
      }
      box.appendChild(
        el("div", "bmt-note", "Official YouTube Analytics for your own channel — not an estimate.")
      );
      overview.appendChild(section("Your channel — official numbers", box));
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
    tags.appendChild(
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
      tags.appendChild(
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
      tags.appendChild(section("Hashtags", chips, data.hashtagIdeas.join(" ")));
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
      // Channel keywords belong with the other tag lists, not under the stats.
      if (c.keywords.length) {
        const chips = el("div", "bmt-chips");
        c.keywords.slice(0, 24).forEach((k) => {
          const chip = el("span", "bmt-chip");
          chip.appendChild(el("span", null, k));
          chip.appendChild(copyBtn(k, "⧉"));
          chips.appendChild(chip);
        });
        tags.appendChild(
          section(`Channel tags (${c.keywords.length})`, chips, c.keywords.join(", "))
        );
      } else {
        tags.appendChild(
          section(
            "Channel tags",
            el("div", "bmt-note", "This channel has not set any public channel keywords.")
          )
        );
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
      overview.appendChild(section(`Channel — ${c.title}`, box));
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
      if (resp.needsAuth) {
        const link = el("span", "bmt-s-item", "Sign in to Bainsla Tags");
        link.style.cursor = "pointer";
        link.addEventListener("click", () =>
          chrome.runtime.sendMessage({ type: "openConnect" })
        );
        strip.appendChild(link);
        renderSignIn();
        return;
      }
      const warn = el("span", "bmt-s-item bmt-est", resp.error.slice(0, 40));
      strip.appendChild(warn);
      return;
    }
    latest = resp.data;
    renderStrip(latest);
    showPanel(latest);
  }

  /**
   * vidIQ-style: the report is open by default on every video the user opens,
   * until they close it for that video.
   */
  function showPanel(data) {
    renderPanel(data);
    if (currentId !== dismissedId) {
      document.getElementById("bmt-pulse-panel")?.classList.add("open");
    }
  }

  function start() {
    const id = videoIdFromUrl();
    if (!id || id === currentId) return;
    currentId = id;
    dismissedId = "";
    storyOpen = false;
    viralError = "";
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
    if (!videoIdFromUrl() || !latest) return;
    if (!document.getElementById("bmt-strip")) renderStrip(latest);
    // YouTube rebuilds its right column on navigation; move the report back in.
    const panel = document.getElementById("bmt-pulse-panel");
    if (!panel || !panel.isConnected) showPanel(latest);
    else buildPanel();
  }, 3000);

  setTimeout(start, 1200);
})();
