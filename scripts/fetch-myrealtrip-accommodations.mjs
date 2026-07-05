import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PATH = path.join(ROOT, "data", "myrealtrip-accommodations.json");

const API_KEY = process.env.MYREALTRIP_API_KEY
  || process.env.PARTNER_API_KEY
  || process.env.MYREALTRIP_PARTNER_API_KEY
  || "";
const REGION_URL = process.env.MYREALTRIP_ACCOMMODATION_REGION_URL
  || "https://partner-ext-api.myrealtrip.com/v1/products/accommodation/region-autocomplete";
const SEARCH_URL = process.env.MYREALTRIP_ACCOMMODATION_SEARCH_URL
  || "https://partner-ext-api.myrealtrip.com/v1/products/accommodation/search";
const KEYWORD = process.env.MYREALTRIP_ACCOMMODATION_KEYWORD || "서울";
const IS_DOMESTIC = String(process.env.MYREALTRIP_ACCOMMODATION_IS_DOMESTIC || "true").toLowerCase() !== "false";
const NIGHTS = Math.max(1, Math.min(14, Number.parseInt(process.env.MYREALTRIP_ACCOMMODATION_NIGHTS || "2", 10) || 2));
const ADULT_COUNT = Math.max(1, Math.min(9, Number.parseInt(process.env.MYREALTRIP_ACCOMMODATION_ADULT_COUNT || "2", 10) || 2));
const CHILD_COUNT = Math.max(0, Math.min(9, Number.parseInt(process.env.MYREALTRIP_ACCOMMODATION_CHILD_COUNT || "0", 10) || 0));
const STAR_RATING = process.env.MYREALTRIP_ACCOMMODATION_STAR_RATING || "";
const SIZE = Math.max(1, Math.min(50, Number.parseInt(process.env.MYREALTRIP_ACCOMMODATION_SIZE || "20", 10) || 20));
const LIMIT = Math.max(1, Math.min(20, Number.parseInt(process.env.MYREALTRIP_ACCOMMODATION_LIMIT || "8", 10) || 8));

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dateText(date) {
  return date.toISOString().slice(0, 10);
}

const defaultCheckIn = dateText(addDays(new Date(), 14));
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

function normalizeAccommodation(item, region) {
  const title = String(item?.itemName || "").trim();
  const url = String(item?.productUrl || "").trim();
  const priceText = formatWon(item?.salePrice);
  if (!title || !url || !priceText) return null;

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
    image: item.imageUrl || "",
    price: item.salePrice || "",
    priceText: `${priceText}부터`,
    region: region.name,
    city: region.name,
    category: "숙소 예약",
    description: [stay, star, review].filter(Boolean).join(" · "),
    tags: ["숙소", "호텔", "예약", region.name],
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

if (!API_KEY.trim()) {
  console.log("MyRealTrip accommodation fetch skipped: API key is not configured. Set MYREALTRIP_API_KEY or PARTNER_API_KEY.");
  process.exit(0);
}

try {
  const regionPayload = await postJson(REGION_URL, { keyword: KEYWORD, isDomestic: IS_DOMESTIC });
  const regions = Array.isArray(regionPayload?.data?.regions) ? regionPayload.data.regions : [];
  const region = regions.find((item) => item?.type === "CITY") || regions[0];
  if (!region?.regionId) {
    console.log(`MyRealTrip accommodation fetch skipped: no region found for "${KEYWORD}".`);
    process.exit(0);
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
  const accommodations = items
    .map((item) => normalizeAccommodation(item, region))
    .filter(Boolean)
    .sort((a, b) => Number(a.price || 0) - Number(b.price || 0))
    .slice(0, LIMIT);

  await writeItems(accommodations);
  console.log(`Saved ${accommodations.length} MyRealTrip accommodation(s) to data/myrealtrip-accommodations.json.`);
} catch (error) {
  console.log(`MyRealTrip accommodation fetch skipped: ${error.message}`);
}
