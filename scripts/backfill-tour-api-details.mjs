import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const API_BASE = "https://apis.data.go.kr/B551011/KorService2";
const SERVICE_KEY = process.env.TRIPVIEW_API_KEY || process.env.TRIPVIEW_API_KEY_PARAM || "";
const LIMIT = Math.max(0, Number.parseInt(process.env.BACKFILL_LIMIT || "300", 10) || 300);

if (!SERVICE_KEY) {
  throw new Error("TRIPVIEW_API_KEY is required for TourAPI detail backfill.");
}

const strip = (value = "") =>
  String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(path.join(ROOT, file), "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await fs.writeFile(path.join(ROOT, file), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function contentTypeId(post) {
  if (post.tourApi?.contentTypeId) return String(post.tourApi.contentTypeId);
  if (String(post.slug || "").startsWith("festival-") || post.category === "공연/축제") return "15";
  return "12";
}

function buildUrl(endpoint, extra, encodedKey) {
  const params = new URLSearchParams({ MobileOS: "ETC", MobileApp: "TripView", _type: "json", ...extra });
  const key = encodedKey ? encodeURIComponent(SERVICE_KEY) : SERVICE_KEY;
  return `${API_BASE}/${endpoint}?serviceKey=${key}&${params.toString()}`;
}

async function tourGet(endpoint, extra = {}) {
  let lastError = "";
  for (const encodedKey of [false, true]) {
    const res = await fetch(buildUrl(endpoint, extra, encodedKey));
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      const header = json.response?.header;
      if (header && header.resultCode && header.resultCode !== "0000") {
        lastError = `${header.resultCode} ${header.resultMsg || ""}`.trim();
        continue;
      }
      const item = json.response?.body?.items?.item;
      return Array.isArray(item) ? item : item ? [item] : [];
    } catch {
      lastError = text.slice(0, 120);
    }
  }
  throw new Error(`TourAPI request failed: ${lastError}`);
}

function pickIntroFields(intro = {}) {
  const keys = [
    "eventstartdate",
    "eventenddate",
    "eventplace",
    "playtime",
    "program",
    "subevent",
    "usetimefestival",
    "sponsor1",
    "sponsor1tel",
    "sponsor2",
    "sponsor2tel",
    "parking",
    "parkingculture",
    "parkingfestival",
    "parkingleports",
    "restdate",
    "restdateculture",
    "usetime",
    "usetimeculture",
    "usetimeleports",
    "usefee",
    "expguide",
    "expagerange",
    "chkpet",
    "infocenter",
    "infocenterculture",
    "infocenterleports"
  ];
  return Object.fromEntries(keys.map((key) => [key, strip(intro[key])]).filter(([, value]) => value));
}

function mergeInfo(post, common, intro) {
  const rows = [...(post.info || [])];
  const existing = new Set(rows.map(([key]) => key));
  const add = (key, value) => {
    const clean = strip(value);
    if (!clean || existing.has(key)) return;
    existing.add(key);
    rows.push([key, clean]);
  };

  add("홈페이지", common.homepage);
  add("좌표", common.mapx && common.mapy ? `${common.mapy}, ${common.mapx}` : "");
  add("주차", intro.parking || intro.parkingculture || intro.parkingfestival || intro.parkingleports);
  add("쉬는 날", intro.restdate || intro.restdateculture);
  add("체험 안내", intro.expguide || intro.expagerange);
  add("반려동물", intro.chkpet);
  return rows;
}

const posts = await readJson("data/generated-posts.json", []);
let checked = 0;
let updated = 0;
const next = [];

for (const post of posts) {
  if (!post.contentid || checked >= LIMIT) {
    next.push(post);
    continue;
  }

  checked += 1;
  const typeId = contentTypeId(post);
  try {
    const common = (await tourGet("detailCommon2", {
      contentId: post.contentid,
      contentTypeId: typeId,
      defaultYN: "Y",
      firstImageYN: "Y",
      addrinfoYN: "Y",
      overviewYN: "Y",
      mapinfoYN: "Y",
      areacodeYN: "Y"
    }))[0] || {};
    const intro = (await tourGet("detailIntro2", { contentId: post.contentid, contentTypeId: typeId }))[0] || {};
    const tourApi = {
      contentTypeId: typeId,
      overview: strip(common.overview),
      homepage: strip(common.homepage),
      mapx: common.mapx || "",
      mapy: common.mapy || "",
      mlevel: common.mlevel || "",
      intro: pickIntroFields(intro),
      backfilledAt: new Date().toISOString()
    };
    next.push({ ...post, info: mergeInfo(post, common, intro), tourApi });
    updated += 1;
    console.log(`Backfilled ${post.slug}`);
  } catch (error) {
    console.warn(`Skipped ${post.slug}: ${error.message}`);
    next.push(post);
  }
}

await writeJson("data/generated-posts.json", next);
console.log(`TourAPI backfill complete. Checked ${checked}, updated ${updated}.`);
