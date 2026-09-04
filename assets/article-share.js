(() => {
  const bars = Array.from(document.querySelectorAll("[data-article-share-bar]"));
  if (!bars.length) return;

  const fontScaleKey = "tripview.articleFontScale";
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const isSmallScreen = () => window.matchMedia("(max-width: 820px)").matches;

  function currentScale() {
    try {
      const stored = Number(window.localStorage?.getItem(fontScaleKey) || 0);
      return Number.isFinite(stored) ? clamp(stored, -1, 3) : 0;
    } catch {
      return 0;
    }
  }

  function storeScale(value) {
    try {
      window.localStorage?.setItem(fontScaleKey, String(value));
    } catch {
      // Font size still changes for this page-view when storage is unavailable.
    }
  }

  function applyFontScale(scale) {
    const content = document.querySelector("article.content");
    if (!content) return;
    const baseSize = isSmallScreen() ? 17 : 19;
    content.style.fontSize = `${baseSize + scale}px`;
  }

  function setStatus(bar, message) {
    const status = bar?.querySelector("[data-share-status]");
    if (status) status.textContent = message;
  }

  function fallbackCopy(text) {
    const input = document.createElement("textarea");
    input.value = text;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.left = "-9999px";
    document.body.append(input);
    input.select();
    try {
      return document.execCommand("copy");
    } finally {
      input.remove();
    }
  }

  let scale = currentScale();
  applyFontScale(scale);

  window.matchMedia("(max-width: 820px)").addEventListener?.("change", () => {
    applyFontScale(scale);
  });

  document.addEventListener("click", async (event) => {
    const copyButton = event.target.closest("[data-share-copy]");
    if (copyButton) {
      const bar = copyButton.closest("[data-article-share-bar]");
      const url = bar?.dataset.shareUrl || window.location.href;
      try {
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
        else if (!fallbackCopy(url)) throw new Error("copy failed");
        copyButton.classList.add("is-copied");
        setStatus(bar, "링크를 복사했습니다.");
        window.setTimeout(() => copyButton.classList.remove("is-copied"), 1400);
      } catch {
        setStatus(bar, "주소창의 링크를 복사해 주세요.");
      }
      return;
    }

    const fontButton = event.target.closest("[data-font-delta]");
    if (!fontButton) return;
    const delta = Number(fontButton.dataset.fontDelta || 0);
    scale = clamp(scale + delta, -1, 3);
    storeScale(scale);
    applyFontScale(scale);
    setStatus(fontButton.closest("[data-article-share-bar]"), "글자 크기를 조정했습니다.");
  });
})();
