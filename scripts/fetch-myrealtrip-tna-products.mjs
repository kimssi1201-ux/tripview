import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  affiliateProductImage,
  deriveAffiliateRegionKeywords,
  deriveTourSearchQueries,
  isDomesticRegion,
} from "./lib/affiliate-matching.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PATH = path.join(ROOT, "data", "myrealtrip-tna-products.json");
const POSTS_PATH = path.join(ROOT, "data", "generated-posts.json");

const API_KEY = process.env.MYREALTRIP_API_KEY
  || process.env.PARTNER_API_KEY
  || process.env.MYREALTRIP_PARTNER_API_KEY
  || "";
const SEARCH_URL = process.env.MYREALTRIP_TNA_SEARCH_URL
  || "https://partner-ext-api.myrealtrip.com/v1/products/tna/search";
const CONFIGURED_KEYWORDS = process.env.MYREALTRIP_TNA_KEYWORDS || process.env.MYREALTRIP_TNA_KEYWORD || "";
const CATEGORY = process.env.MYREALTRIP_TNA_CATEGORY || "";
const MIN_PRICE = process.env.MYREALTRIP_TNA_MIN_PRICE || "10000";
const MAX_PRICE = process.env.MYREALTRIP_TNA_MAX_PRICE || "200000";
const SORT = process.env.MYREALTRIP_TNA_SORT || "price_asc";
const SIZE = Math.max(1, Math.min(100, Number.parseInt(process.env.MYREALTRIP_TNA_SIZE || "20", 10) || 20));
const QUERY_LIMIT = Math.max(1, Math.min(12, Number.parseInt(process.env.MYREALTRIP_TNA_QUERY_LIMIT || "8", 10) || 8));
const PER_QUERY_LIMIT = Math.max(1, Math.min(8, Number.parseInt(process.env.MYREALTRIP_TNA_PER_QUERY_LIMIT || "3", 10) || 3));
const LIMIT = Math.max(1, Math.min(60, Number.parseInt(process.env.MYREALTRIP_TNA_LIMIT || "24", 10) || 24));

function formatWon(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "";
  return `${number.toLocaleString("ko-KR")}원`;
}

function normalizeText(value = "") {
  return String(value || "").trim();
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

function inferIntents(item) {
  const text = [
    item.itemName,
    item.description,
    item.category,
    ...(Array.isArray(item.tags) ? item.tags : []),
  ].filter(Boolean).join(" ");
  const intents = new Set(["booking"]);
  if (/(티켓|입장권|패스|교통|이동)/.test(text)) intents.add("transport");
  if (/(투어|근교|가이드)/.test(text)) intents.add("tour");
  if (/(액티비티|체험|클래스|스파|마사지)/.test(text)) intents.add("activity");
  if (/(아이|가족|키즈)/.test(text)) intents.add("family");
  if (/(바다|요트|서핑|스노클링|워터)/.test(text)) intents.add("water");
  if (/(실내|전시|박물관|미술관|공연)/.test(text)) intents.add("indoor");
  return [...intents];
}

function keywordRegion(value = "") {
  return normalizeText(value).split(/\s+/)[0] || "";
}

function cityFromText(item, keyword) {
  const text = normalizeText(item.description);
  const city = text.split(/[∙·]/)[0]?.trim();
  const expected = keywordRegion(keyword);
  if (city && city.length <= 20) {
    if (isDomesticRegion(city) || (expected.length >= 2 && city.includes(expected))) return city;
    return "";
  }
  const configuredCity = normalizeText(process.env.MYREALTRIP_TNA_CITY);
  if (isDomesticRegion(configuredCity) || configuredCity === expected) return configuredCity;
  return expected;
}

function normalizeProduct(item, keyword) {
  const title = normalizeText(item?.itemName);
  const url = normalizeText(item?.productUrl);
  if (!title || !url) return null;

  const priceText = normalizeText(item?.priceDisplay) || formatWon(item?.salePrice);
  const city = cityFromText(item, keyword);
  if (!city) return null;
  const review = item?.reviewScore
    ? `평점 ${item.reviewScore}${item?.reviewCount ? `(${Number(item.reviewCount).toLocaleString("ko-KR")}개)` : ""}`
    : "";
  const tags = Array.isArray(item?.tags) ? item.tags.map(normalizeText).filter(Boolean) : [];

  return {
    id: `tna-${item.gid || url}`,
    type: "tna",
    title,
    url,
    image: affiliateProductImage(item),
    price: item?.salePrice || "",
    priceText: priceText ? `${priceText}부터` : "",
    region: city,
    city,
    category: normalizeText(item?.category) || "투어·티켓",
    description: [normalizeText(item?.description), review, tags.slice(0, 2).join(" · ")].filter(Boolean).join(" · "),
    tags: ["투어티켓", "액티비티", "예약", city, ...tags],
    intents: inferIntents(item),
    gid: normalizeText(item?.gid),
    reviewScore: item?.reviewScore || "",
    reviewCount: item?.reviewCount || "",
    deepLink: normalizeText(item?.deepLink),
    source: "myrealtrip-tna",
  };
}

async function writeProducts(products) {
  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, `${JSON.stringify(products, null, 2)}\n`, "utf8");
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
  console.log("MyRealTrip TNA fetch skipped: API key is not configured. Set MYREALTRIP_API_KEY or PARTNER_API_KEY.");
  process.exit(0);
}

try {
  const posts = await readPosts();
  const explicit = configuredKeywords(posts);
  const keywords = explicit.length
    ? explicit.slice(0, QUERY_LIMIT)
    : deriveTourSearchQueries(posts, QUERY_LIMIT);
  if (!keywords.length) keywords.push("서울 투어", "부산 투어", "제주 액티비티");

  const collected = [];
  for (const keyword of keywords) {
    try {
      const request = {
        keyword,
        sort: SORT,
        page: 1,
        size: SIZE,
      };
      if (CATEGORY) request.category = CATEGORY;
      if (MIN_PRICE) request.minPrice = Number(MIN_PRICE);
      if (MAX_PRICE) request.maxPrice = Number(MAX_PRICE);

      const payload = await postJson(SEARCH_URL, request);
      const items = Array.isArray(payload?.data?.items) ? payload.data.items : [];
      collected.push(...items
        .map((item) => normalizeProduct(item, keyword))
        .filter(Boolean)
        .sort((a, b) => Number(a.price || 0) - Number(b.price || 0))
        .slice(0, PER_QUERY_LIMIT));
    } catch (error) {
      console.log(`MyRealTrip TNA query skipped for "${keyword}": ${error.message}`);
    }
  }

  const seen = new Set();
  const products = collected.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  }).slice(0, LIMIT);

  if (!products.length) {
    console.log("MyRealTrip TNA fetch kept the existing file: no matched products were returned.");
    process.exit(0);
  }
  await writeProducts(products);
  console.log(`Saved ${products.length} MyRealTrip TNA product(s) to data/myrealtrip-tna-products.json.`);
} catch (error) {
  console.log(`MyRealTrip TNA fetch skipped: ${error.message}`);
}
