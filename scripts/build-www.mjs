import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { affiliateProductImage, selectAffiliateProducts } from "./lib/affiliate-matching.mjs";
import { isIndexablePost } from "./lib/content-quality.mjs";
import { PRETENDARD_LINK, SITE_CSS, siteFooter, siteHeader, siteNavScript } from "./lib/site-design.mjs";
import {
  TOUR_IMAGE_SOURCE_LABEL,
  isTourApiImage,
  postImageWithProcessed,
  postImagesWithProcessed,
  readTourImageManifest,
  tourImageAlt,
  tourImageAssetForSource,
  tourImageBannerAssetForPost,
  tourImageCaption,
  tourImageEntry,
} from "./lib/tour-image-assets.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "www");
const siteDir = join(root, "site");
const baseUrl = "https://tripview.kr";
const NAVER_VERIFICATION_META = '<meta name="naver-site-verification" content="38616b4b4209994ed384d0d2439bddcbec2cc711" />';
const ADSENSE_SCRIPT = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5751319666030430" crossorigin="anonymous"></script>';
const LANGUAGE_SWITCH = "";
const I18N_SCRIPT = "";
const TOPIC_FILTER_SCRIPT = '<script src="/assets/topic-filter.js?v=topic-filter-20260712-no-hero" defer></script>';
const LANGUAGE_SWITCH_CSS = "";
const FLIGHT_BOOKING_URL = "https://flights.myrealtrip.com/";
const ARTICLE_NAVIGATION = '<nav class="links" aria-label="주요 메뉴"><a href="/">홈</a><a href="/travel/">여행지</a><a href="/festival/">축제</a><a href="/stay/">숙소</a><a href="/ticket/">입장권·투어</a></nav>';
const CATEGORY_PAGES = [
  { path: "/travel/", title: "여행지", description: "물놀이·계곡, 실내여행, 아이와, 이번 주말 글을 태그로 묶어 국내 여행지를 탐색합니다." },
  { path: "/festival/", title: "축제", description: "전국 축제와 행사를 지역, 일정, 방문 전 확인 포인트 중심으로 모았습니다." },
  { path: "/stay/", title: "숙소", description: "지역별 숙소, 숙소 가격 비교, 숙소 상세 리뷰를 한곳에서 확인합니다." },
  { path: "/ticket/", title: "입장권·투어", description: "지역별 입장권 가격 모음과 여행지별 체험·투어 상품을 분리해 확인합니다." },
];
const BOOKING_CITY_ORDER = ["제주", "부산", "강원", "여수", "경주", "속초", "서울", "경기", "전남"];
const BOOKING_CONDITIONS = {
  stay: [
    { label: "가족 여행", point: "객실 인원과 조식", description: "객실 정원, 침대 구성, 조식 포함 여부를 먼저 확인합니다." },
    { label: "커플 여행", point: "위치와 뷰", description: "이동 동선, 주변 식당, 객실 전망 조건을 비교합니다." },
    { label: "출장", point: "체크인 시간과 접근성", description: "늦은 체크인, 역·공항 접근성, 업무 동선을 함께 봅니다." },
  ],
  ticket: [
    { label: "입장권", point: "운영 시간과 매표 마감", description: "입장 가능 시간, 현장 매표 마감, 재입장 조건을 확인합니다." },
    { label: "현지투어", point: "집결지와 포함 사항", description: "집결 장소, 포함·불포함 항목, 취소 조건을 비교합니다." },
    { label: "체험", point: "소요 시간과 준비물", description: "체험 시간, 준비물, 연령 제한을 예약 전에 확인합니다." },
    { label: "교통·패스", point: "이용 범위와 수령 방법", description: "사용 가능 구간, 수령 위치, 모바일 바우처 여부를 봅니다." },
  ],
};
const REGION_SLUGS = new Map([
  ["서울", "seoul"],
  ["경기", "gyeonggi"],
  ["인천", "incheon"],
  ["강원", "gangwon"],
  ["대전", "daejeon"],
  ["세종", "sejong"],
  ["충북", "chungbuk"],
  ["충남", "chungnam"],
  ["광주", "gwangju"],
  ["전북", "jeonbuk"],
  ["전남", "jeonnam"],
  ["대구", "daegu"],
  ["부산", "busan"],
  ["울산", "ulsan"],
  ["경북", "gyeongbuk"],
  ["경남", "gyeongnam"],
  ["제주", "jeju"],
  ["기타", "other"],
]);

async function readJson(relativePath, fallback = []) {
  try {
    return JSON.parse(await readFile(join(root, relativePath), "utf8"));
  } catch {
    return fallback;
  }
}

async function readLegacyRendererPosts() {
  try {
    const source = await readFile(join(root, "assets/article-renderer.js"), "utf8");
    const match = source.match(/const POSTS = (\{[\s\S]*?\});\s*const slug/);
    if (!match) return {};
    const parsed = Function(`"use strict"; return (${match[1]});`)();
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dateText(date) {
  return date.toISOString().slice(0, 10);
}

function todayInKorea(reference = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(reference);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
}

function defaultStayWindow(reference = new Date()) {
  const today = todayInKorea(reference);
  const day = today.getUTCDay();
  let daysUntilFriday = (5 - day + 7) % 7;
  if (daysUntilFriday === 0) daysUntilFriday = 7;
  const checkInDate = addDays(today, daysUntilFriday);
  return {
    checkIn: dateText(checkInDate),
    checkOut: dateText(addDays(checkInDate, 2)),
    adultCount: 2,
    childCount: 0,
  };
}

const ACCOMMODATION_STAY = defaultStayWindow();
const CONTENT_TODAY = dateText(todayInKorea());

const generatedPosts = await readJson("data/generated-posts.json");
const legacyPosts = await readJson("data/posts.json");
const posts = generatedPosts.length ? generatedPosts : legacyPosts;
const indexablePosts = posts.filter(isIndexablePost);
const flightDeals = await readJson("data/myrealtrip-flight-deals.json");
const accommodationCache = await readJson("data/myrealtrip-accommodation-cache.json", null);
const accommodationProducts = accommodationProductsFromCache(accommodationCache);
const tnaProducts = await readJson("data/myrealtrip-tna-products.json");
const legacyRendererPosts = await readLegacyRendererPosts();
const processedTourImages = await readTourImageManifest(root);

const files = [
  "index.html",
  "about.html",
  "contact.html",
  "editorial-team.html",
  "editorial-policy.html",
  "affiliate-disclosure.html",
  "style.css",
  "main.js",
  "privacy.html",
  "terms.html",
  "manifest.webmanifest",
  "package.json",
  "README.md",
  "_headers",
  "_redirects",
  "robots.txt",
  "sitemap.xml",
  "feed.xml",
  "rss.xml",
  "ads.txt",
  "flight-deals",
  "travel",
  "festival",
  "stay",
  "ticket",
  "region"
];

function xml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function postUrl(post) {
  return `${baseUrl}/${encodeURIComponent(post.slug)}/`;
}

function flightSlug(deal) {
  return String(deal?.id || deal?.title || "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "") || "flight-deal";
}

function flightUrl(deal) {
  return `${baseUrl}/flight-deals/${encodeURIComponent(flightSlug(deal))}/`;
}

function flightPath(deal) {
  return `/flight-deals/${encodeURIComponent(flightSlug(deal))}/`;
}

function publicFlightUrl(deal) {
  return html(flightPath(deal));
}

function flightBookingUrl(deal) {
  return deal?.bookingUrl || FLIGHT_BOOKING_URL;
}

function postDate(post) {
  return post.updatedAt || post.sortDate || post.date || new Date().toISOString().slice(0, 10);
}

function postExcerpt(post) {
  return post.excerpt || post.description || "";
}

function html(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeText(value = "") {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function compactRegion(value = "") {
  const text = normalizeText(value);
  if (!text) return "기타";
  if (text.includes("서울")) return "서울";
  if (text.includes("경기")) return "경기";
  if (text.includes("인천")) return "인천";
  if (text.includes("강원")) return "강원";
  if (text.includes("대전")) return "대전";
  if (text.includes("세종")) return "세종";
  if (text.includes("충청북도") || text.includes("충북")) return "충북";
  if (text.includes("충청남도") || text.includes("충남")) return "충남";
  if (text.includes("광주")) return "광주";
  if (text.includes("전북") || text.includes("전라북도")) return "전북";
  if (text.includes("전남") || text.includes("전라남도")) return "전남";
  if (text.includes("대구")) return "대구";
  if (text.includes("부산")) return "부산";
  if (text.includes("울산")) return "울산";
  if (text.includes("경상북도") || text.includes("경북")) return "경북";
  if (text.includes("경상남도") || text.includes("경남")) return "경남";
  if (text.includes("제주")) return "제주";
  return text.split(/\s+/)[0] || "기타";
}

function fallbackSlug(value = "") {
  const text = normalizeText(value)
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return text || "other";
}

function regionSlug(region) {
  const label = compactRegion(region);
  return REGION_SLUGS.get(label) || fallbackSlug(label);
}

function detailedRegionLabel(value = "") {
  const token = normalizeText(value)
    .split(/\s+/)
    .filter(Boolean)
    .pop()
    ?.replace(/(?:특별자치시|특별시|광역시|자치구|시|군|구|읍|면)$/u, "") || "";
  const label = compactRegion(value);
  if (REGION_SLUGS.has(token) && token !== label) return "";
  return token && token !== label ? token : "";
}

function regionPath(region) {
  return `/region/${regionSlug(region)}/`;
}

function isFestivalPost(post) {
  const text = [post?.category, post?.title, post?.sourceTitle, post?.description, post?.excerpt]
    .filter(Boolean)
    .join(" ");
  return post?.category === "공연/축제" || /축제|행사|페스티벌|공연|콘서트/.test(text);
}

function contentTypeOf(post) {
  return String(post?.tourApi?.contentTypeId || post?.contentTypeId || post?.contenttypeid || post?.contentType || "");
}

function searchablePostText(post) {
  return [
    post?.title,
    post?.sourceTitle,
    post?.description,
    post?.excerpt,
    post?.category,
    post?.region,
    ...(Array.isArray(post?.memo) ? post.memo : []),
    ...(Array.isArray(post?.info) ? post.info.flat() : []),
  ].filter(Boolean).join(" ");
}

function hasKeyword(post, keywords) {
  const text = searchablePostText(post);
  return keywords.some((keyword) => text.includes(keyword));
}

function infoValue(post, label) {
  const rows = Array.isArray(post?.info) ? post.info : [];
  const found = rows.find((row) => Array.isArray(row) && normalizeText(row[0]) === label);
  return normalizeText(found?.[1] || "");
}

function isoDate(year, month, day) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function extractScheduleDates(value = "") {
  const text = normalizeText(value);
  const dates = [];
  for (const match of text.matchAll(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/g)) {
    dates.push(isoDate(match[1], match[2], match[3]));
  }
  if (dates.length > 1) return dates;
  const sameYearRange = text.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})(?:일)?\s*(?:~|-|부터|–|—)\s*(?:(\d{1,2})\D+)?(\d{1,2})/);
  if (sameYearRange) {
    const [, year, month, day, endMonth, endDay] = sameYearRange;
    return [isoDate(year, month, day), isoDate(year, endMonth || month, endDay)];
  }
  if (dates.length) return dates;
  return [...text.matchAll(/(\d{4})(\d{2})(\d{2})/g)].map((match) => isoDate(match[1], match[2], match[3]));
}

function festivalSchedule(post) {
  const intro = post?.tourApi?.intro || {};
  const period = infoValue(post, "기간");
  const startRaw = normalizeText(intro.eventstartdate || "");
  const endRaw = normalizeText(intro.eventenddate || "");
  const dates = extractScheduleDates(period || `${startRaw} ${endRaw}`);
  const start = dates[0] || "";
  const end = dates[1] || dates[0] || "";
  return { start, end, label: period || [start, end].filter(Boolean).join("~") };
}

function festivalStatus(post) {
  if (!isFestivalPost(post)) return { state: "", ended: false, ongoing: false, upcoming: false };
  const { start, end } = festivalSchedule(post);
  const lastDay = end || start;
  if (lastDay && lastDay < CONTENT_TODAY) return { state: "ended", ended: true, ongoing: false, upcoming: false };
  if (start && start <= CONTENT_TODAY && (!lastDay || lastDay >= CONTENT_TODAY)) {
    return { state: "ongoing", ended: false, ongoing: true, upcoming: false };
  }
  if (start && start > CONTENT_TODAY) return { state: "upcoming", ended: false, ongoing: false, upcoming: true };
  return { state: "", ended: false, ongoing: false, upcoming: false };
}

function festivalCardStatus(post) {
  return festivalStatus(post).ended ? "종료" : "";
}

function festivalSortRank(post) {
  const status = festivalStatus(post);
  if (status.ongoing) return 0;
  if (status.upcoming) return 1;
  if (status.ended) return 2;
  return 3;
}

function festivalSortDate(post) {
  const { start, end } = festivalSchedule(post);
  return end || start || postDate(post);
}

function postTitle(post) {
  return normalizeText(post?.title || post?.sourceTitle || "여행 글");
}

function placeName(post) {
  return normalizeText(post?.sourceTitle || post?.title || "")
    .replace(/\[[^\]]+\]/g, (match) => match.slice(1, -1))
    .replace(/\s*\d{4}.*$/g, "")
    .replace(/\s*(?:방문|운영정보|관람 정보|입장 정보).*$/g, "")
    .trim() || postTitle(post);
}

function lodgingPlaceName(post) {
  return placeName(post)
    .replace(/,\s*체크인[\s\S]*$/g, "")
    .replace(/\s*체크인[\s\S]*$/g, "")
    .replace(/^(?:서울|부산|인천|대구|대전|광주|울산|세종|제주|강원|경기|충북|충남|전북|전남|경북|경남)(?:특별시|광역시|특별자치시|특별자치도|도)?\s*/g, "")
    .replace(/^[가-힣]+(?:시|군|구)\s+/g, "")
    .trim() || placeName(post);
}

function postSummary(post, length = 92) {
  const value = normalizeText(post?.excerpt || post?.description || "");
  return value.length > length ? `${value.slice(0, length)}...` : value;
}

function postImage(post) {
  return postImageWithProcessed(processedTourImages, post);
}

function regionCardImage(post) {
  return tourImageEntry(processedTourImages, post)?.cover?.src || "";
}

function sortedPosts(items) {
  return [...items].sort((a, b) => {
    const aEndedFestival = isFestivalPost(a) && festivalStatus(a).ended;
    const bEndedFestival = isFestivalPost(b) && festivalStatus(b).ended;
    if (aEndedFestival !== bEndedFestival) return aEndedFestival ? 1 : -1;
    if (isFestivalPost(a) && isFestivalPost(b)) {
      const rankDiff = festivalSortRank(a) - festivalSortRank(b);
      if (rankDiff) return rankDiff;
      const aDate = festivalSortDate(a);
      const bDate = festivalSortDate(b);
      if (festivalStatus(a).ended && festivalStatus(b).ended) return String(bDate).localeCompare(String(aDate));
      return String(aDate).localeCompare(String(bDate));
    }
    return String(b.sortDate || b.updatedAt || "").localeCompare(String(a.sortDate || a.updatedAt || ""));
  });
}

function regionGroups() {
  const groups = new Map();
  for (const post of indexablePosts) {
    const label = compactRegion(post?.region);
    const slug = regionSlug(label);
    if (!groups.has(slug)) groups.set(slug, { label, slug, posts: [] });
    groups.get(slug).posts.push(post);
  }
  return [...groups.values()]
    .map((group) => ({ ...group, posts: sortedPosts(group.posts) }))
    .sort((a, b) => a.label.localeCompare(b.label, "ko"));
}

function stripAccommodationStayParams(rawUrl = "") {
  try {
    const url = new URL(String(rawUrl));
    if (url.hostname.toLowerCase() !== "accommodation.myrealtrip.com") return String(rawUrl || "");
    for (const key of ["checkIn", "checkOut", "adultCount", "childCount", "childAges"]) {
      url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return String(rawUrl || "");
  }
}

function safeMyRealTripUrl(rawUrl = "") {
  try {
    const url = new URL(String(rawUrl || ""));
    return url.protocol === "https:" && (url.hostname === "myrealtrip.com" || url.hostname.endsWith(".myrealtrip.com"))
      ? url
      : null;
  } catch {
    return null;
  }
}

function accommodationUrl(rawUrl = "") {
  const url = safeMyRealTripUrl(rawUrl);
  if (!url) return "";
  if (url.hostname.toLowerCase() === "accommodation.myrealtrip.com") {
    url.searchParams.set("checkIn", ACCOMMODATION_STAY.checkIn);
    url.searchParams.set("checkOut", ACCOMMODATION_STAY.checkOut);
    url.searchParams.set("adultCount", String(ACCOMMODATION_STAY.adultCount));
    url.searchParams.set("childCount", String(ACCOMMODATION_STAY.childCount));
    url.searchParams.set("childAges", "");
  }
  return url.toString();
}

function numericValue(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const number = Number(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function won(value) {
  const number = numericValue(value);
  return number > 0 ? `${number.toLocaleString("ko-KR")}원` : "";
}

function starNumber(value) {
  const text = normalizeText(value).toLowerCase();
  if (/five|5/.test(text)) return 5;
  if (/four|4/.test(text)) return 4;
  if (/three|3/.test(text)) return 3;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function accommodationStarLabel(value) {
  const number = starNumber(value);
  return number ? `${number}성급` : "";
}

function accommodationDiscountRate(item = {}) {
  const explicit = numericValue(item.discountRate || item.discountPercent);
  if (explicit > 0) return Math.round(explicit);
  const original = numericValue(item.originalPrice);
  const sale = numericValue(item.salePrice || item.price);
  return original > sale && sale > 0 ? Math.round(((original - sale) / original) * 100) : 0;
}

function accommodationCacheRegions(cache = accommodationCache) {
  return cache && typeof cache === "object" && cache.regions && typeof cache.regions === "object"
    ? cache.regions
    : {};
}

function normalizeAccommodationProduct(item = {}, fallbackRegion = "") {
  const title = normalizeText(item.title || item.itemName || item.name);
  const url = accommodationUrl(item.url || item.productUrl);
  const image = typeof item.image === "string" ? item.image : "";
  const region = compactRegion(item.region || item.city || fallbackRegion);
  const salePrice = numericValue(item.salePrice || item.price);
  const originalPrice = numericValue(item.originalPrice || salePrice);
  if (!title || !url || !image || !salePrice) return null;
  return {
    ...item,
    id: item.id || `accommodation-${url}`,
    type: "accommodation",
    title,
    url,
    image,
    region,
    city: region,
    regionSlug: item.regionSlug || regionSlug(region),
    category: item.category || "숙소 예약",
    salePrice,
    price: salePrice,
    originalPrice: originalPrice || salePrice,
    discountRate: accommodationDiscountRate({ ...item, salePrice, originalPrice }),
    priceText: item.priceText || `${won(salePrice)}부터`,
    checkIn: ACCOMMODATION_STAY.checkIn,
    checkOut: ACCOMMODATION_STAY.checkOut,
    adultCount: ACCOMMODATION_STAY.adultCount,
    childCount: ACCOMMODATION_STAY.childCount,
    source: "myrealtrip-accommodation",
  };
}

function accommodationProductsFromCache(cache = accommodationCache) {
  const seen = new Set();
  const products = [];
  for (const region of Object.values(accommodationCacheRegions(cache))) {
    for (const item of [...(region.default || []), ...(region.family || [])]) {
      const normalized = normalizeAccommodationProduct(item, region.name);
      if (!normalized || seen.has(stripAccommodationStayParams(normalized.url))) continue;
      seen.add(stripAccommodationStayParams(normalized.url));
      products.push(normalized);
    }
  }
  return products;
}

function familyAccommodationContext(post) {
  return /아이|가족|어린이|키즈|체험|테마파크|아쿠아리움|생태|자연학습/.test(searchablePostText(post));
}

function accommodationPresetForPosts(posts = []) {
  return posts.some(familyAccommodationContext) ? "family" : "default";
}

function accommodationBucketForRegion(region) {
  const slug = regionSlug(region);
  return accommodationCacheRegions()[slug] || null;
}

function accommodationBucketsForRegion(region) {
  const regions = accommodationCacheRegions();
  const labels = [
    detailedRegionLabel(region),
    compactRegion(region),
  ].filter(Boolean);
  const seen = new Set();
  return labels
    .map((label) => regionSlug(label))
    .filter((slug) => {
      if (!slug || seen.has(slug)) return false;
      seen.add(slug);
      return true;
    })
    .map((slug) => regions[slug])
    .filter(Boolean);
}

function itemKey(item = {}) {
  return stripAccommodationStayParams(item.url || item.productUrl || item.id || item.title || "");
}

function selectAccommodationItems({ posts = [], region = "", preset = "", limit = 3, exclude = [] } = {}) {
  const safeLimit = Math.max(0, Math.min(12, Number.parseInt(limit, 10) || 0));
  if (!safeLimit) return [];
  const label = compactRegion(region || posts.find((post) => post?.region)?.region || posts[0]?.city);
  const buckets = accommodationBucketsForRegion(region || posts.find((post) => post?.region)?.region || posts[0]?.city || label);
  if (!buckets.length) return [];
  const presetName = preset || accommodationPresetForPosts(posts);
  const familyPool = buckets.flatMap((bucket) => (bucket.family || []).map((item) => normalizeAccommodationProduct(item, bucket.name)).filter(Boolean));
  const defaultPool = buckets.flatMap((bucket) => (bucket.default || []).map((item) => normalizeAccommodationProduct(item, bucket.name)).filter(Boolean));
  const pool = presetName === "family"
    ? (familyPool.length ? familyPool : defaultPool.filter((item) => starNumber(item.starRating) >= 4))
    : defaultPool;
  const seen = new Set((Array.isArray(exclude) ? exclude : []).map(itemKey));
  const picked = [];
  for (const item of pool) {
    const key = itemKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    picked.push(item);
    if (picked.length >= safeLimit) break;
  }
  return picked;
}

function selectMultiRegionAccommodations(posts = [], limit = 6) {
  const safeLimit = Math.max(0, Math.min(12, Number.parseInt(limit, 10) || 0));
  const regionCounts = new Map();
  for (const post of posts) {
    const label = compactRegion(post?.region || post?.city);
    if (accommodationBucketForRegion(label)) regionCounts.set(label, (regionCounts.get(label) || 0) + 1);
  }
  const regions = [...regionCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
    .map(([label]) => label);
  const picked = [];
  const seen = new Set();
  for (const label of regions) {
    for (const item of selectAccommodationItems({ region: label, limit: 2 })) {
      const key = itemKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      picked.push(item);
      if (picked.length >= safeLimit) return picked;
    }
  }
  for (const item of accommodationProducts) {
    const key = itemKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(item);
    if (picked.length >= safeLimit) break;
  }
  return picked;
}

function accommodationCard(item = {}) {
  const product = normalizeAccommodationProduct(item);
  if (!product) return "";
  const stayLabel = accommodationStayLabel();
  const discount = accommodationDiscountRate(product);
  const star = accommodationStarLabel(product.starRating);
  const rating = product.reviewScore ? `평점 ${product.reviewScore}` : "";
  const reviews = numericValue(product.reviewCount);
  const meta = [star, rating, reviews ? `리뷰 ${reviews.toLocaleString("ko-KR")}개` : ""].filter(Boolean).join(" · ");
  const original = numericValue(product.originalPrice);
  const sale = numericValue(product.salePrice || product.price);
  const price = [
    original > sale ? `<del>${html(won(original))}</del>` : "",
    `<strong>${html(won(sale))}</strong>`,
  ].filter(Boolean).join("");
  return `<a class="mrt-accommodation-card" data-mrt-accommodation-card href="${html(product.url)}" rel="sponsored nofollow" target="_blank">
    <span class="mrt-accommodation-thumb"><img src="${html(product.image)}" alt="${html(product.title)}" loading="lazy"></span>
    <span class="mrt-accommodation-body">
      ${discount > 0 ? `<span class="mrt-accommodation-badge">${discount}% 할인</span>` : ""}
      <strong>${html(product.title)}</strong>
      <span class="mrt-accommodation-meta">${html(meta || product.region)}</span>
      <span class="mrt-accommodation-price">${price}<small>${html(stayLabel)}</small></span>
      <span class="article-product-cta">예약하기</span>
    </span>
  </a>`;
}

function articleAccommodationCard(item = {}) {
  const product = normalizeAccommodationProduct(item);
  if (!product) return "";
  const stayLabel = accommodationStayLabel();
  const discount = accommodationDiscountRate(product);
  const rating = product.reviewScore ? `평점 ${product.reviewScore}` : "";
  const reviews = numericValue(product.reviewCount);
  const meta = [accommodationStarLabel(product.starRating), rating, reviews ? `리뷰 ${reviews.toLocaleString("ko-KR")}개` : ""]
    .filter(Boolean)
    .join(" · ");
  const original = numericValue(product.originalPrice);
  const sale = numericValue(product.salePrice || product.price);
  if (!sale) return "";
  const price = [
    original > sale ? `<del>${html(won(original))}</del>` : "",
    `<strong>${html(won(sale))}</strong>`,
  ].filter(Boolean).join("");
  return `<a class="mrt-accommodation-card article-product-card" data-mrt-accommodation-card href="${html(product.url)}" rel="sponsored nofollow" target="_blank">
    <span class="mrt-accommodation-thumb"><img src="${html(product.image)}" alt="${html(product.title)} 숙소 대표 이미지" loading="lazy" decoding="async">${rating ? `<span class="mrt-rating-badge">${html(rating)}</span>` : ""}</span>
    <span class="mrt-accommodation-body">
      ${discount > 0 ? `<span class="mrt-accommodation-badge">${discount}% 할인</span>` : ""}
      <strong>${html(product.title)}</strong>
      <span class="mrt-accommodation-meta">${html(meta || product.region)}</span>
      <span class="mrt-accommodation-price">${price}<small>${html(stayLabel)}</small></span>
      <span class="article-product-cta">예약하기</span>
    </span>
  </a>`;
}

function removeLanguageArtifacts(value) {
  return String(value ?? "")
    .replace(/\s*<div class=["']language-switch\b[^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/\s*<script\s+src=["']\/assets\/i18n\.js(?:\?[^"']*)?["']\s+defer><\/script>/gi, "")
    .replace(/\s*<link\s+rel=["']alternate["'][^>]*\bhreflang=["'][^"']+["'][^>]*>/gi, "")
    .replace(/\s*<div><h3>Language<\/h3>[\s\S]*?<\/div>/gi, "")
    .replace(/\?lang=(?:ko|en|ja|zh)(?:-[A-Za-z]+)?/g, "")
    .replace(/\.language-switch(?:\s+a(?:\.is-active)?|\.is-active)?\{[^{}]*\}/g, "")
    .replace(/@media[^{]+\{\s*\}/g, "");
}

const EMBEDDED_SITE_CSS_RE = /:root\{--brand:#0F5C5C;[\s\S]*?@media\(prefers-reduced-motion:reduce\)\{\*,\*::before,\*::after\{transition-duration:0\.01ms!important;animation-duration:0\.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important\}\}\s*/g;

function refreshEmbeddedSiteCss(value) {
  return String(value ?? "").replace(EMBEDDED_SITE_CSS_RE, SITE_CSS);
}

function cleanGeneratedHtml(value) {
  return removeLanguageArtifacts(refreshEmbeddedSiteCss(value))
    .replace(/로컬/g, "지역")
    .replace(/데이터 연결/g, "인터넷 연결")
    .replace(/(\s*<footer class=["']site-footer["'][\s\S]*?<\/footer>)(?:\s*<footer class=["']site-footer["'][\s\S]*?<\/footer>)+/gi, "$1")
    .replace(/[ \t]+$/gm, "");
}

function canonicalUrl(pathname = "/") {
  const normalized = `/${String(pathname).replace(/^\/+|\/+$/g, "")}`;
  if (normalized === "/") return `${baseUrl}/`;
  if (/^\/(?:about|contact|editorial-team|editorial-policy|affiliate-disclosure|privacy|terms)$/.test(normalized)) {
    return `${baseUrl}${normalized}`;
  }
  return /\/[^/]+\.[a-z0-9]+$/i.test(normalized)
    ? `${baseUrl}${normalized}`
    : `${baseUrl}${normalized}/`;
}

function ensureCanonical(document, pathname = "/") {
  const canonical = `<link rel="canonical" href="${html(canonicalUrl(pathname))}">`;
  const withoutExisting = String(document).replace(/\s*<link\s+rel=["']canonical["'][^>]*>/gi, "");
  return withoutExisting.includes("</head>")
    ? withoutExisting.replace("</head>", `    ${canonical}\n  </head>`)
    : withoutExisting;
}

function ensureRobotsMeta(document, indexable) {
  const content = indexable ? "index, follow, max-image-preview:large" : "noindex, follow";
  const meta = `<meta name="robots" content="${content}">`;
  const withoutExisting = String(document).replace(/\s*<meta\s+name=["']robots["'][^>]*>/gi, "");
  return withoutExisting.includes("</head>")
    ? withoutExisting.replace("</head>", `    ${meta}\n  </head>`)
    : withoutExisting;
}

function articleActivePath(post = {}) {
  if (isFestivalPost(post)) return "/festival/";
  const text = searchablePostText(post);
  if (post?.dataPipeline?.kind === "ticket-price" || /입장권|티켓|관람권|이용권|액티비티/.test(text)) return "/ticket/";
  if (isLodgingPost(post) || /숙소|호텔|예약/.test(text)) return "/stay/";
  return "/travel/";
}

function ensurePretendardLink(document) {
  if (String(document).includes("pretendardvariable-dynamic-subset.css")) return document;
  return String(document).includes("</head>")
    ? String(document).replace("</head>", `    ${PRETENDARD_LINK}\n  </head>`)
    : document;
}

function removeLegacyArticleHeaderScript(document) {
  return String(document).replace(
    /\s*<script>const header=document\.querySelector\(['"]\.top['"]\);const syncHeader=[\s\S]*?<\/script>/,
    "",
  );
}

function alignSiteHeader(document, activePath = "/") {
  const header = siteHeader(activePath);
  const withoutExistingSiteHeader = String(document).replace(/\s*<header class=["']site-header["'][\s\S]*?<\/header>/gi, "");
  return withoutExistingSiteHeader.includes("<body")
    ? withoutExistingSiteHeader.replace(/<body([^>]*)>/i, `<body$1>\n    ${header}`)
    : `${header}${withoutExistingSiteHeader}`;
}

function alignArticleNavigation(document, post = {}) {
  const header = siteHeader(articleActivePath(post));
  const withoutExistingSiteHeader = String(document).replace(/\s*<header class=["']site-header["'][\s\S]*?<\/header>/gi, "");
  let next = withoutExistingSiteHeader.replace(
    /<header class=["']top["']>[\s\S]*?<\/header>/i,
    header,
  );
  if (next === withoutExistingSiteHeader) {
    next = next.replace(
      /<nav class=["']links["'] aria-label=["']주요 메뉴["'][\s\S]*?<\/nav>/i,
      ARTICLE_NAVIGATION,
    );
  }
  if (next === withoutExistingSiteHeader) {
    next = next.replace(/<body>/i, `<body>\n    ${header}`);
  }
  return removeLegacyArticleHeaderScript(ensurePretendardLink(next));
}

function alignArticleFooter(document) {
  const regionLinks = regionGroups().map((group) => ({ href: `/region/${group.slug}/`, label: group.label }));
  const footer = siteFooter({ regionLinks });
  const withoutFooters = String(document).replace(/\s*<footer\b[\s\S]*?<\/footer>/gi, "");
  return withoutFooters.includes("</body>")
    ? withoutFooters.replace("</body>", `${footer}\n  </body>`)
    : `${withoutFooters}${footer}`;
}

function removeExistingSiteNavScript(document) {
  return String(document).replace(
    /\s*<script(?:\s+data-site-nav-script)?>(?:(?!<\/script>)[\s\S])*?\.site-nav-desktop \.nav-group(?:(?!<\/script>)[\s\S])*?<\/script>/g,
    "",
  );
}

function ensureSiteNavigationScript(document) {
  if (!String(document).includes("data-site-header")) return document;
  const stripped = removeExistingSiteNavScript(document);
  return stripped.includes("</body>")
    ? stripped.replace("</body>", `\n    ${siteNavScript()}\n  </body>`)
    : stripped;
}

function alignStaticInternalLinks(document) {
  return String(document).replace(
    /href=(["'])\/(about|contact|editorial-team|editorial-policy|affiliate-disclosure|privacy|terms)\.html\1/g,
    (_match, quote, slug) => `href=${quote}/${slug}${quote}`,
  );
}

function formatDate(value = "") {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(value || "");
  return `${match[1]}년 ${Number(match[2])}월 ${Number(match[3])}일`;
}

function formatShortDate(value = "") {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(value || "");
  return `${Number(match[2])}월 ${Number(match[3])}일`;
}

function accommodationStayLabel() {
  return `성인 2인 · ${formatShortDate(ACCOMMODATION_STAY.checkIn)} 체크인`;
}

function flightMeta(deal) {
  return [
    deal?.priceText ? `최저가 ${deal.priceText}` : "",
    deal?.departureDate ? `출발 ${formatDate(deal.departureDate)}` : "",
    deal?.returnDate ? `귀국 ${formatDate(deal.returnDate)}` : "",
    deal?.period ? `${deal.period}일 일정` : "",
  ].filter(Boolean).join(" · ");
}

function savingsText(deal) {
  const price = Number(deal?.price || 0);
  const average = Number(deal?.averagePrice || 0);
  if (!price || !average || average <= price) return "";
  const saved = average - price;
  return `평균가 대비 약 ${saved.toLocaleString("ko-KR")}원 낮게 확인된 일정입니다.`;
}

function relatedProducts(deal, count = 4) {
  const products = [...tnaProducts, ...accommodationProducts].filter((item) => item?.title && item?.url);
  return selectAffiliateProducts({
    sectionId: "flight",
    posts: [{
      title: deal?.title || "",
      description: deal?.description || "",
      region: deal?.region || deal?.city || "",
    }],
    products,
    limit: count,
  });
}

function productCard(product) {
  if (!product?.image) return "";
  const image = `<span class="thumb"><img src="${html(product.image)}" alt="${html(product.title)}" loading="lazy"></span>`;
  return `<a class="product-card" href="${html(product.url)}" rel="sponsored noopener">
    ${image}
    <strong>${html(product.title)}</strong>
    <span>${html([product?.region || product?.city, product?.category, product?.priceText].filter(Boolean).join(" · "))}</span>
  </a>`;
}

function flightPageHtml(deal) {
  const products = relatedProducts(deal);
  const productCards = products.map(productCard).filter(Boolean);
  const related = productCards.length
    ? `<section class="block"><h2>여행 준비에 필요한 예약</h2><div class="products">${productCards.join("")}</div></section>`
    : "";
  const description = `${deal.region || deal.city || "해외"} 여행을 검토할 때 참고할 항공권 가격, 출발일, 여행 기간을 한 번에 정리했습니다.`;
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, follow">
    ${NAVER_VERIFICATION_META}
    <meta name="description" content="${html(description)}">
    <link rel="canonical" href="${html(flightUrl(deal))}">
    <title>${html(deal.title)} - 트립뷰</title>
    <style>
      :root{--ink:#111;--muted:#707070;--line:#e1e1e1;--paper:#fff;--soft:#f5f5f5}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:Arial,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;line-height:1.65}a{color:inherit;text-decoration:none}img{display:block;width:100%;height:100%;object-fit:cover;object-position:center}.wrap{width:min(760px,calc(100% - 32px));margin:auto}.top{position:sticky;top:0;background:rgba(255,255,255,.96);border-bottom:1px solid var(--line);z-index:10}.nav{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:68px}.brand{font-size:22px;font-weight:900}.links{display:flex;gap:14px;overflow-x:auto;white-space:nowrap;font-size:13px;font-weight:800}.language-switch{display:flex;gap:8px;white-space:nowrap}.language-switch a{font-size:12px;font-weight:900;color:#555;border-bottom:1px solid transparent}.language-switch a.is-active{color:#111;border-bottom-color:#111}.hero{padding:34px 0 22px}.hero h1{margin:0 0 14px;font-size:clamp(30px,8vw,46px);line-height:1.18;letter-spacing:-.01em}.meta{color:var(--muted);font-size:14px;font-weight:800}.fare{margin:22px 0 0;padding:20px 0;border-top:2px solid var(--ink);border-bottom:1px solid var(--line)}.fare strong{display:block;font-size:30px;line-height:1.1}.fare span{display:block;margin-top:8px;color:var(--muted);font-size:14px}.booking-cta{display:flex;align-items:center;justify-content:center;margin-top:16px;min-height:48px;background:#111;color:#fff;font-weight:900}.block{padding:28px 0;border-bottom:1px solid var(--line)}.block h2{margin:0 0 12px;font-size:23px;line-height:1.25}.info{display:grid;grid-template-columns:110px 1fr;gap:10px 16px;margin:0}.info dt{font-weight:900}.info dd{margin:0;color:#333}.products{display:grid;gap:0;border-top:1px solid var(--line)}.product-card{display:grid;grid-template-columns:92px minmax(0,1fr);gap:12px;align-items:center;padding:13px 0;border-bottom:1px solid var(--line)}.product-card .thumb{grid-row:1/3;position:relative;display:block;width:100%;aspect-ratio:16/10;background:#fff;overflow:hidden}.product-card .thumb img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;display:block}.product-card strong{font-size:17px;line-height:1.35;font-weight:900}.product-card span{display:block;color:var(--muted);font-size:12px}.note{color:var(--muted);font-size:14px}.footer{padding:28px 0 46px;color:var(--muted);font-size:13px}@media(max-width:520px){.nav{align-items:flex-start;flex-direction:column;padding:14px 0}.links{width:100%}.hero{padding-top:28px}.info{grid-template-columns:88px 1fr}.product-card{grid-template-columns:84px minmax(0,1fr)}}
    </style>
  </head>
  <body>
    <header class="top"><div class="wrap nav"><a class="brand" href="/">트립뷰</a>${primaryNavigation("")}${LANGUAGE_SWITCH}</div></header>
    <main class="wrap">
      <article>
        <section class="hero">
          <p class="meta">항공권 최저가 여행지 · ${html(deal.region || deal.city || "")}</p>
          <h1>${html(deal.title)}</h1>
          <p>${html(description)}</p>
          <div class="fare"><strong>${html(deal.priceText || "")}</strong><span>${html(flightMeta(deal))}</span></div>
          <a class="booking-cta" href="${html(flightBookingUrl(deal))}" rel="sponsored noopener">마이리얼트립에서 항공권 예약하기</a>
        </section>
        <section class="block">
          <h2>가격과 일정 요약</h2>
          <dl class="info">
            <dt>출발</dt><dd>${html(deal.fromCity || "인천")}</dd>
            <dt>도착</dt><dd>${html(deal.region || deal.city || deal.toCity || "")}</dd>
            <dt>출발일</dt><dd>${html(formatDate(deal.departureDate))}</dd>
            <dt>귀국일</dt><dd>${html(formatDate(deal.returnDate))}</dd>
            <dt>여행 기간</dt><dd>${html(deal.period ? `${deal.period}일` : "")}</dd>
            <dt>참고</dt><dd>${html(savingsText(deal) || "가격은 변동될 수 있으니 실제 예약 전 조건을 다시 확인하는 편이 좋습니다.")}</dd>
          </dl>
        </section>
        <section class="block">
          <h2>이 목적지로 볼 때 체크할 것</h2>
          <p>항공권 가격만 보고 바로 결정하기보다 숙소 위치, 도착 시간대, 현지 이동 시간을 같이 봐야 실제 여행 비용이 흔들리지 않습니다. 특히 ${html(deal.region || deal.city || "목적지")} 일정은 왕복 항공권 가격과 함께 첫날 도착 후 이동 동선, 마지막 날 공항 복귀 시간을 같이 확인하는 것이 좋습니다.</p>
          <p class="note">항공권 가격은 여행지 선택을 돕는 참고 정보로 정리하고, 실제 예약 전에는 일정과 수하물 조건을 다시 확인하세요.</p>
        </section>
        ${related}
      </article>
    </main>
    <footer class="wrap footer">트립뷰는 항공권 가격을 여행지 선택의 기준으로 정리하고, 함께 볼 만한 숙소와 투어 정보를 연결합니다.</footer>
    ${I18N_SCRIPT}
    ${TOPIC_FILTER_SCRIPT}
  </body>
</html>`;
}

function flightIndexHtml(deals) {
  const rows = deals
    .filter((deal) => deal?.title)
    .sort((a, b) => Number(a.price || 0) - Number(b.price || 0))
    .map((deal) => `<a class="product-card flight-card" href="${publicFlightUrl(deal)}"><strong>${html(deal.title)}</strong><span>${html(flightMeta(deal))}</span></a>`)
    .join("");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, follow">${NAVER_VERIFICATION_META}<meta name="description" content="항공권 가격을 기준으로 여행지를 비교하고 함께 볼 숙소와 투어 정보를 확인하세요."><title>항공권 최저가 여행지 - 트립뷰</title><style>body{margin:0;font-family:Arial,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;color:#111}.wrap{width:min(760px,calc(100% - 32px));margin:auto}a{color:inherit;text-decoration:none}.top{border-bottom:1px solid #e1e1e1}.top .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px}.brand{display:block;padding:22px 0;font-size:26px;font-weight:900}.hero{padding:30px 0}.hero h1{margin:0;font-size:38px;line-height:1.15}.products{border-top:1px solid #e1e1e1}.product-card{display:grid;gap:6px;align-items:center;padding:16px 0;border-bottom:1px solid #e1e1e1}strong{font-size:19px;line-height:1.35}span{color:#707070;font-size:13px}${LANGUAGE_SWITCH_CSS}@media(max-width:520px){.top .wrap{align-items:flex-start;flex-direction:column;padding:14px 0}.brand{padding:0}}</style></head><body><header class="top"><div class="wrap"><a class="brand" href="/">트립뷰</a>${LANGUAGE_SWITCH}</div></header><main class="wrap"><section class="hero"><h1>항공권 최저가 여행지</h1><p>항공권 가격을 기준으로 여행지를 고르고, 상세 페이지에서 함께 볼 숙소와 투어 정보를 확인하세요.</p></section><section class="products">${rows}</section></main>${I18N_SCRIPT}${TOPIC_FILTER_SCRIPT}</body></html>`;
}

function primaryNavigation(activePath = "") {
  const items = [
    ["/", "홈"],
    ["/travel/", "여행지"],
    ["/festival/", "축제"],
    ["/stay/", "숙소"],
    ["/ticket/", "입장권·투어"],
  ];
  return `<nav class="links" aria-label="주요 메뉴">${items.map(([href, label]) => `<a${href === activePath ? ' class="is-active"' : ""} href="${href}">${label}</a>`).join("")}</nav>`;
}

function hubPageStyle() {
  return `${SITE_CSS}
.hub-page{padding-top:32px}
.hub-banner{display:grid;gap:10px;margin-bottom:24px;padding:24px;border:1px solid var(--line);border-radius:8px;background:var(--soft-teal)}
.hub-banner.has-image{grid-template-columns:minmax(0,1fr) minmax(280px,.42fr);align-items:center;gap:20px}
.hub-banner-copy{display:grid;gap:10px;min-width:0}
.hub-banner-image{margin:0;overflow:hidden;border-radius:8px;background:var(--card)}
.hub-banner-image img{width:100%;aspect-ratio:16/10;object-fit:cover;object-position:center}
.hub-banner-image figcaption{padding:8px 10px;color:var(--muted);font-size:11px;line-height:1.45}
.hub-banner h1{margin:0;font-size:28px;line-height:1.35;font-weight:900}
.hub-banner p{max-width:720px;margin:0;color:var(--muted);line-height:1.7}
.kicker{display:block;color:var(--brand);font-size:12px;font-weight:900}
.banner-count{justify-self:start;color:var(--brand);font-size:13px;font-weight:900}
.tag-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
.tag-row a,.tag-row span{display:inline-flex;align-items:center;min-height:36px;border:1px solid var(--line);border-radius:999px;padding:0 12px;background:var(--card);color:var(--muted);font-size:13px;font-weight:800}
.block{padding:48px 0;border-bottom:1px solid var(--line)}
.block-head{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:16px}
.block h2{margin:0;font-size:20px;line-height:1.35;font-weight:800}
.block-note,.affiliate-note{margin:0;color:var(--muted);font-size:13px}
.story-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}
.story-list .story-card{height:100%}
.stay-slot{margin-right:calc((100vw - min(1180px,calc(100vw - 32px))) / -2);margin-left:calc((100vw - min(1180px,calc(100vw - 32px))) / -2);padding-right:calc((100vw - min(1180px,calc(100vw - 32px))) / 2);padding-left:calc((100vw - min(1180px,calc(100vw - 32px))) / 2);background:color-mix(in srgb,var(--brand) 5%,var(--bg))}
.mrt-accommodation-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.mrt-accommodation-grid[data-count="1"]{grid-template-columns:minmax(0,1fr)}
.mrt-accommodation-grid[data-count="2"]{grid-template-columns:repeat(2,minmax(0,1fr))}
.mrt-accommodation-card{position:relative;display:grid;grid-template-columns:96px minmax(0,1fr);gap:12px;align-items:center;min-width:0;padding:12px;border:1px solid var(--line);border-left:3px solid var(--cta);border-radius:8px;background:var(--card);transition:border-color 150ms ease}
.mrt-accommodation-card:hover,.mrt-accommodation-card:focus-visible{border-color:var(--brand);border-left-color:var(--cta)}
.mrt-accommodation-thumb{position:relative;display:block;width:100%;aspect-ratio:16/10;overflow:hidden;background:var(--card)}
.mrt-accommodation-thumb img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;display:block}
.mrt-accommodation-body{display:grid;gap:4px;min-width:0}
.mrt-accommodation-body strong{font-size:15px;line-height:1.35;font-weight:800}
.mrt-accommodation-body em,.mrt-accommodation-meta{display:block;color:var(--muted);font-size:12px;font-style:normal}
.mrt-accommodation-badge{justify-self:start;border-radius:999px;background:var(--cta);color:var(--card);padding:2px 7px;font-size:11px;font-weight:900;line-height:1.35}
.mrt-accommodation-price{display:flex;flex-wrap:wrap;align-items:baseline;gap:5px}
.mrt-accommodation-price del{color:var(--muted);font-size:12px}
.mrt-accommodation-price strong{font-size:16px;color:var(--ink)}
.mrt-accommodation-price small{flex-basis:100%;color:var(--muted);font-size:11px}
.article-product-cta{justify-self:start;display:inline-flex;align-items:center;min-height:28px;margin-top:2px;padding:0 9px;border-radius:999px;background:var(--cta);color:var(--card);font-size:12px;font-weight:900}
.mrt-ticket-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.mrt-ticket-card{display:grid;grid-template-columns:96px minmax(0,1fr);gap:12px;align-items:center;min-width:0;padding:12px;border:1px solid var(--line);border-left:3px solid var(--cta);border-radius:8px;background:var(--card);transition:border-color 150ms ease}
.mrt-ticket-card:hover,.mrt-ticket-card:focus-visible{border-color:var(--brand);border-left-color:var(--cta)}
.mrt-ticket-thumb{position:relative;display:block;width:100%;aspect-ratio:16/10;overflow:hidden;background:var(--card)}
.mrt-ticket-thumb img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;display:block}
.product-thumb{position:relative;display:block;width:100%;aspect-ratio:16/10;overflow:hidden;background:var(--card)}
.product-thumb img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;display:block}
.mrt-ticket-body{display:grid;gap:4px;min-width:0}
.mrt-ticket-body strong{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:15px;line-height:1.35;font-weight:800}
.mrt-ticket-body em{color:var(--muted);font-size:12px;font-style:normal}
.mrt-ticket-price{color:var(--ink);font-size:16px;font-weight:900}
.booking-page{display:grid;gap:0}
.booking-conditions{padding-top:24px}
.booking-condition-list{display:grid;gap:10px}
.booking-condition{border:1px solid var(--line);border-radius:8px;background:var(--card);overflow:hidden}
.booking-condition summary{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:56px;padding:0 16px;cursor:pointer;list-style:none}
.booking-condition summary::-webkit-details-marker{display:none}
.booking-condition-title{display:grid;gap:2px;min-width:0}
.booking-condition-title strong{font-size:16px;line-height:1.35;font-weight:900}
.booking-condition-title em{color:var(--muted);font-size:13px;font-style:normal;line-height:1.35}
.booking-condition-toggle{color:var(--muted);font-size:12px;font-weight:900}
.booking-condition p{margin:0;padding:0 16px 12px;color:var(--muted);font-size:14px}
.booking-condition a{display:inline-flex;align-items:center;min-height:40px;margin:0 16px 16px;color:var(--brand);font-size:13px;font-weight:900}
.booking-affiliate-box{padding:18px 16px;border:1px solid color-mix(in srgb,var(--cta) 28%,var(--line));border-radius:8px;background:var(--soft-cta)}
.booking-affiliate-box strong{display:block;margin-bottom:4px;font-size:17px;line-height:1.35}
.booking-affiliate-box p{margin:0;color:var(--muted);font-size:14px}
.booking-checklist{display:grid;gap:6px;margin:14px 0 0;padding:0;list-style:none;color:var(--muted);font-size:14px}
.booking-checklist li{padding-left:14px;position:relative}
.booking-checklist li::before{content:"";position:absolute;left:0;top:.75em;width:4px;height:4px;border-radius:999px;background:var(--cta)}
.booking-city-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.booking-city-card{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:64px;padding:14px 16px;border:1px solid var(--line);border-radius:8px;background:var(--card);transition:border-color 150ms ease}
.booking-city-card:hover,.booking-city-card:focus-visible{border-color:var(--brand)}
.booking-city-card strong{font-size:17px;line-height:1.35;font-weight:900}
.booking-city-card span{color:var(--muted);font-size:13px;font-weight:800}
.booking-product-list{display:grid;gap:12px}
.booking-product-card{display:grid;grid-template-columns:132px minmax(0,1fr);gap:14px;align-items:center;min-height:132px;padding:12px;border:1px solid var(--line);border-radius:8px;background:var(--card);transition:border-color 150ms ease}
.booking-product-card:hover,.booking-product-card:focus-visible{border-color:var(--brand)}
.booking-product-thumb{position:relative;display:block;width:100%;aspect-ratio:16/10;overflow:hidden;border-radius:8px;background:var(--card)}
.booking-product-thumb img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;display:block}
.booking-product-body{display:grid;gap:5px;min-width:0}
.booking-product-region{color:var(--brand);font-size:12px;font-weight:900;line-height:1.35}
.booking-product-title{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:17px;line-height:1.35;font-weight:900}
.booking-product-rating{color:var(--muted);font-size:13px;line-height:1.4}
.booking-product-price{color:var(--cta);font-size:18px;font-weight:900;line-height:1.25}
.booking-product-meta{color:var(--muted);font-size:12px;line-height:1.35}
.booking-product-cta{display:flex;justify-content:center;margin-top:18px}
.booking-product-cta a{display:inline-flex;align-items:center;justify-content:center;min-width:220px;min-height:48px;padding:0 18px;border-radius:8px;background:var(--cta);color:var(--card);font-weight:900;transition:background-color 150ms ease}
.booking-product-cta a:hover,.booking-product-cta a:focus-visible{background:var(--cta-hover)}
.subregion-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.subregion-card{display:block;border:1px solid var(--line);border-radius:8px;background:var(--card);padding:16px;transition:border-color 150ms ease}
.subregion-card:hover,.subregion-card:focus-visible{border-color:var(--brand)}
.subregion-card strong{display:block;font-size:17px;line-height:1.35}
.subregion-card span{display:block;margin-top:6px;color:var(--muted);font-size:13px}
.empty-slot{margin:0;padding:16px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--muted)}
@media(max-width:900px){.hub-page{padding-top:24px}.hub-banner,.hub-banner.has-image{grid-template-columns:1fr;padding:18px}.hub-banner h1{font-size:25px}.block{padding:32px 0}.block-head{display:block}.block-note{margin-top:4px}.story-list,.subregion-grid,.mrt-accommodation-grid,.mrt-ticket-grid{grid-template-columns:1fr}.mrt-accommodation-card,.mrt-ticket-card{grid-template-columns:90px minmax(0,1fr)}.booking-product-card{grid-template-columns:104px minmax(0,1fr);min-height:116px}.booking-city-grid{gap:8px}}
@media(max-width:520px){.booking-city-grid{grid-template-columns:1fr}.booking-product-card{grid-template-columns:96px minmax(0,1fr);gap:12px;padding:10px}.booking-product-title{font-size:15px}.booking-product-price{font-size:16px}}`;
}

function storyCard(post) {
  const image = postImage(post);
  if (!image) return "";
  const thumb = `<span class="story-thumb"><img src="${html(image)}" alt="${html(postTitle(post))}" loading="lazy"></span>`;
  const meta = [formatDate(postDate(post)), `${Math.max(2, Math.ceil((postSummary(post, 220).length + postTitle(post).length) / 120))}분 읽기`].filter(Boolean).join(" · ");
  return `<a class="story-card" href="/${encodeURIComponent(post.slug)}/">
    ${thumb}
    <span class="story-card-body">
      <span class="story-label">${html([festivalCardStatus(post), post?.category || "여행지", compactRegion(post?.region)].filter(Boolean).join(" · "))}</span>
      <strong>${html(postTitle(post))}</strong>
      ${postSummary(post) ? `<p>${html(postSummary(post))}</p>` : ""}
      <span class="story-meta">${html(meta)}</span>
    </span>
  </a>`;
}

function hubProductCard(product) {
  const title = html(product?.title || "");
  if (!title) return "";
  const url = stripAccommodationStayParams(product?.url || "https://www.myrealtrip.com/");
  const imageUrl = affiliateProductImage(product);
  const image = imageUrl
    ? `<span class="product-thumb"><img src="${html(imageUrl)}" alt="${title}" loading="lazy"></span>`
    : "";
  const meta = [product?.region || product?.city, product?.category || product?.type, product?.priceText || product?.price]
    .filter(Boolean)
    .join(" · ");
  return `<a class="product-card${image ? "" : " no-image"}" href="${html(url)}" rel="sponsored noopener" data-affiliate-match="context">
    ${image}
    <strong>${title}</strong>
    <span>${html(meta || "예약 정보")}</span>
  </a>`;
}

function selectedHubProducts({ sectionId, posts, limit = 4, accommodationOnly = false }) {
  const productPool = accommodationOnly ? accommodationProducts : [...accommodationProducts, ...tnaProducts];
  return selectAffiliateProducts({ sectionId, posts, products: productPool, limit });
}

function staySlot({ title, posts, products = [], region = "", limit = 6 }) {
  const items = products.length
    ? products
    : region
      ? selectAccommodationItems({ posts, region, limit })
      : selectMultiRegionAccommodations(posts, limit);
  const cards = items.map(accommodationCard).filter(Boolean);
  if (!cards.length) return "";
  return `<section class="block stay-slot" id="accommodation-cards" aria-labelledby="accommodation-cards-title">
    <div class="block-head">
      <div><span class="kicker">STAY</span><h2 id="accommodation-cards-title">${html(title)}</h2></div>
      <p class="block-note">${html(posts.length ? `${compactRegion(posts[0]?.region)} 글 기준 추천` : "여행지 기준 추천")}</p>
    </div>
    <p class="affiliate-note">성인 2명 기준 주말 1박 요금입니다. 예약 화면에서 날짜와 취소 조건을 다시 확인하세요.</p>
    <div class="mrt-accommodation-grid" data-count="${cards.length}">${cards.join("")}</div>
  </section>`;
}

function ticketProductCard(product = {}) {
  const title = html(product?.title || product?.name || "");
  const url = normalizeText(product?.url || product?.productUrl || "");
  const imageUrl = affiliateProductImage(product);
  if (!title || !url || !imageUrl) return "";
  const meta = [product?.region || product?.city, product?.category || product?.type]
    .filter(Boolean)
    .join(" · ");
  const price = product?.priceText || product?.price || product?.salePrice || "";
  return `<a class="mrt-ticket-card" data-mrt-ticket-card href="${html(url)}" rel="sponsored nofollow" target="_blank">
    <span class="mrt-ticket-thumb"><img src="${html(imageUrl)}" alt="${title}" loading="lazy" decoding="async"></span>
    <span class="mrt-ticket-body">
      <em>${html(meta || "입장권·투어")}</em>
      <strong>${title}</strong>
      ${price ? `<span class="mrt-ticket-price">${html(String(price))}</span>` : ""}
      <span class="article-product-cta">예약하기</span>
    </span>
  </a>`;
}

function ticketSlot({ title = "입장권·투어 카드", products = [], limit = 9 }) {
  const cards = products.slice(0, limit).map(ticketProductCard).filter(Boolean);
  if (cards.length < 3) return "";
  return `<section class="block stay-slot" id="ticket-cards" aria-labelledby="ticket-cards-title">
    <div class="block-head">
      <div><span class="kicker">TICKET</span><h2 id="ticket-cards-title">${html(title)}</h2></div>
      <p class="block-note">가격과 이용 조건은 예약 화면에서 확인</p>
    </div>
    <p class="affiliate-note">입장권·투어 링크는 제휴 링크일 수 있으며, 가격과 이용 조건은 예약 화면에서 다시 확인해야 합니다.</p>
    <div class="mrt-ticket-grid">${cards.join("")}</div>
  </section>`;
}

function bookingProductRegion(product = {}) {
  const text = normalizeText([product.region, product.city, product.location, product.title].filter(Boolean).join(" "));
  for (const city of BOOKING_CITY_ORDER) {
    if (text.includes(city)) return city;
  }
  return compactRegion(product.region || product.city || product.location);
}

function bookingRatingValue(product = {}) {
  return numericValue(product.reviewScore || product.rating || product.score);
}

function bookingReviewCount(product = {}) {
  return numericValue(product.reviewCount || product.reviews || product.review);
}

function bookingPriceValue(product = {}) {
  return numericValue(product.salePrice || product.price || product.priceText);
}

function normalizeBookingProduct(product = {}, type = "stay") {
  if (type === "stay") {
    const accommodation = normalizeAccommodationProduct(product);
    if (!accommodation) return null;
    return {
      ...accommodation,
      bookingType: "stay",
      region: bookingProductRegion(accommodation),
      priceText: accommodation.priceText || `${won(accommodation.salePrice)}부터`,
      detail: accommodationStarLabel(accommodation.starRating),
    };
  }
  const title = normalizeText(product.title || product.name);
  const url = normalizeText(product.url || product.productUrl);
  const image = affiliateProductImage(product);
  const priceText = normalizeText(product.priceText || product.price || product.salePrice);
  if (!title || !url || !image || !priceText) return null;
  const region = bookingProductRegion(product);
  return {
    ...product,
    bookingType: "ticket",
    title,
    url,
    image,
    region,
    category: product.category || product.type || "입장권·투어",
    priceText,
    salePrice: bookingPriceValue(product),
    reviewScore: bookingRatingValue(product),
    reviewCount: bookingReviewCount(product),
  };
}

function bookingProducts(products = [], type = "stay", limit = 18) {
  const seen = new Set();
  const items = [];
  for (const product of products) {
    const normalized = normalizeBookingProduct(product, type);
    if (!normalized) continue;
    const key = type === "stay" ? stripAccommodationStayParams(normalized.url) : normalized.url;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    items.push(normalized);
  }
  return items
    .sort((a, b) => {
      const ratingDiff = bookingRatingValue(b) - bookingRatingValue(a);
      if (ratingDiff) return ratingDiff;
      const reviewDiff = bookingReviewCount(b) - bookingReviewCount(a);
      if (reviewDiff) return reviewDiff;
      const priceDiff = bookingPriceValue(a) - bookingPriceValue(b);
      if (priceDiff) return priceDiff;
      return a.title.localeCompare(b.title, "ko");
    })
    .slice(0, limit);
}

function bookingProductListId(type = "stay") {
  return type === "ticket" ? "ticket-cards" : "accommodation-cards";
}

function bookingQuickSearch(type = "stay") {
  const listId = bookingProductListId(type);
  const conditions = BOOKING_CONDITIONS[type] || [];
  if (!conditions.length) return "";
  const items = conditions.map((condition, index) => `<details class="booking-condition"${index === 0 ? " open" : ""}>
      <summary><span class="booking-condition-title"><strong>${html(condition.label)}</strong><em>${html(condition.point)}</em></span><span class="booking-condition-toggle">보기</span></summary>
      <p>${html(condition.description)}</p>
      <a href="#${html(listId)}">조건에 맞는 상품 목록으로 이동</a>
    </details>`).join("");
  return `<section class="block booking-conditions" id="quick-search" aria-labelledby="quick-search-title">
    <div class="block-head"><div><span class="kicker">CHECK</span><h2 id="quick-search-title">조건별 빠른 검색</h2></div><p class="block-note">예약 전 확인 기준</p></div>
    <div class="booking-condition-list">${items}</div>
  </section>`;
}

function bookingAffiliateNotice(type = "stay") {
  const intro = type === "ticket"
    ? "트립뷰의 입장권·투어 링크는 제휴 링크일 수 있습니다."
    : "트립뷰의 숙소 예약 링크는 제휴 링크일 수 있습니다.";
  const notes = type === "ticket"
    ? ["방문 날짜와 운영 시간을 먼저 확인하세요.", "매표 마감, 환불 가능 기간, 포함 사항은 예약 화면 기준으로 확인하세요.", "현장 수령 또는 모바일 바우처 사용 여부를 비교하세요."]
    : ["체크인 날짜와 투숙 인원을 먼저 확인하세요.", "무료 취소 가능 여부와 취소 마감 시각을 예약 화면에서 확인하세요.", "조식, 객실 정원, 위치 조건을 가격과 함께 비교하세요."];
  return `<section class="block" id="affiliate-notice" aria-labelledby="affiliate-notice-title">
    <div class="booking-affiliate-box">
      <strong id="affiliate-notice-title">제휴 링크 안내</strong>
      <p>${html(intro)} 가격과 조건은 예약 화면에서 변경될 수 있습니다.</p>
    </div>
    <ul class="booking-checklist">${notes.map((note) => `<li>${html(note)}</li>`).join("")}</ul>
  </section>`;
}

function bookingCityGrid(products = [], type = "stay") {
  if (!products.length) return "";
  const counts = new Map();
  for (const product of products) {
    const label = bookingProductRegion(product);
    if (!label || label === "기타") continue;
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  const ordered = [
    ...BOOKING_CITY_ORDER.filter((city) => counts.has(city)),
    ...[...counts.keys()].filter((city) => !BOOKING_CITY_ORDER.includes(city)).sort((a, b) => a.localeCompare(b, "ko")),
  ];
  if (!ordered.length) return "";
  const listId = bookingProductListId(type);
  const cards = ordered.map((city) => `<a class="booking-city-card" href="#${html(listId)}"><strong>${html(city)}</strong><span>${html(counts.get(city).toLocaleString("ko-KR"))}개 상품</span></a>`).join("");
  return `<section class="block" id="popular-cities" aria-labelledby="popular-cities-title">
    <div class="block-head"><div><span class="kicker">CITY</span><h2 id="popular-cities-title">인기 도시</h2></div><p class="block-note">상품이 있는 국내 도시만 표시</p></div>
    <div class="booking-city-grid">${cards}</div>
  </section>`;
}

function bookingRatingText(product = {}) {
  const rating = bookingRatingValue(product);
  const reviews = bookingReviewCount(product);
  if (!rating && !reviews) return "";
  return [rating ? `평점 ${rating}` : "", reviews ? `리뷰 ${reviews.toLocaleString("ko-KR")}개` : ""].filter(Boolean).join(" · ");
}

function bookingProductCard(product = {}, type = "stay") {
  const detail = [product.region, product.detail || product.category].filter(Boolean).join(" · ");
  const rating = bookingRatingText(product);
  const dataAttr = type === "ticket" ? "data-mrt-ticket-card" : "data-mrt-accommodation-card";
  const stayMeta = type === "stay" ? `<span class="booking-product-meta">${html(accommodationStayLabel())}</span>` : "";
  return `<a class="booking-product-card" ${dataAttr} href="${html(product.url)}" rel="sponsored nofollow" target="_blank">
    <span class="booking-product-thumb"><img src="${html(product.image)}" alt="${html(product.title)}" loading="lazy" decoding="async"></span>
    <span class="booking-product-body">
      <span class="booking-product-region">${html(detail || (type === "ticket" ? "입장권·투어" : "숙소"))}</span>
      <strong class="booking-product-title">${html(product.title)}</strong>
      ${rating ? `<span class="booking-product-rating">${html(rating)}</span>` : ""}
      <span class="booking-product-price">${html(product.priceText || won(product.salePrice) || "가격 확인")}</span>
      ${stayMeta}
    </span>
  </a>`;
}

function bookingProductSection(products = [], type = "stay") {
  const normalized = bookingProducts(products, type, type === "ticket" ? 18 : 12);
  if (!normalized.length) return "";
  const id = bookingProductListId(type);
  const title = type === "ticket" ? "평점순 입장권·투어" : "평점순 숙소";
  const note = type === "ticket" ? "가격과 이용 조건은 예약 화면에서 확인" : "성인 2명 기준 주말 1박 요금입니다";
  const ctaUrl = type === "ticket" ? "https://experiences.myrealtrip.com/" : "https://accommodation.myrealtrip.com/";
  const ctaText = type === "ticket" ? "전체 입장권·투어 보기" : "전체 숙소 보기";
  const cards = normalized.map((product) => bookingProductCard(product, type)).join("");
  return `<section class="block" id="${html(id)}" aria-labelledby="${html(id)}-title">
    <div class="block-head"><div><span class="kicker">RATING</span><h2 id="${html(id)}-title">${html(title)}</h2></div><p class="block-note">${html(note)}</p></div>
    <div class="booking-product-list">${cards}</div>
    <div class="booking-product-cta"><a href="${html(ctaUrl)}" rel="sponsored nofollow" target="_blank">${html(ctaText)}</a></div>
  </section>`;
}

function bookingCategoryPageHtml({ path, type, title, description, products = [] }) {
  const normalized = bookingProducts(products, type, type === "ticket" ? 18 : 12);
  const body = [
    `<div class="booking-page">`,
    bookingQuickSearch(type),
    bookingAffiliateNotice(type),
    bookingCityGrid(normalized, type),
    bookingProductSection(normalized, type),
    `</div>`,
  ].join("");
  return pageShell({
    path,
    title,
    description,
    kicker: type === "ticket" ? "입장권·투어" : "숙소·예약",
    tags: [
      { label: "여행지", href: "/travel/" },
      { label: "축제·행사", href: "/festival/" },
      { label: type === "ticket" ? "숙소" : "입장권·투어", href: type === "ticket" ? "/stay/" : "/ticket/" },
    ],
    body,
  });
}

function sectionBlock({ id, title, posts, note = "" }) {
  const items = sortedPosts(posts).slice(0, 9);
  const cards = items.map(storyCard).filter(Boolean);
  if (cards.length < 3) return "";
  return `<section class="block" id="${html(id)}" aria-labelledby="${html(id)}-title">
    <div class="block-head">
      <div><span class="kicker">TAG</span><h2 id="${html(id)}-title">${html(title)}</h2></div>
      ${note ? `<p class="block-note">${html(note)}</p>` : ""}
    </div>
    <div class="story-grid">${cards.join("")}</div>
  </section>`;
}

function pageShell({ path, title, description, kicker = "TRIPVIEW", tags = [], countLabel = "", bannerAsset = null, body }) {
  const canonical = canonicalUrl(path);
  const regionLinks = regionGroups().map((group) => ({ href: `/region/${group.slug}/`, label: group.label }));
  const bannerFigure = bannerAsset?.src
    ? `<figure class="hub-banner-image"><img src="${html(bannerAsset.src)}" alt="${html(tourImageAlt(bannerAsset))}" loading="lazy"><figcaption>${html(tourImageCaption(bannerAsset))}</figcaption></figure>`
    : "";
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    ${NAVER_VERIFICATION_META}
    <meta name="description" content="${html(description)}">
    <link rel="canonical" href="${html(canonical)}">
    ${PRETENDARD_LINK}
    <title>${html(title)} - 트립뷰</title>
    <style>${hubPageStyle()}</style>
  </head>
  <body>
    ${siteHeader(path)}
    <main class="site-page hub-page">
      <section class="hub-banner${bannerFigure ? " has-image" : ""}">
        <div class="hub-banner-copy">
          <span class="kicker">${html(kicker)}</span>
          <h1>${html(title)}</h1>
          <p>${html(description)}</p>
          ${countLabel ? `<span class="banner-count">${html(countLabel)}</span>` : ""}
          ${tags.length ? `<div class="tag-row">${tags.map((tag) => tag.href ? `<a href="${html(tag.href)}">${html(tag.label)}</a>` : `<span>${html(tag.label)}</span>`).join("")}</div>` : ""}
        </div>
        ${bannerFigure}
      </section>
      ${body}
    </main>
    ${siteFooter({ regionLinks })}
    ${siteNavScript()}
    <script src="/assets/homepage.js?v=booking-search-20260712-flight-links" defer></script>
    ${I18N_SCRIPT}
    ${TOPIC_FILTER_SCRIPT}
  </body>
</html>`;
}

function categoryPageHtml({ path, title, description, posts, tags = [], sections = [], products = [], affiliateSlot = "stay" }) {
  const rows = sortedPosts(posts).slice(0, 48);
  const rowCards = rows.map(storyCard).filter(Boolean);
  const allPostsSection = rowCards.length >= 3
    ? `<section class="block" id="all-posts" aria-labelledby="all-posts-title">
      <div class="block-head"><div><span class="kicker">ALL</span><h2 id="all-posts-title">${html(title)} 글 목록</h2></div><p class="block-note">최신 검수 글 기준</p></div>
      <div class="story-list">${rowCards.join("")}</div>
    </section>`
    : "";
  const affiliateSection = affiliateSlot === "ticket"
    ? ticketSlot({ title: "입장권·투어 카드", products, limit: 9 })
    : staySlot({ title: title === "숙소" ? "인기 숙소" : "추천 숙소", posts, products });
  const body = [
    ...sections.map(sectionBlock),
    affiliateSection,
    allPostsSection,
  ].join("");
  return pageShell({ path, title, description, kicker: "CATEGORY", tags, countLabel: rows.length >= 20 ? `총 ${rows.length.toLocaleString("ko-KR")}개 글` : "", body });
}

function subregionLabel(post = {}) {
  const compact = compactRegion(post?.region);
  const source = normalizeText(post?.region || "");
  const withoutCompact = source
    .replace(new RegExp(`^${compact}(?:특별시|광역시|특별자치시|특별자치도|도)?\\s*`), "")
    .replace(/^(?:전라|경상|충청)(?:남|북)도\s*/, "")
    .replace(/^강원특별자치도\s*/, "")
    .replace(/^제주특별자치도\s*/, "")
    .trim();
  const match = withoutCompact.match(/[가-힣]+(?:시|군|구)/);
  return match?.[0] || compact;
}

function subregionGroups(posts = []) {
  const groups = new Map();
  for (const post of posts) {
    const label = subregionLabel(post);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(post);
  }
  return [...groups.entries()]
    .map(([label, items]) => ({ label, posts: sortedPosts(items) }))
    .sort((a, b) => b.posts.length - a.posts.length || a.label.localeCompare(b.label, "ko"));
}

function subregionBlock(posts = []) {
  const groups = subregionGroups(posts).filter((group) => group.posts.length >= 1);
  if (groups.length < 2) return "";
  const cards = groups.slice(0, 12).map((group) => `<a class="subregion-card" href="/${encodeURIComponent(group.posts[0].slug)}/">
    <strong>${html(group.label)}</strong>
    <span>${html(group.posts.length.toLocaleString("ko-KR"))}개 글 · 대표 글 ${html(postTitle(group.posts[0]))}</span>
  </a>`).join("");
  return `<section class="block" id="subregions" aria-labelledby="subregions-title">
    <div class="block-head"><div><span class="kicker">LOCAL</span><h2 id="subregions-title">하위 시군구별 글</h2></div><p class="block-note">지역값을 기준으로 자동 그룹핑</p></div>
    <div class="subregion-grid">${cards}</div>
  </section>`;
}

function regionBannerAsset(group) {
  for (const post of group.posts) {
    const asset = tourImageBannerAssetForPost(processedTourImages, post);
    if (asset?.src) return asset;
  }
  return null;
}

function regionHubHtml(group) {
  const description = `${group.label} 지역의 여행지와 축제 글을 최신순으로 모았습니다. 지역 소개와 함께 관련 글, 추천 숙소를 한 번에 확인하세요.`;
  const products = selectAccommodationItems({ posts: group.posts, region: group.label, preset: "default", limit: 6 });
  const postCards = group.posts.map(storyCard).filter(Boolean);
  const postSection = postCards.length >= 3
    ? `<section class="block" id="region-posts" aria-labelledby="region-posts-title"><div class="block-head"><div><span class="kicker">POSTS</span><h2 id="region-posts-title">${html(group.label)} 글 목록</h2></div><p class="block-note">같은 광역 지역 기준</p></div><div class="story-list">${postCards.join("")}</div></section>`
    : "";
  const body = [
    `<section class="block" id="region-intro" aria-labelledby="region-intro-title"><div class="block-head"><div><span class="kicker">REGION</span><h2 id="region-intro-title">${html(group.label)} 여행 소개</h2></div><p class="block-note">${html(group.posts.length)}개 글</p></div><p>${html(group.label)} 여행은 계절 행사, 실내 명소, 자연 여행지를 함께 보면 동선 선택이 쉬워집니다. 아래 목록에서 방문 목적에 맞는 글을 먼저 확인하고, 숙소는 일정이 정해진 뒤 비교용으로 활용하세요.</p></section>`,
    staySlot({ title: `${group.label} 추천 숙소`, posts: group.posts, region: group.label, products, limit: 6 }),
    postSection,
    subregionBlock(group.posts),
  ].join("");
  return pageShell({
    path: `/region/${group.slug}/`,
    title: `${group.label} 여행 허브`,
    description,
    kicker: "REGION HUB",
    tags: [
      { label: "여행지", href: "/travel/" },
      { label: "축제", href: "/festival/" },
      { label: "숙소", href: "/stay/" },
      { label: "입장권·투어", href: "/ticket/" },
    ],
    countLabel: `${group.posts.length.toLocaleString("ko-KR")}개 글`,
    bannerAsset: regionBannerAsset(group),
    body,
  });
}

function regionIndexHtml(groups = regionGroups()) {
  const cards = groups.map((group) => {
    const lead = group.posts.find((post) => !isFestivalPost(post) && regionCardImage(post)) || group.posts.find((post) => regionCardImage(post));
    const image = regionCardImage(lead);
    if (!image) return "";
    const thumb = `<span class="story-thumb"><img src="${html(image)}" alt="${html(group.label)} 여행 허브 대표 글" loading="lazy"></span>`;
    return `<a class="story-card" href="/region/${html(group.slug)}/">
      ${thumb}
      <span class="story-card-body">
        <span class="story-label">지역 허브</span>
        <strong>${html(group.label)} 여행 허브</strong>
        <p>${html(group.label)} 지역 글 목록과 숙소, 하위 시군구 그룹을 확인합니다.</p>
        <span class="story-meta">${html(group.posts.length.toLocaleString("ko-KR"))}개 글</span>
      </span>
    </a>`;
  }).filter(Boolean).join("");
  return pageShell({
    path: "/region/",
    title: "지역별 여행 허브",
    description: "지역별 트립뷰 허브 목록입니다. 각 허브에서 지역 소개, 글 목록, 숙소, 하위 시군구 그룹을 확인할 수 있습니다.",
    kicker: "REGION",
    countLabel: `${groups.length.toLocaleString("ko-KR")}개 지역`,
    tags: [
      { label: "여행지", href: "/travel/" },
      { label: "축제·행사", href: "/festival/" },
      { label: "숙소", href: "/stay/" },
      { label: "입장권·투어", href: "/ticket/" },
    ],
    body: `<section class="block" id="region-list" aria-labelledby="region-list-title">
      <div class="block-head"><div><span class="kicker">HUBS</span><h2 id="region-list-title">지역 허브 목록</h2></div><p class="block-note">검수 글이 있는 지역만 표시</p></div>
      <div class="story-grid">${cards}</div>
    </section>`,
  });
}

async function writePage(pathname, document) {
  const parts = pathname.split("/").filter(Boolean);
  const dir = join(root, ...parts);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "index.html"), cleanGeneratedHtml(document), "utf8");
}

async function generateHubPages() {
  for (const dirName of ["travel", "festival", "stay", "ticket", "region"]) {
    await rm(join(root, dirName), { recursive: true, force: true });
  }

  const travelPosts = sortedPosts(indexablePosts.filter((post) => !isFestivalPost(post)));
  const festivalPosts = sortedPosts(indexablePosts.filter(isFestivalPost));
  const waterKeywords = ["수영장", "계곡", "해수욕장", "해변", "바다", "물놀이", "워터파크", "폭포", "수변"];
  const indoorKeywords = ["실내", "박물관", "미술관", "전시", "문화", "센터", "아트", "공연장"];
  const familyKeywords = ["아이", "가족", "어린이", "체험", "공원", "생태", "자연학습"];

  await writePage("/travel/", categoryPageHtml({
    path: "/travel/",
    title: "여행지",
    description: CATEGORY_PAGES[0].description,
    posts: travelPosts,
    tags: [
      { label: "이번 주말", href: "#tag-weekend" },
      { label: "물놀이·계곡", href: "#tag-water" },
      { label: "실내여행", href: "#tag-indoor" },
      { label: "아이와", href: "#tag-family" },
    ],
    sections: [
      { id: "tag-weekend", title: "이번 주말", posts: travelPosts.filter((post) => Array.isArray(post.editorialTopics) && post.editorialTopics.includes("weekend")), note: "기존 이번 주말 카테고리를 태그로 전환" },
      { id: "tag-water", title: "물놀이·계곡", posts: travelPosts.filter((post) => hasKeyword(post, waterKeywords)), note: "기존 물놀이 카테고리를 태그로 전환" },
      { id: "tag-indoor", title: "실내여행", posts: travelPosts.filter((post) => hasKeyword(post, indoorKeywords)), note: "기존 실내여행 카테고리를 태그로 전환" },
      { id: "tag-family", title: "아이와", posts: travelPosts.filter((post) => hasKeyword(post, familyKeywords)), note: "기존 아이와 카테고리를 태그로 전환" },
    ],
    products: selectMultiRegionAccommodations(travelPosts, 6),
  }));

  await writePage("/festival/", categoryPageHtml({
    path: "/festival/",
    title: "축제·행사",
    description: CATEGORY_PAGES[1].description,
    posts: festivalPosts,
    tags: [
      { label: "진행 중", href: "#ongoing" },
      { label: "예정", href: "#upcoming" },
      { label: "지난 축제", href: "#past" },
    ],
    sections: [
      { id: "ongoing", title: "진행 중인 축제", posts: festivalPosts.filter((post) => festivalStatus(post).ongoing), note: "오늘 기준 종료되지 않은 진행 중 축제" },
      { id: "upcoming", title: "예정 축제", posts: festivalPosts.filter((post) => festivalStatus(post).upcoming), note: "시작일이 남아 있는 축제" },
      { id: "past", title: "지난 축제", posts: festivalPosts.filter((post) => festivalStatus(post).ended), note: "종료된 축제는 하단에서 확인" },
    ],
    products: selectMultiRegionAccommodations(festivalPosts, 6),
  }));

  await writePage("/stay/", bookingCategoryPageHtml({
    path: "/stay/",
    type: "stay",
    title: "가격보다 위치와 취소 조건을 먼저 비교하세요",
    description: "국내 숙소를 예약하기 전 날짜, 인원, 취소 가능 여부, 위치 조건을 한 화면에서 확인할 수 있도록 정리했습니다.",
    products: accommodationProducts,
  }));

  await writePage("/ticket/", bookingCategoryPageHtml({
    path: "/ticket/",
    type: "ticket",
    title: "일정 확정 전에 운영 조건을 먼저 비교하세요",
    description: "국내 입장권과 현지투어를 예약하기 전 운영 시간, 집결지, 포함 사항, 환불 조건을 먼저 확인할 수 있도록 정리했습니다.",
    products: tnaProducts,
  }));

  for (const group of regionGroups()) {
    await writePage(`/region/${group.slug}/`, regionHubHtml(group));
  }
  await writePage("/region/", regionIndexHtml(regionGroups()));
}

async function generateFlightDealPages() {
  const deals = Array.isArray(flightDeals) ? flightDeals.filter((deal) => deal?.title && deal?.price) : [];
  const dir = join(root, "flight-deals");
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "index.html"), cleanGeneratedHtml(flightIndexHtml(deals)), "utf8");
  for (const deal of deals) {
    const pageDir = join(dir, flightSlug(deal));
    await mkdir(pageDir, { recursive: true });
    await writeFile(join(pageDir, "index.html"), cleanGeneratedHtml(flightPageHtml(deal)), "utf8");
  }
}

async function generateSitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${baseUrl}/`, lastmod: today },
    { loc: `${baseUrl}/about`, lastmod: today },
    { loc: `${baseUrl}/contact`, lastmod: today },
    { loc: `${baseUrl}/editorial-team`, lastmod: today },
    { loc: `${baseUrl}/editorial-policy`, lastmod: today },
    { loc: `${baseUrl}/affiliate-disclosure`, lastmod: today },
    { loc: `${baseUrl}/privacy`, lastmod: today },
    { loc: `${baseUrl}/terms`, lastmod: today },
    ...CATEGORY_PAGES.map((page) => ({ loc: canonicalUrl(page.path), lastmod: today })),
    { loc: `${baseUrl}/region/`, lastmod: today },
    ...regionGroups().map((group) => ({ loc: `${baseUrl}/region/${group.slug}/`, lastmod: today })),
    ...indexablePosts.map((post) => ({ loc: postUrl(post), lastmod: postDate(post) }))
  ];

  const body = urls
    .map(
      (item) => `  <url>
    <loc>${xml(item.loc)}</loc>
    <lastmod>${xml(item.lastmod)}</lastmod>
  </url>`
    )
    .join("\n");

  await writeFile(
    join(root, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`,
    "utf8"
  );
}

async function generateFeed() {
  const latest = postDate(indexablePosts[0] || {});
  const items = indexablePosts
    .slice(0, 50)
    .map(
      (post) => `    <item>
      <title>${xml(post.title)}</title>
      <link>${xml(postUrl(post))}</link>
      <guid>${xml(postUrl(post))}</guid>
      <description>${xml(postExcerpt(post))}</description>
      <category>${xml(post.category || "")}</category>
      <pubDate>${new Date(postDate(post)).toUTCString()}</pubDate>
    </item>`
    )
    .join("\n");

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>트립뷰</title>
    <link>${baseUrl}/</link>
    <description>국내여행과 공연/축제 여행 정보</description>
    <lastBuildDate>${new Date(latest).toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;

  await writeFile(join(root, "feed.xml"), feed, "utf8");
  await writeFile(join(root, "rss.xml"), feed, "utf8");
}

const MRT_AD_START = "<!-- MRT_AD_START";
const MRT_AD_END = "MRT_AD_END -->";
const MRT_STYLE_MARK = "/* tripview-mrt-native-ad */";
const MRT_ACCOMMODATION_START = "<!-- MRT_ACCOMMODATION_START";
const MRT_ACCOMMODATION_END = "MRT_ACCOMMODATION_END -->";
const MRT_ACCOMMODATION_STYLE_MARK = "/* tripview-mrt-accommodation-cards */";
const ARTICLE_SITE_STYLE_MARK = "/* tripview-site-design */";
const TRUST_NOTE_START = "<!-- TRUST_NOTE_START";
const TRUST_NOTE_END = "TRUST_NOTE_END -->";
const TRUST_STYLE_MARK = "/* tripview-trust-note */";
const REGION_RELATED_START = "<!-- REGION_RELATED_START";
const REGION_RELATED_END = "REGION_RELATED_END -->";
const REGION_RELATED_STYLE_MARK = "/* tripview-region-related */";
const ARTICLE_DISCLOSURE_START = "<!-- ARTICLE_DISCLOSURE_START";
const ARTICLE_DISCLOSURE_END = "ARTICLE_DISCLOSURE_END -->";
const ARTICLE_PHOTO_START = "<!-- ARTICLE_PHOTO_START";
const ARTICLE_PHOTO_END = "ARTICLE_PHOTO_END -->";
const ARTICLE_INLINE_PHOTO_START = "<!-- ARTICLE_INLINE_PHOTO_START";
const ARTICLE_INLINE_PHOTO_END = "ARTICLE_INLINE_PHOTO_END -->";
const LODGING_GUIDE_START = "<!-- LODGING_GUIDE_START";
const LODGING_GUIDE_END = "LODGING_GUIDE_END -->";
const LODGING_BOOKING_START = "<!-- LODGING_BOOKING_START";
const LODGING_BOOKING_END = "LODGING_BOOKING_END -->";
const ARTICLE_PRODUCT_START = "<!-- ARTICLE_PRODUCT_START";
const ARTICLE_PRODUCT_END = "ARTICLE_PRODUCT_END -->";
const ARTICLE_OFFICIAL_START = "<!-- ARTICLE_OFFICIAL_START";
const ARTICLE_OFFICIAL_END = "ARTICLE_OFFICIAL_END -->";
const ARTICLE_SOURCE_START = "<!-- ARTICLE_SOURCE_START";
const ARTICLE_SOURCE_END = "ARTICLE_SOURCE_END -->";
const COUPANG_AD_START = "<!-- COUPANG_AD_START";
const COUPANG_AD_END = "COUPANG_AD_END -->";
const COUPANG_WIDGET_START = "<!-- COUPANG_WIDGET_START";
const COUPANG_WIDGET_END = "COUPANG_WIDGET_END -->";
const COUPANG_STYLE_MARK = "/* tripview-coupang-native-ad */";
const COUPANG_SCRIPT = '<script src="/assets/coupang.js?v=coupang-20260708" defer></script>';

function articleAdCss() {
  return `${MRT_STYLE_MARK}.mrt-native-ad{margin:34px 0;padding:18px 0 20px;border-top:2px solid #111;border-bottom:1px solid var(--line)}.mrt-native-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:6px}.mrt-native-head strong{font-size:20px;line-height:1.25}.mrt-native-head span{color:var(--muted);font-size:13px}.mrt-affiliate-note{margin:0 0 12px;color:var(--muted);font-size:12px;line-height:1.55}.mrt-native-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px;border-top:1px solid var(--line)}.mrt-card{display:grid;grid-template-columns:88px minmax(0,1fr);gap:12px;align-items:center;padding:13px 0;border-bottom:1px solid var(--line)}.mrt-card.no-image{grid-template-columns:1fr}.mrt-thumb{grid-row:1/3;position:relative;display:block;width:100%;aspect-ratio:16/10;overflow:hidden;background:var(--card)}.mrt-thumb img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;display:block}.mrt-card strong{font-size:16px;line-height:1.35}.mrt-card em{display:block;color:var(--muted);font-size:12px;font-style:normal}.mrt-card.no-image strong,.mrt-card.no-image em{grid-column:1}@media(max-width:640px){.mrt-native-grid{grid-template-columns:1fr}.mrt-card{grid-template-columns:84px minmax(0,1fr)}}/* end-tripview-mrt-native-ad */`;
}

function articleSiteDesignCss() {
  return `${ARTICLE_SITE_STYLE_MARK}${SITE_CSS}
.hero{padding:40px 0 24px}
.hero h1{font-size:clamp(28px,5vw,46px);line-height:1.28}
.layout{padding-top:32px}
.layout.wrap{width:min(1120px,calc(100% - 40px))}
.content{max-width:760px;font-size:16px;line-height:1.8;word-break:keep-all;overflow-wrap:anywhere}
.content p{margin:0 0 24px}
.content h2{position:relative;margin:40px 0 16px;padding-left:12px;border-left:3px solid var(--brand);font-size:22px;line-height:1.35;font-weight:900}
.content h2:first-child{margin-top:0}
.content ul,.content ol{margin:0 0 24px;padding-left:1.25rem;line-height:1.8}
.content li+li{margin-top:8px}
.content strong{font-weight:900}
.cover-figure{margin-top:0}
.cover{width:100%;aspect-ratio:4/3;border-radius:8px;object-fit:cover}
.article-hero-band{position:relative;min-height:280px;background:linear-gradient(90deg,color-mix(in srgb,var(--ink) 76%,transparent),color-mix(in srgb,var(--ink) 28%,transparent)),var(--article-hero-image,linear-gradient(135deg,var(--ink),var(--brand)));background-size:cover;background-position:center;color:var(--card)}
.article-hero-inner{min-height:280px;display:flex;flex-direction:column;justify-content:flex-end;padding:32px 0}
.article-breadcrumb{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 12px;color:color-mix(in srgb,var(--card) 82%,transparent);font-size:12px;font-weight:800}
.article-breadcrumb a{text-decoration:underline;text-underline-offset:3px}
.article-hero-band h1{max-width:860px;margin:0 0 14px;font-size:clamp(28px,5vw,46px);line-height:1.22}
.article-hero-tags{display:flex;flex-wrap:wrap;gap:8px}
.article-tag{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border:1px solid color-mix(in srgb,var(--card) 38%,transparent);border-radius:999px;background:color-mix(in srgb,var(--card) 12%,transparent);font-size:12px;font-weight:900}
.article-hero-band .meta{margin-top:12px;color:color-mix(in srgb,var(--card) 84%,transparent)}
.article-hero-credit{margin-top:8px;color:color-mix(in srgb,var(--card) 72%,transparent);font-size:11px;line-height:1.45}
.article-hero-image-alt{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.article-affiliate-disclosure{width:var(--site-wrap);margin:18px auto 0;padding:12px 14px;border:1px solid color-mix(in srgb,var(--cta) 28%,var(--line));border-radius:8px;background:color-mix(in srgb,var(--cta) 13%,var(--card));color:var(--ink);font-size:13px;line-height:1.55}
.article-info-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:0 0 30px}
.article-info-card{display:grid;grid-template-columns:32px minmax(0,1fr);gap:10px;padding:14px;border:1px solid var(--line);border-radius:8px;background:var(--card)}
.article-info-icon{display:grid;place-items:center;width:32px;height:32px;border-radius:8px;background:var(--soft-teal);color:var(--brand);font-size:13px;font-weight:900}
.article-info-label{display:block;color:var(--muted);font-size:12px;font-weight:800}
.article-info-value{display:block;margin-top:2px;color:var(--ink);font-size:15px;font-weight:800;line-height:1.55;white-space:pre-line;word-break:keep-all;overflow-wrap:anywhere}
.article-fact-table{width:100%;margin:0 0 24px;border-collapse:separate;border-spacing:0;border:1px solid var(--line);border-radius:8px;background:var(--card);overflow:hidden;font-size:15px;line-height:1.65}
.article-fact-table th,.article-fact-table td{padding:12px 14px;border-bottom:1px solid var(--line);vertical-align:top;text-align:left}
.article-fact-table th{width:118px;background:color-mix(in srgb,var(--line) 28%,var(--card));color:var(--ink);font-weight:900}
.article-fact-table td{color:var(--ink);white-space:pre-line;word-break:keep-all;overflow-wrap:anywhere}
.article-fact-table tr:last-child th,.article-fact-table tr:last-child td{border-bottom:0}
.article-check-list{display:grid;gap:8px;list-style:none;padding:0!important}
.article-check-list li{position:relative;margin:0!important;padding:10px 12px 10px 24px;border:1px solid var(--line);border-radius:8px;background:var(--card)}
.article-check-list li::before{content:"";position:absolute;left:12px;top:20px;width:4px;height:4px;border-radius:50%;background:var(--brand)}
.inline-figure.article-inline-figure{margin:24px 0}
.inline-figure.article-inline-figure img{width:100%;aspect-ratio:16/10;border-radius:8px;object-fit:cover;object-position:center;background:var(--card)}
.inline-figure.article-inline-figure figcaption{margin-top:8px;color:var(--muted);font-size:12px;line-height:1.55}
.article-photo-grid{margin:26px 0 32px}
.article-photo-grid h2{margin-top:0}
.article-photo-items{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.article-photo-items figure{margin:0}
.article-photo-items img{width:100%;aspect-ratio:4/3;border-radius:8px}
.article-photo-items figcaption{margin-top:6px;color:var(--muted);font-size:12px}
.article-lodging-layout{display:grid;grid-template-columns:minmax(0,760px) 280px;gap:32px;align-items:start}
.article-lodging-layout .content{max-width:none}
.lodging-photo-guide{margin:34px 0 30px;padding:20px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.lodging-photo-guide h2{margin-top:0}
.lodging-photo-item{display:grid;gap:12px;margin:0 0 24px}
.lodging-photo-item:last-child{margin-bottom:0}
.lodging-photo-item figure{margin:0}
.lodging-photo-item img{width:100%;aspect-ratio:16/10;border-radius:8px;object-fit:cover;object-position:center;background:var(--card)}
.lodging-photo-item figcaption{margin-top:8px;color:var(--muted);font-size:12px;line-height:1.55}
.lodging-photo-item p{margin:0!important}
.lodging-booking-aside{position:sticky;top:92px;display:grid;gap:10px;padding:16px;border:1px solid color-mix(in srgb,var(--cta) 32%,var(--line));border-left:3px solid var(--cta);border-radius:8px;background:var(--card)}
.lodging-booking-aside h2{margin:0;font-size:18px;line-height:1.35}
.lodging-booking-aside p{margin:0;color:var(--muted);font-size:13px;line-height:1.6}
.lodging-booking-price{color:var(--cta)!important;font-size:18px!important;font-weight:900}
.lodging-booking-button{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 14px;border-radius:8px;background:var(--cta);color:var(--card);font-weight:900;transition:background-color 150ms ease}
.lodging-booking-button:hover,.lodging-booking-button:focus-visible{background:var(--cta-hover)}
.article-product-section{margin:36px 0 0;padding:22px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.article-product-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:12px}
.article-product-head h2{margin:0;padding-left:12px;border-left:3px solid var(--brand);font-size:20px}
.article-product-note{margin:0 0 14px;color:var(--muted);font-size:12px;line-height:1.55}
.article-place-intro{margin:0 0 28px}
.article-product-compare-wrap{margin:0 0 16px;overflow-x:auto}
.article-product-compare{width:100%;min-width:560px;border-collapse:separate;border-spacing:0;border:1px solid var(--line);border-radius:8px;background:var(--card);overflow:hidden;font-size:13px;line-height:1.55}
.article-product-compare th,.article-product-compare td{padding:10px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
.article-product-compare th{background:color-mix(in srgb,var(--line) 28%,var(--card));color:var(--ink);font-weight:900}
.article-product-compare td{color:var(--ink)}
.article-product-compare td:first-child{font-weight:800}
.article-product-compare tr:last-child td{border-bottom:0}
.article-product-section .mrt-accommodation-grid,.article-product-section .mrt-ticket-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.article-product-section .mrt-accommodation-grid[data-count="1"],.article-product-section .mrt-ticket-grid[data-count="1"]{grid-template-columns:minmax(0,1fr)}
.article-product-section .mrt-accommodation-grid[data-count="2"],.article-product-section .mrt-ticket-grid[data-count="2"]{grid-template-columns:repeat(2,minmax(0,1fr))}
.article-product-section .article-product-card,.article-product-section .mrt-ticket-card{display:block;min-width:0;padding:0;overflow:hidden;border:1px solid var(--line);border-left:3px solid var(--cta);border-radius:8px;background:var(--card);transition:border-color 150ms ease}
.article-product-section .article-product-card:hover,.article-product-section .article-product-card:focus-visible,.article-product-section .mrt-ticket-card:hover,.article-product-section .mrt-ticket-card:focus-visible{border-color:var(--brand);border-left-color:var(--cta)}
.article-product-section .mrt-accommodation-thumb,.article-product-section .mrt-ticket-thumb{position:relative;display:block;width:100%;aspect-ratio:16/10;overflow:hidden;background:var(--card)}
.article-product-section .mrt-accommodation-thumb img,.article-product-section .mrt-ticket-thumb img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;display:block}
.article-product-section .mrt-accommodation-body,.article-product-section .mrt-ticket-body{display:grid;gap:5px;padding:12px}
.article-product-section .mrt-accommodation-meta{display:block;color:var(--muted);font-size:12px;font-style:normal}
.article-product-section .mrt-accommodation-badge{justify-self:start;border-radius:999px;background:var(--cta);color:var(--card);padding:2px 7px;font-size:11px;font-weight:900;line-height:1.35}
.article-product-section .mrt-accommodation-price,.article-product-section .mrt-ticket-price{display:flex;flex-wrap:wrap;align-items:baseline;gap:5px;color:var(--cta);font-size:16px;font-weight:900}
.article-product-section .mrt-accommodation-price del{color:var(--muted);font-size:12px;font-weight:400}
.article-product-section .mrt-accommodation-price small{flex-basis:100%;color:var(--muted);font-size:11px;font-weight:400}
.article-product-section .article-product-cta{justify-self:start;display:inline-flex;align-items:center;min-height:28px;margin-top:2px;padding:0 9px;border-radius:999px;background:var(--cta);color:var(--card);font-size:12px;font-weight:900}
.mrt-rating-badge{position:absolute;left:8px;top:8px;border-radius:999px;background:color-mix(in srgb,var(--ink) 82%,transparent);color:var(--card);padding:3px 7px;font-size:11px;font-weight:900}
.article-official-box{margin:22px 0 0}
.article-official-button{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 16px;border-radius:8px;background:var(--brand);color:var(--card);font-weight:900;transition:background-color 150ms ease}
.article-official-button:hover,.article-official-button:focus-visible{background:var(--brand-hover)}
.tourapi-source-box{margin:22px 0 0;padding:14px;border:1px solid var(--line);border-radius:8px;background:color-mix(in srgb,var(--line) 36%,var(--card));color:var(--muted);font-size:13px;line-height:1.6}
.related-posts,.region-related,.trust-note{border-top:1px solid var(--line)}
footer.site-footer{padding:0;color:var(--muted)}
@media(max-width:820px){.hero{padding-top:32px}.layout{padding-top:24px}.layout.wrap{width:calc(100% - 40px)}.content{font-size:15px;line-height:1.8}.content h2{margin:36px 0 16px;font-size:20px}.article-lodging-layout{display:block}.lodging-booking-aside{position:static;margin:28px 0 0}.article-info-grid,.article-product-section .mrt-accommodation-grid,.article-product-section .mrt-ticket-grid{grid-template-columns:1fr}.article-fact-table th{width:96px}.article-photo-items{grid-template-columns:1fr}.article-hero-band,.article-hero-inner{min-height:240px}.article-affiliate-disclosure{width:var(--site-wrap)}}/* end-tripview-site-design */`;
}

function articleAccommodationCss() {
  return `${MRT_ACCOMMODATION_STYLE_MARK}.mrt-accommodation-block{margin:34px 0;padding:18px 0 20px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.mrt-accommodation-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:6px}.mrt-accommodation-head h2{margin:0;font-size:20px;line-height:1.35;font-weight:800}.mrt-accommodation-head span{color:var(--muted);font-size:13px}.mrt-accommodation-note{margin:0 0 12px;color:var(--muted);font-size:12px;line-height:1.55}.mrt-accommodation-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.mrt-accommodation-grid[data-count="1"]{grid-template-columns:minmax(0,1fr)}.mrt-accommodation-grid[data-count="2"]{grid-template-columns:repeat(2,minmax(0,1fr))}.mrt-accommodation-card{position:relative;display:grid;grid-template-columns:88px minmax(0,1fr);gap:12px;align-items:center;min-width:0;padding:12px;border:1px solid var(--line);border-left:3px solid var(--cta);border-radius:8px;background:var(--card);transition:border-color 150ms ease}.mrt-accommodation-card:hover,.mrt-accommodation-card:focus-visible{border-color:var(--brand);border-left-color:var(--cta)}.mrt-accommodation-thumb{position:relative;display:block;width:100%;aspect-ratio:16/10;overflow:hidden;background:var(--card)}.mrt-accommodation-thumb img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;display:block}.mrt-accommodation-body{display:grid;gap:4px;min-width:0}.mrt-accommodation-body strong{font-size:15px;line-height:1.35;font-weight:800}.mrt-accommodation-body em,.mrt-accommodation-meta{display:block;color:var(--muted);font-size:12px;font-style:normal}.mrt-accommodation-badge{justify-self:start;border-radius:999px;background:var(--cta);color:var(--card);padding:2px 7px;font-size:11px;font-weight:900;line-height:1.35}.mrt-accommodation-price{display:flex;flex-wrap:wrap;align-items:baseline;gap:5px}.mrt-accommodation-price del{color:var(--muted);font-size:12px}.mrt-accommodation-price strong{font-size:16px}.mrt-accommodation-price small{flex-basis:100%;color:var(--muted);font-size:11px}.article-product-cta{justify-self:start;display:inline-flex;align-items:center;min-height:28px;margin-top:2px;padding:0 9px;border-radius:999px;background:var(--cta);color:var(--card);font-size:12px;font-weight:900}@media(max-width:640px){.mrt-accommodation-head{display:block}.mrt-accommodation-grid{grid-template-columns:1fr}.mrt-accommodation-card{grid-template-columns:84px minmax(0,1fr)}}/* end-tripview-mrt-accommodation-cards */`;
}

function articleCoupangCss() {
  return `${COUPANG_STYLE_MARK}.coupang-native-ad,.coupang-widget-ad{margin:30px 0;padding:18px 0 20px;border-top:2px solid var(--ink);border-bottom:1px solid var(--line)}.coupang-native-ad h2,.coupang-widget-ad h2{margin:0 0 8px;font-size:22px}.coupang-native-ad .affiliate-disclosure,.coupang-widget-ad .affiliate-disclosure{margin:0 0 13px;color:var(--muted);font-size:12px;line-height:1.55}.coupang-native-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px;border-top:1px solid var(--line)}.coupang-card strong{font-size:16px}.coupang-widget-scroll{width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden;padding-bottom:2px}.coupang-widget-inner{width:680px;max-width:680px;min-height:140px}@media(max-width:640px){.coupang-native-grid{grid-template-columns:1fr}}/* end-tripview-coupang-native-ad */`;
}

function articleTrustCss() {
  return `${TRUST_STYLE_MARK}.meta .author-link,.trust-note a{font-weight:900;text-decoration:underline;text-underline-offset:3px}.meta .festival-status{color:var(--ink);font-weight:900}.trust-note{margin:36px 0 10px;padding:18px 0 0;border-top:1px solid var(--line);color:var(--ink)}.trust-note h2{margin:0 0 12px;font-size:20px;line-height:1.35}.trust-note dl{display:grid;grid-template-columns:118px minmax(0,1fr);gap:8px 14px;margin:0 0 14px}.trust-note dt{font-weight:900;color:var(--ink)}.trust-note dd{margin:0}.trust-note p{margin:0 0 10px;color:var(--muted);font-size:14px;line-height:1.6}@media(max-width:520px){.trust-note dl{grid-template-columns:1fr;gap:4px}.trust-note dd{padding-bottom:8px;border-bottom:1px solid var(--line)}}/* end-tripview-trust-note */`;
}

function articleRegionRelatedCss() {
  return `${REGION_RELATED_STYLE_MARK}.region-related{margin:34px 0;padding:18px 0 20px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.region-related-head{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin-bottom:12px}.region-related h2{margin:0;font-size:20px;line-height:1.35}.region-hub-link{color:var(--brand);font-size:13px;font-weight:900;text-decoration:underline;text-underline-offset:3px;white-space:nowrap}.region-related-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.region-related-card{display:grid;grid-template-rows:auto 1fr;overflow:hidden;border:1px solid var(--line);border-radius:8px;background:var(--card);transition:border-color 150ms ease}.region-related-card:hover,.region-related-card:focus-visible{border-color:var(--brand)}.region-related-thumb{position:relative;display:block;width:100%;aspect-ratio:16/10;overflow:hidden;background:var(--card)}.region-related-thumb img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;display:block}.region-related-body{display:grid;gap:6px;padding:12px}.region-related-card.no-image{display:block;padding:13px}.region-related-card.no-image .region-related-body{padding:0}.region-related-card strong{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;font-size:15px;line-height:1.35}.region-related-card span{display:block;color:var(--muted);font-size:12px}.region-related-empty{margin:0;color:var(--muted);font-size:14px}@media(max-width:900px){.region-related-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:640px){.region-related-head{display:block}.region-hub-link{display:inline-block;margin-top:8px}.region-related-grid{grid-template-columns:1fr}}/* end-tripview-region-related */`;
}

function stripExistingArticleAds(document) {
  return document
    .replace(new RegExp(`${MRT_AD_START}[\\s\\S]*?${MRT_AD_END}`, "g"), "")
    .replace(new RegExp(`${MRT_ACCOMMODATION_START}[\\s\\S]*?${MRT_ACCOMMODATION_END}`, "g"), "")
    .replace(new RegExp(`${TRUST_NOTE_START}[\\s\\S]*?${TRUST_NOTE_END}`, "g"), "")
    .replace(new RegExp(`${REGION_RELATED_START}[\\s\\S]*?${REGION_RELATED_END}`, "g"), "")
    .replace(new RegExp(`${ARTICLE_DISCLOSURE_START}[\\s\\S]*?${ARTICLE_DISCLOSURE_END}`, "g"), "")
    .replace(new RegExp(`${ARTICLE_PHOTO_START}[\\s\\S]*?${ARTICLE_PHOTO_END}`, "g"), "")
    .replace(new RegExp(`${ARTICLE_INLINE_PHOTO_START}[\\s\\S]*?${ARTICLE_INLINE_PHOTO_END}`, "g"), "")
    .replace(new RegExp(`${LODGING_GUIDE_START}[\\s\\S]*?${LODGING_GUIDE_END}`, "g"), "")
    .replace(new RegExp(`${LODGING_BOOKING_START}[\\s\\S]*?${LODGING_BOOKING_END}`, "g"), "")
    .replace(new RegExp(`${ARTICLE_PRODUCT_START}[\\s\\S]*?${ARTICLE_PRODUCT_END}`, "g"), "")
    .replace(new RegExp(`${ARTICLE_OFFICIAL_START}[\\s\\S]*?${ARTICLE_OFFICIAL_END}`, "g"), "")
    .replace(new RegExp(`${ARTICLE_SOURCE_START}[\\s\\S]*?${ARTICLE_SOURCE_END}`, "g"), "")
    .replace(new RegExp(`${COUPANG_AD_START}[\\s\\S]*?${COUPANG_AD_END}`, "g"), "")
    .replace(new RegExp(`${COUPANG_WIDGET_START}[\\s\\S]*?${COUPANG_WIDGET_END}`, "g"), "")
    .replace(/\s*<section class=["']related-posts["'][\s\S]*?<\/section>/gi, "")
    .replace(/\s*<aside class=["']aside["'][^>]*>\s*<strong>운영 메모<\/strong>[\s\S]*?<\/aside>/gi, "")
    .replace(/\s*<p class=["']note["']>일정과 세부 운영[\s\S]*?<\/p>/gi, "")
    .replace(/\/\* tripview-site-design \*\/[\s\S]*?\/\* end-tripview-site-design \*\//g, "")
    .replace(/\/\* tripview-mrt-native-ad \*\/[\s\S]*?\/\* end-tripview-mrt-native-ad \*\//g, "")
    .replace(/\/\* tripview-mrt-accommodation-cards \*\/[\s\S]*?\/\* end-tripview-mrt-accommodation-cards \*\//g, "")
    .replace(/\/\* tripview-trust-note \*\/[\s\S]*?\/\* end-tripview-trust-note \*\//g, "")
    .replace(/\/\* tripview-region-related \*\/[\s\S]*?\/\* end-tripview-region-related \*\//g, "")
    .replace(/\/\* tripview-coupang-native-ad \*\/[\s\S]*?\/\* end-tripview-coupang-native-ad \*\//g, "")
    .replace(/\s*class=["']wrap layout article-lodging-layout["']/g, ' class="wrap layout"')
    .replace(/\s*<script\s+src=["']\/assets\/coupang\.js\?v=[^"']+["']\s+defer><\/script>/g, "")
    .replace(/\s*<script\s+src=["']https:\/\/ads-partners\.coupang\.com\/g\.js["']><\/script>/g, "")
    .replace(/\s*<script\s+src=["']\/assets\/beach-(?:info|weather)\.js\?v=[^"']+["']\s+defer><\/script>/g, "");
}

function stripArticleSiteDesignCss(document) {
  return String(document).replace(/\/\* tripview-site-design \*\/[\s\S]*?\/\* end-tripview-site-design \*\//g, "");
}

function refreshArticleSiteDesignCss(document) {
  const withoutExisting = stripArticleSiteDesignCss(document);
  return withoutExisting.includes("</style>")
    ? withoutExisting.replace("</style>", `${articleSiteDesignCss()}</style>`)
    : withoutExisting;
}

function injectArticleAdCss(document, includeAffiliate = false, includeRegionRelated = false, includeAccommodation = false, includeCoupang = false) {
  let next = refreshArticleSiteDesignCss(document);
  if (includeAffiliate && !next.includes(MRT_STYLE_MARK)) next = next.replace("</style>", `${articleAdCss()}</style>`);
  if (includeAccommodation && !next.includes(MRT_ACCOMMODATION_STYLE_MARK)) next = next.replace("</style>", `${articleAccommodationCss()}</style>`);
  if (includeRegionRelated && !next.includes(REGION_RELATED_STYLE_MARK)) next = next.replace("</style>", `${articleRegionRelatedCss()}</style>`);
  if (includeCoupang && !next.includes(COUPANG_STYLE_MARK)) next = next.replace("</style>", `${articleCoupangCss()}</style>`);
  if (!next.includes(TRUST_STYLE_MARK)) next = next.replace("</style>", `${articleTrustCss()}</style>`);
  return next;
}

function formatKoreanDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(value || "");
  return `${match[1]}년 ${Number(match[2])}월 ${Number(match[3])}일`;
}

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function articleSourceLinks(post) {
  const sources = [];
  if (post?.contentid) {
    sources.push({ label: "한국관광공사 국내여행 정보", url: "https://korean.visitkorea.or.kr/" });
  }
  const official = safeHttpUrl(post?.tourApi?.homepage);
  if (official && !sources.some((source) => source.url === official)) {
    sources.push({ label: "운영기관 공식 안내", url: official });
  }
  return sources;
}

function articleSourceHtml(post) {
  const links = articleSourceLinks(post);
  if (!links.length) return "트립뷰 편집 기준";
  return links
    .map((source) => `<a href="${html(source.url)}" target="_blank" rel="noopener">${html(source.label)}</a>`)
    .join(" · ");
}

function articleImageSource(post) {
  const images = [post?.image, ...(Array.isArray(post?.images) ? post.images : [])].filter(Boolean);
  if (!images.length) return "이미지 없음";
  if (tourImageEntry(processedTourImages, post) || images.some(isTourApiImage)) return TOUR_IMAGE_SOURCE_LABEL;
  return "본문 표기 이미지 또는 공개 자료";
}

function articleTrustSourceNotes(post) {
  const notes = [];
  const kind = post?.dataPipeline?.kind || "";
  const slug = String(post?.slug || "");
  if (kind === "stay-price" || slug === "data-stay-ticket-seoul") notes.push("숙소 정보는 마이리얼트립 상품 정보 기준입니다.");
  if (kind === "ticket-price" || slug === "data-stay-ticket-seoul") notes.push("상품 정보는 마이리얼트립 상품 정보 기준입니다.");
  if (kind === "festival-schedule" || post?.contentid || post?.tourApi) {
    notes.push("관광 정보는 공공 관광 정보를 바탕으로 정리했습니다.");
  }
  if (articleImageSource(post) === TOUR_IMAGE_SOURCE_LABEL) {
    notes.push("사진은 공공누리 출처 표기를 유지했습니다.");
  }
  return notes;
}

function articleTrustBlock(post) {
  const reviewed = isIndexablePost(post);
  const checkedAt = reviewed ? formatKoreanDate(post.editorialReviewedAt) : "준비 중";
  const authorProfile = post.editorialAuthorProfile || "/editorial-team";
  const sourceNotes = articleTrustSourceNotes(post).map((note) => `<p>${html(note)}</p>`).join("");
  return `${TRUST_NOTE_START} -->
<aside class="trust-note" aria-label="콘텐츠 신뢰 정보">
  <h2>작성·검수 정보</h2>
  <dl>
    <dt>작성자</dt><dd><a href="${html(authorProfile)}">${html(post.editorialReviewer || "트립뷰 편집팀")}</a></dd>
    <dt>최종 확인일</dt><dd>${html(checkedAt)}</dd>
  </dl>
  ${sourceNotes}
  <p>운영 시간, 요금, 프로그램, 주차 가능 여부는 현장 사정에 따라 바뀔 수 있습니다. 출발 전 공식 안내나 현장 문의처를 한 번 더 확인하는 것을 권장합니다.</p>
  <p>글 안의 예약, 숙소, 투어, 상품 링크는 제휴 링크일 수 있으며 예약 또는 구매가 발생할 경우 트립뷰가 일정 수수료를 받을 수 있습니다. 정정 요청은 <a href="/editorial-policy">운영 기준</a>, <a href="/affiliate-disclosure">제휴 안내</a>, <a href="/contact">문의</a>에서 보낼 수 있습니다.</p>
</aside>
<!-- ${TRUST_NOTE_END}`;
}

function alignArticleByline(document, post) {
  const profile = post.editorialAuthorProfile || "/editorial-team";
  const byline = `<div class="meta"><a class="author-link" href="${html(profile)}">${html(post.editorialReviewer || "트립뷰 편집팀")}</a>`;
  return String(document).replace(
    /<div class="meta">(?:<span>트립뷰 편집팀<\/span>|<a class="author-link"[^>]*>[^<]*<\/a>)/,
    byline,
  );
}

function injectFestivalStatus(document, post) {
  let next = String(document).replace(/\s*<span class=["']festival-status\b[^"']*["']>[^<]*<\/span>/gi, "");
  if (!festivalStatus(post).ended) return next;
  return next.replace(/<div class=["']meta["']>/i, '<div class="meta"><span class="festival-status is-ended">종료</span>');
}

function publicImageUrl(value = "") {
  const src = String(value || "");
  if (!src) return "";
  if (src.startsWith("/")) return `${baseUrl}${src}`;
  return src;
}

function cssImageUrl(value = "") {
  return String(value || "")
    .replaceAll("\\", "/")
    .replaceAll("'", "%27")
    .replaceAll("(", "%28")
    .replaceAll(")", "%29");
}

function ensureLazyImages(document) {
  return String(document).replace(/<img\b(?![^>]*\bloading=)([^>]*?)>/gi, "<img loading=\"lazy\"$1>");
}

function applyProcessedMetaImages(document, cover) {
  if (!cover?.src) return document;
  const imageUrl = html(publicImageUrl(cover.src));
  return String(document)
    .replace(/(<meta\s+property=["']og:image["']\s+content=["'])[^"']*(["'])/i, `$1${imageUrl}$2`)
    .replace(/(<meta\s+property=["']og:image:secure_url["']\s+content=["'])[^"']*(["'])/i, `$1${imageUrl}$2`)
    .replace(/(<meta\s+name=["']twitter:image["']\s+content=["'])[^"']*(["'])/i, `$1${imageUrl}$2`)
    .replace(/(<link\s+rel=["']image_src["']\s+href=["'])[^"']*(["'])/i, `$1${imageUrl}$2`);
}

function processedFigure(asset, className) {
  const imageClass = className === "cover-figure" ? ' class="cover"' : "";
  return `<figure class="${className}"><img${imageClass} src="${html(asset.src)}" alt="${html(tourImageAlt(asset))}" loading="lazy" /><figcaption>${html(tourImageCaption(asset))}</figcaption></figure>`;
}

function applyProcessedArticleImages(document, post) {
  const entry = tourImageEntry(processedTourImages, post);
  if (!entry?.cover?.src) return ensureLazyImages(document);
  let next = applyProcessedMetaImages(document, entry.cover);
  next = next.replace(/<figure class="cover-figure">[\s\S]*?<\/figure>/, processedFigure(entry.cover, "cover-figure"));
  next = next.replace(/<figure class="inline-figure">[\s\S]*?<\/figure>/g, (figure) => {
    const original = figure.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1] || "";
    const asset = tourImageAssetForSource(processedTourImages, post, original);
    return asset?.src ? processedFigure(asset, "inline-figure") : ensureLazyImages(figure);
  });
  return ensureLazyImages(next);
}

const ARTICLE_HEADING_REWRITES = new Map([
  ["이 축제를 어떻게 보면 좋을까", "관람 포인트"],
  ["어떤 일정에 어울릴까", "관람 포인트"],
  ["어떤 일정에 넣기 좋은 곳인가", "관람 포인트"],
  ["한눈에 보는 방문 포인트", "관람 포인트"],
  ["이번 일정에서 먼저 볼 점", "관람 포인트"],
  ["편집팀이 먼저 본 핵심", "관람 포인트"],
  ["운영 정보에서 놓치기 쉬운 부분", "운영 정보"],
  ["위치와 운영 확인", "운영 정보"],
  ["방문 전 확인할 정보", "운영 정보"],
  ["운영정보를 자세히 보면", "운영 정보"],
  ["프로그램 고르는 법", "프로그램 구성"],
  ["프로그램을 고르는 법", "프로그램 구성"],
  ["현장에서 볼 포인트", "프로그램 구성"],
  ["주변 동선 잡기", "이동과 귀가"],
  ["교통과 현장 동선", "이동과 귀가"],
  ["이동과 귀가 팁", "이동과 귀가"],
  ["주소와 도착 동선", "이동과 귀가"],
  ["동선과 준비물", "이동과 귀가"],
  ["준비물과 방문 팁", "비용과 준비물"],
  ["비용과 예약 확인", "비용과 준비물"],
  ["출발 전 마지막 확인", "예약 전 확인 순서"],
  ["정보 확인 순서", "예약 전 확인 순서"],
]);

const ARTICLE_DELETED_SECTION_HEADINGS = new Set([
  "자료 기준",
  "본문에서 제외한 내용",
]);

const VERBOSE_PROCESS_PATTERNS = [
  /방문 전 확인할 만한 세부 정보는/,
  /현재 확인된 핵심 정보는/,
  /본문에 넣지 않았습니다/,
  /표에 넣었습니다/,
  /만들지 않았습니다/,
  /생성하지 않았습니다/,
  /검증할 수 없어/,
  /확인할 수 없어/,
  /대조할 수 있는 항목/,
  /수동 검수 콘텐츠/,
  /항목만 사용했습니다/,
  /기준으로 작성했으며/,
  /저장되어 있습니다/,
  /운영 관련 안내는/,
  /^요금은 .+로 안내됩니다/,
  /이 정보는 제목이나 대표 이미지보다 실제 일정에 더 직접적으로 영향을 줍니다/,
  /홈페이지:\s*https?:\/\//i,
];

function replaceArticleContent(document, mapper) {
  return String(document).replace(
    /(<article\b[^>]*\bclass=["'][^"']*\bcontent\b[^"']*["'][^>]*>)([\s\S]*?)(<\/article>)/i,
    (_match, open, body, close) => `${open}${mapper(body)}${close}`,
  );
}

function normalizeArticleHeadingText(value = "") {
  const text = stripTags(value);
  if (!text) return "";
  const direct = ARTICLE_HEADING_REWRITES.get(text);
  if (direct) return direct;
  if (/^(?:자주 묻는 질문|작성·검수 정보|사진으로 확인하기|함께 볼 글|이 지역 입장권·투어|지역 인기 숙소)/.test(text)) return text;
  if (/이 축제|어떤 일정|어떤 곳|한눈|먼저 볼 점|방문 포인트/.test(text)) return "관람 포인트";
  if (/운영\s*정보|운영정보|위치와 운영|방문 전 확인/.test(text)) return "운영 정보";
  if (/일정|운영 흐름/.test(text)) return "일정과 운영 흐름";
  if (/프로그램|현장에서 볼|관람 순서|체류 시간/.test(text)) return "프로그램 구성";
  if (/비용|요금|준비물|동행자별 준비/.test(text)) return "비용과 준비물";
  if (/이동|귀가|동선|주소|도착|교통|주변/.test(text)) return "이동과 귀가";
  return text.replace(/[?？]\s*$/g, "");
}

function normalizeArticleHeadings(document) {
  return replaceArticleContent(document, (body) => body.replace(
    /<h2([^>]*)>([\s\S]*?)<\/h2>/gi,
    (match, attrs, label) => {
      const normalized = normalizeArticleHeadingText(label);
      if (!normalized) return match;
      return `<h2${attrs}>${html(normalized)}</h2>`;
    },
  ));
}

function cleanFactValue(value = "") {
  return plainFieldValue(value)
    .replace(/https?:\/\/[^\s<>"']+/g, "")
    .replace(/([^\n])※/g, "$1\n※")
    .replace(/([^\n])\s*-\s*(?=(?:평일|토요일|일요일|월요일|화요일|수요일|목요일|금요일|주말|공휴일|매표|성인|소인|어린이|청소년|경로|주요|부대|전시|공연|\d{1,2}:))/g, "$1\n- ")
    .replace(/\s*\/\s*(?=(?:주차|쉬는 날|이용 시간|행사 장소|행사 기간|프로그램|이용 요금|문의|요금|시간|장소)\s*:)/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function articleFactTable(post) {
  if (isDataPipelinePost(post)) return "";
  const items = articleInfoItems(post)
    .map((item) => ({ ...item, value: cleanFactValue(item.value) }))
    .filter((item) => item.value)
    .slice(0, 7);
  if (!items.length) return "";
  return `<table class="article-fact-table" aria-label="운영 정보 표"><tbody>${items.map((item) => `<tr><th>${html(item.label)}</th><td>${html(item.value)}</td></tr>`).join("")}</tbody></table>`;
}

function splitProgramItems(value = "") {
  const normalized = plainFieldValue(value)
    .replace(/\d+\.\s*/g, " ")
    .replace(/(?:메인|주요|부대|공연|소비자 참여|전시 연계)\s*(?:행사|프로그램)?\s*[:：]/g, " ")
    .replace(/기타\s*내용\s*[:：]/g, " ");
  return [...new Set(normalized
    .split(/[,·ㆍ/]|(?:\s+-\s+)|(?:\s+및\s+)|(?:\s+등\s*)/)
    .map((item) => normalizeText(item).replace(/^[:：-]+/, "").trim())
    .filter((item) => item.length >= 2 && item.length <= 64))]
    .slice(0, 8);
}

function articleProgramList(post) {
  const raw = firstInfoValue(post, "주요 프로그램", "방문 포인트", "체험 안내") || introValue(post, "program", "subevent", "expguide");
  const items = splitProgramItems(raw);
  if (items.length < 2) return "";
  return `<ul class="article-check-list article-program-list" aria-label="프로그램 구성">${items.map((item) => `<li>${html(item)}</li>`).join("")}</ul>`;
}

function insertArticleFactBlocks(document, post) {
  return replaceArticleContent(document, (body) => {
    let next = body.replace(/\s*<table\b[^>]*\bclass=["'][^"']*\barticle-fact-table\b[^"']*["'][^>]*>[\s\S]*?<\/table>/gi, "");
    const factTable = articleFactTable(post);
    if (factTable && !next.includes("article-fact-table")) {
      const target = next.match(/<h2[^>]*>\s*(?:운영 정보|일정과 운영 흐름|비용과 준비물)\s*<\/h2>/i);
      next = target
        ? `${next.slice(0, target.index + target[0].length)}${factTable}${next.slice(target.index + target[0].length)}`
        : `${factTable}${next}`;
    }
    const programList = articleProgramList(post);
    if (programList && !next.includes("article-program-list")) {
      next = next.replace(/(<h2[^>]*>\s*프로그램 구성\s*<\/h2>)/i, `$1${programList}`);
    }
    return next;
  });
}

function sentenceUnits(value = "") {
  const text = normalizeText(value);
  const protectedText = text.replace(/(\d)\.(\d)/g, "$1__DECIMAL_POINT__$2");
  const sentences = protectedText
    .match(/[^.!?。]+[.!?。]?/g)
    ?.map((sentence) => normalizeText(sentence.replaceAll("__DECIMAL_POINT__", ".")))
    .filter(Boolean) || [text];
  const units = [];
  for (const sentence of sentences) {
    if (sentence.length <= 96) {
      units.push(sentence);
      continue;
    }
    const parts = sentence.split(/,\s+|;\s+| · /).map(normalizeText).filter(Boolean);
    if (parts.length > 1) units.push(...parts);
    else units.push(sentence);
  }
  return units;
}

function splitReadableParagraphs(value = "") {
  const units = sentenceUnits(value);
  const paragraphs = [];
  let current = "";
  for (const unit of units) {
    if (current && `${current} ${unit}`.length > 110) {
      paragraphs.push(current);
      current = unit;
    } else {
      current = [current, unit].filter(Boolean).join(" ");
    }
  }
  if (current) paragraphs.push(current);
  return paragraphs;
}

function emphasizeFirstMetric(escaped = "") {
  return escaped.replace(
    /(\d{1,2}:\d{2}(?:\s*~\s*\d{1,2}:\d{2})?|\d{1,3}(?:,\d{3})+(?:원|개|건|명)?|\d+(?:\.\d+)?점|\d+개월|\d+개|\d+건|\d+명|\d+분|\d+월\s*\d+일)/,
    "<strong>$1</strong>",
  );
}

function feeRowsFromText(text = "") {
  if (!/^요금 기준은\s+/.test(text)) return [];
  let feeText = normalizeText(text.replace(/^요금 기준은\s+/, ""));
  const endIndex = feeText.indexOf("입니다.");
  if (endIndex >= 0) feeText = feeText.slice(0, endIndex);
  feeText = feeText
    .replace(/\s*(\[[^\]]+\])/g, "\n$1")
    .replace(/\s*※\s*/g, "\n※ ")
    .replace(/\s+-\s*/g, "\n")
    .replace(/\)\s*-\s*/g, ")\n")
    .replace(/(원|%)\s*-\s*/g, "$1\n")
    .replace(/\s*\/\s*(?=(?:성인|소인|어린이|청소년|경로|광주|여주|만|초등|장애|국가|현역|ICOM|예술|단체|버스|체험|공연|특별|자유|개별|통합))/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
  return feeText
    .split(/\n+/)
    .map((item) => normalizeText(item).replace(/^[:：-]+/, "").trim())
    .filter((item) => item.length >= 2)
    .slice(0, 18);
}

function feeAdviceFromText(text = "") {
  const match = normalizeText(text).match(/입니다\.\s*(.+)$/);
  return match?.[1] || "";
}

function feeListBlock(text = "", attrs = "") {
  const rows = feeRowsFromText(text);
  if (rows.length < 2) return "";
  const advice = feeAdviceFromText(text);
  return `<ul class="article-check-list article-fee-list" aria-label="요금 구분">${rows.map((item) => `<li>${emphasizeFirstMetric(html(item))}</li>`).join("")}</ul>${advice ? `<p${attrs}>${html(advice)}</p>` : ""}`;
}

function repairBrokenNumericMarkup(document) {
  return String(document)
    .replace(/<strong>(\d+)개<\/strong>\s*월/g, "<strong>$1개월</strong>")
    .replace(/(\d+)\.\s*<strong>(\d+(?:점)?)<\/strong>/g, "<strong>$1.$2</strong>")
    .replace(/(\d+),\s*<strong>(\d{3}(?:원|개|건|명)?)<\/strong>/g, "<strong>$1,$2</strong>")
    .replace(/(\d+)\.\s+(\d+)(?=\s*(?:점|·|,|<\/p>))/g, "$1.$2")
    .replace(/(\d+),\s+(\d{3})(?=\s*(?:원|개|건|명|·|,|<\/p>))/g, "$1,$2")
    .replace(/\s+,/g, ",");
}

function shouldDropArticleParagraph(text = "") {
  return VERBOSE_PROCESS_PATTERNS.some((pattern) => pattern.test(text));
}

function splitLongArticleParagraphs(document) {
  return replaceArticleContent(document, (body) => body.replace(
    /<p([^>]*)>([\s\S]*?)<\/p>/gi,
    (match, attrs, content, offset, source) => {
      if (/\bclass=["'][^"']*(?:article-affiliate-disclosure|article-product-note|mrt-affiliate-note|note|region-related-empty)/i.test(attrs)) return match;
      const text = stripTags(content);
      if (!text) return "";
      if (shouldDropArticleParagraph(text)) return "";
      const feeBlock = feeListBlock(text, attrs);
      if (feeBlock) return feeBlock;
      if (/<\/summary>\s*$/i.test(source.slice(Math.max(0, offset - 80), offset))) return match;
      if (/<(?:img|figure|table|ul|ol|details|section|aside)\b/i.test(content)) return match;
      return splitReadableParagraphs(text)
        .map((paragraph) => `<p${attrs}>${emphasizeFirstMetric(html(paragraph))}</p>`)
        .join("");
    },
  ));
}

function replaceVisibleArticleUrls(document, post) {
  const official = officialUrlForPost(post);
  return replaceArticleContent(document, (body) => body.replace(
    />([^<>]*https?:\/\/[^<>]+)</gi,
    (_match, text) => {
      const replaced = text.replace(/https?:\/\/[^\s<>"']+/gi, (rawUrl) => {
        const suffix = rawUrl.match(/[.,)]$/)?.[0] || "";
        const cleanUrl = suffix ? rawUrl.slice(0, -suffix.length) : rawUrl;
        const href = safeHttpUrl(cleanUrl);
        if (!href) return suffix;
        const label = official && href === official ? "공식 안내" : "관련 안내";
        return `<a href="${html(href)}" target="_blank" rel="noopener">${label}</a>${suffix}`;
      });
      return `>${replaced}<`;
    },
  ));
}

function removeDeletedArticleSections(document) {
  return replaceArticleContent(document, (body) => body.replace(
    /\s*<h2[^>]*>([\s\S]*?)<\/h2>[\s\S]*?(?=\s*<h2\b|\s*<section\b|\s*<aside\b|$)/gi,
    (match, heading) => ARTICLE_DELETED_SECTION_HEADINGS.has(stripTags(heading)) ? "" : match,
  ));
}

function articleInlineAssets(post) {
  const entry = tourImageEntry(processedTourImages, post);
  const assets = [
    ...(Array.isArray(entry?.images) ? entry.images : []),
    entry?.cover,
  ].filter((asset) => asset?.src);
  const seen = new Set();
  return assets.filter((asset) => {
    if (seen.has(asset.src)) return false;
    seen.add(asset.src);
    return true;
  }).slice(0, 3);
}

function lodgingPhotoAssets(post) {
  if (!isLodgingPost(post)) return [];
  const sources = postImagesWithProcessed(processedTourImages, post).filter(Boolean);
  const seen = new Set();
  return sources
    .filter((src) => {
      if (seen.has(src)) return false;
      seen.add(src);
      return true;
    })
    .slice(0, 3)
    .map((src) => {
      const asset = tourImageAssetForSource(processedTourImages, post, src);
      const place = lodgingPlaceName(post);
      const region = compactRegion(post?.region);
      return {
        src,
        alt: asset ? tourImageAlt(asset, post) : `${region} ${place} 숙소 외관과 주변 분위기`,
        caption: asset ? tourImageCaption(asset) : `출처: ${TOUR_IMAGE_SOURCE_LABEL} · 트립뷰 편집 이미지`,
      };
    });
}

function lodgingPhotoGuideParagraph(post, index) {
  const place = lodgingPlaceName(post);
  const region = compactRegion(post?.region);
  const checkIn = introValue(post, "checkintime");
  const checkOut = introValue(post, "checkouttime");
  const roomType = introValue(post, "roomtype");
  const facilities = introValue(post, "subfacility");
  const parking = introValue(post, "parkinglodging") || firstInfoValue(post, "주차");
  const options = [
    `${place} 사진에서는 숙소 외관과 주변 분위기를 먼저 확인할 수 있습니다. 예약 전에는 위치, 객실 조건, 취소 마감 시각을 함께 비교하세요.`,
    [roomType ? `객실 유형은 ${roomType}입니다.` : "", facilities ? `부대시설은 ${facilities}입니다.` : "", "동행 인원에 맞는 객실명과 포함 서비스를 예약 화면에서 다시 확인하세요."].filter(Boolean).join(" "),
    [`${region} 일정에 넣을 때는 숙소 주변 이동 시간을 같이 잡는 편이 좋습니다.`, parking ? `주차는 ${parking}입니다.` : "", checkIn || checkOut ? `체크인·아웃은 ${[checkIn, checkOut].filter(Boolean).join(" / ")} 기준입니다.` : ""].filter(Boolean).join(" "),
  ].filter(Boolean);
  return options[index] || options[0];
}

function lodgingPhotoGuideBlock(post) {
  const assets = lodgingPhotoAssets(post);
  if (!assets.length) return "";
  return `${LODGING_GUIDE_START} -->
<section class="lodging-photo-guide" aria-labelledby="lodging-photo-guide-title">
  <h2 id="lodging-photo-guide-title">숙소 사진으로 확인할 부분</h2>
  ${assets.map((asset, index) => `<div class="lodging-photo-item">
    <figure><img src="${html(asset.src)}" alt="${html(asset.alt)}" loading="lazy" decoding="async"><figcaption>${html(asset.caption)}</figcaption></figure>
    <p>${html(lodgingPhotoGuideParagraph(post, index))}</p>
  </div>`).join("")}
</section>
<!-- ${LODGING_GUIDE_END}`;
}

function ensureLodgingPhotoGuide(document, post) {
  if (!isLodgingPost(post)) return document;
  const block = lodgingPhotoGuideBlock(post);
  if (!block) return document;
  return replaceArticleContent(document, (body) => {
    const next = body.replace(new RegExp(`${LODGING_GUIDE_START}[\\s\\S]*?${LODGING_GUIDE_END}`, "g"), "");
    const introRe = /(<section class=["']article-place-intro["'][\s\S]*?<\/section>)/i;
    return introRe.test(next)
      ? next.replace(introRe, `$1${block}`)
      : `${block}${next}`;
  });
}

function injectArticleInlinePhotos(document, post) {
  return replaceArticleContent(document, (body) => {
    let next = body
      .replace(new RegExp(`${ARTICLE_INLINE_PHOTO_START}[\\s\\S]*?${ARTICLE_INLINE_PHOTO_END}`, "g"), "")
      .replace(/\s*<figure class=["'][^"']*\barticle-inline-figure\b[\s\S]*?<\/figure>/gi, "");
    const figures = articleInlineAssets(post).map((asset, index) => `${ARTICLE_INLINE_PHOTO_START} ${index + 1} -->${processedFigure(asset, "inline-figure article-inline-figure")}<!-- ${ARTICLE_INLINE_PHOTO_END}`);
    if (!figures.length) return next;
    const headings = [...next.matchAll(/<h2\b[^>]*>[\s\S]*?<\/h2>/gi)];
    if (!headings.length) return `${figures[0]}${next}`;
    let offset = 0;
    figures.forEach((figure, index) => {
      const headingIndex = Math.min((index + 1) * 3 - 1, headings.length);
      const insertAt = headingIndex < headings.length ? headings[headingIndex].index + offset : next.length;
      next = `${next.slice(0, insertAt)}${figure}${next.slice(insertAt)}`;
      offset += figure.length;
    });
    return next;
  });
}

function improveArticleReadability(document, post) {
  let next = normalizeArticleHeadings(document);
  next = removeDeletedArticleSections(next);
  next = insertArticleFactBlocks(next, post);
  next = replaceVisibleArticleUrls(next, post);
  if (!isDataPipelinePost(post)) {
    next = splitLongArticleParagraphs(next);
    if (!isLodgingPost(post)) next = injectArticleInlinePhotos(next, post);
  }
  return repairBrokenNumericMarkup(next);
}

function articleCategoryLabel(post) {
  if (articleActivePath(post) === "/ticket/") return "입장권·투어";
  if (articleActivePath(post) === "/stay/") return "숙소";
  return isFestivalPost(post) ? "축제·행사" : "여행지";
}

function articleCategoryPath(post) {
  return articleActivePath(post);
}

function articleReadTime(post) {
  const explicit = normalizeText(post?.read);
  if (explicit) return explicit;
  const length = normalizeText([postTitle(post), postExcerpt(post), ...(Array.isArray(post?.sections) ? post.sections.flat() : [])].join(" ")).length;
  return `${Math.max(2, Math.ceil(length / 520))}분 읽기`;
}

function articleHeroBand(post) {
  const image = postImage(post);
  const coverAsset = tourImageEntry(processedTourImages, post)?.cover || null;
  const label = articleCategoryLabel(post);
  const categoryPath = articleCategoryPath(post);
  const region = compactRegion(post?.region);
  const status = festivalStatus(post).ended ? "종료" : "";
  const tags = [status, label, region, isIndexablePost(post) ? "검수 완료" : "검수 대기"].filter(Boolean);
  const imageStyle = image ? ` style="--article-hero-image:url('${html(cssImageUrl(image))}')" ` : "";
  const credit = coverAsset?.src ? tourImageCaption(coverAsset) : "";
  const alt = coverAsset?.src ? tourImageAlt(coverAsset, post) : "";
  return `<section class="article-hero-band"${imageStyle}aria-labelledby="article-title">
        <div class="wrap article-hero-inner">
          ${alt ? `<span class="article-hero-image-alt" role="img" aria-label="${html(alt)}"></span>` : ""}
          <nav class="article-breadcrumb" aria-label="글 위치"><a href="/">홈</a><span>/</span><a href="${html(categoryPath)}">${html(label)}</a><span>/</span><a href="/region/${html(regionSlug(region))}/">${html(region)}</a></nav>
          <h1 id="article-title">${html(postTitle(post))}</h1>
          <div class="article-hero-tags">${tags.map((tag) => `<span class="article-tag">${html(tag)}</span>`).join("")}</div>
          <div class="meta"><a class="author-link" href="${html(post.editorialAuthorProfile || "/editorial-team")}">${html(post.editorialReviewer || "트립뷰 편집팀")}</a><span>${html(formatDate(postDate(post)))}</span><span>${html(articleReadTime(post))}</span><span>${html(post?.region || region)}</span></div>
          ${credit ? `<span class="article-hero-credit">${html(credit)}</span>` : ""}
        </div>
      </section>`;
}

function applyArticleHeroBand(document, post) {
  let next = String(document)
    .replace(/\s*<section class=["']article-hero-band["'][\s\S]*?<\/section>/gi, "")
    .replace(/\s*<section class=["']wrap hero["'][\s\S]*?<\/section>/i, "\n      ")
    .replace(/\s*<figure class=["']cover-figure["'][\s\S]*?<\/figure>/i, "\n      ");
  return next.includes("<main>")
    ? next.replace(/<main>/i, `<main>\n      ${articleHeroBand(post)}`)
    : next;
}

function articleAffiliateDisclosureBlock() {
  return `${ARTICLE_DISCLOSURE_START} -->
<p class="article-affiliate-disclosure">이 글에는 예약·입장권 제휴 링크가 포함될 수 있습니다. 링크를 통해 예약 또는 구매가 발생하면 트립뷰가 일정 수수료를 받을 수 있습니다.</p>
<!-- ${ARTICLE_DISCLOSURE_END}`;
}

function injectArticleAffiliateDisclosure(document, enabled) {
  let next = String(document)
    .replace(new RegExp(`${ARTICLE_DISCLOSURE_START}[\\s\\S]*?${ARTICLE_DISCLOSURE_END}`, "g"), "")
    .replace(/\s*<p class=["']article-affiliate-disclosure["'][\s\S]*?<\/p>/gi, "");
  if (!enabled) return next;
  const marker = '<section class="wrap layout">';
  return next.includes(marker)
    ? next.replace(marker, `${articleAffiliateDisclosureBlock()}\n      ${marker}`)
    : next;
}

function plainFieldValue(value = "") {
  return normalizeText(String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&"));
}

function usefulInfoValue(value = "") {
  const text = plainFieldValue(value);
  if (!text) return "";
  if (/방문 전(?:\s*공식)?\s*안내\s*확인|방문 전 확인 필요|확인 필요|전화 문의 요망/.test(text)) return "";
  if (/^[-–—]+$/.test(text)) return "";
  return text;
}

function introValue(post, ...keys) {
  const intro = post?.tourApi?.intro || {};
  for (const key of keys) {
    const value = usefulInfoValue(intro[key]);
    if (value) return value;
  }
  return "";
}

function firstInfoValue(post, ...labels) {
  for (const label of labels) {
    const value = usefulInfoValue(infoValue(post, label));
    if (value) return value;
  }
  return "";
}

function articleInfoItems(post) {
  if (isDataPipelinePost(post)) {
    return (Array.isArray(post?.info) ? post.info : [])
      .map((row) => Array.isArray(row) ? { label: normalizeText(row[0]), icon: normalizeText(row[0]).slice(0, 1), value: usefulInfoValue(row[1]) } : null)
      .filter((item) => item?.label && item.value)
      .slice(0, 8);
  }
  const schedule = isFestivalPost(post) ? usefulInfoValue(festivalSchedule(post).label) || introValue(post, "eventstartdate", "eventenddate") : firstInfoValue(post, "기간", "일정");
  const baseItems = [
    { label: "일정", icon: "일", value: schedule },
    { label: "장소", icon: "장", value: firstInfoValue(post, "장소", "주소") || usefulInfoValue(post?.region) },
    { label: "문의", icon: "문", value: firstInfoValue(post, "문의") || introValue(post, "infocenter", "infocenterculture", "infocenterleports", "infocenterlodging", "infocentershopping", "infocenterfood", "sponsor1tel") },
    { label: "주최", icon: "주", value: firstInfoValue(post, "주최") || introValue(post, "sponsor1", "sponsor2") },
    { label: "운영 시간", icon: "시", value: firstInfoValue(post, "운영 시간", "운영 확인", "이용 시간", "시간") || introValue(post, "usetime", "usetimeculture", "usetimeleports", "opentime", "opentimefood", "playtime") },
    { label: "이용 요금", icon: "요", value: firstInfoValue(post, "이용 요금", "요금") || introValue(post, "usefee", "usefeeleports", "usetimefestival", "saleitemcost") },
  ];
  const lodgingItems = isLodgingPost(post)
    ? [
      { label: "체크인·아웃", icon: "체", value: [introValue(post, "checkintime"), introValue(post, "checkouttime")].filter(Boolean).join(" / ") },
      { label: "객실 수", icon: "객", value: introValue(post, "roomcount") },
      { label: "객실 유형", icon: "형", value: introValue(post, "roomtype") },
      { label: "부대시설", icon: "부", value: introValue(post, "subfacility") },
      { label: "취사", icon: "취", value: introValue(post, "chkcooking") },
      { label: "주차", icon: "주", value: introValue(post, "parkinglodging") || firstInfoValue(post, "주차") },
    ]
    : [];
  const limit = isLodgingPost(post) ? 10 : 6;
  return [...baseItems, ...lodgingItems]
    .filter((item, index, list) => item.value && list.findIndex((candidate) => candidate.label === item.label) === index)
    .slice(0, limit);
}

function articleInfoGrid(post) {
  const items = articleInfoItems(post);
  if (!items.length) return "";
  return `<div class="article-info-grid" aria-label="방문 기본 정보">${items.map((item) => `<div class="article-info-card"><span class="article-info-icon" aria-hidden="true">${html(item.icon)}</span><span><span class="article-info-label">${html(item.label)}</span><strong class="article-info-value">${html(cleanFactValue(item.value))}</strong></span></div>`).join("")}</div>`;
}

function replaceArticleInfoTable(document, post) {
  const grid = articleInfoGrid(post);
  const withoutExistingGrid = String(document).replace(/\s*<div class=["']article-info-grid["'] aria-label=["']방문 기본 정보["']>(?:<div class=["']article-info-card["'][\s\S]*?<\/div>)+<\/div>/gi, "");
  const hasTable = /<table class=["']info-table["']/.test(withoutExistingGrid);
  let next = hasTable
    ? withoutExistingGrid.replace(/\s*<table class=["']info-table["'][\s\S]*?<\/table>/i, grid)
    : withoutExistingGrid;
  if (!hasTable && grid) {
    next = next.replace(/<article class=["']content["']>/i, `<article class="content">${grid}`);
  }
  return next;
}

function articlePhotoGrid(post) {
  if (isLodgingPost(post)) return "";
  const images = postImagesWithProcessed(processedTourImages, post).filter(Boolean).slice(0, 6);
  if (images.length < 3) return "";
  const figures = images.map((src) => {
    const asset = tourImageAssetForSource(processedTourImages, post, src) || { src, alt: postTitle(post), caption: "" };
    return `<figure><img src="${html(src)}" alt="${html(tourImageAlt(asset, post))}" loading="lazy" decoding="async"><figcaption>${html(tourImageCaption(asset))}</figcaption></figure>`;
  }).join("");
  return `${ARTICLE_PHOTO_START} -->
<section class="article-photo-grid" aria-labelledby="article-photo-title">
  <h2 id="article-photo-title">사진으로 확인하기</h2>
  <div class="article-photo-items">${figures}</div>
</section>
<!-- ${ARTICLE_PHOTO_END}`;
}

function injectArticlePhotoGrid(document, post) {
  let next = String(document).replace(new RegExp(`${ARTICLE_PHOTO_START}[\\s\\S]*?${ARTICLE_PHOTO_END}`, "g"), "");
  const block = articlePhotoGrid(post);
  if (!block) return next;
  if (next.includes("</div><h2")) return next.replace("</div><h2", `</div>${block}<h2`);
  return next.replace(/<article class=["']content["']>/i, `<article class="content">${block}`);
}

function paidDayVisitPost(post) {
  if (isDataPipelinePost(post) || isLodgingPost(post)) return false;
  return /입장료|입장권|티켓|관람권|이용권|현장 구매|사전\s*예매|예매|입장 마감|무료 입장|매표|케이블카|천문대|박물관|미술관|과학관|동굴|테마파크|아쿠아리움|전망대|모노레일|유람선|스카이파크/.test(searchablePostText(post));
}

function articleTicketItems(post, count = 6) {
  return selectAffiliateProducts({
    sectionId: "booking",
    posts: [post],
    products: tnaProducts,
    limit: count,
  });
}

function articleTicketProductCard(product = {}) {
  return ticketProductCard(product).replace('class="mrt-ticket-card"', 'class="mrt-ticket-card article-product-card"');
}

function productComparisonPrice(product = {}, type = "ticket") {
  if (type === "accommodation") {
    const normalized = normalizeAccommodationProduct(product);
    return normalized?.priceText || won(normalized?.salePrice) || "";
  }
  return normalizeText(product.priceText || won(product.salePrice || product.price) || "");
}

function productComparisonType(product = {}, type = "ticket") {
  if (type === "accommodation") return accommodationStarLabel(product.starRating) || product.category || "숙소";
  return normalizeText(product.category || product.type || "입장권·투어");
}

function productComparisonCondition(product = {}, type = "ticket") {
  if (type === "accommodation") {
    const normalized = normalizeAccommodationProduct(product);
    const rating = bookingRatingText(normalized || product);
    return [accommodationStayLabel(), rating].filter(Boolean).join(" · ");
  }
  const rating = bookingRatingText(product);
  const instant = Array.isArray(product.tags) && product.tags.includes("즉시 확정") ? "즉시 확정" : "";
  return [instant, rating, product.region || product.city].filter(Boolean).join(" · ") || "예약 화면에서 조건 확인";
}

function articleProductComparisonTable(items = [], type = "ticket") {
  const rows = items.slice(0, 6)
    .map((product) => ({
      title: normalizeText(product.title || product.name),
      type: productComparisonType(product, type),
      price: productComparisonPrice(product, type),
      condition: productComparisonCondition(product, type),
    }))
    .filter((row) => row.title && row.price);
  if (!rows.length) return "";
  return `<div class="article-product-compare-wrap">
    <table class="article-product-compare" aria-label="예약 상품 비교">
      <thead><tr><th>상품명</th><th>유형</th><th>가격</th><th>확인할 조건</th></tr></thead>
      <tbody>${rows.map((row) => `<tr><td>${html(row.title)}</td><td>${html(row.type)}</td><td>${html(row.price)}</td><td>${html(row.condition)}</td></tr>`).join("")}</tbody>
    </table>
  </div>`;
}

function articleProductSection(post) {
  if (paidDayVisitPost(post)) {
    const products = articleTicketItems(post, 6);
    const cards = products.map(articleTicketProductCard).filter(Boolean);
    if (!cards.length) return "";
    return `${ARTICLE_PRODUCT_START} ticket -->
<section class="article-product-section" aria-label="입장권·투어 카드" data-article-product-type="ticket">
  <div class="article-product-head"><h2>이 지역 입장권·투어</h2><span>마이리얼트립</span></div>
  <p class="article-product-note">방문지 성격과 지역 기준으로 연결한 제휴 상품입니다. 가격과 이용 조건은 예약 화면에서 다시 확인해야 합니다.</p>
  ${articleProductComparisonTable(products, "ticket")}
  <div class="mrt-ticket-grid" data-count="${cards.length}">${cards.join("")}</div>
</section>
<!-- ${ARTICLE_PRODUCT_END}`;
  }
  const products = articleAccommodationItems(post, 6);
  const cards = products.map(articleAccommodationCard).filter(Boolean);
  if (!cards.length) return "";
  return `${ARTICLE_PRODUCT_START} accommodation -->
<section class="article-product-section" aria-label="지역 인기 숙소" data-article-product-type="accommodation">
  <div class="article-product-head"><h2>${html(compactRegion(post?.region))} 인기 숙소</h2><span>마이리얼트립 숙소</span></div>
  <p class="article-product-note">성인 2명 기준 주말 1박 요금입니다. 예약 화면에서 날짜와 취소 조건을 다시 확인하세요.</p>
  ${articleProductComparisonTable(products, "accommodation")}
  <div class="mrt-accommodation-grid" data-count="${cards.length}">${cards.join("")}</div>
</section>
<!-- ${ARTICLE_PRODUCT_END}`;
}

function injectArticleProductSection(document, block) {
  if (!block || !String(document).includes("</article>")) return document;
  return String(document).replace("</article>", `${block}</article>`);
}

function lodgingMatchName(value = "") {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\[[^\]]+\]|\([^)]*\)/g, " ")
    .replace(/(?:체크인|방문|운영|위치|주차|확인|예약|가이드)[\s\S]*$/g, " ")
    .replace(/(?:서울|부산|인천|대구|대전|광주|울산|세종|제주|강원|경기|충북|충남|전북|전남|경북|경남)(?:특별시|광역시|특별자치시|특별자치도|도)?/g, " ")
    .replace(/[가-힣]+(?:시|군|구)\s+/g, " ")
    .replace(/[^0-9a-z가-힣]+/g, "");
}

function matchingLodgingProduct(post) {
  if (!isLodgingPost(post)) return null;
  const region = compactRegion(post?.region);
  const postName = lodgingMatchName(lodgingPlaceName(post));
  if (!postName) return null;
  return accommodationProducts
    .map((item) => normalizeAccommodationProduct(item))
    .find((product) => {
      if (!product || compactRegion(product.region) !== region) return false;
      const productName = lodgingMatchName(product.title);
      return productName && (productName.includes(postName) || postName.includes(productName));
    }) || null;
}

function lodgingBookingSidebar(post) {
  if (!isLodgingPost(post)) return "";
  const product = matchingLodgingProduct(post);
  const place = lodgingPlaceName(post);
  const href = product?.url || "/stay/";
  const external = /^https:\/\//i.test(href);
  const linkAttrs = external ? ' rel="sponsored nofollow" target="_blank"' : "";
  const price = product?.priceText || "가격과 객실 조건은 예약 허브에서 확인하세요.";
  const cta = product ? "예약하기" : "숙소 예약처 보기";
  return `${LODGING_BOOKING_START} -->
<aside class="lodging-booking-aside" aria-label="숙소 예약 확인">
  <h2>${html(place)} 예약 확인</h2>
  <p class="lodging-booking-price">${html(price)}</p>
  <p>날짜, 인원, 취소 가능 여부를 먼저 비교한 뒤 예약 화면에서 최종 조건을 확인하세요.</p>
  <a class="lodging-booking-button" href="${html(href)}"${linkAttrs}>${html(cta)}</a>
</aside>
<!-- ${LODGING_BOOKING_END}`;
}

function injectLodgingBookingSidebar(document, post) {
  if (!isLodgingPost(post)) return document;
  const block = lodgingBookingSidebar(post);
  if (!block) return document;
  let next = String(document)
    .replace(new RegExp(`${LODGING_BOOKING_START}[\\s\\S]*?${LODGING_BOOKING_END}`, "g"), "")
    .replace(/\s*class=["']wrap layout article-lodging-layout["']/g, ' class="wrap layout"');
  next = next.replace(/<section class=["']wrap layout["']>/i, '<section class="wrap layout article-lodging-layout">');
  return next.replace(
    /(<section class=["']wrap layout article-lodging-layout["'][^>]*>[\s\S]*?<\/article>)(\s*<\/section>)/i,
    `$1${block}$2`,
  );
}

function injectCoupangAdBlock(document, block) {
  if (!block || !String(document).includes("</article>")) return document;
  return String(document).replace("</article>", `${block}</article>`);
}

function firstHttpUrl(value = "") {
  const text = String(value || "").replaceAll("&amp;", "&");
  const href = text.match(/href=["']([^"']+)["']/i)?.[1] || text.match(/https?:\/\/[^\s<>"']+/i)?.[0] || "";
  return safeHttpUrl(href);
}

function officialUrlForPost(post) {
  return safeHttpUrl(post?.tourApi?.homepage) || firstHttpUrl(infoValue(post, "홈페이지"));
}

function articleOfficialBlock(post) {
  const url = officialUrlForPost(post);
  if (!url) return "";
  return `${ARTICLE_OFFICIAL_START} -->
<div class="article-official-box"><a class="article-official-button" href="${html(url)}" target="_blank" rel="noopener">공식 안내 확인</a></div>
<!-- ${ARTICLE_OFFICIAL_END}`;
}

function articleTourApiSourceBlock(post) {
  return "";
}

function injectArticleOfficialBlock(document, block) {
  if (!block || !String(document).includes("</article>")) return document;
  return String(document).replace("</article>", `${block}</article>`);
}

function injectArticleTourApiSource(document, block) {
  if (!block || !String(document).includes("</article>")) return document;
  return String(document).replace("</article>", `${block}</article>`);
}

const PLACE_INTRO_SECTION_RE = /\s*<section class=["']article-place-intro["'][\s\S]*?<\/section>/gi;
const RAW_PLACE_INTRO_RE = /\s*<h2[^>]*>\s*장소 소개\s*<\/h2>(?:\s*<p[^>]*>[\s\S]*?<\/p>)+/gi;

function lodgingIntroParagraphs(post) {
  if (!isLodgingPost(post)) return [];
  const overview = usefulInfoValue(post?.tourApi?.overview || "");
  if (overview) return splitReadableParagraphs(overview).slice(0, 4);
  const title = postTitle(post);
  const region = compactRegion(post?.region);
  const facts = [
    introValue(post, "roomcount") ? `객실 수는 ${introValue(post, "roomcount")}입니다.` : "",
    introValue(post, "roomtype") ? `객실 유형은 ${introValue(post, "roomtype")}입니다.` : "",
    introValue(post, "subfacility") ? `부대시설은 ${introValue(post, "subfacility")}입니다.` : "",
    introValue(post, "chkcooking") ? `취사 가능 여부는 ${introValue(post, "chkcooking")}입니다.` : "",
  ].filter(Boolean);
  return [
    `${title}은 ${region} 숙박 일정에서 위치와 객실 조건을 함께 확인할 수 있는 숙소입니다.`,
    ...facts,
  ].slice(0, 4);
}

function lodgingPlaceIntroBlock(post) {
  const paragraphs = lodgingIntroParagraphs(post);
  if (!paragraphs.length) return "";
  return `<section class="article-place-intro" aria-labelledby="article-place-intro-title">
    <h2 id="article-place-intro-title">장소 소개</h2>
    ${paragraphs.map((paragraph) => `<p>${html(paragraph)}</p>`).join("")}
  </section>`;
}

function ensureLodgingPlaceIntro(document, post) {
  if (!isLodgingPost(post)) return document;
  const block = lodgingPlaceIntroBlock(post);
  if (!block) return document;
  return replaceArticleContent(document, (body) => {
    let next = body
      .replace(PLACE_INTRO_SECTION_RE, "")
      .replace(RAW_PLACE_INTRO_RE, "");
    const gridRe = /(<div class=["']article-info-grid["'] aria-label=["']방문 기본 정보["']>(?:<div class=["']article-info-card["'][\s\S]*?<\/div>)+<\/div>)/i;
    return gridRe.test(next)
      ? next.replace(gridRe, `$1${block}`)
      : `${block}${next}`;
  });
}

function stripTourOverviewSection(document, post = null) {
  if (isLodgingPost(post)) return document;
  return replaceArticleContent(document, (body) => body
    .replace(PLACE_INTRO_SECTION_RE, "")
    .replace(RAW_PLACE_INTRO_RE, ""));
}

function schemaDate(value, fallback = CONTENT_TODAY) {
  const text = normalizeText(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const dates = extractScheduleDates(text);
  return dates[0] || fallback;
}

function schemaImages(post) {
  const images = postImagesWithProcessed(processedTourImages, post).map(publicImageUrl).filter(Boolean);
  return images.length ? images : [publicImageUrl(postImage(post))].filter(Boolean);
}

function schemaScript(name, schema) {
  const json = JSON.stringify(schema).replaceAll("<", "\\u003c");
  return `    <script type="application/ld+json" data-tripview-${name}>${json}</script>`;
}

function articleSchema(post) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: postTitle(post),
    description: postSummary(post, 180) || postExcerpt(post),
    mainEntityOfPage: postUrl(post),
    datePublished: schemaDate(post.sortDate || post.updatedAt || post.date),
    dateModified: schemaDate(post.editorialReviewedAt || post.updatedAt || post.sortDate || post.date),
    author: {
      "@type": "Organization",
      name: post.editorialReviewer || "트립뷰 편집팀",
      url: `${baseUrl}${post.editorialAuthorProfile || "/editorial-team"}`,
    },
    publisher: {
      "@type": "Organization",
      name: "트립뷰",
      url: `${baseUrl}/`,
    },
    image: schemaImages(post),
    citation: articleSourceLinks(post).map((source) => source.url),
    isAccessibleForFree: true,
    inLanguage: "ko-KR",
  };
}

function eventSchema(post) {
  const schedule = festivalSchedule(post);
  const startDate = schedule.start || schemaDate(postDate(post));
  const endDate = schedule.end || startDate;
  const place = infoValue(post, "장소") || normalizeText(post?.tourApi?.intro?.eventplace) || compactRegion(post?.region);
  const address = infoValue(post, "주소") || post?.region || place;
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: post?.sourceTitle || postTitle(post),
    startDate,
    endDate,
    location: {
      "@type": "Place",
      name: place || postTitle(post),
      address: {
        "@type": "PostalAddress",
        streetAddress: address || place || compactRegion(post?.region),
        addressCountry: "KR",
      },
    },
  };
}

function isLodgingPost(post) {
  return contentTypeOf(post) === "32";
}

function isDataPipelinePost(post) {
  return Boolean(post?.dataPipeline?.generated);
}

function lodgingSchema(post) {
  const address = infoValue(post, "주소") || post?.region || "";
  const phone = infoValue(post, "문의") || normalizeText(post?.tourApi?.intro?.infocenterlodging || "");
  return {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: post?.sourceTitle || postTitle(post),
    description: postSummary(post, 180) || postExcerpt(post),
    url: postUrl(post),
    image: schemaImages(post),
    ...(address ? { address: { "@type": "PostalAddress", streetAddress: address, addressCountry: "KR" } } : {}),
    ...(phone ? { telephone: phone } : {}),
  };
}

function ensureArticleSchema(document, post) {
  const withoutExisting = String(document).replace(
    /\s*<script type="application\/ld\+json" data-tripview-(?:article|event|lodging)>[\s\S]*?<\/script>/g,
    "",
  );
  if (!withoutExisting.includes("</head>")) return withoutExisting;
  const scripts = [schemaScript("article", articleSchema(post))];
  if (isFestivalPost(post) && !isDataPipelinePost(post)) scripts.push(schemaScript("event", eventSchema(post)));
  if (isLodgingPost(post) && !isDataPipelinePost(post)) scripts.push(schemaScript("lodging", lodgingSchema(post)));
  return withoutExisting.replace("</head>", `${scripts.join("\n")}\n  </head>`);
}

function legacyRendererPost(slug, item = {}) {
  const title = normalizeText(item.title || "");
  const description = normalizeText(item.description || "");
  const category = normalizeText(item.category || "");
  const festivalLike = /축제|행사|페스타|문화제|단오제|공연/.test(`${category} ${title}`);
  const lodgingLike = /숙소|호텔|펜션|리조트|게스트하우스/.test(`${category} ${title} ${description}`);
  return {
    slug,
    title,
    sourceTitle: title,
    description,
    excerpt: description,
    category: category || (festivalLike ? "공연/축제" : "국내여행"),
    region: item.region || "",
    date: schemaDate(item.date || CONTENT_TODAY),
    sortDate: schemaDate(item.date || CONTENT_TODAY),
    image: item.image || "",
    images: item.image ? [item.image] : [],
    info: Array.isArray(item.info) ? item.info : [],
    contentTypeId: festivalLike ? "15" : lodgingLike ? "32" : "",
    editorialReviewer: "트립뷰 편집팀",
    editorialAuthorProfile: "/editorial-team",
  };
}

function stripTags(value = "") {
  return normalizeText(String(value || "").replace(/<[^>]*>/g, " "));
}

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function documentMetaContent(document, key) {
  const pattern = new RegExp(`<meta\\s+[^>]*(?:name|property)=["']${escapeRegExp(key)}["'][^>]*content=["']([^"']*)["'][^>]*>`, "i");
  return normalizeText(String(document).match(pattern)?.[1] || "");
}

function documentTitle(document) {
  return stripTags(String(document).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "")
    .replace(/\s*\|\s*트립뷰\s*$/, "");
}

function documentMetaSpans(document) {
  const block = String(document).match(/<div class=["']meta["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || "";
  return [...block.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)].map((match) => stripTags(match[1])).filter(Boolean);
}

function documentInfoRows(document) {
  const rows = [];
  for (const match of String(document).matchAll(/<tr[^>]*>\s*<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi)) {
    const label = stripTags(match[1]);
    const value = stripTags(match[2]);
    if (label && value) rows.push([label, value]);
  }
  return rows;
}

function legacyDocumentPost(slug, document) {
  const title = (documentMetaContent(document, "og:title") || documentTitle(document)).replace(/\s*\|\s*트립뷰\s*$/, "");
  const description = documentMetaContent(document, "description") || documentMetaContent(document, "og:description") || title;
  const image = documentMetaContent(document, "og:image");
  const metaSpans = documentMetaSpans(document);
  const dateText = metaSpans.find((value) => extractScheduleDates(value).length) || CONTENT_TODAY;
  const region = metaSpans.at(-1) || "";
  const festivalLike = /축제|행사|페스타|문화제|단오제|공연/.test(`${title} ${description}`);
  return {
    slug,
    title,
    sourceTitle: title,
    description,
    excerpt: description,
    category: festivalLike ? "공연/축제" : "국내여행",
    region,
    date: schemaDate(dateText),
    sortDate: schemaDate(dateText),
    image,
    images: image ? [image] : [],
    info: documentInfoRows(document),
    contentTypeId: festivalLike ? "15" : "",
    editorialReviewer: "트립뷰 편집팀",
    editorialAuthorProfile: "/editorial-team",
  };
}

function ensureLegacyArticleSchema(document, slug, item) {
  const post = item ? legacyRendererPost(slug, item) : legacyDocumentPost(slug, document);
  if (!post.title) return document;
  const withoutExisting = String(document).replace(
    /\s*<script type="application\/ld\+json" data-tripview-(?:article|event|lodging)>[\s\S]*?<\/script>/g,
    "",
  );
  if (!withoutExisting.includes("</head>")) return withoutExisting;
  const scripts = [schemaScript("article", articleSchema(post))];
  if (isFestivalPost(post)) scripts.push(schemaScript("event", eventSchema(post)));
  if (isLodgingPost(post)) scripts.push(schemaScript("lodging", lodgingSchema(post)));
  return withoutExisting.replace("</head>", `${scripts.join("\n")}\n  </head>`);
}

function ensureArticleAdsense(document, enabled) {
  const next = String(document);
  if (!enabled) {
    return next.replace(
      /\s*<script\s+async\s+src=["']https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-\d+["'][^>]*><\/script>/gi,
      "",
    );
  }
  if (next.includes("adsbygoogle.js?client=") || !next.includes("</head>")) return next;
  return next.replace("</head>", `    ${ADSENSE_SCRIPT}\n  </head>`);
}

function injectArticleTrust(document, post) {
  if (!document.includes("</article>")) return document;
  return document.replace("</article>", `${articleTrustBlock(post)}</article>`);
}

function articleAdMeta(item) {
  if (item?.type === "flight" || item?.source === "myrealtrip-flight") return flightMeta(item);
  return [item?.matchReason, item?.category || item?.type, item?.priceText || item?.price]
    .filter(Boolean)
    .join(" \u00B7 ");
}

function articleAdUrl(item) {
  if (item?.type === "flight" || item?.source === "myrealtrip-flight") return flightBookingUrl(item);
  return stripAccommodationStayParams(item?.url || "https://www.myrealtrip.com/");
}

function articleAdCard(item) {
  const title = html(item?.title || "");
  if (!title) return "";
  const url = articleAdUrl(item);
  const rel = String(url).startsWith("/") ? "" : ' rel="sponsored noopener"';
  const imageUrl = affiliateProductImage(item);
  const image = imageUrl
    ? `<span class="mrt-thumb"><img src="${html(imageUrl)}" alt="${title}" loading="lazy"></span>`
    : "";
  return `<a class="mrt-card${image ? "" : " no-image"}" href="${html(url)}"${rel}>
    ${image}
    <strong>${title}</strong>
    <em>${html(articleAdMeta(item) || "상품 정보")}</em>
  </a>`;
}

function articleSectionId(post) {
  const text = [post?.title, post?.sourceTitle, post?.description, post?.excerpt, post?.category]
    .filter(Boolean)
    .join(" ");
  if (/물놀이|계곡|해수욕장|해변|바다|워터|서핑|요트|래프팅|카약/.test(text)) return "water";
  if (/실내|전시|박물관|미술관|과학관|도서관|아쿠아리움/.test(text)) return "indoor";
  if (/아이|가족|어린이|키즈|체험|테마파크/.test(text)) return "family";
  if (post?.category === "공연/축제" || /축제|행사|페스티벌|공연|콘서트/.test(text)) return "festival";
  return "article";
}

function articleAdItems(post, count = 1) {
  return selectAffiliateProducts({
    sectionId: articleSectionId(post),
    posts: [post],
    products: [...tnaProducts, ...accommodationProducts],
    limit: count,
  });
}

function articleAdBlock(post) {
  const items = articleAdItems(post, 1);
  if (!items.length) return "";
  const title = "주변 숙소·투어";
  return `${MRT_AD_START} context -->
<section class="mrt-native-ad" aria-label="${title}">
  <div class="mrt-native-head"><strong>${title}</strong><span>숙소·투어·티켓</span></div>
  <p class="mrt-affiliate-note">여행지 주변의 숙소와 이용 가능한 투어·티켓을 모았습니다. 제휴 링크를 통해 예약하면 트립뷰가 수수료를 받을 수 있습니다.</p>
  <div class="mrt-native-grid">${items.map(articleAdCard).join("")}</div>
</section>
<!-- ${MRT_AD_END}`;
}

function injectArticleAffiliate(document, block) {
  if (!block || !document.includes("</article>")) return document;
  return document.replace("</article>", `${block}</article>`);
}

function articleAccommodationItems(post, count = 3) {
  return selectAccommodationItems({
    posts: [post],
    region: post?.region || post?.city,
    preset: familyAccommodationContext(post) ? "family" : "default",
    limit: count,
  });
}

function articleAccommodationBlock(items = [], slot = "bottom") {
  const cards = items.map(accommodationCard).filter(Boolean);
  if (!cards.length) return "";
  const title = slot === "mid" ? "이 지역 인기 숙소" : "함께 볼 인기 숙소";
  const label = slot === "mid" ? "본문 중간 숙소 추천" : "본문 하단 숙소 추천";
  return `${MRT_ACCOMMODATION_START} ${slot} -->
<section class="mrt-accommodation-block" aria-label="${html(label)}">
  <div class="mrt-accommodation-head"><h2>${html(title)}</h2><span>마이리얼트립 숙소</span></div>
  <p class="mrt-accommodation-note">성인 2명 기준 주말 1박 요금입니다. 예약 화면에서 날짜와 취소 조건을 다시 확인하세요.</p>
  <div class="mrt-accommodation-grid" data-count="${cards.length}">${cards.join("")}</div>
</section>
<!-- ${MRT_ACCOMMODATION_END}`;
}

function injectArticleMidAccommodation(document, block) {
  if (!block) return document;
  const articleStart = document.indexOf('<article class="content"');
  const articleEnd = articleStart >= 0 ? document.indexOf("</article>", articleStart) : -1;
  if (articleStart < 0 || articleEnd < 0) return document;
  const article = document.slice(articleStart, articleEnd);
  const relatedStart = article.search(/<section class=["']related-posts["']/);
  const body = relatedStart >= 0 ? article.slice(0, relatedStart) : article;
  const paragraphMatches = [...body.matchAll(/<\/p>/g)];
  const match = paragraphMatches[Math.min(2, paragraphMatches.length - 1)];
  if (match) {
    const insertAt = articleStart + match.index + match[0].length;
    return `${document.slice(0, insertAt)}${block}${document.slice(insertAt)}`;
  }
  const tableIndex = article.indexOf("</table>");
  if (tableIndex >= 0) {
    const insertAt = articleStart + tableIndex + "</table>".length;
    return `${document.slice(0, insertAt)}${block}${document.slice(insertAt)}`;
  }
  return document.replace("</article>", `${block}</article>`);
}

function injectArticleBottomAccommodation(document, block) {
  if (!block || !document.includes("</article>")) return document;
  return document.replace("</article>", `${block}</article>`);
}

function articleRegionRelatedItems(post) {
  const slug = regionSlug(post?.region);
  return sortedPosts(indexablePosts)
    .filter((candidate) => candidate?.slug && candidate.slug !== post?.slug && regionSlug(candidate?.region) === slug)
    .slice(0, 8);
}

function articleRegionRelatedCard(post) {
  const asset = tourImageEntry(processedTourImages, post)?.cover || null;
  const image = asset?.src || postImage(post);
  const meta = [compactRegion(post?.region), formatDate(postDate(post))].filter(Boolean).join(" · ");
  const body = `<span class="region-related-body"><strong>${html(postTitle(post))}</strong><span>${html(meta)}</span></span>`;
  if (!image) {
    return `<a class="region-related-card no-image" href="/${encodeURIComponent(post.slug)}/">${body}</a>`;
  }
  const alt = asset?.src ? tourImageAlt(asset, post) : postTitle(post);
  return `<a class="region-related-card" href="/${encodeURIComponent(post.slug)}/">
    <span class="region-related-thumb"><img src="${html(image)}" alt="${html(alt)}" loading="lazy" decoding="async"></span>
    ${body}
  </a>`;
}

function articleRegionRelatedBlock(post) {
  const label = compactRegion(post?.region);
  const slug = regionSlug(label);
  const items = articleRegionRelatedItems(post);
  const cards = items.map(articleRegionRelatedCard).join("");
  return `${REGION_RELATED_START} -->
<aside class="region-related" aria-label="같은 지역 다른 글">
  <div class="region-related-head">
    <h2>${html(label)}에서 함께 볼 글</h2>
    <a class="region-hub-link" href="/region/${html(slug)}/">${html(label)} 여행 허브 보기</a>
  </div>
  ${cards ? `<div class="region-related-grid">${cards}</div>` : `<p class="region-related-empty">${html(label)} 지역의 다른 검수 글이 추가되면 이곳에 함께 표시됩니다.</p>`}
</aside>
<!-- ${REGION_RELATED_END}`;
}

function injectArticleRegionRelated(document, block) {
  if (!block || !document.includes("</article>")) return document;
  return document.replace("</article>", `${block}</article>`);
}

function coupangKeywordForPost(post) {
  const text = [
    post?.title,
    post?.sourceTitle,
    post?.category,
    post?.region,
    post?.excerpt,
    post?.description,
  ].filter(Boolean).join(" ");
  if (/물놀이|계곡|해수욕장|해변|바다|워터파크|수영|폭포/.test(text)) return { intent: "water", keyword: "방수팩" };
  if (/비 오는|실내|박물관|미술관|전시|도서관|과학관/.test(text)) return { intent: "indoor", keyword: "접이식 우산" };
  if (/축제|행사|공연|페스티벌/.test(text)) return { intent: "festival", keyword: "보조배터리" };
  if (/아이|가족|키즈|체험/.test(text)) return { intent: "family", keyword: "아이 여행 준비물" };
  return { intent: "travel", keyword: "여행 준비물" };
}

function coupangAdBlock(post) {
  const { intent, keyword } = coupangKeywordForPost(post);
  return `${COUPANG_AD_START} bottom -->
<section class="coupang-native-ad" aria-label="쿠팡 파트너스 추천" data-coupang-section>
  <h2>이 여행에 챙기면 좋은 준비물</h2>
  <p class="affiliate-disclosure" data-coupang-disclosure>이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>
  <div class="coupang-native-grid" data-coupang-products data-coupang-intent="${html(intent)}" data-coupang-keyword="${html(keyword)}" data-coupang-limit="4">
    <p class="note">추천 상품을 불러오는 중입니다.</p>
  </div>
</section>
<!-- ${COUPANG_AD_END}`;
}

function coupangWidgetBlock(slot = "bottom") {
  return `${COUPANG_WIDGET_START} ${slot} -->
<section class="coupang-widget-ad" aria-label="쿠팡 파트너스 광고">
  <h2>여행 준비 특가</h2>
  <p class="affiliate-disclosure">이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>
  <div class="coupang-widget-scroll">
    <div class="coupang-widget-inner">
      <script src="https://ads-partners.coupang.com/g.js"></script>
      <script>
        new PartnersCoupang.G({"id":1003200,"trackingCode":"AF1488183","subId":null,"template":"carousel","width":"680","height":"140"});
      </script>
    </div>
  </div>
</section>
<!-- ${COUPANG_WIDGET_END}`;
}

function injectCoupangScript(document) {
  let next = document;
  if (!next.includes("/assets/coupang.js")) next = next.replace("</body>", `\n    ${COUPANG_SCRIPT}\n  </body>`);
  next = next.replace(/\s*<script\s+src=["']\/assets\/beach-(?:info|weather)\.js\?v=[^"']+["']\s+defer><\/script>/g, "");
  return next;
}

function ensureAccommodationLinkScript(document) {
  if (!document.includes("accommodation.myrealtrip.com/union/products/") || document.includes("/assets/homepage.js")) {
    return document;
  }
  return document.includes("</body>")
    ? document.replace("</body>", `\n    <script src="/assets/homepage.js?v=booking-search-20260712-flight-links" defer></script>\n  </body>`)
    : document;
}

async function polishGeneratedArticles() {
  for (const post of generatedPosts) {
    if (!post?.slug) continue;
    const file = join(root, post.slug, "index.html");
    let document;
    try {
      document = await readFile(file, "utf8");
    } catch {
      continue;
    }
    if (!document.includes('<article class="content"')) continue;

    const indexable = isIndexablePost(post);
    const productBlock = indexable && !isDataPipelinePost(post) ? articleProductSection(post) : "";
    const coupangBlock = indexable && !isLodgingPost(post) ? coupangAdBlock(post) : "";
    const regionRelatedBlock = indexable ? articleRegionRelatedBlock(post) : "";
    const officialBlock = articleOfficialBlock(post);
    const sourceBlock = articleTourApiSourceBlock(post);
    let next = injectArticleAdCss(stripExistingArticleAds(document), false, Boolean(regionRelatedBlock), false, Boolean(coupangBlock));
    next = alignArticleNavigation(next, post);
    next = alignArticleByline(next, post);
    next = applyProcessedArticleImages(next, post);
    next = applyArticleHeroBand(next, post);
    next = injectArticleAffiliateDisclosure(next, Boolean(productBlock));
    next = replaceArticleInfoTable(next, post);
    next = ensureLodgingPlaceIntro(next, post);
    next = stripTourOverviewSection(next, post);
    next = improveArticleReadability(next, post);
    next = ensureLodgingPhotoGuide(next, post);
    next = injectArticlePhotoGrid(next, post);
    next = injectArticleProductSection(next, productBlock);
    next = injectCoupangAdBlock(next, coupangBlock);
    next = injectArticleRegionRelated(next, regionRelatedBlock);
    next = injectArticleOfficialBlock(next, officialBlock);
    next = injectArticleTourApiSource(next, sourceBlock);
    next = injectArticleTrust(next, post);
    next = injectLodgingBookingSidebar(next, post);
    next = injectFestivalStatus(next, post);
    next = ensureCanonical(next, `/${post.slug}/`);
    next = ensureRobotsMeta(next, indexable);
    next = ensureArticleSchema(next, post);
    next = ensureArticleAdsense(next, indexable);
    next = alignArticleFooter(next);
    next = ensureSiteNavigationScript(next);
    next = ensureAccommodationLinkScript(next);
    if (coupangBlock) next = injectCoupangScript(next);
    next = ensureLazyImages(next);
    next = alignStaticInternalLinks(next);
    next = cleanGeneratedHtml(next);
    if (next !== document) await writeFile(file, next, "utf8");
  }
}

async function polishLegacyArticleShells() {
  const generatedSlugs = new Set(generatedPosts.map((post) => post?.slug).filter(Boolean));
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || generatedSlugs.has(entry.name)) continue;
    const file = join(root, entry.name, "index.html");
    let document;
    try {
      document = await readFile(file, "utf8");
    } catch {
      continue;
    }
    const legacyShell = document.includes("assets/article-renderer.js") || document.includes("data-slug=");
    const legacyStaticArticle = document.includes('<article class="content"');
    const languageArtifacts = /language-switch|\?lang=|hreflang=|i18n\.js/.test(document);
    if (!legacyShell && !legacyStaticArticle && !languageArtifacts) continue;
    let next = removeLanguageArtifacts(document);
    const legacyPost = legacyRendererPosts[entry.name]
      ? legacyRendererPost(entry.name, legacyRendererPosts[entry.name])
      : legacyDocumentPost(entry.name, next);
    next = ensureCanonical(next, `/${entry.name}/`);
    next = ensureLegacyArticleSchema(next, entry.name, legacyRendererPosts[entry.name]);
    if (next.includes("data-site-header")) next = alignSiteHeader(next, articleActivePath(legacyPost));
    if (legacyStaticArticle) next = refreshArticleSiteDesignCss(improveArticleReadability(next, legacyPost));
    next = ensureSiteNavigationScript(next);
    next = cleanGeneratedHtml(next);
    if (next !== document) await writeFile(file, next, "utf8");
  }
}

async function copyIfExists(from, to) {
  try {
    await cp(from, to, { recursive: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function polishStaticPages() {
  const pages = new Map([
    ["index.html", "/"],
    ["about.html", "/about"],
    ["contact.html", "/contact"],
    ["editorial-team.html", "/editorial-team"],
    ["editorial-policy.html", "/editorial-policy"],
    ["affiliate-disclosure.html", "/affiliate-disclosure"],
    ["privacy.html", "/privacy"],
    ["terms.html", "/terms"],
  ]);

  for (const [fileName, pathname] of pages) {
    const file = join(root, fileName);
    try {
      const document = await readFile(file, "utf8");
      const alignedNavigation = document
        .replaceAll('<a href="/#latest">최신글</a>', '<a href="/travel/">여행지</a>')
        .replaceAll('<a href="/#routes">전체글</a>', '<a href="/festival/">축제</a>')
        .replace(/href=(["'])\/#festival\1/g, 'href="/festival/"')
        .replace(/href=(["'])\/#(?:booking|myrealtrip-deals)\1/g, 'href="/stay/"')
        .replace(/href=(["'])\/#(?:popular|water|weekend|indoor|family)\1/g, 'href="/travel/"');
      const next = cleanGeneratedHtml(ensureSiteNavigationScript(ensureCanonical(alignStaticInternalLinks(alignSiteHeader(alignedNavigation, pathname)), pathname)));
      if (next !== document) await writeFile(file, next, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}

async function copySite(targetDir) {
  console.log(`Copying static output to ${targetDir === outDir ? "www" : "site"}...`);
  await rm(targetDir, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });

  for (const file of files) {
    await copyIfExists(join(root, file), join(targetDir, file));
  }

  await copyIfExists(join(root, "assets"), join(targetDir, "assets"));
  await copyIfExists(join(root, "data"), join(targetDir, "data"));

  for (const post of generatedPosts) {
    await copyIfExists(join(root, post.slug), join(targetDir, post.slug));
  }
  console.log(`Copied static output to ${targetDir === outDir ? "www" : "site"}.`);
}

console.log("Generating flight deal pages...");
await generateFlightDealPages();
console.log("Generating hub pages...");
await generateHubPages();
console.log("Generating sitemap...");
await generateSitemap();
console.log("Generating feed...");
await generateFeed();
console.log("Polishing generated articles...");
await polishGeneratedArticles();
console.log("Polishing legacy article shells...");
await polishLegacyArticleShells();
console.log("Polishing static pages...");
await polishStaticPages();
await copySite(outDir);
await copySite(siteDir);

console.log(`Built ${posts.length} posts into www and site`);
