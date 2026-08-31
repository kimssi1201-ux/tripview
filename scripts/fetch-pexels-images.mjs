import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PEXELS_IMAGE_MANIFEST_PATH,
  PEXELS_SOURCE_LABEL,
  readPexelsImageManifest,
} from "./lib/pexels-image-assets.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const POSTS_PATH = join(ROOT, "data", "generated-posts.json");
const OUTPUT_PATH = join(ROOT, PEXELS_IMAGE_MANIFEST_PATH);
const API_URL = "https://api.pexels.com/v1/search";
const API_KEY = String(process.env.PEXELS_API_KEY || "").trim();
const LOCALE = String(process.env.PEXELS_LOCALE || "ko-KR").trim();
const REFRESH = /^(1|true|yes)$/i.test(String(process.env.PEXELS_REFRESH || ""));
const TARGET_LIMIT = clampNumber(process.env.PEXELS_TARGET_LIMIT, 1, 1000, 30);
const IMAGES_PER_POST = clampNumber(process.env.PEXELS_IMAGES_PER_POST, 1, 5, 5);
const TARGET_SLUGS = new Set(String(process.env.PEXELS_TARGET_SLUGS || "")
  .split(/[\s,]+/)
  .map((slug) => slug.trim())
  .filter(Boolean));

const DESTINATION_QUERIES = [
  { terms: ["오사카", "osaka"], query: "Osaka Japan travel street" },
  { terms: ["도쿄", "tokyo"], query: "Tokyo Japan city travel" },
  { terms: ["후쿠오카", "fukuoka"], query: "Fukuoka Japan travel" },
  { terms: ["삿포로", "sapporo"], query: "Sapporo Japan travel" },
  { terms: ["교토", "kyoto"], query: "Kyoto Japan temple travel" },
  { terms: ["다낭", "da nang", "danang"], query: "Da Nang Vietnam beach travel" },
  { terms: ["호이안", "hoi an"], query: "Hoi An Vietnam travel" },
  { terms: ["나트랑", "nha trang"], query: "Nha Trang Vietnam beach travel" },
  { terms: ["하노이", "hanoi"], query: "Hanoi Vietnam travel" },
  { terms: ["호치민", "ho chi minh", "saigon"], query: "Ho Chi Minh City Vietnam travel" },
  { terms: ["방콕", "bangkok"], query: "Bangkok Thailand travel" },
  { terms: ["치앙마이", "chiang mai"], query: "Chiang Mai Thailand travel" },
  { terms: ["타이베이", "taipei"], query: "Taipei Taiwan travel" },
  { terms: ["싱가포르", "singapore"], query: "Singapore city travel" },
  { terms: ["홍콩", "hong kong"], query: "Hong Kong skyline travel" },
  { terms: ["마카오", "macau", "macao"], query: "Macau travel city" },
  { terms: ["세부", "cebu"], query: "Cebu Philippines beach travel" },
  { terms: ["보라카이", "boracay"], query: "Boracay Philippines beach travel" },
  { terms: ["발리", "bali"], query: "Bali Indonesia beach travel" },
  { terms: ["괌", "guam"], query: "Guam beach travel" },
  { terms: ["사이판", "saipan"], query: "Saipan island travel" },
  { terms: ["하와이", "hawaii"], query: "Hawaii beach travel" },
  { terms: ["파리", "paris"], query: "Paris France travel" },
  { terms: ["런던", "london"], query: "London England travel" },
  { terms: ["로마", "rome"], query: "Rome Italy travel" },
  { terms: ["바르셀로나", "barcelona"], query: "Barcelona Spain travel" },
  { terms: ["뉴욕", "new york"], query: "New York City travel" },
];

function clampNumber(value, min, max, fallback) {
  const number = Number.parseInt(value || "", 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

async function readJsonArray(path) {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function searchablePostText(post = {}) {
  return [
    post.pexelsQuery,
    post.freeImageQuery,
    post.imageQuery,
    post.title,
    post.sourceTitle,
    post.description,
    post.excerpt,
    post.region,
    post.category,
    ...(Array.isArray(post.tags) ? post.tags : []),
    ...(Array.isArray(post.keywords) ? post.keywords : []),
  ].filter(Boolean).join(" ").toLowerCase();
}

function explicitQuery(post = {}) {
  return normalizeText(post.pexelsQuery || post.freeImageQuery || post.imageQuery || "");
}

function destinationQuery(post = {}) {
  const text = searchablePostText(post);
  const found = DESTINATION_QUERIES.find((item) => item.terms.some((term) => text.includes(term.toLowerCase())));
  return found?.query || "";
}

function hasDomesticTourSource(post = {}) {
  return Boolean(post.contentid || post.tourApi || post.contentTypeId || post.contenttypeid);
}

function shouldFetchPost(post = {}, manifest = {}) {
  if (!post?.slug) return false;
  if (TARGET_SLUGS.size && !TARGET_SLUGS.has(post.slug)) return false;
  if (!REFRESH && manifest.items?.[post.slug]?.images?.length) return false;
  if (explicitQuery(post)) return true;
  if (hasDomesticTourSource(post)) return false;
  if (/해외|항공|flight|overseas/i.test(searchablePostText(post))) return true;
  return Boolean(destinationQuery(post));
}

function queryForPost(post = {}) {
  return explicitQuery(post) || destinationQuery(post) || `${normalizeText(post.sourceTitle || post.title)} travel`;
}

function bestPhotoSrc(photo = {}) {
  const src = photo.src || {};
  return src.large2x || src.large || src.landscape || src.medium || src.original || "";
}

function normalizePhoto(photo = {}, query = "") {
  const src = bestPhotoSrc(photo);
  if (!src || !photo.url) return null;
  return {
    id: `pexels-${photo.id}`,
    source: "pexels",
    provider: "Pexels",
    sourceLabel: PEXELS_SOURCE_LABEL,
    src,
    original: src,
    url: photo.url,
    alt: normalizeText(photo.alt || ""),
    caption: normalizeText(photo.alt || ""),
    photographer: normalizeText(photo.photographer || ""),
    photographerUrl: photo.photographer_url || "",
    avgColor: photo.avg_color || "",
    width: photo.width || 0,
    height: photo.height || 0,
    query,
  };
}

async function searchPexels(query) {
  const url = new URL(API_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", String(Math.max(IMAGES_PER_POST, 5)));
  url.searchParams.set("orientation", "landscape");
  if (LOCALE) url.searchParams.set("locale", LOCALE);
  const response = await fetch(url, {
    headers: {
      Authorization: API_KEY,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Pexels search failed: ${response.status}`);
  }
  const payload = await response.json();
  return Array.isArray(payload.photos) ? payload.photos : [];
}

async function writeManifest(manifest) {
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

const posts = await readJsonArray(POSTS_PATH);
const manifest = await readPexelsImageManifest(ROOT, { source: "pexels", items: {} });
manifest.source = "pexels";
manifest.sourceLabel = PEXELS_SOURCE_LABEL;
manifest.items ||= {};

if (!API_KEY) {
  await writeManifest(manifest);
  console.log("[pexels] PEXELS_API_KEY is not set; kept existing Pexels image manifest.");
  process.exit(0);
}

const targets = posts.filter((post) => shouldFetchPost(post, manifest)).slice(0, TARGET_LIMIT);
let updated = 0;

for (const post of targets) {
  const query = queryForPost(post);
  try {
    const photos = await searchPexels(query);
    const seen = new Set();
    const images = photos
      .map((photo) => normalizePhoto(photo, query))
      .filter(Boolean)
      .filter((asset) => {
        const key = asset.id || asset.src;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, IMAGES_PER_POST);
    if (!images.length) continue;
    manifest.items[post.slug] = {
      source: "pexels",
      sourceLabel: PEXELS_SOURCE_LABEL,
      query,
      updatedAt: new Date().toISOString(),
      cover: images[0],
      images,
    };
    updated += 1;
    console.log(`[pexels] ${post.slug}: ${images.length} image(s) for "${query}"`);
  } catch (error) {
    console.warn(`[pexels] ${post.slug}: ${error.message}`);
  }
}

if (updated) manifest.generatedAt = new Date().toISOString();
await writeManifest(manifest);
console.log(`[pexels] updated ${updated}/${targets.length} target post(s).`);
