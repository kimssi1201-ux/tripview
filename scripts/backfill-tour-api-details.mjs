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
const INCLUDE_IMAGES = process.env.BACKFILL_INCLUDE_IMAGES === "1";
const IMAGE_SAMPLE = process.env.BACKFILL_IMAGE_SAMPLE === "1";
const IMAGE_SAMPLE_SIZE = Math.max(20, Math.min(30, Number.parseInt(process.env.BACKFILL_IMAGE_SAMPLE_SIZE || "30", 10) || 30));
const MAX_IMAGES_PER_POST = Math.max(3, Math.min(8, Number.parseInt(process.env.BACKFILL_MAX_IMAGES_PER_POST || "8", 10) || 8));
const FETCH_TIMEOUT_MS = Math.max(1000, Number.parseInt(process.env.BACKFILL_FETCH_TIMEOUT_MS || "15000", 10) || 15000);

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

export function contentTypeId(post) {
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(buildUrl(endpoint, extra, encodedKey), { signal: controller.signal });
    } catch (error) {
      lastError = error.name === "AbortError" ? `request timed out after ${FETCH_TIMEOUT_MS}ms` : error.message;
      clearTimeout(timeout);
      continue;
    }
    clearTimeout(timeout);
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

export function imageFamilyKey(src) {
  const clean = String(src || "").split("?")[0];
  const resource = clean.match(/\/resource\/\d+\/([^/_]+)_image\d+_\d+/i);
  if (resource) return resource[1];
  return clean.toLowerCase();
}

function imageUrlFromDetail(item = {}) {
  return strip(item.originimgurl || item.smallimageurl || item.imageUrl || item.imageurl);
}

function addImage(images, seen, src, limit = MAX_IMAGES_PER_POST) {
  const value = strip(src);
  if (!value || images.length >= limit) return;
  const key = imageFamilyKey(value);
  if (seen.has(key)) return;
  seen.add(key);
  images.push(value);
}

export function mergePostImages(post, detailImages = [], limit = MAX_IMAGES_PER_POST) {
  const images = [];
  const seen = new Set();
  addImage(images, seen, post?.image, limit);
  for (const src of Array.isArray(post?.images) ? post.images : []) addImage(images, seen, src, limit);
  for (const item of detailImages) addImage(images, seen, imageUrlFromDetail(item), limit);
  return images;
}

export function sampleImageBackfillPosts(posts = [], size = IMAGE_SAMPLE_SIZE) {
  const byType = new Map();
  for (const post of posts) {
    if (!post?.contentid) continue;
    const typeId = contentTypeId(post);
    if (!byType.has(typeId)) byType.set(typeId, []);
    byType.get(typeId).push(post);
  }
  const types = [...byType.keys()].sort((a, b) => Number(a) - Number(b));
  const selected = [];
  let cursor = 0;
  while (selected.length < size && types.some((typeId) => (byType.get(typeId) || []).length > cursor)) {
    for (const typeId of types) {
      const post = byType.get(typeId)?.[cursor];
      if (post) selected.push(post);
      if (selected.length >= size) break;
    }
    cursor += 1;
  }
  return selected;
}

export function summarizeImageSampleResults(results = []) {
  const distribution = {};
  const mergedDistribution = {};
  const byType = {};
  for (const result of results) {
    const detailKey = String(result.detailCount || 0);
    const mergedKey = String(result.mergedCount || 0);
    distribution[detailKey] = (distribution[detailKey] || 0) + 1;
    mergedDistribution[mergedKey] = (mergedDistribution[mergedKey] || 0) + 1;
    const typeId = result.typeId || "unknown";
    byType[typeId] ||= { checked: 0, atLeast3: 0 };
    byType[typeId].checked += 1;
    if ((result.mergedCount || 0) >= 3) byType[typeId].atLeast3 += 1;
  }
  const atLeast3 = results.filter((result) => (result.mergedCount || 0) >= 3).length;
  return {
    checked: results.length,
    detailImageDistribution: Object.fromEntries(Object.entries(distribution).sort((a, b) => Number(a[0]) - Number(b[0]))),
    mergedImageDistribution: Object.fromEntries(Object.entries(mergedDistribution).sort((a, b) => Number(a[0]) - Number(b[0]))),
    atLeast3,
    atLeast3Ratio: results.length ? atLeast3 / results.length : 0,
    byType,
  };
}

async function fetchDetailImages(post) {
  return tourGet("detailImage2", {
    contentId: post.contentid,
    imageYN: "Y",
    subImageYN: "Y",
    numOfRows: "50",
  });
}

async function runImageSample(posts) {
  const sample = sampleImageBackfillPosts(posts, IMAGE_SAMPLE_SIZE);
  const results = [];
  for (const post of sample) {
    const typeId = contentTypeId(post);
    try {
      const detailImages = await fetchDetailImages(post);
      const merged = mergePostImages(post, detailImages, MAX_IMAGES_PER_POST);
      results.push({
        slug: post.slug,
        contentId: post.contentid,
        typeId,
        detailCount: detailImages.map(imageUrlFromDetail).filter(Boolean).length,
        mergedCount: merged.length,
      });
    } catch (error) {
      results.push({
        slug: post.slug,
        contentId: post.contentid,
        typeId,
        detailCount: 0,
        mergedCount: mergePostImages(post, [], MAX_IMAGES_PER_POST).length,
        error: error.message,
      });
    }
  }
  const summary = summarizeImageSampleResults(results);
  const percent = summary.checked ? Math.round(summary.atLeast3Ratio * 1000) / 10 : 0;
  console.log(`TourAPI detailImage2 sample complete. Checked ${summary.checked} post(s).`);
  console.log(`Detail image count distribution: ${JSON.stringify(summary.detailImageDistribution)}`);
  console.log(`Merged image count distribution: ${JSON.stringify(summary.mergedImageDistribution)}`);
  console.log(`Posts with 3+ renderable images: ${summary.atLeast3}/${summary.checked} (${percent}%).`);
  for (const [typeId, row] of Object.entries(summary.byType).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    console.log(`Type ${typeId}: ${row.atLeast3}/${row.checked} with 3+ renderable images.`);
  }
  const errors = results.filter((result) => result.error);
  if (errors.length) {
    console.log(`detailImage2 sample errors: ${errors.length}`);
    for (const item of errors.slice(0, 5)) console.log(`- ${item.slug}: ${item.error}`);
  }
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

async function main() {
  if (!SERVICE_KEY) {
    throw new Error("TRIPVIEW_API_KEY is required for TourAPI detail backfill.");
  }

  const posts = await readJson("data/generated-posts.json", []);
  if (IMAGE_SAMPLE) {
    await runImageSample(posts);
    return;
  }

  let checked = 0;
  let updated = 0;
  let imagesUpdated = 0;
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
      let images = Array.isArray(post.images) ? post.images : [];
      if (INCLUDE_IMAGES) {
        const detailImages = await fetchDetailImages(post);
        const mergedImages = mergePostImages(post, detailImages, MAX_IMAGES_PER_POST);
        if (JSON.stringify(mergedImages) !== JSON.stringify(images)) {
          images = mergedImages;
          imagesUpdated += 1;
        }
      }
      next.push({ ...post, images, info: mergeInfo(post, common, tourApi.intro), tourApi });
      updated += 1;
      console.log(`Backfilled ${post.slug}`);
    } catch (error) {
      console.warn(`Skipped ${post.slug}: ${error.message}`);
      next.push(post);
    }
  }

  await writeJson("data/generated-posts.json", next);
  console.log(`TourAPI backfill complete. Checked ${checked}, updated ${updated}.${INCLUDE_IMAGES ? ` Image sets updated ${imagesUpdated}.` : ""}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  await main();
}
