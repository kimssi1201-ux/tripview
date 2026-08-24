const API_BASE = "https://partner-ext-api.myrealtrip.com";
const PUBLIC_FLIGHT_URL = "https://flights.myrealtrip.com/";
const MYREALTRIP_TIMEOUT_MS = 8000;

const STATIC_DATA = {
  accommodation: "/data/myrealtrip-accommodations.json",
  tna: "/data/myrealtrip-tna-products.json",
  flight: "/data/myrealtrip-flight-deals.json",
};

const AIRPORT_ALIASES = {
  ICN: "인천",
  GMP: "김포",
  CJU: "제주",
  PUS: "부산",
  CJJ: "청주",
};

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
  return env.MYREALTRIP_API_KEY
    || env.MYREALTRIP_PARTNER_API_KEY
    || env.MYREALTRIP_PARTNER_KEY
    || env.MYREALTRIP_OPEN_API_KEY
    || env.MYREALTRIP_API
    || env.MRT_API_KEY
    || env.PARTNER_API_KEY
    || env.PARTNER_EXT_API_KEY
    || "";
}

function hasApiKey(env = {}) {
  return Boolean(getApiKey(env).trim());
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

function todayInKorea(reference = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(reference);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
}

function defaultStayWindow(reference = new Date()) {
  const today = todayInKorea(reference);
  const day = today.getUTCDay();
  let daysUntilFriday = (5 - day + 7) % 7;
  if (daysUntilFriday === 0) daysUntilFriday = 7;
  const checkInDate = addDays(today, daysUntilFriday);
  return {
    checkIn: isoDate(checkInDate),
    checkOut: isoDate(addDays(checkInDate, 2)),
    adultCount: 2,
    childCount: 0,
  };
}

function parseIsoDate(value) {
  const dateText = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return null;
  const date = new Date(`${dateText}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
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

function productImage(item = {}) {
  const candidates = [
    item.image,
    item.imageUrl,
    item.thumbnail,
    item.thumbnailUrl,
    item.mainImage,
    item.mainImageUrl,
    item.coverImage,
    item.coverImageUrl,
    ...(Array.isArray(item.images) ? item.images : []),
    ...(Array.isArray(item.imageUrls) ? item.imageUrls : []),
  ];
  for (const value of candidates) {
    const candidate = typeof value === "string"
      ? value
      : value?.url || value?.src || value?.imageUrl || value?.thumbnailUrl || "";
    try {
      const url = new URL(text(candidate));
      if (url.protocol === "https:") return url.toString();
    } catch {
      // Ignore malformed or non-URL image fields from the partner response.
    }
  }
  return "";
}

function accommodationImage(item = {}) {
  for (const key of ["thumbnailUrl", "imageUrl", "mainImage", "mainImageUrl", "coverImage", "coverImageUrl", "image", "thumbnail"]) {
    const value = item?.[key];
    if (typeof value !== "string") continue;
    try {
      const url = new URL(text(value));
      if (url.protocol === "https:") return url.toString();
    } catch {
      // The accommodation API exposes scalar image fields; ignore malformed values.
    }
  }
  return "";
}

function accommodationStarRating(keyword = "", explicitFamily = false) {
  const familyContext = explicitFamily || /아이|가족|어린이|키즈|체험|테마파크|아쿠아리움/.test(text(keyword));
  return familyContext ? "fourstar,fivestar" : "threestar,fourstar,fivestar";
}

function includesKeyword(item, keyword) {
  const needle = text(keyword).toLowerCase();
  if (!needle) return true;
  const haystack = [
    item?.title,
    item?.region,
    item?.city,
    item?.category,
    item?.description,
    Array.isArray(item?.tags) ? item.tags.join(" ") : "",
  ].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(needle);
}

function staticMeta(item) {
  return [item?.region || item?.city, item?.category || item?.type, item?.priceText || item?.price]
    .filter(Boolean)
    .join(" · ");
}

function flightSlug(deal) {
  return String(deal?.id || deal?.title || "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "") || "flight-deal";
}

function flightDealPath(deal) {
  return `/flight-deals/${flightSlug(deal)}/`;
}

function normalizeStaticProduct(item, type) {
  const title = text(item?.title);
  if (!title) return null;
  const isFlight = type === "flight" || item?.source === "myrealtrip-flight";
  const bookingUrl = text(item?.bookingUrl) || PUBLIC_FLIGHT_URL;
  return {
    type: isFlight ? "flight" : (type === "tna" ? "tna" : "accommodation"),
    title,
    url: isFlight ? bookingUrl : text(item?.url),
    detailUrl: isFlight ? flightDealPath(item) : "",
    bookingUrl: isFlight ? bookingUrl : "",
    image: productImage(item),
    price: Number(item?.price || 0),
    meta: isFlight
      ? [item?.priceText, item?.departureDate ? `출발 ${item.departureDate}` : "", item?.returnDate ? `귀국 ${item.returnDate}` : ""].filter(Boolean).join(" · ")
      : staticMeta(item),
  };
}

async function readStaticData(context, type) {
  const pathname = STATIC_DATA[type];
  if (!pathname) return [];

  const url = new URL(context.request.url);
  url.pathname = pathname;
  url.search = "";

  const request = new Request(url.toString(), context.request);
  const response = context.env?.ASSETS
    ? await context.env.ASSETS.fetch(request)
    : await fetch(request);
  if (!response.ok) return [];

  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

async function staticSearch(context, type, options = {}) {
  const url = new URL(context.request.url);
  const rows = await readStaticData(context, type);
  const keyword = text(url.searchParams.get(type === "flight" ? "departure" : "keyword"));
  const departure = keyword.toUpperCase();
  const departureName = AIRPORT_ALIASES[departure] || keyword;
  const period = type === "flight" ? clampInt(url.searchParams.get("period"), 3, 7, 0) : 0;

  const matchedByKeyword = rows.filter((item) => {
    if (type === "flight") {
      if (!keyword) return true;
      return text(item?.fromCity).toUpperCase() === departure || includesKeyword(item, departureName);
    }
    return includesKeyword(item, keyword);
  });

  const periodMatched = type === "flight" && period
    ? matchedByKeyword.filter((item) => Number(item?.period) === period)
    : [];
  const matched = type === "flight" && period ? periodMatched : matchedByKeyword;
  const hasKeyword = Boolean(keyword);
  const source = matched.length ? matched : (hasKeyword || (type === "flight" && period) ? [] : rows);
  const items = source
    .map((item) => normalizeStaticProduct(item, type))
    .filter((item) => item?.title && item?.url)
    .sort((a, b) => Number(a.price || 0) - Number(b.price || 0))
    .slice(0, 8);
  const emptyMessage = type === "flight" && period
    ? `${period}일 일정 항공권 추천 데이터가 아직 없습니다. 다른 기간으로 검색해 보세요.`
    : (hasKeyword
      ? `${keyword} 관련 추천 데이터가 아직 없습니다. 다른 검색어로 다시 확인해 보세요.`
      : "저장된 상품 데이터가 없습니다.");

  return json({
    ok: true,
    fallback: true,
    items,
    message: items.length
      ? (options.message || "현재 확인된 추천 데이터를 보여드립니다.")
      : emptyMessage,
  });
}

async function postMyRealTrip(env, pathname, body) {
  const apiKey = getApiKey(env);
  if (!apiKey) throw new Error("API key is not configured.");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MYREALTRIP_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}${pathname}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const payload = await response.json().catch(async () => ({ message: await response.text() }));
    if (!response.ok) {
      const message = text(payload?.result?.message || payload?.message || `request failed ${response.status}`);
      throw new Error(message);
    }
    return payload;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("실시간 검색 응답이 지연되고 있습니다.");
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeAccommodation(item, regionName) {
  const title = text(item?.itemName);
  const url = productUrl(item?.productUrl);
  if (!title || !url) return null;

  return {
    type: "accommodation",
    title,
    url,
    image: accommodationImage(item),
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
    image: productImage(item),
    meta: [text(item?.category), price, review].filter(Boolean).join(" · "),
  };
}

function normalizeFlight(item) {
  const from = text(item?.fromCity);
  const to = text(item?.toCity);
  const price = formatWon(item?.totalPrice);
  if (!from || !to || !price) return null;
  const departureDate = text(item?.departureDate);
  const returnDate = text(item?.returnDate);

  return {
    type: "flight",
    title: `${from}-${to} 항공권 최저가 ${price}`,
    url: PUBLIC_FLIGHT_URL,
    bookingUrl: PUBLIC_FLIGHT_URL,
    image: "",
    price: Number(item?.totalPrice) || 0,
    meta: [price, departureDate ? `출발 ${departureDate}` : "", returnDate ? `귀국 ${returnDate}` : ""].filter(Boolean).join(" · "),
  };
}

async function searchAccommodation(request, env) {
  const url = new URL(request.url);
  const keyword = text(url.searchParams.get("keyword"), "서울").slice(0, 100);
  const defaultStay = defaultStayWindow();
  const checkInDate = parseIsoDate(url.searchParams.get("checkIn")) || parseIsoDate(defaultStay.checkIn);
  const checkIn = isoDate(checkInDate);
  const requestedCheckOut = parseIsoDate(url.searchParams.get("checkOut"));
  const checkOutDate = requestedCheckOut && requestedCheckOut > checkInDate
    ? requestedCheckOut
    : addDays(checkInDate, 2);
  const checkOut = isoDate(checkOutDate);
  const adultCount = clampInt(url.searchParams.get("adultCount"), 1, 9, 2);
  const childCount = clampInt(url.searchParams.get("childCount"), 0, 9, 0);
  const starRating = accommodationStarRating(keyword, url.searchParams.get("family") === "1" || url.searchParams.get("family") === "true");

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
    starRating,
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
    if (!["accommodation", "tna", "flight"].includes(type)) {
      return json({ ok: false, message: "지원하지 않는 검색 유형입니다." }, 400);
    }

    if (!hasApiKey(context.env)) {
      return await staticSearch(context, type, {
        message: "현재 확인된 추천 데이터를 보여드립니다.",
      });
    }

    if (type === "accommodation") return await searchAccommodation(context.request, context.env);
    if (type === "tna") return await searchTna(context.request, context.env);
    if (type === "flight") return await searchFlight(context.request, context.env);
  } catch (error) {
    const url = new URL(context.request.url);
    const type = text(url.searchParams.get("type"));
    if (["accommodation", "tna", "flight"].includes(type)) {
      console.warn("myrealtrip search fallback", { type, message: error?.message || "unknown error" });
      const fallback = await staticSearch(context, type, {
        message: "실시간 검색이 지연되어 현재 확인된 추천 데이터를 보여드립니다.",
      }).catch(() => null);
      if (fallback) return fallback;
    }
    return json({ ok: false, message: error.message || "검색 중 오류가 발생했습니다." }, 500);
  }
}
