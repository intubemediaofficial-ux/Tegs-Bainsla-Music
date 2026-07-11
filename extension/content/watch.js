// YouTube watch page: seed suggestions from the current video's title.
(function () {
  function detectTitle() {
    const meta = document.querySelector('meta[name="title"]');
    if (meta?.content) return meta.content;
    const h1 = document.querySelector("h1.ytd-watch-metadata, h1.title");
    return (h1?.textContent || "").trim();
  }

  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (typeof window.bmtBuildPanel === "function") {
      // Don't auto-run on watch pages — just seed the box.
      window.bmtBuildPanel("");
      const input = document.querySelector("#bmt-panel input");
      if (input) input.value = detectTitle().slice(0, 80);
      clearInterval(timer);
    }
    if (tries > 20) clearInterval(timer);
  }, 800);
})();
