(() => {
  if (window.tripviewCoupangReady) return;
  window.tripviewCoupangReady = true;

  const slots = () => [...document.querySelectorAll("[data-coupang-products]")];

  function card(item) {
    const link = document.createElement("a");
    link.className = `check-card product-card coupang-card${item.image ? "" : " no-thumb"}`;
    link.href = item.url;
    link.target = "_blank";
    link.rel = "sponsored noopener";

    if (item.image) {
      const thumb = document.createElement("span");
      thumb.className = "booking-thumb";
      const image = document.createElement("img");
      image.src = item.image;
      image.alt = item.title || "쿠팡 추천 상품";
      image.loading = "lazy";
      image.referrerPolicy = "no-referrer";
      image.addEventListener("error", () => thumb.remove(), { once: true });
      thumb.appendChild(image);
      link.appendChild(thumb);
    }

    const title = document.createElement("strong");
    title.textContent = item.title || "쿠팡 추천 상품";
    const meta = document.createElement("span");
    meta.textContent = item.meta || "쿠팡 파트너스 추천";
    link.appendChild(title);
    link.appendChild(meta);
    return link;
  }

  function hideSection(slot) {
    const section = slot.closest(".coupang-ad-section, .coupang-native-ad");
    if (section) section.hidden = true;
  }

  async function loadSlot(slot) {
    const params = new URLSearchParams();
    const keyword = slot.dataset.coupangKeyword || "";
    const intent = slot.dataset.coupangIntent || "";
    const limit = slot.dataset.coupangLimit || "6";
    if (keyword) params.set("keyword", keyword);
    if (intent) params.set("intent", intent);
    params.set("limit", limit);

    try {
      const response = await fetch(`/api/coupang/search?${params.toString()}`, {
        headers: { accept: "application/json" },
      });
      const payload = await response.json();
      const items = Array.isArray(payload.items)
        ? payload.items.filter((item) => item?.title && /^https?:\/\//.test(item?.url || ""))
        : [];
      if (!response.ok || !payload.ok || !items.length) {
        hideSection(slot);
        return;
      }

      slot.innerHTML = "";
      items.forEach((item) => slot.appendChild(card(item)));
      const disclosure = slot.closest(".coupang-ad-section, .coupang-native-ad")?.querySelector("[data-coupang-disclosure]");
      if (disclosure && payload.disclosure) disclosure.textContent = payload.disclosure;
    } catch {
      hideSection(slot);
    }
  }

  function init() {
    slots().forEach(loadSlot);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
