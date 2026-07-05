const API_BASE = "https://partner-ext-api.myrealtrip.com";
const PUBLIC_FLIGHT_URL = "https://www.myrealtrip.com/flights";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function getApiKey(env = {}) {
  return env.MYREALTRIP_API_KEY || env.PARTNER_API_KEY || env.MYREALTRIP_PARTNER_API_KEY || "";
}

function text(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function clampInt(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatWon(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "";
  return `${number.toLocaleString("ko-KR")}원`;
}

function productUrl(value) {
  const url = text(value);
  if (!/^https:\/\/(accommodation|experiences)\.myrealtrip\.com\//.test(url)) return "";
  return url;
}

async function postMyRealTrip(env, pathname, body) {
  const apiKey = getApiKey(env);
  if (!apiKey) throw new Error("API key is not configured.");

  const response = await fetch(`${API_BASE}${pathname}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(async () => ({ message: await response.text() }));
  if (!response.ok) {
    const message = text(payload?.result?.message || payload?.message || `request failed ${response.status}`);
    throw new Error(message);
  }
  return payload;
}

function normalizeAccommodation(item, regionName) {
  const title = text(item?.itemName);
  const url = productUrl(item?.productUrl);
  if (!title || !url) return null;

  return {
    type: "accommodation",
    title,
    url,
    image: text(item?.imageUrl),
    meta: [regionName, item?.starRating ? `${item.starRating}성` : "", formatWon(item?.salePrice)].filter(Boolean).join(" · "),
  };
}

function normalizeTna(item) {
  const title = text(item?.itemName);
  const url = productUrl(item?.productUrl);
  if (!title || !url) return null;

  const price = text(item?.priceDisplay) || formatWon(item?.salePrice);
  const review = item?.reviewScore ? `평점 ${item.reviewScore}` : "";
  return {
    type: "tna",
    title,
    url,
    image: text(item?.imageUrl),
    meta: [text(item?.category), price, review].filter(Boolean).join(" · "),
  };
}

function normalizeFlight(item) {
  const from = text(item?.fromCity);
  const to = text(item?.toCity);
  const price = formatWon(item?.totalPrice);
  if (!from || !to || !price) return null;

  return {
    type: "flight",
    title: `${from}-${to} 항공권 최저가`,
    url: PUBLIC_FLIGHT_URL,
    image: "",
    price: Number(item?.totalPrice) || 0,
    meta: [price, item?.departureDate ? `출발 ${item.departureDate}` : "", item?.returnDate ? `귀국 ${item.returnDate}` : ""].filter(Boolean).join(" · "),
  };
}

async function searchAccommodation(request, env) {
  const url = new URL(request.url);
  const keyword = text(url.searchParams.get("keyword"), "서울").slice(0, 100);
  const today = new Date();
  const checkIn = text(url.searchParams.get("checkIn"), isoDate(addDays(today, 14)));
  const checkOut = text(url.searchParams.get("checkOut"), isoDate(addDays(new Date(`${checkIn}T00:00:00Z`), 2)));
  const adultCount = clampInt(url.searchParams.get("adultCount"), 1, 9, 2);
  const childCount = clampInt(url.searchParams.get("childCount"), 0, 9, 0);

  const regionPayload = await postMyRealTrip(env, "/v1/products/accommodation/region-autocomplete", {
    keyword,
    isDomestic: true,
  });
  const regions = Array.isArray(regionPayload?.data?.regions) ? regionPayload.data.regions : [];
  const region = regions.find((item) => item?.type === "CITY") || regions[0];
  if (!region?.regionId) return json({ ok: true, items: [], message: "검색 가능한 지역을 찾지 못했습니다." });

  const payload = await postMyRealTrip(env, "/v1/products/accommodation/search", {
    regionId: region.regionId,
    checkIn,
    checkOut,
    adultCount,
    childCount,
    page: 0,
    size: 10,
  });
  const items = (Array.isArray(payload?.data?.items) ? payload.data.items : [])
    .map((item) => normalizeAccommodation(item, text(region.name, keyword)))
    .filter(Boolean)
    .slice(0, 8);

  return json({ ok: true, items });
}

async function searchTna(request, env) {
  const url = new URL(request.url);
  const keyword = text(url.searchParams.get("keyword"), "제주 투어").slice(0, 100);
  const sort = text(url.searchParams.get("sort"), "selling_count_desc");
  const allowedSorts = new Set(["price_asc", "price_desc", "review_score_desc", "selling_count_desc"]);
  const payload = await postMyRealTrip(env, "/v1/products/tna/search", {
    keyword,
    sort: allowedSorts.has(sort) ? sort : "selling_count_desc",
    page: 1,
    size: 10,
  });
  const items = (Array.isArray(payload?.data?.items) ? payload.data.items : [])
    .map(normalizeTna)
    .filter(Boolean)
    .slice(0, 8);

  return json({ ok: true, items });
}

async function airportCode(env, keyword) {
  const code = text(keyword).toUpperCase();
  if (/^[A-Z]{3}$/.test(code)) return code;
  const payload = await postMyRealTrip(env, "/v1/products/flight/airport-autocomplete", {
    keyword: text(keyword, "인천").slice(0, 100),
    size: 1,
  });
  const airports = Array.isArray(payload?.data?.airports) ? payload.data.airports : [];
  return text(airports[0]?.airport?.code).toUpperCase();
}

async function searchFlight(request, env) {
  const url = new URL(request.url);
  const depCityCd = await airportCode(env, url.searchParams.get("departure") || "ICN");
  const period = clampInt(url.searchParams.get("period"), 3, 7, 5);
  if (!depCityCd) return json({ ok: true, items: [], message: "출발 공항을 찾지 못했습니다." });

  const payload = await postMyRealTrip(env, "/v1/products/flight/calendar/bulk-lowest", {
    depCityCd,
    period,
  });
  const items = (Array.isArray(payload?.data) ? payload.data : [])
    .map(normalizeFlight)
    .filter(Boolean)
    .sort((a, b) => Number(a.price || 0) - Number(b.price || 0))
    .slice(0, 8);

  return json({ ok: true, items });
}

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const type = text(url.searchParams.get("type"));
    if (type === "accommodation") return await searchAccommodation(context.request, context.env);
    if (type === "tna") return await searchTna(context.request, context.env);
    if (type === "flight") return await searchFlight(context.request, context.env);
    return json({ ok: false, message: "지원하지 않는 검색 유형입니다." }, 400);
  } catch (error) {
    return json({ ok: false, message: error.message || "검색 중 오류가 발생했습니다." }, 500);
  }
}
