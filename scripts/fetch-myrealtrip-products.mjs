import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PATH = path.join(ROOT, "data", "myrealtrip-products.json");

const API_KEY = process.env.MYREALTRIP_API_KEY
  || process.env.PARTNER_API_KEY
  || process.env.MYREALTRIP_PARTNER_API_KEY
  || "";
const API_URL = process.env.MYREALTRIP_API_BASE_URL
  || process.env.MYREALTRIP_PRODUCTS_URL
  || process.env.MYREALTRIP_API_URL
  || process.env.MYREALTRIP_ENDPOINT_URL
  || process.env.PARTNER_API_URL
  || process.env.PARTNER_PRODUCTS_URL
  || "";
const AUTH_MODE = (process.env.MYREALTRIP_AUTH_MODE || "bearer").toLowerCase();
const API_KEY_PARAM = process.env.MYREALTRIP_API_KEY_PARAM || "apiKey";
const API_KEY_HEADER = process.env.MYREALTRIP_API_KEY_HEADER || "";
const LIMIT = Math.max(1, Math.min(100, Number.parseInt(process.env.MYREALTRIP_PRODUCT_LIMIT || "60", 10) || 60));

function pick(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return "";
}

function firstArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.products)) return value.products;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.list)) return value.list;
  if (Array.isArray(value?.records)) return value.records;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.data?.items)) return value.data.items;
  if (Array.isArray(value?.data?.products)) return value.data.products;
  if (Array.isArray(value?.data?.results)) return value.data.results;
  if (Array.isArray(value?.data?.list)) return value.data.list;
  if (Array.isArray(value?.data?.records)) return value.data.records;
  if (Array.isArray(value?.result?.items)) return value.result.items;
  if (Array.isArray(value?.result?.products)) return value.result.products;
  if (Array.isArray(value?.result?.results)) return value.result.results;
  return [];
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return value.split(/[,\s#]+/).filter(Boolean);
  return [];
}

function normalizeText(value = "") {
  return String(value || "").trim();
}

function inferIntents(product) {
  const text = [
    product.title,
    product.description,
    product.category,
    product.type,
    product.region,
    product.city,
    ...asArray(product.tags),
  ].filter(Boolean).join(" ");
  const intents = new Set(["booking"]);

  const rules = [
    ["water", ["물놀이", "해수욕장", "바다", "요트", "서핑", "스노클링", "워터", "수영", "계곡", "래프팅", "카약"]],
    ["indoor", ["실내", "전시", "박물관", "미술관", "공연", "체험", "테마", "클래스", "스파"]],
    ["festival", ["축제", "행사", "페스티벌", "티켓", "입장권", "공연", "콘서트"]],
    ["family", ["아이", "가족", "키즈", "체험", "테마파크", "동물", "농장", "목장", "아쿠아리움"]],
  ];

  for (const [intent, keywords] of rules) {
    if (keywords.some((keyword) => text.includes(keyword))) intents.add(intent);
  }
  return [...intents];
}

function normalizeProduct(item) {
  const title = normalizeText(pick(item, ["title", "name", "productName", "displayName"]));
  const url = normalizeText(pick(item, ["url", "link", "linkUrl", "deeplink", "affiliateUrl", "productUrl"]));
  const image = normalizeText(pick(item, ["image", "imageUrl", "thumbnail", "thumbnailUrl", "mainImage", "coverImage"]));
  const price = pick(item, ["price", "salePrice", "displayPrice", "amount", "minPrice"]);
  const priceText = normalizeText(pick(item, ["priceText", "displayPrice", "priceLabel"]));
  const region = normalizeText(pick(item, ["region", "city", "area", "locationName", "destination"]));
  const category = normalizeText(pick(item, ["category", "categoryName", "type", "productType"]));
  const description = normalizeText(pick(item, ["description", "summary", "subtitle", "intro"]));
  const tags = asArray(pick(item, ["tags", "keywords", "tagNames"]));

  if (!title || !url) return null;

  const product = {
    id: normalizeText(pick(item, ["id", "productId", "contentId", "uuid"])) || url,
    title,
    url,
    image,
    price: price === "" ? "" : price,
    priceText,
    region,
    category,
    description,
    tags,
  };

  product.intents = inferIntents(product);
  return product;
}

function buildRequest() {
  let urlText = API_URL.replaceAll("{API_KEY}", encodeURIComponent(API_KEY));
  const url = new URL(urlText);
  const headers = { accept: "application/json" };

  if (API_KEY && !API_URL.includes("{API_KEY}")) {
    if (API_KEY_HEADER) {
      headers[API_KEY_HEADER] = API_KEY;
    } else if (AUTH_MODE === "query") {
      url.searchParams.set(API_KEY_PARAM, API_KEY);
    } else if (AUTH_MODE === "x-api-key") {
      headers["x-api-key"] = API_KEY;
    } else {
      headers.authorization = `Bearer ${API_KEY}`;
    }
  }

  return { url, headers };
}

if (!API_KEY.trim()) {
  console.log("MyRealTrip fetch skipped: API key is not configured. Set MYREALTRIP_API_KEY or PARTNER_API_KEY.");
  process.exit(0);
}

if (!API_URL.trim()) {
  console.log("MyRealTrip fetch skipped: product API URL is not configured. Set MYREALTRIP_PRODUCTS_URL, MYREALTRIP_API_BASE_URL, MYREALTRIP_API_URL, MYREALTRIP_ENDPOINT_URL, or PARTNER_API_URL.");
  process.exit(0);
}

if (API_URL.includes("/revenues")) {
  console.log("MyRealTrip fetch skipped: /revenues is a private settlement API, not a public product feed. Use a product/tour/ticket/deeplink endpoint for homepage cards.");
  process.exit(0);
}

const { url, headers } = buildRequest();
console.log(`MyRealTrip fetch started: endpoint=${url.origin}${url.pathname}, auth=${API_KEY_HEADER ? "custom-header" : AUTH_MODE}`);
const response = await fetch(url, { headers });
if (!response.ok) {
  const body = await response.text();
  throw new Error(`MyRealTrip API request failed: ${response.status} ${body.slice(0, 500)}`);
}

const payload = await response.json();
const products = firstArray(payload)
  .map(normalizeProduct)
  .filter(Boolean)
  .slice(0, LIMIT);

await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
await fs.writeFile(OUT_PATH, `${JSON.stringify(products, null, 2)}\n`, "utf8");
console.log(`Saved ${products.length} MyRealTrip product(s) to data/myrealtrip-products.json.`);
