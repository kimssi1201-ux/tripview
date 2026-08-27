import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deriveAffiliateRegionKeywords, isDomesticRegion, normalizeRegion } from "./lib/affiliate-matching.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POSTS_PATH = path.join(ROOT, "data", "generated-posts.json");
const LEGACY_OUT_PATH = path.join(ROOT, "data", "myrealtrip-accommodations.json");
const REGION_MAP_PATH = path.join(ROOT, "data", "myrealtrip-accommodation-region-map.json");
const CACHE_PATH = path.join(ROOT, "data", "myrealtrip-accommodation-cache.json");

const API_KEY = process.env.MYREALTRIP_API_KEY
  || process.env.PARTNER_API_KEY
  || process.env.MYREALTRIP_PARTNER_API_KEY
  || process.env.MYREALTRIP_PARTNER_KEY
  || process.env.MYREALTRIP_OPEN_API_KEY
  || process.env.MRT_API_KEY
  || process.env.PARTNER_EXT_API_KEY
  || "";
const REGION_URL = process.env.MYREALTRIP_ACCOMMODATION_REGION_URL
  || "https://partner-ext-api.myrealtrip.com/v1/products/accommodation/region-autocomplete";
const SEARCH_URL = process.env.MYREALTRIP_ACCOMMODATION_SEARCH_URL
  || "https://partner-ext-api.myrealtrip.com/v1/products/accommodation/search";
const CONFIGURED_KEYWORDS = process.env.MYREALTRIP_ACCOMMODATION_KEYWORDS
  || process.env.MYREALTRIP_ACCOMMODATION_KEYWORD
  || "";
const IS_DOMESTIC = String(process.env.MYREALTRIP_ACCOMMODATION_IS_DOMESTIC || "true") !== "false";
const NIGHTS = 2;
const ADULT_COUNT = 2;
const CHILD_COUNT = 0;
const SIZE = Math.max(1, Math.min(50, Number.parseInt(process.env.MYREALTRIP_ACCOMMODATION_SIZE || "30", 10) || 30));
const REGION_LIMIT = Math.max(1, Math.min(120, Number.parseInt(process.env.MYREALTRIP_ACCOMMODATION_REGION_LIMIT || "100", 10) || 100));
const PER_REGION_LIMIT = Math.max(3, Math.min(8, Number.parseInt(process.env.MYREALTRIP_ACCOMMODATION_PER_REGION_LIMIT || "8", 10) || 8));
const LIMIT = Math.max(12, Math.min(240, Number.parseInt(process.env.MYREALTRIP_ACCOMMODATION_LIMIT || "240", 10) || 240));
const STAR_RATINGS = {
  default: "threestar,fourstar,fivestar",
  family: "fourstar,fivestar",
};

const REGION_SLUGS = new Map([
  ["서울", "seoul"],
  ["경기", "gyeonggi"],
  ["인천", "incheon"],
  ["강원", "gangwon"],
  ["대전", "daejeon"],
  ["세종", "sejong"],
  ["충북", "chungbuk"],
  ["충남", "chungnam"],
  ["광주", "gwangju"],
  ["전북", "jeonbuk"],
  ["전남", "jeonnam"],
  ["대구", "daegu"],
  ["부산", "busan"],
  ["울산", "ulsan"],
  ["경북", "gyeongbuk"],
  ["경남", "gyeongnam"],
  ["제주", "jeju"],
  ["기타", "other"],
]);

function normalizeText(value = "") {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function fallbackSlug(value = "") {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "") || "other";
}

function comparableRegionToken(value = "") {
  return normalizeText(value)
    .split(/\s+/)
    .filter(Boolean)
    .pop()
    ?.replace(/(?:특별자치시|특별시|광역시|자치구|시|군|구|읍|면)$/u, "") || "";
}

function sameLocalRegion(left = "", right = "") {
  const leftToken = comparableRegionToken(left);
  const rightToken = comparableRegionToken(right);
  return Boolean(leftToken && rightToken && (leftToken === rightToken || leftToken.includes(rightToken) || rightToken.includes(leftToken)));
}

function compactRegion(value = "") {
  const normalized = normalizeRegion(value);
  if (normalized && isDomesticRegion(normalized)) return normalized;
  return normalizeText(value).split(/\s+/)[0] || "기타";
}

function regionSlug(value = "") {
  const label = compactRegion(value);
  return REGION_SLUGS.get(label) || fallbackSlug(label);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatDate(date) {
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
    generatedForDate: formatDate(today),
    checkIn: formatDate(checkInDate),
    checkOut: formatDate(addDays(checkInDate, NIGHTS)),
    nights: NIGHTS,
    adultCount: ADULT_COUNT,
    childCount: CHILD_COUNT,
  };
}

const STAY = defaultStayWindow();

function formatWon(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "";
  return `${number.toLocaleString("ko-KR")}원`;
}

function numberValue(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value ?? "").replace(/[^\d.]/g, "");
  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
}

function starNumber(value) {
  const text = normalizeText(value).toLowerCase();
  if (/five|5/.test(text)) return 5;
  if (/four|4/.test(text)) return 4;
  if (/three|3/.test(text)) return 3;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function scalarImage(item = {}) {
  for (const key of ["thumbnailUrl", "imageUrl", "mainImage", "mainImageUrl", "coverImage", "coverImageUrl", "image", "thumbnail"]) {
    const value = item?.[key];
    if (typeof value !== "string") continue;
    try {
      const url = new URL(value.trim());
      if (url.protocol === "https:") return url.toString();
    } catch {
      continue;
    }
  }
  return "";
}

function safeMyRealTripUrl(value = "") {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && (url.hostname === "myrealtrip.com" || url.hostname.endsWith(".myrealtrip.com"))
      ? url
      : null;
  } catch {
    return null;
  }
}

function urlWithStayParams(value = "", stay = STAY) {
  const url = safeMyRealTripUrl(value);
  if (!url) return "";
  if (url.hostname.toLowerCase() === "accommodation.myrealtrip.com") {
    url.searchParams.set("checkIn", stay.checkIn);
    url.searchParams.set("checkOut", stay.checkOut);
    url.searchParams.set("adultCount", String(stay.adultCount));
    url.searchParams.set("childCount", String(stay.childCount));
    url.searchParams.set("childAges", "");
  }
  return url.toString();
}

function deeplinkWithStayParams(value = "", stay = STAY) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const url = new URL(text);
    url.searchParams.set("checkIn", stay.checkIn);
    url.searchParams.set("checkOut", stay.checkOut);
    url.searchParams.set("adultCount", String(stay.adultCount));
    url.searchParams.set("childCount", String(stay.childCount));
    url.searchParams.set("childAges", "");
    return url.toString();
  } catch {
    return text;
  }
}

function formatStayDate(value = "") {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

function formatStar(value) {
  const number = starNumber(value);
  return number ? `${number}성급` : "";
}

function normalizeAccommodation(item, region, preset, stay = STAY) {
  const title = normalizeText(item?.itemName || item?.name || item?.title);
  const sourceUrl = item?.productUrl || item?.url || item?.linkUrl || item?.affiliateUrl;
  const url = urlWithStayParams(sourceUrl, stay);
  const image = scalarImage(item);
  const salePrice = numberValue(item?.salePrice || item?.discountedPrice || item?.price);
  const originalPrice = numberValue(item?.originalPrice || item?.marketPrice || item?.price || salePrice);
  if (!title || !url || !image || !salePrice) return null;

  const reviewScore = normalizeText(item?.reviewScore || item?.rating || item?.score);
  const reviewCount = numberValue(item?.reviewCount || item?.reviews || item?.reviewTotalCount);
  const discountRate = numberValue(item?.discountRate || item?.discountPercent)
    || (originalPrice > salePrice ? Math.round(((originalPrice - salePrice) / originalPrice) * 100) : 0);
  const regionName = compactRegion(region?.name || region?.keyword || item?.region || item?.city);
  const regionId = normalizeText(region?.regionId || item?.regionId);
  const starRating = item?.starRating || item?.grade || "";
  const meta = [
    `${formatStayDate(stay.checkIn)} 체크인`,
    `${stay.nights}박`,
    formatStar(starRating),
    reviewScore ? `평점 ${reviewScore}${reviewCount ? `(${reviewCount.toLocaleString("ko-KR")}개)` : ""}` : "",
  ].filter(Boolean);

  return {
    id: `accommodation-${item?.itemId || item?.id || url}`,
    type: "accommodation",
    title,
    url,
    image,
    region: regionName,
    regionSlug: regionSlug(regionName),
    regionId,
    category: "숙소 예약",
    price: salePrice,
    priceText: `${formatWon(salePrice)}부터`,
    salePrice,
    originalPrice: originalPrice || salePrice,
    discountRate,
    starRating,
    reviewScore,
    reviewCount,
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    adultCount: stay.adultCount,
    childCount: stay.childCount,
    starRatingPreset: preset,
    description: meta.join(" · "),
    tags: ["숙소", "호텔", "예약", regionName],
    intents: ["booking"],
    deepLink: deeplinkWithStayParams(item?.deepLink || "", stay),
    source: "myrealtrip-accommodation",
  };
}

async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readPosts() {
  const posts = await readJson(POSTS_PATH, []);
  return Array.isArray(posts) ? posts : [];
}

function configuredKeywords(posts) {
  const knownRegions = new Set(deriveAffiliateRegionKeywords(posts, REGION_LIMIT));
  return CONFIGURED_KEYWORDS.split(/[,\n]/)
    .map((value) => value.trim())
    .filter((value) => isDomesticRegion(value) || knownRegions.has(compactRegion(value)));
}

function fallbackKeywords(posts) {
  const regions = new Set();
  for (const post of posts) {
    const region = compactRegion(post?.region || post?.city);
    if (isDomesticRegion(region)) regions.add(region);
  }
  const fromPosts = [...regions].sort((a, b) => a.localeCompare(b, "ko"));
  const derived = deriveAffiliateRegionKeywords(posts, REGION_LIMIT);
  return [...new Set([...derived, ...fromPosts, "서울", "부산", "제주"])].slice(0, REGION_LIMIT);
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${API_KEY}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${text.slice(0, 300)}`);
  }
  return response.json();
}

function regionCandidates(payload) {
  if (Array.isArray(payload?.data?.regions)) return payload.data.regions;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.regions)) return payload.regions;
  if (Array.isArray(payload)) return payload;
  return [];
}

function normalizeRegionEntry(region, keyword) {
  const regionId = normalizeText(region?.regionId || region?.id);
  const rawName = normalizeText(region?.name || region?.regionName || keyword);
  const keywordName = compactRegion(keyword);
  const type = normalizeText(region?.type || region?.regionType);
  let name = compactRegion(rawName);
  const isKeywordLocal = keywordName && !isDomesticRegion(keywordName);
  if (isKeywordLocal && sameLocalRegion(rawName, keywordName)) name = keywordName;
  const isDomesticCandidate = isDomesticRegion(rawName) || isDomesticRegion(name) || type.toUpperCase() === "CITY" || sameLocalRegion(rawName, keywordName);
  if (!regionId || !name || !isDomesticCandidate) return null;
  return {
    keyword,
    name,
    slug: regionSlug(name),
    regionId,
    type,
    sourceName: normalizeText(region?.name || region?.regionName),
  };
}

async function fetchRegionMap(keywords, existing = null) {
  const regions = {};
  for (const keyword of keywords) {
    try {
      const payload = await postJson(REGION_URL, { keyword, isDomestic: IS_DOMESTIC });
      const candidates = regionCandidates(payload);
      const region = candidates
        .map((item) => normalizeRegionEntry(item, keyword))
        .filter(Boolean)
        .find((item) => item.type === "CITY")
        || candidates.map((item) => normalizeRegionEntry(item, keyword)).filter(Boolean)[0];
      if (!region) {
        console.log(`MyRealTrip accommodation region skipped: no region found for "${keyword}".`);
        continue;
      }
      regions[region.slug] = region;
    } catch (error) {
      const cached = Object.values(existing?.regions || {}).find((item) => item?.keyword === keyword || item?.name === compactRegion(keyword));
      if (cached?.regionId) {
        regions[cached.slug || regionSlug(cached.name)] = cached;
        console.log(`MyRealTrip accommodation region reused from cache for "${keyword}": ${error.message}`);
      } else {
        console.log(`MyRealTrip accommodation region skipped for "${keyword}": ${error.message}`);
      }
    }
  }
  return {
    updatedDate: STAY.generatedForDate,
    generatedAt: new Date().toISOString(),
    source: "myrealtrip-accommodation-region-autocomplete",
    endpoint: "/v1/products/accommodation/region-autocomplete",
    regions,
  };
}

function searchItems(payload) {
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.data?.products)) return payload.data.products;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload)) return payload;
  return [];
}

function sortAccommodations(items) {
  return [...items].sort((a, b) => {
    const aScore = Number(a.reviewScore || 0);
    const bScore = Number(b.reviewScore || 0);
    if (bScore !== aScore) return bScore - aScore;
    return Number(a.salePrice || 0) - Number(b.salePrice || 0);
  });
}

async function fetchAccommodationCache(regionMap) {
  const cache = {
    updatedDate: STAY.generatedForDate,
    generatedAt: new Date().toISOString(),
    source: "myrealtrip-accommodation-search",
    endpoint: "/v1/products/accommodation/search",
    checkIn: STAY.checkIn,
    checkOut: STAY.checkOut,
    adultCount: STAY.adultCount,
    childCount: STAY.childCount,
    nights: STAY.nights,
    presets: STAR_RATINGS,
    regions: {},
  };

  for (const region of Object.values(regionMap.regions || {}).filter((item) => item?.regionId)) {
    cache.regions[region.slug] = {
      keyword: region.keyword,
      name: region.name,
      slug: region.slug,
      regionId: region.regionId,
      default: [],
      family: [],
    };

    for (const [preset, starRating] of Object.entries(STAR_RATINGS)) {
      try {
        const payload = await postJson(SEARCH_URL, {
          regionId: region.regionId,
          checkIn: STAY.checkIn,
          checkOut: STAY.checkOut,
          adultCount: STAY.adultCount,
          childCount: STAY.childCount,
          starRating,
          page: 0,
          size: SIZE,
        });
        const seen = new Set();
        const items = sortAccommodations(
          searchItems(payload)
            .map((item) => normalizeAccommodation(item, region, preset, STAY))
            .filter(Boolean),
        ).filter((item) => {
          if (seen.has(item.url)) return false;
          seen.add(item.url);
          return true;
        }).slice(0, PER_REGION_LIMIT);
        cache.regions[region.slug][preset] = items;
      } catch (error) {
        console.log(`MyRealTrip accommodation search skipped for "${region.name}" ${preset}: ${error.message}`);
      }
    }
  }
  return cache;
}

function hasAccommodationItems(cache) {
  return Object.values(cache?.regions || {}).some((region) =>
    [...(region.default || []), ...(region.family || [])].some((item) => item?.url && item?.image),
  );
}

function flattenCache(cache) {
  const seen = new Set();
  const items = [];
  for (const region of Object.values(cache?.regions || {})) {
    for (const item of [...(region.default || []), ...(region.family || [])]) {
      if (!item?.url || seen.has(item.url)) continue;
      seen.add(item.url);
      items.push({
        ...item,
        city: item.region,
        url: urlWithStayParams(item.url, STAY),
        checkIn: STAY.checkIn,
        checkOut: STAY.checkOut,
        adultCount: STAY.adultCount,
        childCount: STAY.childCount,
      });
      if (items.length >= LIMIT) return items;
    }
  }
  return items;
}

function isFreshToday(value) {
  return value?.updatedDate === STAY.generatedForDate
    && value?.checkIn === STAY.checkIn
    && value?.checkOut === STAY.checkOut;
}

function hasMappedRegionIds(regionMap) {
  return Object.values(regionMap?.regions || {}).some((region) => normalizeText(region?.regionId));
}

function isFreshApiCache(cache, regionMap) {
  return isFreshToday(cache)
    && cache?.source === "myrealtrip-accommodation-search"
    && regionMap?.updatedDate === STAY.generatedForDate
    && regionMap?.source === "myrealtrip-accommodation-region-autocomplete"
    && hasMappedRegionIds(regionMap)
    && hasAccommodationItems(cache);
}

function legacyCacheFromFlatItems(items = []) {
  const cache = {
    updatedDate: STAY.generatedForDate,
    generatedAt: new Date().toISOString(),
    source: "legacy-myrealtrip-accommodation-cache",
    endpoint: "/v1/products/accommodation/search",
    checkIn: STAY.checkIn,
    checkOut: STAY.checkOut,
    adultCount: STAY.adultCount,
    childCount: STAY.childCount,
    nights: STAY.nights,
    presets: STAR_RATINGS,
    regions: {},
  };
  const regionMap = {
    updatedDate: STAY.generatedForDate,
    generatedAt: new Date().toISOString(),
    source: "legacy-myrealtrip-accommodation-region-map",
    endpoint: "/v1/products/accommodation/region-autocomplete",
    regions: {},
  };

  for (const legacyItem of Array.isArray(items) ? items : []) {
    const regionName = compactRegion(legacyItem?.region || legacyItem?.city);
    if (!isDomesticRegion(regionName)) continue;
    const slug = regionSlug(regionName);
    const normalized = normalizeAccommodation({
      itemId: String(legacyItem?.id || "").replace(/^accommodation-/, ""),
      itemName: String(legacyItem?.title || "").replace(new RegExp(`^${regionName}\\s+숙소\\s+`), ""),
      productUrl: legacyItem?.url,
      image: legacyItem?.image,
      salePrice: legacyItem?.salePrice || legacyItem?.price,
      originalPrice: legacyItem?.originalPrice || legacyItem?.price,
      starRating: legacyItem?.starRating,
      reviewScore: legacyItem?.reviewScore,
      reviewCount: legacyItem?.reviewCount,
      deepLink: legacyItem?.deepLink,
    }, { name: regionName, slug, regionId: normalizeText(legacyItem?.regionId) }, "default", STAY);
    if (!normalized) continue;
    if (!cache.regions[slug]) {
      cache.regions[slug] = {
        keyword: regionName,
        name: regionName,
        slug,
        regionId: normalizeText(legacyItem?.regionId),
        default: [],
        family: [],
      };
      regionMap.regions[slug] = {
        keyword: regionName,
        name: regionName,
        slug,
        regionId: normalizeText(legacyItem?.regionId),
        type: "",
        sourceName: regionName,
      };
    }
    if (cache.regions[slug].default.length < PER_REGION_LIMIT) {
      cache.regions[slug].default.push({ ...normalized, starRatingPreset: "default" });
    }
    if (starNumber(normalized.starRating) >= 4 && cache.regions[slug].family.length < PER_REGION_LIMIT) {
      cache.regions[slug].family.push({ ...normalized, starRatingPreset: "family" });
    }
  }
  return { cache, regionMap };
}

async function writeCacheFiles(cache, regionMap = null) {
  await writeJson(CACHE_PATH, cache);
  if (regionMap) await writeJson(REGION_MAP_PATH, regionMap);
  const flat = flattenCache(cache);
  if (flat.length) await writeJson(LEGACY_OUT_PATH, flat);
}

async function useLegacyFallback(reason) {
  const existingCache = await readJson(CACHE_PATH, null);
  if (hasAccommodationItems(existingCache)) {
    console.log(`MyRealTrip accommodation fetch kept cached data: ${reason}`);
    return true;
  }
  const legacyItems = await readJson(LEGACY_OUT_PATH, []);
  const { cache, regionMap } = legacyCacheFromFlatItems(legacyItems);
  if (hasAccommodationItems(cache)) {
    await writeCacheFiles(cache, regionMap);
    console.log(`MyRealTrip accommodation fetch used legacy local cache: ${reason}`);
    return true;
  }
  console.log(`MyRealTrip accommodation fetch produced no renderable cache: ${reason}`);
  return false;
}

if (!API_KEY.trim()) {
  await useLegacyFallback("API key is not configured.");
  process.exit(0);
}

try {
  const [posts, existingCache, existingMap] = await Promise.all([
    readPosts(),
    readJson(CACHE_PATH, null),
    readJson(REGION_MAP_PATH, null),
  ]);
  if (isFreshApiCache(existingCache, existingMap)) {
    await writeCacheFiles(existingCache, existingMap);
    console.log(`MyRealTrip accommodation fetch skipped: cache is already fresh for ${STAY.generatedForDate}.`);
    process.exit(0);
  }

  const explicitKeywords = configuredKeywords(posts);
  const keywords = explicitKeywords.length ? explicitKeywords.slice(0, REGION_LIMIT) : fallbackKeywords(posts);
  const regionMap = await fetchRegionMap(keywords, existingMap);
  const cache = await fetchAccommodationCache(regionMap);
  if (!hasAccommodationItems(cache)) {
    await useLegacyFallback("API returned no renderable accommodation cards.");
    process.exit(0);
  }
  await writeCacheFiles(cache, regionMap);
  console.log(`Saved MyRealTrip accommodation cache for ${Object.keys(cache.regions).length} region(s) to data/myrealtrip-accommodation-cache.json.`);
} catch (error) {
  await useLegacyFallback(error.message);
}
