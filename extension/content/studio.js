// YouTube Studio: detect the video title being edited and offer suggestions.
(function () {
  function detectTitle() {
    const sels = [
      "ytcp-social-suggestions-textbox#title-textarea #textbox",
      "#title-textarea #textbox",
      "textarea#textbox",
      'div#textbox[aria-label*="title" i]',
    ];
    for (const s of sels) {
      const el = document.querySelector(s);
      const text = el && (el.value || el.textContent || "").trim();
      if (text) return text;
    }
    return "";
  }

  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (typeof window.bmtBuildPanel === "function") {
      window.bmtBuildPanel(detectTitle());
      clearInterval(timer);
    }
    if (tries > 20) clearInterval(timer);
  }, 800);
})();
