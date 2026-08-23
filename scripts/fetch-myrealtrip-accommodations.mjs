import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { affiliateProductImage, deriveAffiliateRegionKeywords, isDomesticRegion } from "./lib/affiliate-matching.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PATH = path.join(ROOT, "data", "myrealtrip-accommodations.json");
const POSTS_PATH = path.join(ROOT, "data", "generated-posts.json");

const API_KEY = process.env.MYREALTRIP_API_KEY
  || process.env.PARTNER_API_KEY
  || process.env.MYREALTRIP_PARTNER_API_KEY
  || "";
const REGION_URL = process.env.MYREALTRIP_ACCOMMODATION_REGION_URL
  || "https://partner-ext-api.myrealtrip.com/v1/products/accommodation/region-autocomplete";
const SEARCH_URL = process.env.MYREALTRIP_ACCOMMODATION_SEARCH_URL
  || "https://partner-ext-api.myrealtrip.com/v1/products/accommodation/search";
const CONFIGURED_KEYWORDS = process.env.MYREALTRIP_ACCOMMODATION_KEYWORDS
  || process.env.MYREALTRIP_ACCOMMODATION_KEYWORD
  || "";
const IS_DOMESTIC = true;
const NIGHTS = Math.max(1, Math.min(14, Number.parseInt(process.env.MYREALTRIP_ACCOMMODATION_NIGHTS || "2", 10) || 2));
const ADULT_COUNT = Math.max(1, Math.min(9, Number.parseInt(process.env.MYREALTRIP_ACCOMMODATION_ADULT_COUNT || "2", 10) || 2));
const CHILD_COUNT = Math.max(0, Math.min(9, Number.parseInt(process.env.MYREALTRIP_ACCOMMODATION_CHILD_COUNT || "0", 10) || 0));
const STAR_RATING = process.env.MYREALTRIP_ACCOMMODATION_STAR_RATING || "";
const SIZE = Math.max(1, Math.min(50, Number.parseInt(process.env.MYREALTRIP_ACCOMMODATION_SIZE || "20", 10) || 20));
const REGION_LIMIT = Math.max(1, Math.min(12, Number.parseInt(process.env.MYREALTRIP_ACCOMMODATION_REGION_LIMIT || "8", 10) || 8));
const PER_REGION_LIMIT = Math.max(1, Math.min(8, Number.parseInt(process.env.MYREALTRIP_ACCOMMODATION_PER_REGION_LIMIT || "3", 10) || 3));
const LIMIT = Math.max(1, Math.min(60, Number.parseInt(process.env.MYREALTRIP_ACCOMMODATION_LIMIT || "24", 10) || 24));

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dateText(date) {
  return date.toISOString().slice(0, 10);
}

function koreaCalendarDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day)));
}

function defaultAccommodationCheckIn(reference = new Date()) {
  const today = koreaCalendarDate(reference);
  const daysUntilFriday = (5 - today.getUTCDay() + 7) % 7 || 7;
  return dateText(addDays(today, daysUntilFriday));
}

const defaultCheckIn = defaultAccommodationCheckIn();
const CHECK_IN = process.env.MYREALTRIP_ACCOMMODATION_CHECK_IN || defaultCheckIn;
const CHECK_OUT = process.env.MYREALTRIP_ACCOMMODATION_CHECK_OUT || dateText(addDays(new Date(`${CHECK_IN}T00:00:00Z`), NIGHTS));

function formatWon(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "";
  return `${number.toLocaleString("ko-KR")}원`;
}

function formatStayDate(value = "") {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
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

function keywordRegion(value = "") {
  return String(value || "").trim().split(/\s+/)[0] || "";
}

function isExpectedDomesticRegion(regionName, keyword) {
  const name = String(regionName || "").trim();
  const expected = keywordRegion(keyword);
  return isDomesticRegion(name) || (expected.length >= 2 && name.includes(expected));
}

function normalizeAccommodation(item, region, keyword) {
  const title = String(item?.itemName || "").trim();
  const url = String(item?.productUrl || "").trim();
  const priceText = formatWon(item?.salePrice);
  if (!title || !url || !priceText || !isExpectedDomesticRegion(region?.name, keyword)) return null;

  const review = item?.reviewScore
    ? `평점 ${item.reviewScore}${item?.reviewCount ? `(${Number(item.reviewCount).toLocaleString("ko-KR")}개)` : ""}`
    : "";
  const star = item?.starRating ? `${item.starRating}성급` : "";
  const stay = `${formatStayDate(CHECK_IN)} 체크인 · ${NIGHTS}박`;

  return {
    id: `accommodation-${item.itemId || url}`,
    type: "accommodation",
    title: `${region.name} 숙소 ${title}`,
    url,
    image: affiliateProductImage(item),
    price: item.salePrice || "",
    priceText: `${priceText}부퀰`,
    region: region.name,
    city: region.name,
    category: "숙소 예약",
    description: [stay, star, review].filter(Boolean).join(" · "),
    tags: ["숙소", "호퀔", "예약", region.name],
    intents: ["booking"],
    checkIn: CHECK_IN,
    checkOut: CHECK_OUT,
    adultCount: ADULT_COUNT,
    childCount: CHILD_COUNT,
    starRating: item.starRating || "",
    reviewScore: item.reviewScore || "",
    reviewCount: item.reviewCount || "",
    originalPrice: item.originalPrice || "",
    deepLink: item.deepLink || "",
    source: "myrealtrip-accommodation",
  };
}

async function writeItems(items) {
  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

async function readPosts() {
  try {
    const posts = JSON.parse(await fs.readFile(POSTS_PATH, "utf8"));
    return Array.isArray(posts) ? posts : [];
  } catch {
    return [];
  }
}

function configuredKeywords(posts) {
  const knownRegions = new Set(deriveAffiliateRegionKeywords(posts, 20));
  return CONFIGURED_KEYWORDS.split(/[,\n]/)
    .map((value) => value.trim())
    .filter((value) => isDomesticRegion(value) || knownRegions.has(keywordRegion(value)));
}

if (!API_KEY.trim()) {
  console.log("MyRealTrip accommodation fetch skipped: API key is not configured. Set MYREALTRIP_API_KEY or PARTNER_API_KEY.");
  process.exit(0);
}

try {
  const posts = await readPosts();
  const explicitKeywords = configuredKeywords(posts);
  const keywords = explicitKeywords.length
    ? explicitKeywords.slice(0, REGION_LIMIT)
    : deriveAffiliateRegionKeywords(posts, REGION_LIMIT);
  if (!keywords.length) keywords.push("서울", "부산", "제주");

  const collected = [];
  for (const keyword of keywords) {
    try {
      const regionPayload = await postJson(REGION_URL, { keyword, isDomestic: IS_DOMESTIC });
      const regions = Array.isArray(regionPayload?.data?.regions) ? regionPayload.data.regions : [];
      const region = regions.find((item) => item?.type === "CITY") || regions[0];
      if (!region?.regionId) {
        console.log(`MyRealTrip accommodation region skipped: no region found for "${keyword}".`);
        continue;
      }

      const request = {
        regionId: region.regionId,
        checkIn: CHECK_IN,
        checkOut: CHECK_OUT,
        adultCount: ADULT_COUNT,
        childCount: CHILD_COUNT,
        page: 0,
        size: SIZE,
      };
      if (STAR_RATING) request.starRating = STAR_RATING;

      const searchPayload = await postJson(SEARCH_URL, request);
      const items = Array.isArray(searchPayload?.data?.items) ? searchPayload.data.items : [];
      collected.push(...items
        .map((item) => normalizeAccommodation(item, region, keyword))
        .filter(Boolean)
        .sort((a, b) => Number(a.price || 0) - Number(b.price || 0))
        .slice(0, PER_REGION_LIMIT));
    } catch (error) {
      console.log(`MyRealTrip accommodation region skipped for "${keyword}": ${error.message}`);
    }
  }

  const seen = new Set();
  const accommodations = collected.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  }).slice(0, LIMIT);

  if (!accommodations.length) {
    console.log("MyRealTrip accommodation fetch kept the existing file: no matched products were returned.");
    process.exit(0);
  }
  await writeItems(accommodations);
  console.log(`Saved ${accommodations.length} MyRealTrip accommodation(s) to data/myrealtrip-accommodations.json.`);
} catch (error) {
  console.log(`MyRealTrip accommodation fetch skipped: ${error.message}`);
}
