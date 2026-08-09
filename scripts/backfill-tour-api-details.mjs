import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MIN_INDEXABLE_BODY_LENGTH, postBodyLength } from "./lib/content-quality.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const API_BASE = "https://apis.data.go.kr/B551011/KorService2";
const SERVICE_KEY = process.env.TRIPVIEW_API_KEY || process.env.TRIPVIEW_API_KEY_PARAM || "";
const LIMIT = Math.max(0, Number.parseInt(process.env.BACKFILL_LIMIT || "300", 10) || 300);
const ONLY_SHORT = process.env.BACKFILL_ONLY_SHORT === "1";
const TARGETS = new Set(String(process.env.BACKFILL_TARGETS || "").split(",").map((value) => value.trim()).filter(Boolean));

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
      if (json.resultCode && json.resultCode !== "0000") {
        lastError = `${json.resultCode} ${json.resultMsg || ""}`.trim();
        continue;
      }
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
    "infocenterleports",
    "infocentertourcourse",
    "infocenterlodging",
    "infocentershopping",
    "infocenterfood",
    "restdateleports",
    "restdateshopping",
    "restdatefood",
    "usefeeleports",
    "reservation",
    "expagerangeleports",
    "checkintime",
    "checkouttime",
    "chkcooking",
    "foodplace",
    "parkinglodging",
    "pickup",
    "roomcount",
    "reservationlodging",
    "reservationurl",
    "roomtype",
    "subfacility",
    "opentime",
    "parkingshopping",
    "saleitem",
    "saleitemcost",
    "shopguide",
    "distance",
    "schedule",
    "taketime",
    "theme",
    "firstmenu",
    "opentimefood",
    "packing",
    "parkingfood",
    "reservationfood",
    "treatmenu"
  ];
  return Object.fromEntries(keys.map((key) => [key, strip(intro[key])]).filter(([, value]) => value));
}

function mergeInfo(post, common, intro) {
  const rows = [...(post.info || [])];
  const indexByKey = new Map(rows.map(([key], index) => [key, index]));
  const placeholder = /^(방문 전 (확인|문의) 필요|시설별 상이|정보 없음|-|없음)$/;
  const set = (key, value) => {
    const clean = strip(value);
    if (!clean) return;
    const index = indexByKey.get(key);
    if (index === undefined) {
      indexByKey.set(key, rows.length);
      rows.push([key, clean]);
      return;
    }
    if (!strip(rows[index][1]) || placeholder.test(strip(rows[index][1]))) rows[index][1] = clean;
  };

  set("문의", intro.infocenter || intro.infocenterculture || intro.infocenterleports || intro.infocentertourcourse || intro.infocenterlodging || intro.infocentershopping || intro.infocenterfood);
  set("운영 확인", intro.usetime || intro.usetimeculture || intro.usetimeleports || intro.opentime || intro.opentimefood);
  set("요금", intro.usefee || intro.usefeeleports || intro.usetimefestival || intro.saleitemcost);
  set("홈페이지", common.homepage);
  set("좌표", common.mapx && common.mapy ? `${common.mapy}, ${common.mapx}` : "");
  set("주차", intro.parking || intro.parkingculture || intro.parkingfestival || intro.parkingleports || intro.parkinglodging || intro.parkingshopping || intro.parkingfood);
  set("쉬는 날", intro.restdate || intro.restdateculture || intro.restdateleports || intro.restdateshopping || intro.restdatefood);
  set("체험 안내", intro.expguide || intro.expagerange || intro.expagerangeleports);
  set("반려동물", intro.chkpet || intro.chkpetculture || intro.chkpetleports || intro.chkpetshopping);
  set("체크인", intro.checkintime);
  set("체크아웃", intro.checkouttime);
  set("객실 안내", intro.roomtype || intro.roomcount);
  set("대표 메뉴", intro.firstmenu || intro.treatmenu);
  set("판매 품목", intro.saleitem || intro.shopguide);
  set("예상 시간", intro.taketime);
  set("코스 안내", intro.schedule || intro.theme);
  return rows;
}

const posts = await readJson("data/generated-posts.json", []);
let checked = 0;
let updated = 0;
const next = [];

for (const post of posts) {
  const selected = (!TARGETS.size || TARGETS.has(post.slug))
    && (!ONLY_SHORT || postBodyLength(post) < MIN_INDEXABLE_BODY_LENGTH);
  if (!selected || !post.contentid || checked >= LIMIT) {
    next.push(post);
    continue;
  }

  checked += 1;
  const typeId = contentTypeId(post);
  try {
    const common = (await tourGet("detailCommon2", { contentId: post.contentid }))[0] || {};
    const intro = (await tourGet("detailIntro2", { contentId: post.contentid, contentTypeId: typeId }))[0] || {};
    const pickedIntro = pickIntroFields(intro);
    const tourApi = {
      ...(post.tourApi || {}),
      contentTypeId: typeId,
      overview: strip(common.overview) || strip(post.tourApi?.overview),
      homepage: strip(common.homepage) || strip(post.tourApi?.homepage),
      mapx: common.mapx || post.tourApi?.mapx || "",
      mapy: common.mapy || post.tourApi?.mapy || "",
      mlevel: common.mlevel || post.tourApi?.mlevel || "",
      intro: { ...(post.tourApi?.intro || {}), ...pickedIntro },
      backfilledAt: new Date().toISOString()
    };
    next.push({ ...post, info: mergeInfo(post, common, tourApi.intro), tourApi });
    updated += 1;
    console.log(`Backfilled ${post.slug}`);
  } catch (error) {
    console.warn(`Skipped ${post.slug}: ${error.message}`);
    next.push(post);
  }
}

await writeJson("data/generated-posts.json", next);
console.log(`TourAPI backfill complete. Checked ${checked}, updated ${updated}.`);
