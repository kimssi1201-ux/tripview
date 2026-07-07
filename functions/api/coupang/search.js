const API_HOST = "https://api-gateway.coupang.com";
const SEARCH_PATH = "/v2/providers/affiliate_open_api/apis/openapi/products/search";
const REQUEST_TIMEOUT_MS = 8000;
const STATIC_DATA_PATH = "/data/coupang-products.json";
const DISCLOSURE = "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.";

const INTENT_KEYWORDS = {
  travel: "여행 준비물",
  water: "방수팩",
  indoor: "접이식 우산",
  festival: "보조배터리",
  family: "아이 여행 준비물",
  booking: "여행용 파우치",
  summer: "선크림",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": status === 200 && data?.ok ? "public, max-age=1800" : "no-store",
    },
  });
}

function text(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function clampInt(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function cleanKeyword(value) {
  return text(value)
    .replace(/[<>"']/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 60)
    .trim();
}

function looksGarbledKeyword(value) {
  return /[�\u0400-\u04ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text(value));
}

function getCredentials(env = {}) {
  return {
    accessKey: text(env.COUPANG_ACCESS_KEY || env.COUPANG_PARTNERS_ACCESS_KEY || env.COUPANG_PARTNER_ACCESS_KEY),
    secretKey: text(env.COUPANG_SECRET_KEY || env.COUPANG_PARTNERS_SECRET_KEY || env.COUPANG_PARTNER_SECRET_KEY),
    subId: text(env.COUPANG_SUB_ID || env.COUPANG_CHANNEL_ID || env.COUPANG_PARTNER_ID).replace(/[^A-Za-z0-9_-]/g, ""),
  };
}

function signedDate() {
  const date = new Date();
  const iso = date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return iso.slice(2);
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(secret, message) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

async function authorizationHeader({ accessKey, secretKey }, method, uri) {
  const datetime = signedDate();
  const signature = await hmacSha256(secretKey, datetime + method + uri);
  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
}

function pickKeyword(url) {
  const explicit = cleanKeyword(url.searchParams.get("keyword"));
  const intent = text(url.searchParams.get("intent"), "travel");
  if (intent && INTENT_KEYWORDS[intent] && (!explicit || looksGarbledKeyword(explicit))) {
    return INTENT_KEYWORDS[intent];
  }
  if (explicit) return explicit;
  return INTENT_KEYWORDS[intent] || INTENT_KEYWORDS.travel;
}

function safeProductUrl(value) {
  const url = text(value);
  if (!/^https:\/\/(link\.coupang\.com|www\.coupang\.com)\//.test(url)) return "";
  return url;
}

function safeImageUrl(value) {
  const url = text(value);
  return /^https?:\/\//.test(url) ? url : "";
}

function normalizeProduct(item) {
  const title = text(item?.productName);
  const url = safeProductUrl(item?.productUrl);
  if (!title || !/^https?:\/\//.test(url)) return null;

  const price = Number(item?.productPrice || 0);
  const priceText = price > 0 ? `${price.toLocaleString("ko-KR")}원` : "";
  return {
    type: "coupang",
    title,
    url,
    image: safeImageUrl(item?.productImage),
    price,
    meta: [priceText, text(item?.categoryName)].filter(Boolean).join(" · "),
  };
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

async function readStaticProducts(context) {
  const url = new URL(context.request.url);
  url.pathname = STATIC_DATA_PATH;
  url.search = "";
  const request = new Request(url.toString(), context.request);
  const response = context.env?.ASSETS
    ? await context.env.ASSETS.fetch(request)
    : await fetch(request);
  if (!response.ok) return [];
  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? rows.map(normalizeStoredProduct).filter(Boolean) : [];
}

async function staticSearch(context, keyword, intent, limit, message = "") {
  const rows = await readStaticProducts(context);
  const matched = rows
    .filter((item) => staticMatch(item, keyword, intent))
    .slice(0, limit);
  const fallback = matched.length ? matched : rows.slice(0, limit);
  return json({
    ok: Boolean(fallback.length),
    fallback: true,
    keyword,
    items: fallback,
    disclosure: DISCLOSURE,
    message: message || (fallback.length ? "저장된 쿠팡 추천 상품을 보여드립니다." : "Coupang API key is not configured."),
  });
}

async function fetchCoupangProducts({ credentials, keyword, limit }) {
  const endpoint = new URL(`${API_HOST}${SEARCH_PATH}`);
  endpoint.searchParams.set("keyword", keyword);
  endpoint.searchParams.set("limit", String(limit));
  if (credentials.subId) endpoint.searchParams.set("subId", credentials.subId);

  const query = endpoint.searchParams.toString();
  const uri = `${endpoint.pathname}${query}`;
  const method = "GET";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint.toString(), {
      method,
      headers: {
        authorization: await authorizationHeader(credentials, method, uri),
        accept: "application/json",
      },
      signal: controller.signal,
    });
    const payload = await response.json().catch(async () => ({ message: await response.text() }));
    if (!response.ok || String(payload?.rCode ?? "0") !== "0") {
      throw new Error(text(payload?.rMessage || payload?.message || `request failed ${response.status}`));
    }
    return Array.isArray(payload?.data?.productData) ? payload.data.productData : [];
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const keyword = pickKeyword(url);
  const intent = text(url.searchParams.get("intent"));
  const limit = clampInt(url.searchParams.get("limit"), 1, 10, 6);
  const credentials = getCredentials(context.env);

  if (!credentials.accessKey || !credentials.secretKey) {
    return staticSearch(context, keyword, intent, limit);
  }

  const cacheKey = new Request(`${url.origin}${url.pathname}?keyword=${encodeURIComponent(keyword)}&limit=${limit}`);
  const cache = typeof caches !== "undefined" ? caches.default : null;
  const cached = cache ? await cache.match(cacheKey) : null;
  if (cached) return cached;

  try {
    const products = await fetchCoupangProducts({ credentials, keyword, limit });
    const items = products.map(normalizeProduct).filter(Boolean).slice(0, limit);
    if (!items.length) {
      return staticSearch(context, keyword, intent, limit, "Coupang API returned no products. 저장된 추천 상품을 보여드립니다.");
    }
    const response = json({
      ok: true,
      keyword,
      items,
      disclosure: DISCLOSURE,
    });
    if (cache && items.length) context.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (error) {
    return staticSearch(
      context,
      keyword,
      intent,
      limit,
      error?.name === "AbortError" ? "Coupang API request timed out. 저장된 추천 상품을 보여드립니다." : "Coupang API request failed. 저장된 추천 상품을 보여드립니다."
    );
  }
}
