import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MIN_INDEXABLE_BODY_LENGTH, postBodyLength } from "./lib/content-quality.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const API_BASE = "https://apis.data.go.kr/B551011/KorService2";
const PHOTO_GALLERY_API_BASE = "https://apis.data.go.kr/B551011/PhotoGalleryService1";
const PHOTO_GALLERY_SEARCH_ENDPOINT = "gallerySearchList1";
const SERVICE_KEY = process.env.TRIPVIEW_API_KEY || process.env.TRIPVIEW_API_KEY_PARAM || "";
const PHOTO_GALLERY_SERVICE_KEY = process.env.PHOTO_GALLERY_API_KEY || process.env.PHOTO_GALLERY_API_KEY_PARAM || "";
const LIMIT = Math.max(0, Number.parseInt(process.env.BACKFILL_LIMIT || "300", 10) || 300);
const OFFSET = Math.max(0, Number.parseInt(process.env.BACKFILL_OFFSET || "0", 10) || 0);
const ONLY_SHORT = process.env.BACKFILL_ONLY_SHORT === "1";
const TARGETS = new Set(String(process.env.BACKFILL_TARGETS || "").split(",").map((value) => value.trim()).filter(Boolean));
const INCLUDE_IMAGES = process.env.BACKFILL_INCLUDE_IMAGES === "1";
const INCLUDE_PHOTO_GALLERY = process.env.BACKFILL_INCLUDE_PHOTO_GALLERY === "1";
const IMAGE_SAMPLE = process.env.BACKFILL_IMAGE_SAMPLE === "1";
const IMAGE_SAMPLE_SIZE = Math.max(20, Math.min(30, Number.parseInt(process.env.BACKFILL_IMAGE_SAMPLE_SIZE || "20", 10) || 20));
const IMAGE_SAMPLE_CONCURRENCY = Math.max(1, Math.min(6, Number.parseInt(process.env.BACKFILL_IMAGE_SAMPLE_CONCURRENCY || "5", 10) || 5));
const PHOTO_GALLERY_SAMPLE = process.env.BACKFILL_PHOTO_GALLERY_SAMPLE === "1" || process.argv.includes("--photo-gallery-sample");
const PHOTO_GALLERY_SAMPLE_SIZE = Math.max(20, Math.min(30, Number.parseInt(process.env.PHOTO_GALLERY_SAMPLE_SIZE || "30", 10) || 30));
const PHOTO_GALLERY_SAMPLE_CONCURRENCY = Math.max(1, Math.min(5, Number.parseInt(process.env.PHOTO_GALLERY_SAMPLE_CONCURRENCY || "4", 10) || 4));
const PHOTO_GALLERY_KEYWORD_LIMIT = Math.max(1, Math.min(4, Number.parseInt(process.env.PHOTO_GALLERY_KEYWORD_LIMIT || "1", 10) || 1));
const PHOTO_GALLERY_ROWS = Math.max(3, Math.min(20, Number.parseInt(process.env.PHOTO_GALLERY_ROWS || "10", 10) || 10));
const MAX_IMAGES_PER_POST = Math.max(3, Math.min(8, Number.parseInt(process.env.BACKFILL_MAX_IMAGES_PER_POST || "8", 10) || 8));
const FETCH_TIMEOUT_MS = Math.max(1000, Number.parseInt(process.env.BACKFILL_FETCH_TIMEOUT_MS || "8000", 10) || 8000);
const API_REQUEST_RETRIES = Math.max(1, Math.min(3, Number.parseInt(process.env.BACKFILL_REQUEST_RETRIES || "1", 10) || 1));
const IMAGE_BACKFILL_CAMPAIGN = process.env.BACKFILL_IMAGE_CAMPAIGN || "detail-photo-gallery-v1";
const SKIP_IMAGE_COMPLETE = process.env.BACKFILL_SKIP_IMAGE_COMPLETE !== "0";
const RETRY_IMAGE_INCOMPLETE = process.env.BACKFILL_RETRY_IMAGE_INCOMPLETE === "1";

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

function buildPhotoGalleryUrl(endpoint, extra, encodedKey) {
  const params = new URLSearchParams({ MobileOS: "ETC", MobileApp: "TripView", _type: "json", ...extra });
  const key = encodedKey ? encodeURIComponent(PHOTO_GALLERY_SERVICE_KEY) : PHOTO_GALLERY_SERVICE_KEY;
  return `${PHOTO_GALLERY_API_BASE}/${endpoint}?serviceKey=${key}&${params.toString()}`;
}

function responseItems(json) {
  const item = json.response?.body?.items?.item;
  return Array.isArray(item) ? item : item ? [item] : [];
}

function resultError(json, header = json.response?.header || json) {
  if (json.resultCode && json.resultCode !== "0000") return `${json.resultCode} ${json.resultMsg || ""}`.trim();
  if (header?.resultCode && header.resultCode !== "0000") return `${header.resultCode} ${header.resultMsg || ""}`.trim();
  return "";
}

async function requestItemsWithKeyFallback(label, build) {
  let lastError = "";
  for (const encodedKey of [false, true]) {
    for (let attempt = 0; attempt <= API_REQUEST_RETRIES; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(build(encodedKey), { signal: controller.signal });
        const text = await res.text();
        try {
          const json = JSON.parse(text);
          const error = resultError(json);
          if (error) {
            lastError = error;
            break;
          }
          return responseItems(json);
        } catch {
          lastError = text.slice(0, 120);
          break;
        }
      } catch (error) {
        lastError = error.name === "AbortError" ? `request timed out after ${FETCH_TIMEOUT_MS}ms` : error.message;
        if (attempt < API_REQUEST_RETRIES) continue;
      } finally {
        clearTimeout(timeout);
      }
    }
  }
  throw new Error(`${label} request failed: ${lastError}`);
}

async function tourGet(endpoint, extra = {}) {
  return requestItemsWithKeyFallback("TourAPI", (encodedKey) => buildUrl(endpoint, extra, encodedKey));
}

async function photoGalleryGet(endpoint, extra = {}) {
  return requestItemsWithKeyFallback("PhotoGalleryService1", (encodedKey) => buildPhotoGalleryUrl(endpoint, extra, encodedKey));
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

export function photoGalleryImageUrl(item = {}) {
  return strip(item.galWebImageUrl || item.galWebImageURL || item.galwebimageurl || item.galWebImgUrl || "");
}

function photoGalleryDetailImages(items = []) {
  return items.map((item) => ({ originimgurl: photoGalleryImageUrl(item) })).filter((item) => item.originimgurl);
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

export function existingMergedImageCount(post, limit = MAX_IMAGES_PER_POST) {
  return mergePostImages(post, [], limit).length;
}

function imageBackfillAttempt(post) {
  const attempt = post?.tourApi?.imageBackfill;
  return attempt && attempt.campaign === IMAGE_BACKFILL_CAMPAIGN ? attempt : null;
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

function textTokens(value = "") {
  return strip(value)
    .replace(/[()[\]{}"'“”‘’·:|/\\_-]/g, " ")
    .split(/\s+/)
    .map((token) => token.replace(/(?:특별자치도|특별자치시|특별시|광역시|자치구|시|군|구|읍|면|동|리)$/u, ""))
    .filter((token) => /^[가-힣A-Za-z0-9]{2,}$/u.test(token));
}

function uniqueStrings(values = []) {
  const seen = new Set();
  const next = [];
  for (const value of values.map(strip).filter(Boolean)) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(value);
  }
  return next;
}

export function photoGalleryKeywordsForPost(post = {}) {
  const title = strip(post.sourceTitle || post.title || "")
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const region = strip(post.region || post.city || "").split(/[,\s>·/]+/)[0] || "";
  const tokens = textTokens(title).filter((token) => !["여행", "가이드", "정리", "추천", "방문", "예약", "비교"].includes(token));
  return uniqueStrings([
    title,
    region && title && !title.includes(region) ? `${region} ${title}` : "",
    tokens[0] || "",
    region && tokens[0] ? `${region} ${tokens[0]}` : "",
    region,
  ]).slice(0, 4);
}

function galleryItemText(item = {}) {
  return strip([
    item.galTitle,
    item.galPhotographyLocation,
    item.galSearchKeyword,
    item.galContentTypeId,
  ].filter(Boolean).join(" "));
}

export function isRelevantPhotoGalleryItem(post = {}, item = {}) {
  const haystack = galleryItemText(item);
  if (!haystack || !photoGalleryImageUrl(item)) return false;
  const region = strip(post.region || post.city || "").split(/[,\s>·/]+/)[0] || "";
  if (region && haystack.includes(region.replace(/(?:특별자치도|특별자치시|특별시|광역시)$/u, ""))) return true;
  const titleTokens = textTokens(post.sourceTitle || post.title || "").filter((token) => token.length >= 3);
  return titleTokens.some((token) => haystack.includes(token));
}

export function summarizePhotoGallerySampleResults(results = []) {
  const distributions = { raw: {}, matched: {}, merged: {} };
  const byType = {};
  for (const result of results) {
    const rawKey = String(result.rawCount || 0);
    const matchedKey = String(result.matchedCount || 0);
    const mergedKey = String(result.mergedCount || 0);
    distributions.raw[rawKey] = (distributions.raw[rawKey] || 0) + 1;
    distributions.matched[matchedKey] = (distributions.matched[matchedKey] || 0) + 1;
    distributions.merged[mergedKey] = (distributions.merged[mergedKey] || 0) + 1;
    const typeId = result.typeId || "unknown";
    byType[typeId] ||= { checked: 0, success: 0, anyMatched: 0, atLeast3: 0 };
    byType[typeId].checked += 1;
    if (!result.error) byType[typeId].success += 1;
    if ((result.matchedCount || 0) > 0) byType[typeId].anyMatched += 1;
    if ((result.mergedCount || 0) >= 3) byType[typeId].atLeast3 += 1;
  }
  const success = results.filter((result) => !result.error).length;
  const anyMatched = results.filter((result) => (result.matchedCount || 0) > 0).length;
  const atLeast3 = results.filter((result) => (result.mergedCount || 0) >= 3).length;
  const sortEntries = (value) => Object.fromEntries(Object.entries(value).sort((a, b) => Number(a[0]) - Number(b[0])));
  return {
    checked: results.length,
    success,
    anyMatched,
    atLeast3,
    atLeast3Ratio: results.length ? atLeast3 / results.length : 0,
    rawImageDistribution: sortEntries(distributions.raw),
    matchedImageDistribution: sortEntries(distributions.matched),
    mergedImageDistribution: sortEntries(distributions.merged),
    byType,
  };
}

async function fetchDetailImages(post) {
  return tourGet("detailImage2", {
    contentId: post.contentid,
    imageYN: "Y",
    numOfRows: "50",
  });
}

async function fetchPhotoGalleryImages(post) {
  const seen = new Set();
  const items = [];
  const errors = [];
  let successCount = 0;
  for (const keyword of photoGalleryKeywordsForPost(post).slice(0, PHOTO_GALLERY_KEYWORD_LIMIT)) {
    let rows = [];
    try {
      rows = await photoGalleryGet(PHOTO_GALLERY_SEARCH_ENDPOINT, {
        keyword,
        pageNo: "1",
        numOfRows: String(PHOTO_GALLERY_ROWS),
      });
      successCount += 1;
    } catch (error) {
      errors.push(`${keyword}: ${error.message}`);
      continue;
    }
    for (const item of rows) {
      const src = photoGalleryImageUrl(item);
      if (!src || seen.has(src)) continue;
      seen.add(src);
      items.push(item);
    }
  }
  if (!successCount && errors.length) throw new Error(errors[0]);
  return items;
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function runImageSample(posts) {
  const sample = sampleImageBackfillPosts(posts, IMAGE_SAMPLE_SIZE);
  const results = await mapLimit(sample, IMAGE_SAMPLE_CONCURRENCY, async (post) => {
    const typeId = contentTypeId(post);
    try {
      const detailImages = await fetchDetailImages(post);
      const merged = mergePostImages(post, detailImages, MAX_IMAGES_PER_POST);
      return {
        slug: post.slug,
        contentId: post.contentid,
        typeId,
        detailCount: detailImages.map(imageUrlFromDetail).filter(Boolean).length,
        mergedCount: merged.length,
      };
    } catch (error) {
      return {
        slug: post.slug,
        contentId: post.contentid,
        typeId,
        detailCount: 0,
        mergedCount: mergePostImages(post, [], MAX_IMAGES_PER_POST).length,
        error: error.message,
      };
    }
  });
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

async function runPhotoGallerySample(posts) {
  if (!PHOTO_GALLERY_SERVICE_KEY) {
    throw new Error("PHOTO_GALLERY_API_KEY is required for PhotoGalleryService1 sample. Add it as a GitHub Actions secret.");
  }
  const sample = sampleImageBackfillPosts(posts, PHOTO_GALLERY_SAMPLE_SIZE);
  const results = await mapLimit(sample, PHOTO_GALLERY_SAMPLE_CONCURRENCY, async (post) => {
    const typeId = contentTypeId(post);
    try {
      const galleryItems = await fetchPhotoGalleryImages(post);
      const matchedItems = galleryItems.filter((item) => isRelevantPhotoGalleryItem(post, item));
      const merged = mergePostImages(
        post,
        matchedItems.map((item) => ({ originimgurl: photoGalleryImageUrl(item) })),
        MAX_IMAGES_PER_POST,
      );
      return {
        slug: post.slug,
        contentId: post.contentid,
        typeId,
        keywordCount: photoGalleryKeywordsForPost(post).length,
        rawCount: galleryItems.map(photoGalleryImageUrl).filter(Boolean).length,
        matchedCount: matchedItems.length,
        mergedCount: merged.length,
      };
    } catch (error) {
      return {
        slug: post.slug,
        contentId: post.contentid,
        typeId,
        keywordCount: photoGalleryKeywordsForPost(post).length,
        rawCount: 0,
        matchedCount: 0,
        mergedCount: mergePostImages(post, [], MAX_IMAGES_PER_POST).length,
        error: error.message,
      };
    }
  });
  const summary = summarizePhotoGallerySampleResults(results);
  const percent = summary.checked ? Math.round(summary.atLeast3Ratio * 1000) / 10 : 0;
  console.log(`PhotoGalleryService1 ${PHOTO_GALLERY_SEARCH_ENDPOINT} sample complete. Checked ${summary.checked} post(s).`);
  console.log(`Successful post checks: ${summary.success}/${summary.checked}.`);
  console.log(`Raw gallery image distribution: ${JSON.stringify(summary.rawImageDistribution)}`);
  console.log(`Matched gallery image distribution: ${JSON.stringify(summary.matchedImageDistribution)}`);
  console.log(`Merged image count distribution: ${JSON.stringify(summary.mergedImageDistribution)}`);
  console.log(`Posts with 3+ renderable images: ${summary.atLeast3}/${summary.checked} (${percent}%).`);
  for (const [typeId, row] of Object.entries(summary.byType).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    console.log(`Type ${typeId}: ${row.anyMatched}/${row.checked} with matched PhotoGallery image, ${row.atLeast3}/${row.checked} with 3+ renderable images.`);
  }
  const errors = results.filter((result) => result.error);
  if (errors.length) {
    console.log(`PhotoGalleryService1 sample errors: ${errors.length}`);
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
  const posts = await readJson("data/generated-posts.json", []);
  if (PHOTO_GALLERY_SAMPLE) {
    await runPhotoGallerySample(posts);
    return;
  }

  if (!SERVICE_KEY) {
    throw new Error("TRIPVIEW_API_KEY is required for TourAPI detail backfill.");
  }

  if (IMAGE_SAMPLE) {
    await runImageSample(posts);
    return;
  }

  let checked = 0;
  let eligibleSeen = 0;
  let updated = 0;
  let imagesUpdated = 0;
  let imageChecked = 0;
  let imagesAtLeast3 = 0;
  let photoGalleryChecked = 0;
  let photoGalleryMatched = 0;
  let photoGalleryErrors = 0;
  let skippedImageComplete = 0;
  let skippedImageAttempted = 0;
  let photoGalleryMissingKeyWarned = false;
  const next = [];

  for (const post of posts) {
    const selected = (!TARGETS.size || TARGETS.has(post.slug))
      && (!ONLY_SHORT || postBodyLength(post) < MIN_INDEXABLE_BODY_LENGTH);
    if (!selected || !post.contentid) {
      next.push(post);
      continue;
    }
    if (INCLUDE_IMAGES && SKIP_IMAGE_COMPLETE && !TARGETS.size) {
      if (existingMergedImageCount(post) >= 3) {
        skippedImageComplete += 1;
        next.push(post);
        continue;
      }
      if (!RETRY_IMAGE_INCOMPLETE && imageBackfillAttempt(post)) {
        skippedImageAttempted += 1;
        next.push(post);
        continue;
      }
    }
    if (eligibleSeen < OFFSET) {
      eligibleSeen += 1;
      next.push(post);
      continue;
    }
    eligibleSeen += 1;
    if (checked >= LIMIT) {
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
        const combinedImages = [...detailImages];
        let photoGalleryMatchedForPost = 0;
        if (INCLUDE_PHOTO_GALLERY) {
          if (PHOTO_GALLERY_SERVICE_KEY) {
            photoGalleryChecked += 1;
            try {
              const galleryItems = await fetchPhotoGalleryImages(post);
              const matchedItems = galleryItems.filter((item) => isRelevantPhotoGalleryItem(post, item));
              photoGalleryMatchedForPost = matchedItems.length;
              photoGalleryMatched += matchedItems.length;
              combinedImages.push(...photoGalleryDetailImages(matchedItems));
            } catch (error) {
              photoGalleryErrors += 1;
              console.warn(`PhotoGallery skipped ${post.slug}: ${error.message}`);
            }
          } else if (!photoGalleryMissingKeyWarned) {
            console.warn("PhotoGallery image backfill skipped because PHOTO_GALLERY_API_KEY is not set.");
            photoGalleryMissingKeyWarned = true;
          }
        }
        const mergedImages = mergePostImages(post, combinedImages, MAX_IMAGES_PER_POST);
        imageChecked += 1;
        if (mergedImages.length >= 3) imagesAtLeast3 += 1;
        if (JSON.stringify(mergedImages) !== JSON.stringify(images)) {
          images = mergedImages;
          imagesUpdated += 1;
        }
        tourApi.imageBackfill = {
          campaign: IMAGE_BACKFILL_CAMPAIGN,
          attemptedAt: tourApi.backfilledAt,
          completed: mergedImages.length >= 3,
          imageCount: mergedImages.length,
          detailImageCount: detailImages.length,
          photoGalleryMatchedCount: photoGalleryMatchedForPost
        };
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
  const imageSummary = INCLUDE_IMAGES
    ? ` Image sets updated ${imagesUpdated}. Posts with 3+ images after merge ${imagesAtLeast3}/${imageChecked} (${imageChecked ? Math.round((imagesAtLeast3 / imageChecked) * 1000) / 10 : 0}%).`
    : "";
  const imageSkipSummary = INCLUDE_IMAGES
    ? ` Image backfill skipped complete ${skippedImageComplete}, already attempted ${skippedImageAttempted}.`
    : "";
  const photoGallerySummary = INCLUDE_IMAGES && INCLUDE_PHOTO_GALLERY
    ? PHOTO_GALLERY_SERVICE_KEY
      ? ` PhotoGallery checked ${photoGalleryChecked}, matched images ${photoGalleryMatched}, errors ${photoGalleryErrors}.`
      : " PhotoGallery skipped because PHOTO_GALLERY_API_KEY is not set."
    : "";
  console.log(`TourAPI backfill complete. Offset ${OFFSET}, checked ${checked}, updated ${updated}.${imageSummary}${imageSkipSummary}${photoGallerySummary}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  await main();
}
