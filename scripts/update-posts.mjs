import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const postsPath = join(root, "data", "posts.json");
const localEnvPath = join(root, ".env.local");
const defaultSourceUrl =
  "https://apis.data.go.kr/B551011/KorService2/areaBasedList2?MobileOS=ETC&MobileApp=Tripview&_type=json&numOfRows=20&pageNo=1&arrange=Q&contentTypeId=12";

async function loadLocalEnv() {
  try {
    const text = await readFile(localEnvPath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      if (!process.env[key]) {
        process.env[key] = rest.join("=").replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // Local env is optional. GitHub Actions uses repository secrets instead.
  }
}

function slugify(value) {
  const slug = String(value)
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 80);
  return slug || `post-${Date.now()}`;
}

function compactText(values) {
  return values.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function destinationFromAddress(address = "") {
  return address.split(/\s+/).filter(Boolean)[0] || "국내";
}

function categoryFromTourItem(item) {
  const contentTypeId = String(item.contenttypeid || item.contentTypeId || "");
  const map = {
    12: "국내여행",
    14: "국내여행",
    15: "공연/축제",
    25: "국내여행",
    28: "국내여행",
    32: "숙소/예약",
    38: "생활정보",
    39: "생활정보"
  };
  return map[contentTypeId] || "국내여행";
}

function normalizePost(item) {
  const title = item.title || item.name || "새 여행 정보";
  return {
    slug: item.slug || slugify(title),
    title,
    category: item.category || "국내여행",
    excerpt: item.excerpt || item.description || "새로 수집된 여행 정보를 정리했습니다.",
    date: item.date || new Date().toISOString().slice(0, 10),
    readMinutes: Number(item.readMinutes || 3),
    views: Number(item.views || 0),
    image:
      item.image ||
      "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=82",
    alt: item.alt || title,
    keywords: item.keywords || [],
    destination: item.destination || item.region || "국내",
    featured: Boolean(item.featured),
    content: item.content || [item.excerpt || item.description || "새 여행 정보를 확인해 보세요."]
  };
}

function normalizeTourItem(item) {
  const title = item.title || item.name || "새 여행 정보";
  const address = compactText([item.addr1, item.addr2]);
  const destination = item.destination || item.region || destinationFromAddress(address);
  const image = item.firstimage || item.firstimage2 || item.image;
  const category = item.category || categoryFromTourItem(item);
  const dateSource = item.eventstartdate || item.modifiedtime || item.createdtime || item.date;
  const date = dateSource ? String(dateSource).slice(0, 8).replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3") : undefined;
  const excerpt = item.excerpt || item.description || compactText([destination, title, address, "방문 정보를 정리했습니다."]);

  return normalizePost({
    slug: item.slug || (item.contentid ? `tour-${item.contentid}` : `${slugify(destination)}-${slugify(title)}`),
    title,
    category,
    excerpt,
    date,
    readMinutes: item.readMinutes || 3,
    views: item.views || 0,
    image,
    alt: item.alt || title,
    keywords: [destination, category, ...(item.keywords || [])],
    destination,
    content: [
      excerpt,
      address ? `주소는 ${address}입니다. 방문 전 운영 시간, 주차, 예약 가능 여부를 함께 확인하는 것이 좋습니다.` : "방문 전 운영 시간, 주차, 예약 가능 여부를 함께 확인하는 것이 좋습니다.",
      "자동 수집된 여행 정보는 실제 방문 전 공식 안내와 현장 공지를 한 번 더 확인하면 안전합니다."
    ]
  });
}

function extractItems(payload) {
  if (Array.isArray(payload)) return payload.map(normalizePost);
  if (Array.isArray(payload.posts)) return payload.posts.map(normalizePost);
  if (Array.isArray(payload.items)) return payload.items.map(normalizePost);

  const tourItems = payload.response?.body?.items?.item;
  if (Array.isArray(tourItems)) return tourItems.map(normalizeTourItem);
  if (tourItems && typeof tourItems === "object") return [normalizeTourItem(tourItems)];

  return [];
}

function buildRequest() {
  const apiKey = process.env.TRIPVIEW_API_KEY;
  const sourceUrl = process.env.TRIPVIEW_POSTS_SOURCE_URL || (apiKey ? defaultSourceUrl : "");
  const apiKeyParam = process.env.TRIPVIEW_API_KEY_PARAM || "serviceKey";
  const apiKeyHeader = process.env.TRIPVIEW_API_KEY_HEADER;

  if (!sourceUrl) return null;

  let resolvedUrl = sourceUrl;
  if (apiKey && resolvedUrl.includes("{API_KEY}")) {
    resolvedUrl = resolvedUrl.replaceAll("{API_KEY}", encodeURIComponent(apiKey));
  }

  const url = new URL(resolvedUrl);
  const headers = {};

  if (apiKey && apiKeyHeader) {
    headers[apiKeyHeader] = apiKey;
  } else if (apiKey && !url.searchParams.has(apiKeyParam) && !sourceUrl.includes("{API_KEY}")) {
    url.searchParams.set(apiKeyParam, apiKey);
  }

  return { url, headers };
}

await loadLocalEnv();

const currentPosts = JSON.parse(await readFile(postsPath, "utf8"));
let incoming = [];
const request = buildRequest();

if (request) {
  const response = await fetch(request.url, { headers: request.headers });
  if (!response.ok) {
    throw new Error(`Source returned ${response.status}`);
  }
  const payload = await response.json();
  incoming = extractItems(payload);
}

if (!incoming.length) {
  console.log("No external posts supplied. Set TRIPVIEW_POSTS_SOURCE_URL and TRIPVIEW_API_KEY if the API requires auth.");
  process.exit(0);
}

const existing = new Map(currentPosts.map((post) => [post.slug, post]));
for (const item of incoming) {
  existing.set(item.slug, { ...existing.get(item.slug), ...item });
}

const merged = Array.from(existing.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
await writeFile(postsPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
console.log(`Merged ${incoming.length} incoming posts. Total: ${merged.length}`);
