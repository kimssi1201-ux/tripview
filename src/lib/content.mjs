import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { isIndexablePost } from "../../scripts/lib/content-quality.mjs";

export { isIndexablePost };

export const SITE_NAME = "트립뷰";
export const SITE_URL = "https://tripview.kr";
export const NAVER_VERIFICATION = "38616b4b4209994ed384d0d2439bddcbec2cc711";
export const ADSENSE_CLIENT = "ca-pub-5751319666030430";
export const RSS_TITLE = "트립뷰 RSS";
export const CONTENT_TODAY = todayInKorea();
export const EDITORIAL_AUTHOR_NAME = "트립뷰 편집팀";
export const EDITORIAL_AUTHOR_PATH = "/editorial-team";
export const EDITORIAL_AUTHOR_URL = `${SITE_URL}${EDITORIAL_AUTHOR_PATH}`;

export const CATEGORY_PAGES = [
  { path: "/travel/", title: "여행지", description: "9월 해외여행, 가을·단풍, 물놀이·계곡, 실내여행, 아이와, 이번 주말 글을 태그로 묶어 여행지를 탐색합니다." },
  { path: "/festival/", title: "축제·행사", description: "전국 축제와 행사를 지역, 일정, 방문 전 확인 포인트 중심으로 모았습니다." },
  { path: "/stay/", title: "가격보다 위치와 취소 조건을 먼저 비교하세요", description: "국내 숙소를 예약하기 전 날짜, 인원, 취소 가능 여부, 위치 조건을 한 화면에서 확인할 수 있도록 정리했습니다." },
  { path: "/ticket/", title: "일정 확정 전에 운영 조건을 먼저 비교하세요", description: "국내 입장권과 현지투어를 예약하기 전 운영 시간, 집결지, 포함 사항, 환불 조건을 먼저 확인할 수 있도록 정리했습니다." },
];

export const REGION_SLUGS = new Map([
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
  ["해외", "overseas"],
  ["기타", "other"],
]);

const OVERSEAS_ACCOMMODATION_DESTINATIONS = [
  { label: "오사카", keyword: "오사카", aliases: ["오사카", "osaka"] },
  { label: "타이베이", keyword: "타이베이", aliases: ["타이베이", "taipei"] },
  { label: "다낭", keyword: "다낭", aliases: ["다낭", "da nang", "danang"] },
  { label: "방콕", keyword: "방콕", aliases: ["방콕", "bangkok"] },
  { label: "도쿄", keyword: "도쿄", aliases: ["도쿄", "tokyo"] },
  { label: "후쿠오카", keyword: "후쿠오카", aliases: ["후쿠오카", "fukuoka"] },
  { label: "교토", keyword: "교토", aliases: ["교토", "kyoto"] },
];

const ROOT = process.cwd();
const FALLBACK_IMAGE = "/favicon.svg";

function readJson(relativePath, fallback) {
  const fullPath = join(ROOT, relativePath);
  if (!existsSync(fullPath)) return fallback;
  try {
    return JSON.parse(readFileSync(fullPath, "utf8"));
  } catch {
    return fallback;
  }
}

export const allPosts = uniqueBySlug(readJson("data/generated-posts.json", []));
export const indexablePosts = allPosts.filter(isIndexablePost);
export const processedTourImages = readJson("data/processed-tour-images.json", { items: {} });
export const pexelsImages = readJson("data/pexels-images.json", { items: {} });
export const accommodationProducts = readJson("data/myrealtrip-accommodations.json", []);
export const tnaProducts = readJson("data/myrealtrip-tna-products.json", []);
export const myrealtripProducts = readJson("data/myrealtrip-products.json", []);
export const flightDeals = readJson("data/myrealtrip-flight-deals.json", []);
export const coupangProducts = readJson("data/coupang-products.json", []);

export function normalizeText(value = "") {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function stripTags(value = "") {
  return normalizeText(String(value || "").replace(/<[^>]*>/g, " "));
}

export function todayInKorea(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function formatKoreanDate(value = "") {
  const raw = normalizeText(value);
  const iso = schemaDate(raw);
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return raw;
  return `${match[1]}년 ${Number(match[2])}월 ${Number(match[3])}일`;
}

export function canonicalUrl(pathname = "/") {
  return new URL(pathname, SITE_URL).toString();
}

export function postUrl(post) {
  return canonicalUrl(`/${encodeURIComponent(post.slug)}/`);
}

export function postTitle(post = {}) {
  return normalizeText(post.title || post.sourceTitle || "여행 글");
}

export function postDescription(post = {}) {
  return normalizeText(post.description || post.excerpt || postTitle(post));
}

export function postExcerpt(post = {}, length = 130) {
  const text = normalizeText(post.excerpt || post.description || "");
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

export function postDate(post = {}) {
  return post.updatedAt || post.sortDate || schemaDate(post.date) || CONTENT_TODAY;
}

export function postPublishedDate(post = {}) {
  return schemaDate(post.sortDate || post.date || post.updatedAt || CONTENT_TODAY);
}

export function postModifiedDate(post = {}) {
  return schemaDate(post.editorialReviewedAt || post.updatedAt || post.sortDate || post.date || CONTENT_TODAY);
}

export function schemaDate(value = "") {
  const raw = normalizeText(value);
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return raw;
  const korean = raw.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (korean) return `${korean[1]}-${String(korean[2]).padStart(2, "0")}-${String(korean[3]).padStart(2, "0")}`;
  const compact = raw.match(/(\d{4})(\d{2})(\d{2})/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  return raw || CONTENT_TODAY;
}

export function compactRegion(value = "") {
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
  if (/해외|일본|대만|태국|베트남|오사카|도쿄|후쿠오카|삿포로|교토|타이베이|방콕|다낭|싱가포르|홍콩|마카오|세부|보라카이|발리|괌|사이판|하와이|파리|런던|로마|바르셀로나|뉴욕/i.test(text)) return "해외";
  return text.split(/\s+/)[0] || "기타";
}

export function fallbackSlug(value = "") {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "") || "other";
}

export function regionSlug(region = "") {
  const label = compactRegion(region);
  return REGION_SLUGS.get(label) || fallbackSlug(label);
}

export function contentTypeOf(post = {}) {
  return String(post.tourApi?.contentTypeId || post.contentTypeId || post.contenttypeid || post.contentType || "");
}

export function isFestivalPost(post = {}) {
  const text = [post.category, post.title, post.sourceTitle, post.description, post.excerpt].filter(Boolean).join(" ");
  return post.category === "공연/축제" || post.category === "축제·행사" || contentTypeOf(post) === "15" || /축제|행사|페스티벌|공연|콘서트/.test(text);
}

export function isLodgingPost(post = {}) {
  return contentTypeOf(post) === "32" || /숙소|호텔|펜션|리조트|게스트하우스/.test(`${post.category || ""} ${post.title || ""}`);
}

export function isDataPipelinePost(post = {}) {
  return Boolean(post.dataPipeline?.generated);
}

export function articleActivePath(post = {}) {
  if (isFestivalPost(post)) return "/festival/";
  if (isLodgingPost(post) || /숙소/.test(post.category || "")) return "/stay/";
  if (/입장권|투어/.test(post.category || "")) return "/ticket/";
  return "/travel/";
}

export function articleCategoryLabel(post = {}) {
  const active = articleActivePath(post);
  if (active === "/festival/") return "축제·행사";
  if (active === "/stay/") return "숙소";
  if (active === "/ticket/") return "입장권·투어";
  return normalizeText(post.category) === "해외여행" ? "해외여행" : "여행지";
}

export function infoRows(post = {}) {
  return Array.isArray(post.info)
    ? post.info.filter((row) => Array.isArray(row) && normalizeText(row[0]) && normalizeText(row[1]))
    : [];
}

export function infoValue(post = {}, labels) {
  const names = Array.isArray(labels) ? labels : [labels];
  const row = infoRows(post).find(([key]) => names.includes(normalizeText(key)));
  return normalizeText(row?.[1] || "");
}

export function sectionPairs(post = {}) {
  return (Array.isArray(post.sections) ? post.sections : [])
    .map((section) => {
      if (Array.isArray(section)) {
        const paragraphs = Array.isArray(section[1]) ? section[1] : [section[1]];
        return { heading: normalizeText(section[0]), paragraphs: paragraphs.map(normalizeText).filter(Boolean) };
      }
      const paragraphs = Array.isArray(section?.paragraphs) ? section.paragraphs : [section?.body || section?.text];
      return { heading: normalizeText(section?.heading || section?.title), paragraphs: paragraphs.map(normalizeText).filter(Boolean) };
    })
    .filter((section) => section.heading && section.paragraphs.length);
}

export function faqPairs(post = {}) {
  return (Array.isArray(post.faq) ? post.faq : [])
    .map((item) => {
      if (Array.isArray(item)) return { question: normalizeText(item[0]), answer: normalizeText(item[1]) };
      return { question: normalizeText(item?.question), answer: normalizeText(item?.answer) };
    })
    .filter((item) => item.question && item.answer);
}

export function uniqueBySlug(posts = []) {
  const seen = new Set();
  const result = [];
  for (const post of Array.isArray(posts) ? posts : []) {
    if (!post?.slug || seen.has(post.slug)) continue;
    seen.add(post.slug);
    result.push(post);
  }
  return result;
}

export function uniquePosts(posts = []) {
  const seen = new Set();
  return posts.filter((post) => {
    const key = post?.slug || post?.title;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function extractScheduleDates(value = "") {
  const text = normalizeText(value);
  const dates = [];
  for (const match of text.matchAll(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/g)) {
    dates.push(`${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`);
  }
  if (dates.length) return dates;
  return [...text.matchAll(/(\d{4})(\d{2})(\d{2})/g)].map((match) => `${match[1]}-${match[2]}-${match[3]}`);
}

export function festivalSchedule(post = {}) {
  const intro = post.tourApi?.intro || {};
  const period = infoValue(post, "기간");
  const dates = extractScheduleDates(period || `${intro.eventstartdate || ""} ${intro.eventenddate || ""}`);
  const start = dates[0] || "";
  const end = dates[1] || dates[0] || "";
  return { start, end, label: period || [start, end].filter(Boolean).join("~") };
}

export function festivalStatus(post = {}) {
  if (!isFestivalPost(post)) return { state: "", ended: false, ongoing: false, upcoming: false };
  const { start, end } = festivalSchedule(post);
  const lastDay = end || start;
  if (lastDay && lastDay < CONTENT_TODAY) return { state: "ended", ended: true, ongoing: false, upcoming: false };
  if (start && start <= CONTENT_TODAY && (!lastDay || lastDay >= CONTENT_TODAY)) return { state: "ongoing", ended: false, ongoing: true, upcoming: false };
  if (start && start > CONTENT_TODAY) return { state: "upcoming", ended: false, ongoing: false, upcoming: true };
  return { state: "", ended: false, ongoing: false, upcoming: false };
}

export function sortedPosts(items = []) {
  return [...items].sort((a, b) => {
    const aEnded = isFestivalPost(a) && festivalStatus(a).ended;
    const bEnded = isFestivalPost(b) && festivalStatus(b).ended;
    if (aEnded !== bEnded) return aEnded ? 1 : -1;
    if (isFestivalPost(a) && isFestivalPost(b)) {
      const rankDiff = festivalSortRank(a) - festivalSortRank(b);
      if (rankDiff) return rankDiff;
      const aDate = festivalSchedule(a).end || festivalSchedule(a).start || postDate(a);
      const bDate = festivalSchedule(b).end || festivalSchedule(b).start || postDate(b);
      return festivalStatus(a).ended && festivalStatus(b).ended
        ? String(bDate).localeCompare(String(aDate))
        : String(aDate).localeCompare(String(bDate));
    }
    return String(b.sortDate || b.updatedAt || "").localeCompare(String(a.sortDate || a.updatedAt || ""));
  });
}

function festivalSortRank(post) {
  const status = festivalStatus(post);
  if (status.ongoing) return 0;
  if (status.upcoming) return 1;
  if (status.ended) return 2;
  return 3;
}

export function regionGroups(posts = indexablePosts) {
  const groups = new Map();
  for (const post of posts) {
    const label = compactRegion(post.region);
    const slug = regionSlug(label);
    if (!groups.has(slug)) groups.set(slug, { label, slug, posts: [] });
    groups.get(slug).posts.push(post);
  }
  return [...groups.values()]
    .map((group) => ({ ...group, posts: sortedPosts(group.posts) }))
    .sort((a, b) => a.label.localeCompare(b.label, "ko"));
}

export function isTourApiImage(value = "") {
  try {
    const url = new URL(String(value || ""));
    const host = url.hostname.toLowerCase();
    return host === "tong.visitkorea.or.kr" || host.endsWith(".visitkorea.or.kr");
  } catch {
    return false;
  }
}

export function imageIdentity(value = "") {
  const src = String(value || "").trim().replaceAll("\\", "/");
  if (!src) return "";
  try {
    const url = new URL(src, SITE_URL);
    url.hash = "";
    return url.origin === SITE_URL ? `${url.pathname}${url.search}` : `${url.protocol}//${url.hostname.toLowerCase()}${url.pathname}${url.search}`;
  } catch {
    return src;
  }
}

export function tourismImageContentKey(value = "") {
  const clean = String(value || "").split("?")[0];
  const resource = clean.match(/\/resource(?:_photo)?\/\d+\/([^/_]+)_image\d+_\d+/i);
  return resource ? `tour:${resource[1].toLowerCase()}` : "";
}

export function tourImageEntry(post = {}) {
  return processedTourImages.items?.[post.slug] || null;
}

export function pexelsImageEntry(post = {}) {
  return pexelsImages.items?.[post.slug] || null;
}

export function pexelsImageAssetsForPost(post = {}) {
  const entry = pexelsImageEntry(post);
  const assets = [entry?.cover, ...(Array.isArray(entry?.images) ? entry.images : [])].filter((asset) => asset?.src);
  const seen = new Set();
  return assets.filter((asset) => {
    const key = asset.id || imageIdentity(asset.src);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function tourImageAssetsForPost(post = {}) {
  const entry = tourImageEntry(post);
  return [entry?.cover, entry?.hero, entry?.banner, ...(Array.isArray(entry?.images) ? entry.images : [])].filter((asset) => asset?.src);
}

export function imageAssetForSource(post = {}, source = "") {
  const key = imageIdentity(source);
  return [...tourImageAssetsForPost(post), ...pexelsImageAssetsForPost(post)].find((asset) => (
    imageIdentity(asset.src) === key ||
    imageIdentity(asset.original) === key ||
    imageIdentity(asset.url) === key
  )) || null;
}

export function assetFromRaw(src = "", post = {}) {
  if (!src) return null;
  return imageAssetForSource(post, src) || {
    src,
    original: src,
    alt: post.alt || postTitle(post),
    caption: isTourApiImage(src) ? "출처: 한국관광공사 공공누리" : "출처: 본문 표기 이미지 또는 공개 자료",
    width: 0,
    height: 0,
  };
}

export function pexelsCaption(asset = {}) {
  const photographer = normalizeText(asset.photographer || "");
  return photographer ? `출처: Pexels · 사진: ${photographer}` : "출처: Pexels";
}

export function imageCaption(asset = {}) {
  if (asset.source === "pexels") return pexelsCaption(asset);
  return asset.caption || (isTourApiImage(asset.original || asset.src) ? "출처: 한국관광공사 공공누리 · 트립뷰 편집 이미지" : "출처: 본문 표기 이미지 또는 공개 자료");
}

export function imageAlt(asset = {}, post = {}) {
  return asset.alt || post.alt || postTitle(post);
}

export function heroImageAsset(post = {}) {
  const entry = tourImageEntry(post);
  const pexels = pexelsImageAssetsForPost(post)[0];
  return entry?.hero || entry?.cover || pexels || assetFromRaw(post.image || post.images?.[0] || FALLBACK_IMAGE, post);
}

export function cardImageAsset(post = {}) {
  const entry = tourImageEntry(post);
  const pexels = pexelsImageAssetsForPost(post)[0];
  return entry?.cover || pexels || assetFromRaw(post.image || post.images?.[0] || "", post);
}

export function regionCardImageAsset(post = {}) {
  const entry = tourImageEntry(post);
  const pexels = pexelsImageAssetsForPost(post)[0];
  return entry?.banner || entry?.cover || pexels || assetFromRaw(post.image || post.images?.[0] || "", post);
}

function imageAssetContentKey(asset = {}) {
  if (!asset?.src) return "";
  if (asset.source === "pexels") return `pexels:${asset.id || imageIdentity(asset.url) || imageIdentity(asset.src)}`;
  return tourismImageContentKey(asset.original) || tourismImageContentKey(asset.src) || imageIdentity(asset.original || asset.src);
}

export function articleContentImageAssets(post = {}, { excludeHero = false } = {}) {
  const rawSources = [post.image, ...(Array.isArray(post.images) ? post.images : [])].filter(Boolean);
  const processedInline = (tourImageEntry(post)?.images || []).filter((asset) => asset?.src);
  const pexelsInline = pexelsImageAssetsForPost(post);
  const candidates = [
    ...rawSources.map((src) => assetFromRaw(src, post)),
    ...processedInline,
    ...pexelsInline,
  ].filter((asset) => asset?.src);
  const heroKeys = new Set();
  if (excludeHero) {
    const hero = heroImageAsset(post);
    for (const value of [hero?.src, hero?.original, hero?.url, post.image]) {
      if (value) {
        const identity = imageIdentity(value);
        const tourismKey = tourismImageContentKey(value);
        if (identity) heroKeys.add(identity);
        if (tourismKey) heroKeys.add(tourismKey);
      }
    }
    const heroContentKey = imageAssetContentKey(hero);
    if (heroContentKey) heroKeys.add(heroContentKey);
  }
  const seen = new Set();
  const assets = [];
  for (const asset of candidates) {
    const key = imageAssetContentKey(asset);
    const identity = imageIdentity(asset.src);
    const tourismKey = tourismImageContentKey(asset.original);
    if (excludeHero && (heroKeys.has(key) || heroKeys.has(identity) || (tourismKey && heroKeys.has(tourismKey)))) continue;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    assets.push(asset);
  }
  return assets;
}

export function articleInlineAssets(post = {}) {
  const images = articleContentImageAssets(post, { excludeHero: true });
  const limit = images.length >= 3 ? Math.min(images.length, 5) : images.length;
  return images.slice(0, limit);
}

export function articlePhotoGridAssets(post = {}) {
  if (isLodgingPost(post)) return [];
  const inline = new Set(articleInlineAssets(post).map((asset) => imageAssetContentKey(asset)));
  return articleContentImageAssets(post, { excludeHero: true })
    .filter((asset) => !inline.has(imageAssetContentKey(asset)))
    .slice(0, 6);
}

export function imageMode(asset = {}) {
  const src = asset.src || "";
  if (src.startsWith("/assets/processed/") && !asset.posterCanvas) return "cover";
  return "contain";
}

export function publicImageUrl(src = "") {
  if (!src) return "";
  if (/^https?:\/\//i.test(src)) return src;
  return canonicalUrl(src);
}

export function searchablePostText(post = {}) {
  return [
    post.title,
    post.sourceTitle,
    post.description,
    post.excerpt,
    post.category,
    post.region,
    ...(Array.isArray(post.keywords) ? post.keywords : []),
    ...(Array.isArray(post.memo) ? post.memo : []),
    ...(Array.isArray(post.info) ? post.info.flat() : []),
    ...(Array.isArray(post.myrealtripAccommodationKeywords) ? post.myrealtripAccommodationKeywords : []),
  ].filter(Boolean).join(" ");
}

export function hasKeyword(post = {}, keywords = []) {
  const text = searchablePostText(post);
  return keywords.some((keyword) => text.includes(keyword));
}

export function relatedPostsFor(post = {}, limit = 4) {
  const currentRegion = compactRegion(post.region);
  const currentCategory = articleCategoryLabel(post);
  const keywordSet = new Set(normalizeText(`${post.title || ""} ${(post.keywords || []).join(" ")}`).split(/\s+/).filter((word) => word.length >= 2));
  return sortedPosts(indexablePosts)
    .filter((candidate) => candidate.slug !== post.slug)
    .map((candidate) => {
      let score = 0;
      if (articleCategoryLabel(candidate) === currentCategory) score += 8;
      if (compactRegion(candidate.region) === currentRegion) score += 7;
      const candidateWords = normalizeText(`${candidate.title || ""} ${(candidate.keywords || []).join(" ")}`).split(/\s+/);
      score += candidateWords.filter((word) => keywordSet.has(word)).length * 2;
      return { candidate, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || String(postDate(b.candidate)).localeCompare(String(postDate(a.candidate))))
    .slice(0, limit)
    .map((item) => item.candidate);
}

export function groupByCategoryData() {
  const travelPosts = sortedPosts(indexablePosts.filter((post) => !isFestivalPost(post)));
  const festivalPosts = sortedPosts(indexablePosts.filter(isFestivalPost));
  const fallKeywords = ["단풍"];
  const overseasKeywords = ["해외", "9월 해외여행", "일본", "대만", "태국", "베트남", "오사카", "타이베이", "방콕", "다낭"];
  const waterKeywords = ["수영장", "계곡", "해수욕장", "해변", "바다", "물놀이", "워터파크", "폭포", "수변"];
  const indoorKeywords = ["실내", "박물관", "미술관", "전시", "문화", "센터", "아트", "공연장"];
  const familyKeywords = ["아이", "가족", "어린이", "체험", "공원", "생태", "자연학습"];

  return {
    travelPosts,
    festivalPosts,
    overseasPosts: travelPosts.filter((post) => normalizeText(post.category) === "해외여행" || hasKeyword(post, overseasKeywords)),
    fallPosts: travelPosts.filter((post) => hasKeyword(post, fallKeywords)),
    waterPosts: travelPosts.filter((post) => hasKeyword(post, waterKeywords)),
    indoorPosts: travelPosts.filter((post) => hasKeyword(post, indoorKeywords)),
    familyPosts: travelPosts.filter((post) => hasKeyword(post, familyKeywords)),
  };
}

export function currentSeasonPosts(limit = 6) {
  return sortedPosts(indexablePosts.filter((post) => hasKeyword(post, ["단풍", "가을", "9월", "초가을", "해외여행"]))).slice(0, limit);
}

function homepageImagePosts(posts = []) {
  return uniquePosts(sortedPosts(posts).filter((post) => cardImageAsset(post)?.src));
}

function isDomesticHomepagePost(post = {}) {
  return articleCategoryLabel(post) === "여행지" && compactRegion(post.region) !== "해외";
}

function isStayHomepagePost(post = {}) {
  return articleCategoryLabel(post) === "숙소";
}

function isTicketHomepagePost(post = {}) {
  return articleCategoryLabel(post) === "입장권·투어";
}

function selectHomepagePosts(candidates = [], count = 5, used = new Set(), { allowReuse = true } = {}) {
  const pool = uniquePosts(candidates).filter((post) => post?.slug && cardImageAsset(post)?.src);
  const selected = [];
  const selectedSlugs = new Set();
  const add = (post, ignoreUsed = false) => {
    if (!post?.slug || selectedSlugs.has(post.slug)) return false;
    if (!ignoreUsed && used.has(post.slug)) return false;
    selected.push(post);
    selectedSlugs.add(post.slug);
    used.add(post.slug);
    return selected.length >= count;
  };

  for (const post of pool) {
    if (add(post)) break;
  }
  if (allowReuse && selected.length < count) {
    for (const post of pool) {
      if (add(post, true)) break;
    }
  }
  return selected;
}

function homepageStorySection({ id, title, href, posts, used }) {
  const selected = selectHomepagePosts(posts, 5, used, { allowReuse: true });
  return {
    id,
    title,
    href,
    kind: "stories",
    featured: selected[0] || null,
    items: selected.slice(1, 5),
    sourceCount: posts.length,
  };
}

function homepageProductSection({ id, title, href, products, type, disclosure = "" }) {
  const selected = uniqueProducts(products).filter((product) => productImage(product)).slice(0, 5);
  return {
    id,
    title,
    href,
    kind: "products",
    type,
    featuredProduct: selected[0] || null,
    products: selected.slice(1, 5),
    sourceCount: selected.length,
    disclosure,
  };
}

export function homepageSections() {
  const data = groupByCategoryData();
  const editorial = sortedPosts(indexablePosts.filter((post) => !isDataPipelinePost(post)));
  const allImagePosts = homepageImagePosts(indexablePosts);
  const editorialImagePosts = homepageImagePosts(editorial);
  const domesticPosts = homepageImagePosts(indexablePosts.filter(isDomesticHomepagePost));
  const overseasPosts = homepageImagePosts(data.overseasPosts);
  const festivalPosts = homepageImagePosts(data.festivalPosts);
  const stayArticlePosts = homepageImagePosts(indexablePosts.filter(isStayHomepagePost));
  const ticketArticlePosts = homepageImagePosts(indexablePosts.filter(isTicketHomepagePost));
  const used = new Set();

  const topLeadPosts = selectHomepagePosts([
    overseasPosts[0],
    domesticPosts[0],
    ...editorialImagePosts,
    ...allImagePosts,
  ], 2, used, { allowReuse: false });
  const topSmallPosts = selectHomepagePosts([
    overseasPosts[1],
    domesticPosts[1],
    festivalPosts[0],
    stayArticlePosts[0],
    ticketArticlePosts[0],
    ...editorialImagePosts,
    ...allImagePosts,
  ], 4, used, { allowReuse: false });
  const stayProducts = uniqueProducts(accommodationProducts).filter((product) => productImage(product)).slice(0, 6);
  const ticketProducts = uniqueProducts(tnaProducts.length ? tnaProducts : myrealtripProducts).filter((product) => productImage(product)).slice(0, 6);
  const magazineSections = [
    homepageStorySection({ id: "domestic", title: "국내여행", href: "/travel/#all-posts", posts: domesticPosts, used }),
    homepageStorySection({ id: "overseas", title: "해외여행", href: "/region/overseas/", posts: overseasPosts, used }),
    homepageStorySection({ id: "festival", title: "축제·행사", href: "/festival/", posts: festivalPosts, used }),
    stayProducts.length
      ? homepageProductSection({
        id: "stay",
        title: "숙소·예약",
        href: "/stay/",
        products: stayProducts,
        type: "accommodation",
        disclosure: "제휴 예약 상품은 실제 기사와 구분해 표시합니다.",
      })
      : homepageStorySection({ id: "stay", title: "숙소·예약", href: "/stay/", posts: stayArticlePosts, used }),
    ticketProducts.length
      ? homepageProductSection({
        id: "ticket",
        title: "입장권·투어",
        href: "/ticket/",
        products: ticketProducts,
        type: "ticket",
        disclosure: "입장권·투어 상품은 예약 전 공식 판매처의 포함 사항과 취소 조건을 확인하세요.",
      })
      : homepageStorySection({ id: "ticket", title: "입장권·투어", href: "/ticket/", posts: ticketArticlePosts, used }),
  ].filter((section) => section.featured || section.featuredProduct);

  return {
    heroPosts: [...topLeadPosts, ...topSmallPosts],
    topLeadPosts,
    topSmallPosts,
    magazineSections,
    regionGroups: regionGroups().slice(0, 6),
    latestPosts: allImagePosts.slice(0, 6),
    latestSidebarPosts: allImagePosts.slice(0, 14),
    seasonPosts: currentSeasonPosts(6).filter((post) => cardImageAsset(post)?.src),
    festivalPosts: festivalPosts.slice(0, 6),
    stayProducts,
    ticketProducts,
  };
}

function textMatches(value = "", terms = []) {
  const text = normalizeText(value).toLowerCase();
  return terms.some((term) => text.includes(normalizeText(term).toLowerCase()));
}

export function postAccommodationTargets(post = {}) {
  const explicit = Array.isArray(post.myrealtripAccommodationKeywords) ? post.myrealtripAccommodationKeywords : [];
  const sourceText = explicit.length ? explicit.join(" ") : searchablePostText(post);
  const lowered = sourceText.toLowerCase();
  return OVERSEAS_ACCOMMODATION_DESTINATIONS.filter((destination) => destination.aliases.some((alias) => lowered.includes(alias.toLowerCase())));
}

export function accommodationHeading(post = {}) {
  const targets = postAccommodationTargets(post);
  if (targets.length === 1) return `${targets[0].label} 인기 숙소`;
  if (targets.length > 1 || compactRegion(post.region) === "해외") return "9월 해외여행 숙소";
  return `${compactRegion(post.region)} 인기 숙소`;
}

export function selectAccommodationItems({ post = null, posts = [], region = "", limit = 6 } = {}) {
  const explicitTargets = post ? postAccommodationTargets(post).map((target) => target.keyword) : [];
  const explicitKeywords = post && Array.isArray(post.myrealtripAccommodationKeywords) ? post.myrealtripAccommodationKeywords : [];
  const compact = region || (post ? compactRegion(post.region) : "");
  const terms = [...explicitTargets, ...explicitKeywords, compact].filter(Boolean);
  const pool = accommodationProducts.map((product) => {
    const text = [product.title, product.region, product.city, product.regionSlug, ...(product.tags || [])].filter(Boolean).join(" ");
    let score = 0;
    if (terms.length && textMatches(text, terms)) score += 10;
    if (post && textMatches(text, [post.title, post.sourceTitle])) score += 3;
    if (posts.length && posts.some((item) => textMatches(text, [compactRegion(item.region)]))) score += 2;
    return { product, score };
  });
  const scored = pool
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || Number(b.product.reviewScore || 0) - Number(a.product.reviewScore || 0))
    .map((item) => item.product);
  return uniqueProducts(scored.length ? scored : accommodationProducts).slice(0, limit);
}

export function selectTnaItems({ post = null, region = "", limit = 6 } = {}) {
  const compact = region || (post ? compactRegion(post.region) : "");
  const keywords = [compact, post?.sourceTitle, post?.title, ...(post?.keywords || [])].filter(Boolean);
  const scored = tnaProducts
    .map((product) => {
      const text = [product.title, product.region, product.city, product.category, ...(product.tags || [])].filter(Boolean).join(" ");
      let score = 0;
      if (textMatches(text, keywords)) score += 8;
      if (post && hasKeyword(post, product.tags || [])) score += 2;
      return { product, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || Number(b.product.reviewScore || 0) - Number(a.product.reviewScore || 0))
    .map((item) => item.product);
  return uniqueProducts(scored.length ? scored : tnaProducts).slice(0, limit);
}

export function uniqueProducts(products = []) {
  const seen = new Set();
  return products.filter((product) => {
    const key = product.id || product.url || product.title;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function defaultStayWindow(reference = new Date()) {
  const today = new Date(`${todayInKorea(reference)}T00:00:00Z`);
  const day = today.getUTCDay();
  let daysUntilFriday = (5 - day + 7) % 7;
  if (daysUntilFriday === 0) daysUntilFriday = 7;
  const checkInDate = new Date(today);
  checkInDate.setUTCDate(today.getUTCDate() + daysUntilFriday);
  const checkOutDate = new Date(checkInDate);
  checkOutDate.setUTCDate(checkInDate.getUTCDate() + 2);
  return { checkIn: checkInDate.toISOString().slice(0, 10), checkOut: checkOutDate.toISOString().slice(0, 10) };
}

export function normalizeAccommodationUrl(rawUrl = "") {
  if (!rawUrl) return "";
  try {
    const url = new URL(String(rawUrl));
    if (url.protocol !== "https:" || url.hostname !== "accommodation.myrealtrip.com") return String(rawUrl);
    const stay = defaultStayWindow();
    url.searchParams.set("checkIn", stay.checkIn);
    url.searchParams.set("checkOut", stay.checkOut);
    url.searchParams.set("adultCount", "2");
    url.searchParams.set("childCount", "0");
    if (!url.searchParams.has("childAges")) url.searchParams.set("childAges", "");
    return url.toString();
  } catch {
    return "";
  }
}

export function productImage(product = {}) {
  return product.image || product.imageUrl || product.thumbnail || product.thumbnailUrl || "";
}

export function productPriceText(product = {}) {
  return normalizeText(product.priceText || product.meta || (product.price ? `${Number(product.price).toLocaleString("ko-KR")}원` : ""));
}

export function productUpdatedText(product = {}) {
  const raw = product.updatedAt || product.lastUpdatedDate || product.fetchedAt || product.generatedAt || "";
  return raw ? `${formatKoreanDate(raw)} 기준` : `표시일 ${formatKoreanDate(CONTENT_TODAY)} 기준`;
}

export function productSourceLabel(product = {}, type = "") {
  const source = normalizeText(product.source || type);
  if (/coupang/i.test(source)) return "쿠팡";
  if (/myrealtrip|mrt|tna|accommodation|ticket/i.test(source)) return "마이리얼트립";
  return source || "공식 예약처";
}

export function sitemapUrls() {
  const today = new Date().toISOString().slice(0, 10);
  return [
    { loc: `${SITE_URL}/`, lastmod: today },
    { loc: `${SITE_URL}/about`, lastmod: today },
    { loc: `${SITE_URL}/contact`, lastmod: today },
    { loc: `${SITE_URL}/editorial-team`, lastmod: today },
    { loc: `${SITE_URL}/editorial-policy`, lastmod: today },
    { loc: `${SITE_URL}/affiliate-disclosure`, lastmod: today },
    { loc: `${SITE_URL}/privacy`, lastmod: today },
    { loc: `${SITE_URL}/terms`, lastmod: today },
    ...CATEGORY_PAGES.map((page) => ({ loc: canonicalUrl(page.path), lastmod: today })),
    { loc: `${SITE_URL}/region/`, lastmod: today },
    ...regionGroups().map((group) => ({ loc: `${SITE_URL}/region/${group.slug}/`, lastmod: today })),
    ...indexablePosts.map((post) => ({ loc: postUrl(post), lastmod: postDate(post) })),
  ];
}

export function feedItems(limit = 50) {
  return indexablePosts.slice(0, limit).map((post) => ({
    title: postTitle(post),
    link: postUrl(post),
    guid: postUrl(post),
    description: postExcerpt(post, 240),
    pubDate: new Date(`${schemaDate(post.sortDate || post.updatedAt || post.date)}T00:00:00+09:00`).toUTCString(),
  }));
}

export function articleSchema(post = {}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: postTitle(post),
    description: postDescription(post),
    mainEntityOfPage: postUrl(post),
    datePublished: postPublishedDate(post),
    dateModified: postModifiedDate(post),
    author: {
      "@type": "Person",
      "@id": `${EDITORIAL_AUTHOR_URL}#person`,
      name: post.editorialReviewer || EDITORIAL_AUTHOR_NAME,
      url: `${SITE_URL}${post.editorialAuthorProfile || EDITORIAL_AUTHOR_PATH}`,
      worksFor: { "@id": `${SITE_URL}/#organization` },
    },
    publisher: {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
    },
    image: schemaImages(post),
    citation: officialLinks(post).map((source) => source.url),
    isAccessibleForFree: true,
    inLanguage: "ko-KR",
  };
}

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    logo: canonicalUrl("/favicon.svg"),
    sameAs: [EDITORIAL_AUTHOR_URL],
  };
}

export function editorialPersonSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${EDITORIAL_AUTHOR_URL}#person`,
    name: EDITORIAL_AUTHOR_NAME,
    url: EDITORIAL_AUTHOR_URL,
    jobTitle: "여행 정보 편집자",
    worksFor: { "@id": `${SITE_URL}/#organization` },
    knowsAbout: ["국내여행", "해외여행", "축제·행사", "숙소·예약", "여행 준비"],
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    publisher: { "@id": `${SITE_URL}/#organization` },
    inLanguage: "ko-KR",
  };
}

export function eventSchema(post = {}) {
  const schedule = festivalSchedule(post);
  const place = infoValue(post, "장소") || post.sourceTitle || postTitle(post);
  const address = infoValue(post, "주소") || post.region || place;
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: post.sourceTitle || postTitle(post),
    startDate: schedule.start || schemaDate(postDate(post)),
    endDate: schedule.end || schedule.start || schemaDate(postDate(post)),
    location: {
      "@type": "Place",
      name: place,
      address: {
        "@type": "PostalAddress",
        streetAddress: address,
        addressCountry: "KR",
      },
    },
  };
}

export function lodgingSchema(post = {}) {
  const address = infoValue(post, "주소") || post.region || "";
  const phone = infoValue(post, "문의") || normalizeText(post.tourApi?.intro?.infocenterlodging || "");
  return {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: post.sourceTitle || postTitle(post),
    description: postDescription(post),
    url: postUrl(post),
    image: schemaImages(post),
    ...(address ? { address: { "@type": "PostalAddress", streetAddress: address, addressCountry: "KR" } } : {}),
    ...(phone ? { telephone: phone } : {}),
  };
}

export function breadcrumbSchema(items = []) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      item: canonicalUrl(item.href),
    })),
  };
}

function schemaImages(post = {}) {
  const assets = [heroImageAsset(post), ...articleContentImageAssets(post)].filter((asset) => asset?.src);
  const urls = [...new Set(assets.map((asset) => publicImageUrl(asset.src)).filter(Boolean))];
  return urls.length ? urls : [canonicalUrl(FALLBACK_IMAGE)];
}

function firstUrl(value = "") {
  return normalizeText(value).match(/https?:\/\/[^\s<>"')]+/i)?.[0] || "";
}

export function officialLinks(post = {}) {
  const links = [];
  const homepage = infoValue(post, "홈페이지") || post.tourApi?.homepage || "";
  const homepageUrl = firstUrl(homepage);
  if (homepageUrl) links.push({ label: "공식 홈페이지", url: homepageUrl });
  if (post.tourApi?.overview || post.contentid) links.push({ label: "한국관광공사 공공데이터", url: "https://www.visitkorea.or.kr/" });
  if (compactRegion(post.region) === "해외" || articleCategoryLabel(post) === "해외여행") {
    links.push({ label: "외교부 해외안전여행", url: "https://www.0404.go.kr/" });
  }
  if (isDataPipelinePost(post)) {
    links.push({ label: "제휴 예약처 가격 확인", url: "https://www.myrealtrip.com/" });
  }
  return uniqueProducts(links);
}

export function flightSlug(deal = {}) {
  return String(deal.id || deal.title || "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "") || "flight-deal";
}

export function searchIndex() {
  return allPosts.map((post) => ({
    slug: post.slug,
    title: postTitle(post),
    region: compactRegion(post.region),
    category: articleCategoryLabel(post),
  }));
}
