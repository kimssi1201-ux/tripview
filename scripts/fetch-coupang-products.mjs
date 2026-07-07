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
const STATUS_PATHS = [
  path.join(ROOT, "data", "coupang-status.json"),
  path.join(ROOT, "site", "data", "coupang-status.json"),
  path.join(ROOT, "www", "data", "coupang-status.json"),
];
const OUT_PATH = OUT_PATHS[0];
const API_HOST = "https://api-gateway.coupang.com";
const SEARCH_PATH = "/v2/providers/affiliate_open_api/apis/openapi/products/search";
const REQUEST_TIMEOUT_MS = 8000;

const SEARCHES = [
  { intent: "travel", keyword: "\uC5EC\uD589 \uC900\uBE44\uBB3C", limit: 8 },
  { intent: "water", keyword: "\uBB3C\uB180\uC774 \uC6A9\uD488", limit: 8 },
  { intent: "water", keyword: "\uC544\uCFE0\uC544\uC288\uC988", limit: 8 },
  { intent: "indoor", keyword: "\uC7A5\uB9C8 \uC6B0\uC0B0", limit: 8 },
  { intent: "festival", keyword: "\uBCF4\uC870\uBC30\uD130\uB9AC", limit: 8 },
  { intent: "family", keyword: "\uC544\uC774 \uC5EC\uD589 \uC900\uBE44\uBB3C", limit: 8 },
  { intent: "booking", keyword: "\uC5EC\uD589\uC6A9 \uD30C\uC6B0\uCE58", limit: 8 },
  { intent: "summer", keyword: "\uC120\uD06C\uB9BC", limit: 8 },
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
  const image = text(item?.productImage);
  if (!title || !/^https?:\/\//.test(url) || !/^https?:\/\//.test(image)) return null;

  const price = Number(item?.productPrice || 0);
  return {
    type: "coupang",
    source: "coupang",
    intent: search.intent,
    keyword: search.keyword,
    title,
    url,
    image,
    price,
    meta: [price > 0 ? `${price.toLocaleString("ko-KR")}\uC6D0` : "", text(item?.categoryName)].filter(Boolean).join(" \u00B7 "),
  };
}

async function fetchProducts(auth, search) {
  const endpoint = new URL(`${API_HOST}${SEARCH_PATH}`);
  endpoint.searchParams.set("keyword", search.keyword);
  endpoint.searchParams.set("limit", String(search.limit));
  if (auth.subId) endpoint.searchParams.set("subId", auth.subId);

  const query = endpoint.searchParams.toString();
  const uri = `${endpoint.pathname}${query}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let body = "";
  let response;
  try {
    response = await fetch(endpoint.toString(), {
      headers: {
        authorization: authorizationHeader(auth, "GET", uri),
        accept: "application/json",
      },
      signal: controller.signal,
    });
    body = await response.text();
  } finally {
    clearTimeout(timeoutId);
  }

  let payload = {};
  try {
    payload = body ? JSON.parse(body) : {};
  } catch {
    payload = { rMessage: body };
  }
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

async function writeStatus(status) {
  const payload = `${JSON.stringify(
    {
      ...status,
      updatedAt: new Date().toISOString(),
    },
    null,
    2,
  )}\n`;
  for (const outputPath of STATUS_PATHS) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, payload, "utf8");
  }
}

async function mirrorExistingData() {
  try {
    const payload = await fs.readFile(OUT_PATH, "utf8");
    const rows = JSON.parse(payload);
    if (Array.isArray(rows)) {
      await writeJson(rows);
      return rows.length;
    }
  } catch {
    // Fall through and write an empty file set.
  }
  await writeJson([]);
  return 0;
}

const auth = credentials();
if (!auth.accessKey || !auth.secretKey) {
  const count = await mirrorExistingData();
  await writeStatus({
    ok: false,
    configured: false,
    productCount: count,
    message: "Coupang API key is not configured in this runtime.",
  });
  console.log(`Coupang fetch skipped: API key is not configured. Kept ${count} existing product(s).`);
  process.exit(0);
}

const seen = new Set();
const products = [];
const searches = [];
const errors = [];
for (const search of SEARCHES) {
  try {
    const rows = await fetchProducts(auth, search);
    for (const row of rows) {
      const key = row.url || row.title;
      if (seen.has(key)) continue;
      seen.add(key);
      products.push(row);
    }
    searches.push({ intent: search.intent, keyword: search.keyword, count: rows.length });
    console.log(`Coupang fetch: ${search.keyword} ${rows.length} product(s).`);
  } catch (error) {
    errors.push({ intent: search.intent, keyword: search.keyword, message: error.message });
    console.log(`Coupang fetch skipped for "${search.keyword}": ${error.message}`);
  }
}

await writeJson(products);
await writeStatus({
  ok: products.length > 0,
  configured: true,
  productCount: products.length,
  searchCount: SEARCHES.length,
  searches,
  errors,
});
console.log(`Saved ${products.length} Coupang product(s) to ${OUT_PATHS.length} static data file(s).`);
