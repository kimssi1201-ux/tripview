(() => {
  if (window.tripviewCoupangReady) return;
  window.tripviewCoupangReady = true;

  const STATIC_DATA_PATH = "/data/coupang-products.json";
  const DISCLOSURE = "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.";
  const slots = () => [...document.querySelectorAll("[data-coupang-products]")];

  function text(value) {
    return String(value ?? "").trim();
  }

  function safeProductUrl(value) {
    const url = text(value);
    return /^https:\/\/(link\.coupang\.com|www\.coupang\.com)\//.test(url) ? url : "";
  }

  function safeImageUrl(value) {
    const url = text(value);
    return /^https?:\/\//.test(url) ? url : "";
  }

  function normalizeStoredProduct(item) {
    const title = text(item?.title || item?.productName).slice(0, 140);
    const url = safeProductUrl(item?.url || item?.productUrl);
    if (!title || !url) return null;

    return {
      ...item,
      type: "coupang",
      title,
      url,
      image: safeImageUrl(item?.image || item?.productImage),
      price: Number(item?.price || item?.productPrice || 0),
      meta: text(item?.meta),
    };
  }

  function staticMatch(item, keyword, intent) {
    if (!item?.title || !item?.url) return false;
    if (intent && item.intent === intent) return true;
    const haystack = [item.title, item.keyword, item.intent, item.meta].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(keyword.toLowerCase());
  }

  function clampLimit(value) {
    const limit = Number.parseInt(value, 10);
    return Number.isFinite(limit) ? Math.min(10, Math.max(1, limit)) : 6;
  }

  async function staticPayload(keyword, intent, limit) {
    const response = await fetch(STATIC_DATA_PATH, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) return { ok: false, items: [] };

    const rows = await response.json().catch(() => []);
    const products = Array.isArray(rows) ? rows.map(normalizeStoredProduct).filter(Boolean) : [];
    const matched = products.filter((item) => staticMatch(item, keyword, intent));
    const items = (matched.length ? matched : products).slice(0, limit);
    return {
      ok: Boolean(items.length),
      fallback: true,
      items,
      disclosure: DISCLOSURE,
    };
  }

  async function apiPayload(params) {
    const response = await fetch(`/api/coupang/search?${params.toString()}`, {
      headers: { accept: "application/json" },
    });
    const payload = await response.json();
    return response.ok ? payload : { ...payload, ok: false };
  }

  function card(item) {
    const link = document.createElement("a");
    link.className = `check-card product-card coupang-card${item.image ? "" : " no-thumb"}`;
    link.href = item.url;
    link.target = "_blank";
    link.rel = "sponsored noopener";

    if (item.image) {
      const thumb = document.createElement("span");
      thumb.className = "booking-thumb";
      thumb.dataset.fallback = "상품 이미지";
      const image = document.createElement("img");
      image.src = item.image;
      image.alt = item.title || "쿠팡 추천 상품";
      image.loading = "lazy";
      image.decoding = "async";
      image.referrerPolicy = "strict-origin-when-cross-origin";
      image.addEventListener("load", () => thumb.classList.remove("is-image-failed"), { once: true });
      image.addEventListener("error", () => {
        image.remove();
        thumb.classList.add("is-image-failed");
      }, { once: true });
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

    let payload;
    try {
      payload = await apiPayload(params);
    } catch {
      payload = await staticPayload(keyword, intent, clampLimit(limit)).catch(() => ({ ok: false, items: [] }));
    }

    if (!payload?.ok || !Array.isArray(payload.items) || !payload.items.length) {
      payload = await staticPayload(keyword, intent, clampLimit(limit)).catch(() => ({ ok: false, items: [] }));
    }

    const items = Array.isArray(payload.items)
      ? payload.items.filter((item) => item?.title && /^https?:\/\//.test(item?.url || ""))
      : [];
    if (!payload.ok || !items.length) {
      hideSection(slot);
      return;
    }

    slot.innerHTML = "";
    items.forEach((item) => slot.appendChild(card(item)));
    const disclosure = slot.closest(".coupang-ad-section, .coupang-native-ad")?.querySelector("[data-coupang-disclosure]");
    if (disclosure && payload.disclosure) disclosure.textContent = payload.disclosure;
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
