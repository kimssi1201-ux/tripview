import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PATH = path.join(ROOT, "data", "myrealtrip-tna-products.json");

const API_KEY = process.env.MYREALTRIP_API_KEY
  || process.env.PARTNER_API_KEY
  || process.env.MYREALTRIP_PARTNER_API_KEY
  || "";
const SEARCH_URL = process.env.MYREALTRIP_TNA_SEARCH_URL
  || "https://partner-ext-api.myrealtrip.com/v1/products/tna/search";
const KEYWORD = process.env.MYREALTRIP_TNA_KEYWORD || "오사카 투어";
const CATEGORY = process.env.MYREALTRIP_TNA_CATEGORY || "";
const MIN_PRICE = process.env.MYREALTRIP_TNA_MIN_PRICE || "";
const MAX_PRICE = process.env.MYREALTRIP_TNA_MAX_PRICE || "";
const SORT = process.env.MYREALTRIP_TNA_SORT || "price_asc";
const SIZE = Math.max(1, Math.min(100, Number.parseInt(process.env.MYREALTRIP_TNA_SIZE || "20", 10) || 20));
const LIMIT = Math.max(1, Math.min(20, Number.parseInt(process.env.MYREALTRIP_TNA_LIMIT || "8", 10) || 8));

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

function cityFromText(item) {
  const text = normalizeText(item.description);
  const city = text.split(/[∙·]/)[0]?.trim();
  if (city && city.length <= 20) return city;
  return normalizeText(process.env.MYREALTRIP_TNA_CITY || KEYWORD.split(/\s+/)[0]);
}

function normalizeProduct(item) {
  const title = normalizeText(item?.itemName);
  const url = normalizeText(item?.productUrl);
  if (!title || !url) return null;

  const priceText = normalizeText(item?.priceDisplay) || formatWon(item?.salePrice);
  const city = cityFromText(item);
  const review = item?.reviewScore
    ? `평점 ${item.reviewScore}${item?.reviewCount ? `(${Number(item.reviewCount).toLocaleString("ko-KR")}개)` : ""}`
    : "";
  const tags = Array.isArray(item?.tags) ? item.tags.map(normalizeText).filter(Boolean) : [];

  return {
    id: `tna-${item.gid || url}`,
    type: "tna",
    title,
    url,
    image: normalizeText(item?.imageUrl),
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

if (!API_KEY.trim()) {
  console.log("MyRealTrip TNA fetch skipped: API key is not configured. Set MYREALTRIP_API_KEY or PARTNER_API_KEY.");
  process.exit(0);
}

try {
  const request = {
    keyword: KEYWORD,
    sort: SORT,
    page: 1,
    size: SIZE,
  };
  if (CATEGORY) request.category = CATEGORY;
  if (MIN_PRICE) request.minPrice = Number(MIN_PRICE);
  if (MAX_PRICE) request.maxPrice = Number(MAX_PRICE);

  const payload = await postJson(SEARCH_URL, request);
  const items = Array.isArray(payload?.data?.items) ? payload.data.items : [];
  const products = items
    .map(normalizeProduct)
    .filter(Boolean)
    .sort((a, b) => Number(a.price || 0) - Number(b.price || 0))
    .slice(0, LIMIT);

  await writeProducts(products);
  console.log(`Saved ${products.length} MyRealTrip TNA product(s) to data/myrealtrip-tna-products.json.`);
} catch (error) {
  console.log(`MyRealTrip TNA fetch skipped: ${error.message}`);
}
