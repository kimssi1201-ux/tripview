const API_HOST = "https://api-gateway.coupang.com";
const SEARCH_PATH = "/v2/providers/affiliate_open_api/apis/openapi/products/search";
const REQUEST_TIMEOUT_MS = 8000;

const INTENT_KEYWORDS = {
  travel: "여행 준비물",
  water: "방수팩",
  indoor: "접이식 우산",
  festival: "보조배터리",
  family: "아이 여행 준비물",
  booking: "여행용 파우치",
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
  if (explicit) return explicit;
  const intent = text(url.searchParams.get("intent"), "travel");
  return INTENT_KEYWORDS[intent] || INTENT_KEYWORDS.travel;
}

function normalizeProduct(item) {
  const title = text(item?.productName);
  const url = text(item?.productUrl);
  if (!title || !/^https?:\/\//.test(url)) return null;

  const price = Number(item?.productPrice || 0);
  const priceText = price > 0 ? `${price.toLocaleString("ko-KR")}원` : "";
  return {
    type: "coupang",
    title,
    url,
    image: text(item?.productImage),
    price,
    meta: [priceText, text(item?.categoryName)].filter(Boolean).join(" · "),
  };
}

async function fetchCoupangProducts({ credentials, keyword, limit }) {
  const endpoint = new URL(`${API_HOST}${SEARCH_PATH}`);
  endpoint.searchParams.set("keyword", keyword);
  endpoint.searchParams.set("limit", String(limit));
  if (credentials.subId) endpoint.searchParams.set("subId", credentials.subId);

  const uri = `${endpoint.pathname}?${endpoint.searchParams.toString()}`;
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
  const limit = clampInt(url.searchParams.get("limit"), 1, 10, 6);
  const credentials = getCredentials(context.env);

  if (!credentials.accessKey || !credentials.secretKey) {
    return json({ ok: false, items: [], message: "Coupang API key is not configured." });
  }

  const cacheKey = new Request(`${url.origin}${url.pathname}?keyword=${encodeURIComponent(keyword)}&limit=${limit}`);
  const cache = typeof caches !== "undefined" ? caches.default : null;
  const cached = cache ? await cache.match(cacheKey) : null;
  if (cached) return cached;

  try {
    const products = await fetchCoupangProducts({ credentials, keyword, limit });
    const items = products.map(normalizeProduct).filter(Boolean).slice(0, limit);
    const response = json({
      ok: true,
      keyword,
      items,
      disclosure: "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.",
    });
    if (cache && items.length) context.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (error) {
    return json({
      ok: false,
      keyword,
      items: [],
      message: error?.name === "AbortError" ? "Coupang API request timed out." : text(error?.message, "Coupang API request failed."),
    });
  }
}
