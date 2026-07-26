const API_BASE = "https://apis.data.go.kr/1192000/service/OceansBeachInfoService1/getOceansBeachInfo1";
const REQUEST_TIMEOUT_MS = 8000;
const CACHE_SECONDS = 600;

// The slug is the article-to-beach contract. The API result is accepted only
// when its staNm matches one of the aliases for that article.
const BEACHES = new Map([
  ["travel-126078", { name: "\uAD11\uC548\uB9AC", sido: "\uBD80\uC0B0", aliases: ["\uAD11\uC548\uB9AC"] }],
  ["travel-126302", { name: "\uC1A1\uD638\uB545\uB05D", sido: "\uC804\uB0A8", aliases: ["\uC1A1\uD638\uB545\uB05D", "\uB545\uB05D\uC1A1\uD638"] }],
  ["travel-128199", { name: "\uAC15\uB3D9\uBAA8\uB3CC\uD574\uBCC0", sido: "\uC6B8\uC0B0", aliases: ["\uAC15\uB3D9\uBAA8\uB3CC", "\uC815\uC790"] }],
  ["travel-125711", { name: "\uC7A5\uD638", sido: "\uAC15\uC6D0", aliases: ["\uC7A5\uD638"] }],
  ["travel-125713", { name: "\uB9DD\uC0C1", sido: "\uAC15\uC6D0", aliases: ["\uB9DD\uC0C1"] }],
  ["travel-3000205", { name: "\uC6B0\uB450", sido: "\uC804\uB0A8", aliases: ["\uC6B0\uB450"] }],
  ["travel-127722", { name: "\uC548\uBAA9", sido: "\uAC15\uC6D0", aliases: ["\uC548\uBAA9"] }],
  ["travel-127764", { name: "\uB3C8\uBAA9", sido: "\uC804\uB0A8", aliases: ["\uB3C8\uBAA9"] }],
  ["travel-126098", { name: "\uC77C\uAD11", sido: "\uBD80\uC0B0", aliases: ["\uC77C\uAD11"] }],
  ["travel-128767", { name: "\uC744\uC655\uB9AC", sido: "\uC778\uCC9C", aliases: ["\uC744\uC655\uB9AC"] }],
  ["travel-129255", { name: "\uC120\uB140\uBC14\uC704", sido: "\uC778\uCC9C", aliases: ["\uC120\uB140\uBC14\uC704"] }],
  ["travel-129256", { name: "\uC655\uC0B0", sido: "\uC778\uCC9C", aliases: ["\uC655\uC0B0"] }],
  ["travel-127698", { name: "\uC601\uC77C\uB300", sido: "\uACBD\uBD81", aliases: ["\uC601\uC77C\uB300"] }],
  ["travel-129400", { name: "\uAE40\uB155", sido: "\uC81C\uC8FC", aliases: ["\uAE40\uB155"] }],
  ["travel-3041720", { name: "\uCCAD\uD638", sido: "\uAC15\uC6D0", aliases: ["\uCCAD\uD638"] }],
]);

function json(data, status = 200, cacheSeconds = 0) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cacheSeconds > 0
        ? `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}`
        : "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function text(value, fallback = "") {
  const result = String(value ?? fallback).trim();
  return result || fallback;
}

function apiKeyText(value) {
  const key = text(value);
  if (!key.includes("%")) return key;
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
}

function responseItems(payload) {
  const items = payload?.response?.body?.items?.item
    || payload?.body?.items?.item
    || payload?.data?.items?.item
    || payload?.items?.item
    || payload?.response?.body?.items
    || payload?.body?.items
    || payload?.data?.items
    || payload?.items
    || [];
  return Array.isArray(items) ? items : items ? [items] : [];
}

function responseHeader(payload) {
  return payload?.response?.header || payload?.header || payload?.result || {};
}

function responseBody(payload) {
  return payload?.response?.body || payload?.body || payload?.data || payload || {};
}

function isSuccessful(payload) {
  const code = text(responseHeader(payload)?.resultCode, "00");
  return ["00", "0", "200", "NORMAL_SERVICE"].includes(code);
}

function normalizeName(value) {
  return text(value)
    .replace(/\s+/g, "")
    .replace(/[()\u00B7\-]/g, "")
    .replace(/\uD574\uC218\uC695\uC7A5|\uD574\uBCC0/g, "")
    .toLowerCase();
}

function sidoCandidates(sido) {
  return {
    "\uAC15\uC6D0": ["\uAC15\uC6D0", "\uAC15\uC6D0\uB3C4", "\uAC15\uC6D0\uD2B9\uBCC4\uC790\uCE58\uB3C4"],
    "\uACBD\uBD81": ["\uACBD\uBD81", "\uACBD\uC0C1\uBD81\uB3C4"],
    "\uC804\uB0A8": ["\uC804\uB0A8", "\uC804\uB77C\uB0A8\uB3C4"],
    "\uBD80\uC0B0": ["\uBD80\uC0B0", "\uBD80\uC0B0\uAD11\uC5ED\uC2DC"],
    "\uC778\uCC9C": ["\uC778\uCC9C", "\uC778\uCC9C\uAD11\uC5ED\uC2DC"],
    "\uC6B8\uC0B0": ["\uC6B8\uC0B0", "\uC6B8\uC0B0\uAD11\uC5ED\uC2DC"],
    "\uC81C\uC8FC": ["\uC81C\uC8FC", "\uC81C\uC8FC\uD2B9\uBCC4\uC790\uCE58\uB3C4"],
  }[sido] || [sido];
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers: { accept: "application/json" }, signal: controller.signal });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload) throw new Error("Beach information API returned an unsuccessful response.");
    return payload;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("Beach information API request timed out.");
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function safeHttpUrl(value) {
  const url = text(value);
  return /^https?:\/\//i.test(url) ? url : "";
}

function numberOrNull(value) {
  const number = Number.parseFloat(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

function normalizeBeachInfo(item) {
  return {
    province: text(item?.sidoNm),
    county: text(item?.gugunNm),
    name: text(item?.staNm),
    width: numberOrNull(item?.beachWid),
    length: numberOrNull(item?.beachLen),
    feature: text(item?.beachKnd),
    link: safeHttpUrl(item?.linkAddr),
    linkName: text(item?.linkNm),
    image: safeHttpUrl(item?.beachImg),
    emergencyPhone: text(item?.linkTel),
    latitude: numberOrNull(item?.lat),
    longitude: numberOrNull(item?.lon),
  };
}

async function fetchBeachInfo(apiKey, beach) {
  const targetNames = new Set((beach.aliases || [beach.name]).map(normalizeName));
  let successfulResponse = false;
  let lastError;
  for (const sido of sidoCandidates(beach.sido)) {
    const url = new URL(API_BASE);
    Object.entries({
      ServiceKey: apiKey,
      pageNo: "1",
      numOfRows: "1000",
      SIDO_NM: sido,
      resultType: "JSON",
    }).forEach(([key, value]) => url.searchParams.set(key, value));
    try {
      const payload = await fetchJson(url);
      if (!isSuccessful(payload)) continue;
      successfulResponse = true;
      const firstBody = responseBody(payload);
      const firstItems = responseItems(payload);
      const pageSize = Math.max(1, Number.parseInt(firstBody.numOfRows, 10) || firstItems.length || 10);
      const totalCount = Math.max(firstItems.length, Number.parseInt(firstBody.totalCount, 10) || firstItems.length);
      const maxPage = Math.min(100, Math.ceil(totalCount / pageSize));
      const pages = [firstItems];
      for (let pageNo = 2; pageNo <= maxPage; pageNo += 1) {
        url.searchParams.set("pageNo", String(pageNo));
        const nextPayload = await fetchJson(url);
        if (!isSuccessful(nextPayload)) continue;
        pages.push(responseItems(nextPayload));
      }
      const item = pages.flat().find((candidate) => targetNames.has(
        normalizeName(candidate?.staNm || candidate?.beachNm || candidate?.name),
      ));
      if (item) return normalizeBeachInfo(item);
    } catch (error) {
      lastError = error;
    }
  }
  if (!successfulResponse && lastError) throw lastError;
  return null;
}

async function loadBeachInfo(apiKey, slug, beach) {
  const info = await fetchBeachInfo(apiKey, beach);
  if (!info) {
    return {
      ok: false,
      available: false,
      beach: { name: beach.name, slug },
      message: "\uD574\uC218\uC695\uC7A5 \uAE30\uBCF8\uC815\uBCF4 API\uC5D0\uC11C \uC77C\uCE58\uD558\uB294 \uD574\uBCC0\uC744 \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
    };
  }
  return {
    ok: true,
    beach: { name: beach.name, slug },
    updatedAt: new Date().toISOString(),
    info,
    sourceUrl: "https://www.data.go.kr/data/15058519/openapi.do",
  };
}

function resolveBeach(url) {
  const slug = text(url.searchParams.get("beach"));
  return slug && BEACHES.has(slug) ? { slug, beach: BEACHES.get(slug) } : null;
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const resolved = resolveBeach(url);
  if (!resolved) return json({ ok: false, available: false, message: "\uB9E4\uD551\uB41C \uD574\uC218\uC695\uC7A5 \uC815\uBCF4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);

  const apiKey = apiKeyText(
    context.env?.BEACH_INFO_API_KEY
      || context.env?.KMA_BEACH_API_KEY
      || context.env?.TRIPVIEW_API_KEY,
  );
  if (!apiKey) return json({ ok: false, configured: false, message: "\uD574\uC218\uC695\uC7A5 \uC815\uBCF4 API \uC778\uC99D\uD0A4\uAC00 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." }, 503);

  const cacheKey = new Request(`${url.origin}${url.pathname}?beach=${encodeURIComponent(resolved.slug)}`);
  const cache = globalThis.caches?.default;
  if (cache) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }
  try {
    const payload = await loadBeachInfo(apiKey, resolved.slug, resolved.beach);
    const status = payload.ok ? 200 : 404;
    const response = json(payload, status, payload.ok ? CACHE_SECONDS : 0);
    if (cache && payload.ok && typeof context.waitUntil === "function") context.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch {
    return json({ ok: false, message: "\uD574\uC218\uC695\uC7A5 \uAE30\uBCF8\uC815\uBCF4\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uD655\uC778\uD574\uC8FC\uC138\uC694." }, 502);
  }
}
