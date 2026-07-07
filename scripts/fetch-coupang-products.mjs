import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PATHS = [
  path.join(ROOT, "data", "coupang-products.json"),
  path.join(ROOT, "site", "data", "coupang-products.json"),
  path.join(ROOT, "www", "data", "coupang-products.json"),
];
const OUT_PATH = OUT_PATHS[0];
const API_HOST = "https://api-gateway.coupang.com";
const SEARCH_PATH = "/v2/providers/affiliate_open_api/apis/openapi/products/search";

const SEARCHES = [
  { intent: "travel", keyword: "여행 준비물", limit: 6 },
  { intent: "water", keyword: "방수팩", limit: 6 },
  { intent: "indoor", keyword: "접이식 우산", limit: 6 },
  { intent: "festival", keyword: "보조배터리", limit: 6 },
  { intent: "family", keyword: "아이 여행 준비물", limit: 6 },
  { intent: "booking", keyword: "여행용 파우치", limit: 6 },
];

function text(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function credentials() {
  return {
    accessKey: text(process.env.COUPANG_ACCESS_KEY || process.env.COUPANG_PARTNERS_ACCESS_KEY || process.env.COUPANG_PARTNER_ACCESS_KEY),
    secretKey: text(process.env.COUPANG_SECRET_KEY || process.env.COUPANG_PARTNERS_SECRET_KEY || process.env.COUPANG_PARTNER_SECRET_KEY),
    subId: text(process.env.COUPANG_SUB_ID || process.env.COUPANG_CHANNEL_ID || process.env.COUPANG_PARTNER_ID).replace(/[^A-Za-z0-9_-]/g, ""),
  };
}

function signedDate() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").slice(2);
}

function authorizationHeader({ accessKey, secretKey }, method, uri) {
  const datetime = signedDate();
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(datetime + method + uri)
    .digest("hex");
  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
}

function normalizeProduct(item, search) {
  const title = text(item?.productName);
  const url = text(item?.productUrl);
  if (!title || !/^https?:\/\//.test(url)) return null;

  const price = Number(item?.productPrice || 0);
  return {
    type: "coupang",
    source: "coupang",
    intent: search.intent,
    keyword: search.keyword,
    title,
    url,
    image: text(item?.productImage),
    price,
    meta: [price > 0 ? `${price.toLocaleString("ko-KR")}원` : "", text(item?.categoryName)].filter(Boolean).join(" · "),
  };
}

async function fetchProducts(auth, search) {
  const endpoint = new URL(`${API_HOST}${SEARCH_PATH}`);
  endpoint.searchParams.set("keyword", search.keyword);
  endpoint.searchParams.set("limit", String(search.limit));
  if (auth.subId) endpoint.searchParams.set("subId", auth.subId);

  const uri = `${endpoint.pathname}?${endpoint.searchParams.toString()}`;
  const response = await fetch(endpoint.toString(), {
    headers: {
      authorization: authorizationHeader(auth, "GET", uri),
      accept: "application/json",
    },
  });
  const payload = await response.json().catch(async () => ({ rMessage: await response.text() }));
  if (!response.ok || String(payload?.rCode ?? "0") !== "0") {
    throw new Error(text(payload?.rMessage || payload?.message || `request failed ${response.status}`));
  }
  const rows = Array.isArray(payload?.data?.productData) ? payload.data.productData : [];
  return rows.map((item) => normalizeProduct(item, search)).filter(Boolean);
}

async function writeJson(rows) {
  const payload = `${JSON.stringify(rows, null, 2)}\n`;
  for (const outputPath of OUT_PATHS) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, payload, "utf8");
  }
}

const auth = credentials();
if (!auth.accessKey || !auth.secretKey) {
  try {
    await fs.access(OUT_PATH);
    console.log("Coupang fetch skipped: API key is not configured. Keeping existing data/coupang-products.json.");
  } catch {
    await writeJson([]);
    console.log("Coupang fetch skipped: API key is not configured. Wrote empty data/coupang-products.json.");
  }
  process.exit(0);
}

const seen = new Set();
const products = [];
for (const search of SEARCHES) {
  try {
    const rows = await fetchProducts(auth, search);
    for (const row of rows) {
      const key = row.url || row.title;
      if (seen.has(key)) continue;
      seen.add(key);
      products.push(row);
    }
    console.log(`Coupang fetch: ${search.keyword} ${rows.length} product(s).`);
  } catch (error) {
    console.log(`Coupang fetch skipped for "${search.keyword}": ${error.message}`);
  }
}

await writeJson(products);
console.log(`Saved ${products.length} Coupang product(s) to ${OUT_PATHS.length} static data file(s).`);
