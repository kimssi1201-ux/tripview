import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isIndexablePost, postBodyLength } from "./lib/content-quality.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POSTS_PATH = path.join(ROOT, "data", "generated-posts.json");
const ACCOMMODATION_CACHE_PATH = path.join(ROOT, "data", "myrealtrip-accommodation-cache.json");
const TNA_PRODUCTS_PATH = path.join(ROOT, "data", "myrealtrip-tna-products.json");
const MANIFEST_PATH = path.join(ROOT, "data", "data-post-manifest.json");
const LOG_PATH = path.join(ROOT, "data", "data-post-pipeline-log.json");
const SITE_URL = "https://tripview.kr";
const MAX_DAILY_POSTS = 3;
const MAX_DAILY_PER_TYPE = 1;
const MAX_AFFILIATE_LINKS = 8;
const MAX_AUTO_SHARE = 0.7;
const DATA_PIPELINE_VERSION = "2026-08-24-data-gate-v2";
const ALLOWED_DATA_TYPES = new Set(["stay-price", "festival-schedule", "ticket-price"]);
const DATA_SLUG_PATTERN = /^data-(stay-price|festival-schedule|ticket-price)-[a-z0-9-]+$/;
const MIN_ROWS = {
  "stay-price": 3,
  "festival-schedule": 3,
  "ticket-price": 2,
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
const REGION_PRIORITY = [
  "서울",
  "경기",
  "부산",
  "제주",
  "강원",
  "인천",
  "경북",
  "경남",
  "전남",
  "전북",
  "충남",
  "충북",
  "대구",
  "대전",
  "광주",
  "울산",
  "세종",
];
const FORBIDDEN_PATTERNS = [
  /API/,
  /TourAPI/,
  /한국관광공사 API/,
  /마이리얼트립 API/,
  /캐시/,
  /캐시에 저장된/,
  /JSON/,
  /데이터/,
  /데이터베이스/,
  /응답/,
  /(^|[^가-힣])필드(?=$|[^가-힣])/,
  /파라미터/,
  /조회/,
  /크롤링/,
  /파싱/,
  /(^|[^가-힣])로컬(?=$|[^가-힣])/,
  /엔드포인트/,
  /스키마/,
  /렌더링/,
  /렌더링 시점/,
  /빌드/,
  /자동 생성/,
  /스크립트/,
  /저장되어 있습니다/,
  /표에 넣었습니다/,
  /본문에 넣지 않았습니다/,
  /만들지 않았습니다/,
  /생성하지 않았습니다/,
  /검증할 수 없어/,
  /확인할 수 없어/,
  /대조할 수 있는 항목/,
  /수동 검수 콘텐츠/,
  /이 글은\s*.*을 위한 콘텐츠입니다/,
  /항목만 사용했습니다/,
  /남겼습니다/,
  /기준으로 작성했으며/,
  /아마/,
  /일 것입니다/,
  /것입니다/,
  /가보니/,
  /걸어보면/,
  /최고의/,
  /꼭 가야 할/,
  /반드시 가야/,
  /놓치지 말아야/,
  /숨은 명소/,
  /핫플/,
];
const SECRET_ENV_KEYS = [
  "TRIPVIEW_API_KEY",
  "TRIPVIEW_API_KEY_PARAM",
  "MYREALTRIP_API_KEY",
  "PARTNER_API_KEY",
  "MYREALTRIP_PARTNER_API_KEY",
  "COUPANG_ACCESS_KEY",
  "COUPANG_SECRET_KEY",
];

function stripHtml(value = "") {
  return String(value ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(?:x[0-9a-f]+|\d+);/gi, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value = "") {
  return stripHtml(value).replace(/\s+/g, " ").trim();
}

function esc(value = "") {
  return String(value ?? "").replace(/[&<>"']/g, (match) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[match]));
}

function numberValue(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const number = Number(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function formatWon(value) {
  const number = numberValue(value);
  return number > 0 ? `${number.toLocaleString("ko-KR")}원` : "";
}

function compactRegion(value = "") {
  const text = normalizeText(value).replace(/\([^)]*\)/g, "");
  if (!text) return "기타";
  if (text.includes("서울")) return "서울";
  if (text.includes("경기")) return "경기";
  if (text.includes("인천")) return "인천";
  if (text.includes("강원")) return "강원";
  if (text.includes("대전")) return "대전";
  if (text.includes("세종")) return "세종";
  if (text.includes("충북") || text.includes("충청북")) return "충북";
  if (text.includes("충남") || text.includes("충청남")) return "충남";
  if (text.includes("광주")) return "광주";
  if (text.includes("전북") || text.includes("전라북")) return "전북";
  if (text.includes("전남") || text.includes("전라남")) return "전남";
  if (text.includes("대구")) return "대구";
  if (text.includes("부산")) return "부산";
  if (text.includes("울산")) return "울산";
  if (text.includes("경북") || text.includes("경상북")) return "경북";
  if (text.includes("경남") || text.includes("경상남")) return "경남";
  if (text.includes("제주")) return "제주";
  return text.split(/\s+/)[0] || "기타";
}

function fallbackSlug(value = "") {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "other";
}

function regionSlug(region) {
  const label = compactRegion(region);
  return REGION_SLUGS.get(label) || fallbackSlug(label);
}

function regionRank(region) {
  const index = REGION_PRIORITY.indexOf(compactRegion(region));
  return index >= 0 ? index : REGION_PRIORITY.length;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
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

function dateText(date) {
  return date.toISOString().slice(0, 10);
}

function formatKoreanDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return normalizeText(value);
  return `${match[1]}년 ${Number(match[2])}월 ${Number(match[3])}일`;
}

function defaultStayWindow(reference = new Date()) {
  const today = todayInKorea(reference);
  const day = today.getUTCDay();
  let daysUntilFriday = (5 - day + 7) % 7;
  if (daysUntilFriday === 0) daysUntilFriday = 7;
  const checkIn = addDays(today, daysUntilFriday);
  return {
    today: dateText(today),
    checkIn: dateText(checkIn),
    checkOut: dateText(addDays(checkIn, 2)),
    nights: 2,
    adultCount: 2,
    childCount: 0,
  };
}

const STAY = defaultStayWindow();

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function cleanTitle(value = "") {
  return normalizeText(value)
    .replace(/^\[([^\]]{1,30})\]\s*/g, "$1 ")
    .replace(/\s*\[([^\]]{1,30})\]\s*/g, " $1 ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeExternalUrl(value = "") {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function normalizeAffiliateUrl(value = "") {
  const url = safeExternalUrl(value);
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "myrealtrip.com" && !parsed.hostname.endsWith(".myrealtrip.com")) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function withCurrentStayParams(value = "") {
  const safe = normalizeAffiliateUrl(value);
  if (!safe) return "";
  const url = new URL(safe);
  if (url.hostname === "accommodation.myrealtrip.com") {
    url.searchParams.set("checkIn", STAY.checkIn);
    url.searchParams.set("checkOut", STAY.checkOut);
    url.searchParams.set("adultCount", String(STAY.adultCount));
    url.searchParams.set("childCount", String(STAY.childCount));
    url.searchParams.set("childAges", "");
  }
  return url.toString();
}

function starLabel(value) {
  const text = normalizeText(value).toLowerCase();
  if (/five|5/.test(text)) return "5성급";
  if (/four|4/.test(text)) return "4성급";
  if (/three|3/.test(text)) return "3성급";
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? `${number}성급` : "";
}

function reviewLabel(item) {
  const score = normalizeText(item?.reviewScore);
  const count = numberValue(item?.reviewCount);
  if (!score) return "";
  return `평점 ${score}${count ? ` · 리뷰 ${count.toLocaleString("ko-KR")}개` : ""}`;
}

function discountLabel(item) {
  const rate = numberValue(item?.discountRate);
  return rate > 0 ? `${Math.round(rate)}% 할인` : "";
}

function sourceNumbersFromValues(values = []) {
  const numbers = new Set();
  for (const value of values) {
    const text = String(value ?? "");
    for (const match of text.matchAll(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g)) {
      numbers.add(match[0].replaceAll(",", ""));
    }
  }
  return numbers;
}

function allowedDateNumbers(...dates) {
  return sourceNumbersFromValues(dates.flatMap((date) => [date, formatKoreanDate(date)]));
}

function extractScheduleDates(value = "") {
  const text = normalizeText(value);
  const dates = [];
  for (const match of text.matchAll(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/g)) {
    dates.push(`${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`);
  }
  if (dates.length) return dates;
  return [...text.matchAll(/(\d{4})(\d{2})(\d{2})/g)].map((match) => `${match[1]}-${match[2]}-${match[3]}`);
}

function infoValue(post, label) {
  const rows = Array.isArray(post?.info) ? post.info : [];
  const found = rows.find((row) => Array.isArray(row) && normalizeText(row[0]) === label);
  return normalizeText(found?.[1] || "");
}

function festivalSchedule(post) {
  const intro = post?.tourApi?.intro || {};
  const period = infoValue(post, "기간");
  const dates = extractScheduleDates(period || `${intro.eventstartdate || ""} ${intro.eventenddate || ""}`);
  return {
    start: dates[0] || "",
    end: dates[1] || dates[0] || "",
    label: period || [dates[0], dates[1] || dates[0]].filter(Boolean).join("~"),
  };
}

function festivalStatus(row) {
  const lastDay = row.endDate || row.startDate;
  if (lastDay && lastDay < STAY.today) return "종료";
  if (row.startDate && row.startDate <= STAY.today && (!lastDay || lastDay >= STAY.today)) return "진행 중";
  if (row.startDate && row.startDate > STAY.today) return "예정";
  return "확인 필요";
}

function plainPostBody(post = {}) {
  const sections = Array.isArray(post.sections)
    ? post.sections.flatMap((section) => Array.isArray(section?.[1]) ? section[1] : []).join(" ")
    : "";
  const faq = Array.isArray(post.faq)
    ? post.faq.flat().join(" ")
    : "";
  return normalizeText([post.title, post.description, post.excerpt, sections, faq, ...(Array.isArray(post.memo) ? post.memo : [])].join(" "));
}

function shingleSet(text, size = 5) {
  const words = normalizeText(text).split(/\s+/).filter(Boolean);
  if (words.length < size) return new Set(words);
  const set = new Set();
  for (let index = 0; index <= words.length - size; index += 1) {
    set.add(words.slice(index, index + size).join(" "));
  }
  return set;
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

function consecutiveOverviewMatch(body, overviews = []) {
  const normalizedBody = normalizeText(body);
  for (const overview of overviews) {
    const words = normalizeText(overview).split(/\s+/).filter(Boolean);
    for (let index = 0; index <= words.length - 3; index += 1) {
      const phrase = words.slice(index, index + 3).join(" ");
      if (phrase.length >= 6 && normalizedBody.includes(phrase)) return phrase;
    }
  }
  return "";
}

function dataPolicySections() {
  return [];
}

function tableEmptyRatio(rows = []) {
  let total = 0;
  let empty = 0;
  for (const row of rows) {
    for (const value of Object.values(row)) {
      total += 1;
      if (!normalizeText(value)) empty += 1;
    }
  }
  return total ? empty / total : 1;
}

async function liveUrlOk(url) {
  try {
    const response = await fetch(url, { method: "GET", signal: AbortSignal.timeout(15000) });
    return response.status === 200;
  } catch {
    return false;
  }
}

function secretValues() {
  return SECRET_ENV_KEYS
    .map((key) => process.env[key])
    .filter((value) => typeof value === "string" && value.trim().length >= 12);
}

async function validateCandidate(candidate, existingPosts, existingManifest) {
  const failures = [];
  if (!ALLOWED_DATA_TYPES.has(candidate.type)) failures.push(`unsupported_data_type:${candidate.type || "missing"}`);
  if (candidate.post?.dataPipeline?.kind !== candidate.type) failures.push("data_kind_mismatch");
  if (!DATA_SLUG_PATTERN.test(candidate.post?.slug || "")) failures.push(`invalid_data_url:${candidate.post?.slug || "missing"}`);
  const body = plainPostBody(candidate.post);
  const html = renderDataArticle(candidate);
  const text = stripHtml(html);
  const allowedNumbers = new Set([
    ...candidate.allowedNumbers,
    ...sourceNumbersFromValues([
      candidate.post.date,
      candidate.post.sortDate,
      candidate.post.updatedAt,
      candidate.post.dataPipeline?.updatedAt,
      MAX_AFFILIATE_LINKS,
    ]),
  ]);

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) failures.push(`forbidden_expression:${pattern.source}`);
    pattern.lastIndex = 0;
  }

  for (const match of text.matchAll(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g)) {
    const number = match[0].replaceAll(",", "");
    if (!allowedNumbers.has(number)) failures.push(`unmatched_number:${match[0]}`);
  }

  const overviewMatch = consecutiveOverviewMatch(body, candidate.sourceOverviews);
  if (overviewMatch) failures.push(`tour_overview_overlap:${overviewMatch}`);

  const candidateShingles = shingleSet(body);
  for (const existing of existingPosts) {
    if (existing.slug === candidate.post.slug || existing?.dataPipeline?.generated) continue;
    const similarity = jaccard(candidateShingles, shingleSet(plainPostBody(existing)));
    if (similarity > 0.8) {
      failures.push(`body_similarity_over_80:${existing.slug}:${similarity.toFixed(3)}`);
      break;
    }
  }

  const emptyRatio = tableEmptyRatio(candidate.tableRows);
  if (emptyRatio > 0.3) failures.push(`table_empty_cells_over_30:${emptyRatio.toFixed(3)}`);

  if (candidate.affiliateLinkCount > MAX_AFFILIATE_LINKS) failures.push(`affiliate_links_over_${MAX_AFFILIATE_LINKS}:${candidate.affiliateLinkCount}`);
  const affiliateRatio = candidate.affiliateTextLength / Math.max(1, body.length);
  if (affiliateRatio > 0.3) failures.push(`affiliate_ratio_over_30:${affiliateRatio.toFixed(3)}`);

  if (/\[[^\]]+\]/.test(text)) failures.push("bracket_instruction_remaining");

  for (const img of html.matchAll(/<img\b([^>]*)>/gi)) {
    const alt = img[1].match(/\balt=["']([^"']*)["']/i)?.[1] || "";
    if (!normalizeText(alt)) failures.push("image_alt_missing");
  }

  for (const link of html.matchAll(/<a\b([^>]*\bdata-affiliate-link\b[^>]*)>/gi)) {
    const attrs = link[1];
    const rel = attrs.match(/\brel=["']([^"']*)["']/i)?.[1] || "";
    const target = attrs.match(/\btarget=["']([^"']*)["']/i)?.[1] || "";
    if (!/\bsponsored\b/.test(rel)) failures.push("affiliate_rel_sponsored_missing");
    if (!/\bnofollow\b/.test(rel)) failures.push("affiliate_rel_nofollow_missing");
    if (target !== "_blank") failures.push("affiliate_target_blank_missing");
  }

  for (const url of candidate.affiliateUrls) {
    try {
      const parsed = new URL(url);
      const checkIn = parsed.searchParams.get("checkIn");
      if (checkIn && checkIn < STAY.today) failures.push(`checkin_before_today:${checkIn}`);
    } catch {
      failures.push("affiliate_url_invalid");
    }
  }

  const manifestEntry = (existingManifest.posts || []).find((entry) => entry.slug === candidate.post.slug);
  const shouldCheckLive = String(process.env.DATA_PIPELINE_VALIDATE_LIVE_URLS || "").toLowerCase() === "true";
  if (shouldCheckLive) {
    const urls = new Set(candidate.internalUrls.map((url) => `${SITE_URL}${url}`));
    if (manifestEntry) urls.add(`${SITE_URL}/${candidate.post.slug}/`);
    for (const url of urls) {
      if (!(await liveUrlOk(url))) failures.push(`existing_url_not_200:${url}`);
    }
  }

  for (const secret of secretValues()) {
    if (JSON.stringify(candidate.post).includes(secret) || html.includes(secret)) failures.push("api_key_in_candidate");
  }

  if (!isIndexablePost(candidate.post)) failures.push(`not_indexable:body_${postBodyLength(candidate.post)}`);
  return [...new Set(failures)];
}

function sortedNumbers(values = []) {
  return [...new Set([...values].map((value) => String(value)).filter(Boolean))]
    .sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
}

function candidateValidationMetadata(candidate, liveUrlValidation) {
  const body = plainPostBody(candidate.post);
  const affiliateRatio = candidate.affiliateTextLength / Math.max(1, body.length);
  return {
    version: DATA_PIPELINE_VERSION,
    allowedTypes: [...ALLOWED_DATA_TYPES],
    allowedNumbers: sortedNumbers([
      ...candidate.allowedNumbers,
      ...sourceNumbersFromValues([
        candidate.post.date,
        candidate.post.sortDate,
        candidate.post.updatedAt,
        candidate.post.dataPipeline?.updatedAt,
        candidate.tableRows.length,
        candidate.affiliateLinkCount,
        MAX_DAILY_POSTS,
        MAX_DAILY_PER_TYPE,
        MAX_AFFILIATE_LINKS,
        Math.round(MAX_AUTO_SHARE * 100),
      ]),
    ]),
    sourcePostSlugs: [...new Set(candidate.sourcePostSlugs || [])],
    rowCount: candidate.tableRows.length,
    tableEmptyRatio: Number(tableEmptyRatio(candidate.tableRows).toFixed(3)),
    affiliateLinkCount: candidate.affiliateLinkCount,
    affiliateTextRatio: Number(affiliateRatio.toFixed(3)),
    maxAffiliateLinks: MAX_AFFILIATE_LINKS,
    liveUrlValidation,
  };
}

function normalizeAccommodationProduct(item = {}, regionName = "") {
  const title = cleanTitle(item.title || item.itemName || item.name);
  const url = withCurrentStayParams(item.url || item.productUrl);
  const image = safeExternalUrl(item.image);
  const salePrice = numberValue(item.salePrice || item.price);
  const originalPrice = numberValue(item.originalPrice || salePrice);
  if (!title || !url || !image || !salePrice) return null;
  return {
    title,
    url,
    image,
    region: compactRegion(item.region || regionName),
    salePrice,
    originalPrice: originalPrice || salePrice,
    discountRate: numberValue(item.discountRate),
    starRating: starLabel(item.starRating),
    reviewScore: normalizeText(item.reviewScore),
    reviewCount: numberValue(item.reviewCount),
    checkIn: STAY.checkIn,
    checkOut: STAY.checkOut,
    adultCount: STAY.adultCount,
    childCount: STAY.childCount,
    sourceNumbers: sourceNumbersFromValues(Object.values(item)),
  };
}

function accommodationCandidates(cache) {
  const result = [];
  for (const region of Object.values(cache?.regions || {})) {
    const seen = new Set();
    const rows = [...(region.default || []), ...(region.family || [])]
      .map((item) => normalizeAccommodationProduct(item, region.name))
      .filter(Boolean)
      .filter((item) => {
        const key = item.url.replace(/([?&](checkIn|checkOut|adultCount|childCount|childAges)=[^&]*)/g, "");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.salePrice - b.salePrice)
      .slice(0, 6);
    if (rows.length >= MIN_ROWS["stay-price"]) result.push(buildStayCandidate(compactRegion(region.name), rows, cache));
  }
  return result.sort((a, b) => b.tableRows.length - a.tableRows.length || regionRank(a.region) - regionRank(b.region));
}

function normalizeTicketProduct(item = {}) {
  const title = cleanTitle(item.title || item.itemName || item.name);
  const text = [title, item.category, item.description, ...(Array.isArray(item.tags) ? item.tags : [])].join(" ");
  if (!/(입장권|이용권|티켓|패스|관람|워터킹덤|원마운트|수상레저)/.test(text)) return null;
  if (FORBIDDEN_PATTERNS.some((pattern) => pattern.test(title))) return null;
  const url = normalizeAffiliateUrl(item.url || item.productUrl);
  const image = safeExternalUrl(item.image);
  const price = numberValue(item.price || item.salePrice);
  const region = compactRegion(item.region || item.city);
  if (!title || !url || !image || !price || region === "기타") return null;
  return {
    title,
    url,
    image,
    region,
    category: normalizeText(item.category || "입장권"),
    price,
    priceText: normalizeText(item.priceText) || `${formatWon(price)}부터`,
    reviewScore: normalizeText(item.reviewScore),
    reviewCount: numberValue(item.reviewCount),
    sourceNumbers: sourceNumbersFromValues(Object.values(item)),
  };
}

function ticketCandidates(products) {
  const groups = new Map();
  for (const item of products.map(normalizeTicketProduct).filter(Boolean)) {
    if (!groups.has(item.region)) groups.set(item.region, []);
    groups.get(item.region).push(item);
  }
  const result = [];
  for (const [region, items] of groups) {
    const rows = [...items].sort((a, b) => a.price - b.price).slice(0, 6);
    if (rows.length >= MIN_ROWS["ticket-price"]) result.push(buildTicketCandidate(region, rows));
  }
  return result.sort((a, b) => b.tableRows.length - a.tableRows.length || regionRank(a.region) - regionRank(b.region));
}

function festivalCandidates(posts) {
  const groups = new Map();
  for (const post of posts) {
    const isFestival = post?.category === "공연/축제" || /축제|행사|페스티벌|공연/.test([post?.title, post?.sourceTitle, post?.description].join(" "));
    if (!isFestival) continue;
    const schedule = festivalSchedule(post);
    if (!schedule.start) continue;
    const row = {
      title: cleanTitle(post.sourceTitle || post.title),
      slug: post.slug,
      region: compactRegion(post.region),
      startDate: schedule.start,
      endDate: schedule.end || schedule.start,
      period: schedule.label || [schedule.start, schedule.end].filter(Boolean).join("~"),
      place: infoValue(post, "장소") || normalizeText(post?.tourApi?.intro?.eventplace),
      fee: infoValue(post, "요금") || normalizeText(post?.tourApi?.intro?.usetimefestival),
      image: safeExternalUrl(post.image),
      overview: normalizeText(post?.tourApi?.overview),
      sourceNumbers: sourceNumbersFromValues([post.title, post.sourceTitle, post.description, post.excerpt, post.region, JSON.stringify(post.info || []), JSON.stringify(post.tourApi?.intro || {})]),
    };
    if (!row.title || !row.slug || !row.place) continue;
    const region = row.region;
    if (!groups.has(region)) groups.set(region, []);
    groups.get(region).push(row);
  }
  const result = [];
  for (const [region, items] of groups) {
    const rows = items
      .sort((a, b) => {
        const aEnded = a.endDate < STAY.today;
        const bEnded = b.endDate < STAY.today;
        if (aEnded !== bEnded) return aEnded ? 1 : -1;
        return a.startDate.localeCompare(b.startDate);
      })
      .slice(0, 8);
    if (rows.length >= MIN_ROWS["festival-schedule"]) result.push(buildFestivalCandidate(region, rows));
  }
  return result.sort((a, b) => b.tableRows.length - a.tableRows.length || regionRank(a.region) - regionRank(b.region));
}

function affiliateTextLength(rows) {
  return rows.reduce((total, row) => total + normalizeText([row.title, row.priceText, row.salePrice, row.originalPrice].join(" ")).length, 0);
}

function priceStats(rows, key = "salePrice") {
  const prices = rows.map((row) => numberValue(row[key] || row.price)).filter((price) => price > 0);
  const sum = prices.reduce((total, price) => total + price, 0);
  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
    avg: Math.round(sum / prices.length),
  };
}

function basePost({ kind, region, title, description, excerpt, image, alt, info, sections, faq, affiliateLinkCount }) {
  const slug = `data-${kind}-${regionSlug(region)}`;
  const readLabel = kind === "festival-schedule" ? "일정 정리" : "가격 비교";
  return {
    slug,
    title,
    sourceTitle: title,
    description,
    category: kind === "festival-schedule" ? "축제·행사" : kind === "ticket-price" ? "입장권·투어" : "숙소",
    region,
    date: formatKoreanDate(STAY.today),
    sortDate: STAY.today,
    updatedAt: STAY.today,
    read: readLabel,
    image,
    images: image ? [image] : [],
    alt,
    excerpt,
    info,
    memo: [
      `지역: ${region}`,
      `갱신일: ${formatKoreanDate(STAY.today)}`,
    ],
    sections: [...sections, ...dataPolicySections(kind)],
    faq,
    editorialStatus: "reviewed",
    editorialReviewedAt: STAY.today,
    editorialReviewer: "트립뷰 편집팀",
    editorialAuthorProfile: "/editorial-team",
    dataPipeline: {
      generated: true,
      kind,
      region,
      generatedAt: new Date().toISOString(),
      updatedAt: STAY.today,
      affiliateLinkCount,
    },
  };
}

function buildStayCandidate(region, rows, cache) {
  const stats = priceStats(rows, "salePrice");
  const title = `${region} 숙소 가격 비교`;
  const popularRows = rows
    .slice()
    .sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0))
    .slice(0, 3);
  const sections = [
    ["숙소 비교", [
      `${region} 숙소 ${rows.length}곳의 주말 1박 요금은 ${formatWon(stats.min)}부터 ${formatWon(stats.max)}까지입니다. 평균 요금은 ${formatWon(stats.avg)}입니다.`,
      "숙소별 성급, 평점, 리뷰 수, 원가와 판매가는 위 표에서 나란히 확인할 수 있습니다.",
      "숙소를 고를 때는 가격만 단독으로 보지 말고 이동 동선, 체크인 시간, 주변 식사 선택지를 함께 보는 편이 좋습니다.",
      "가족 여행은 침대 구성과 조식 포함 여부를 먼저 보고, 커플 여행은 객실 전망과 주변 산책 동선을 함께 비교하세요.",
      "출장이나 짧은 일정은 늦은 체크인과 교통 접근성이 가격 차이보다 더 중요할 수 있습니다.",
      "관광지 근처 숙소는 이동이 짧은 대신 주말 요금이 높게 보일 수 있습니다. 반대로 역 주변 숙소는 이동 선택지가 넓어 일정 변경에 대응하기 쉽습니다.",
      "차량으로 이동한다면 주차 조건과 입차 시간을 먼저 보세요. 대중교통 일정이라면 마지막 열차나 버스 시간까지 함께 맞추는 편이 좋습니다.",
      "같은 가격대에서는 객실 크기, 침대 구성, 조식 포함 여부처럼 실제 체류에 영향을 주는 조건부터 비교하면 선택이 쉬워집니다.",
    ]],
    ["가격표를 읽는 방법", [
      "원가와 판매가가 같으면 별도 할인이 표시되지 않은 상품입니다. 원가보다 판매가가 낮으면 표와 카드에서 할인율을 함께 봅니다.",
      "평점은 리뷰 수와 함께 보는 편이 좋습니다. 같은 4.5점이라도 리뷰 수가 많은 숙소는 이용자 평가가 더 많이 쌓여 있습니다.",
      "성급은 시설 규모와 서비스 범위를 가늠하는 참고값입니다. 다만 같은 성급이라도 객실 크기, 위치, 조식 구성, 주차 조건은 상품마다 달라질 수 있습니다.",
      "판매가가 낮아 보여도 취소 조건이 엄격하거나 조식이 빠져 있으면 실제 선택은 달라질 수 있습니다. 예약 화면에서 총 결제 금액과 취소 가능 날짜를 함께 확인하세요.",
    ]],
    ["예약 전 확인 순서", [
      "예약 화면에서 날짜, 인원, 객실 타입을 먼저 맞춘 뒤 취소 가능 여부와 조식 포함 여부를 확인하세요.",
      "주말 숙소는 같은 지역 안에서도 역·해변·관광지와의 거리에 따라 요금 차이가 큽니다. 이동 동선을 가격과 함께 비교하는 편이 좋습니다.",
      "아이와 함께 머문다면 객실 정원, 침대 추가 가능 여부, 주차장 동선, 주변 편의점이나 식당 위치를 먼저 살피세요.",
      "늦게 도착하는 일정이라면 체크인 마감 시간과 프런트 운영 방식을 먼저 확인하는 편이 안전합니다. 대중교통 막차 시간도 같이 보면 이동 계획을 세우기 쉽습니다.",
      "연박을 계획한다면 청소 방식과 수건 교체 기준도 함께 보세요. 짧은 숙박보다 체류 시간이 길수록 작은 조건 차이가 크게 느껴질 수 있습니다.",
      "환불 가능 기간이 짧은 상품은 날씨나 동행자 일정이 바뀔 때 부담이 커질 수 있습니다. 일정 변동 가능성이 있으면 취소 조건을 먼저 비교하세요.",
    ]],
    ["인기 숙소", [
      `${popularRows.map((item) => item.title).join(", ")} 순서로 리뷰가 많이 쌓여 있습니다.`,
      "리뷰 수가 많은 숙소는 장점과 단점이 더 많이 드러나는 편입니다.",
      "평점이 비슷하다면 리뷰 수, 위치, 취소 조건 순서로 다시 비교해 보세요.",
      "가격 차이가 큰 숙소를 나란히 볼 때는 숙박 목적을 먼저 정하는 것이 좋습니다. 잠만 자는 일정인지, 호텔 안에서 보내는 시간이 긴 일정인지에 따라 적정 가격대가 달라집니다.",
      "호텔 안에서 보내는 시간이 긴 여행이라면 객실 전망, 라운지, 조식처럼 머무는 동안 쓰는 조건이 중요합니다.",
      "늦은 밤 도착이나 이른 아침 출발이 있다면 숙소 주변 교통편과 프런트 운영 시간을 먼저 확인하세요.",
    ]],
  ];
  const post = basePost({
    kind: "stay-price",
    region,
    title,
    description: `${region} 숙소의 판매가, 원가, 성급, 평점, 리뷰 수를 같은 조건으로 비교했습니다.`,
    excerpt: `${formatKoreanDate(STAY.checkIn)} 체크인, 성인 ${STAY.adultCount}명 기준 ${region} 숙소 가격표입니다.`,
    image: rows[0].image,
    alt: `${region} 숙소 가격 비교 대표 이미지`,
    info: [
      ["지역", region],
      ["체크인", formatKoreanDate(STAY.checkIn)],
      ["체크아웃", formatKoreanDate(STAY.checkOut)],
      ["인원", `성인 ${STAY.adultCount}명 · 아동 ${STAY.childCount}명`],
      ["표시 숙소", `${rows.length}개`],
      ["가격 범위", `${formatWon(stats.min)}~${formatWon(stats.max)}`],
      ["최종 확인일", formatKoreanDate(cache.updatedDate || STAY.today)],
    ],
    sections,
    faq: [
      ["가격은 어떤 기준인가요?", `성인 ${STAY.adultCount}명 기준 주말 1박 요금으로 비교했습니다.`],
      ["원가와 판매가가 같으면 어떤 의미인가요?", "별도 할인이 표시되지 않은 상품으로 보면 됩니다."],
      ["주소가 바뀌나요?", `${region} 숙소 가격 비교는 /data-stay-price-${regionSlug(region)}/ 주소에서 이어집니다.`],
    ],
    affiliateLinkCount: rows.length,
  });
  return {
    type: "stay-price",
    region,
    post,
    tableRows: rows,
    tableKind: "stay",
    affiliateUrls: rows.map((row) => row.url),
    affiliateLinkCount: rows.length,
    affiliateTextLength: affiliateTextLength(rows),
    internalUrls: [],
    sourceOverviews: [],
    sourcePostSlugs: [],
    allowedNumbers: new Set([
      ...allowedDateNumbers(STAY.today, STAY.checkIn, STAY.checkOut, cache.updatedDate),
      ...sourceNumbersFromValues([1, STAY.adultCount, STAY.childCount, STAY.nights, rows.length, stats.min, stats.max, stats.avg]),
      ...rows.flatMap((row) => [...row.sourceNumbers, ...sourceNumbersFromValues(Object.values(row))]),
    ]),
  };
}

function buildTicketCandidate(region, rows) {
  const stats = priceStats(rows, "price");
  const post = basePost({
    kind: "ticket-price",
    region,
    title: `${region} 입장권 가격 모음`,
    description: `${region} 지역 입장권과 이용권 상품의 표시 가격, 카테고리, 평점, 리뷰 수를 비교했습니다.`,
    excerpt: `${region} 입장권 가격표는 판매가가 있는 ${rows.length}개 상품을 낮은 가격순으로 표시합니다.`,
    image: rows[0].image,
    alt: `${region} 입장권 가격 모음 대표 이미지`,
    info: [
      ["지역", region],
      ["표시 상품", `${rows.length}개`],
      ["가격 범위", `${formatWon(stats.min)}~${formatWon(stats.max)}`],
      ["최종 확인일", formatKoreanDate(STAY.today)],
    ],
    sections: [
      ["상품 비교 표", [
        `${region} 입장권과 이용권 ${rows.length}개의 표시 가격은 ${formatWon(stats.min)}부터 ${formatWon(stats.max)}까지입니다. 평균 가격은 ${formatWon(stats.avg)}입니다.`,
        "상품별 카테고리, 평점, 리뷰 수, 표시 가격은 위 표에서 나란히 확인할 수 있습니다.",
        "가격이 비슷한 상품은 이용 장소, 포함 사항, 환불 가능 기간을 함께 보세요.",
        "같은 지역 상품이라도 집결지와 종료 위치가 다르면 여행 동선이 달라집니다.",
        "입장권은 방문 시간대가 중요하고, 현지투어는 집결지와 이동 방식이 중요합니다.",
        "하루에 여러 상품을 묶는 일정은 이동 거리부터 계산하는 편이 좋습니다. 가까운 지역이라도 입장 마감과 회차 시간이 겹치면 실제 이용이 어려울 수 있습니다.",
        "아이와 함께 쓰는 상품은 연령 제한과 보호자 동반 조건을 먼저 보세요. 준비물이 필요한 체험은 출발 전에 챙길 시간을 남기는 편이 좋습니다.",
      ]],
      ["체험 상품", [
        "체험 상품은 소요 시간과 준비물이 일정에 맞는지 먼저 보는 편이 좋습니다.",
        "수상레저나 야외 체험은 날씨 영향을 받을 수 있습니다.",
        "예약 전에 변경 가능 기간과 당일 연락 방법을 확인하면 일정 조정이 쉬워집니다.",
        "도심 체험 상품은 이동 시간이 짧은 대신 회차 시간이 촘촘할 수 있습니다.",
        "식사 시간이나 다음 방문지와 겹치지 않는지 함께 비교하세요.",
        "체험 전후로 이동 시간이 길다면 같은 날에는 여유 있는 상품을 고르는 편이 좋습니다.",
        "장비 대여가 포함된 상품인지, 현장에서 별도로 준비해야 하는 물품이 있는지 살펴보면 추가 지출을 줄일 수 있습니다.",
      ]],
      ["가격표를 읽는 방법", [
        "표시 가격이 같다면 카테고리와 리뷰 수를 함께 보세요. 수상레저, 투어, 이용권은 가격이 같아도 포함 조건이 다를 수 있습니다.",
        "평점은 리뷰 수와 함께 보는 편이 좋습니다. 리뷰 수가 적은 상품은 예약 화면에서 세부 조건을 더 꼼꼼히 확인하세요.",
        "가격 뒤에 붙는 부터 표기는 선택 옵션에 따라 금액이 달라질 수 있다는 뜻으로 보면 됩니다. 날짜, 시간, 인원 옵션을 고른 뒤 총액을 다시 비교하세요.",
        "패스형 상품은 이용 범위가 넓은 대신 수령 방법이나 사용 시작 시간이 중요할 수 있습니다. 단일 입장권은 운영 시간과 매표 마감이 더 중요합니다.",
      ]],
      ["예약 전 확인 순서", [
        "방문 날짜를 정한 뒤 운영 시간, 매표 마감, 집결지, 포함 사항을 차례로 확인하세요.",
        "날씨 영향을 받는 체험은 변경·취소 조건과 대체 일정을 함께 보는 편이 좋습니다.",
        "여행 마지막 날에 이용하는 상품은 이동 거리와 짐 보관 여부를 함께 보세요. 공항이나 기차역으로 이동해야 하는 일정이라면 종료 시간이 특히 중요합니다.",
        "아이와 함께 이용하는 상품은 연령 제한, 보호자 동반 조건, 준비물을 먼저 확인하세요. 체력 소모가 큰 체험은 다음 일정과 간격을 두는 편이 좋습니다.",
        "숙소 체크아웃 뒤 바로 이용하는 일정이라면 짐 보관 가능 장소와 이동 시간을 먼저 맞추세요. 늦은 오후 상품은 귀가 교통편과 식사 시간을 함께 고려하는 편이 좋습니다.",
        "상품명이 비슷한 경우에는 장소명과 포함 사항을 다시 비교하세요. 예약 버튼을 누르기 전 옵션명이 원하는 이용 방식과 맞는지 확인하면 변경 가능성을 줄일 수 있습니다.",
        "현장에서 신분 확인이나 모바일 티켓 제시가 필요한 상품은 배터리와 통신 상태도 함께 챙기는 편이 좋습니다.",
        "우천이나 강풍 영향을 받는 일정은 전날 안내와 당일 연락처를 함께 보세요. 변경 가능 시간이 지나기 전에 확인해야 선택지가 넓습니다.",
      ]],
    ],
    faq: [
      ["가격표를 먼저 볼 때 무엇을 비교하나요?", "표시 가격, 카테고리, 평점, 리뷰 수를 함께 봅니다."],
      ["체험 상품은 무엇을 확인해야 하나요?", "소요 시간, 집결지, 포함 사항, 취소 조건을 예약 전에 확인하세요."],
      ["주소가 바뀌나요?", `${region} 입장권 가격 모음은 /data-ticket-price-${regionSlug(region)}/ 주소에서 이어집니다.`],
    ],
    affiliateLinkCount: rows.length,
  });
  return {
    type: "ticket-price",
    region,
    post,
    tableRows: rows,
    tableKind: "ticket",
    affiliateUrls: rows.map((row) => row.url),
    affiliateLinkCount: rows.length,
    affiliateTextLength: affiliateTextLength(rows),
    internalUrls: [],
    sourceOverviews: [],
    sourcePostSlugs: [],
    allowedNumbers: new Set([
      ...allowedDateNumbers(STAY.today),
      ...sourceNumbersFromValues([rows.length, stats.min, stats.max, stats.avg]),
      ...rows.flatMap((row) => [...row.sourceNumbers, ...sourceNumbersFromValues(Object.values(row))]),
    ]),
  };
}

function buildFestivalCandidate(region, rows) {
  const statuses = rows.map(festivalStatus);
  const ongoing = statuses.filter((status) => status === "진행 중").length;
  const upcoming = statuses.filter((status) => status === "예정").length;
  const ended = statuses.filter((status) => status === "종료").length;
  const post = basePost({
    kind: "festival-schedule",
    region,
    title: `${region} 축제 일정 정리`,
    description: `${region} 축제 일정의 시작일, 종료일, 장소, 요금, 상태를 한눈에 비교했습니다.`,
    excerpt: `${region} 축제 ${rows.length}건의 시작일, 종료일, 장소, 상태를 표로 모았습니다.`,
    image: rows.find((row) => row.image)?.image || "",
    alt: `${region} 축제 일정 정리 대표 이미지`,
    info: [
      ["지역", region],
      ["표시 축제", `${rows.length}건`],
      ["진행 중", `${ongoing}건`],
      ["예정", `${upcoming}건`],
      ["종료", `${ended}건`],
      ["최종 확인일", formatKoreanDate(STAY.today)],
    ],
    sections: [
      ["예약 전 확인 순서", [
        `${region} 축제는 ${formatKoreanDate(STAY.today)} 현재 진행 중 ${ongoing}건, 예정 ${upcoming}건, 종료 ${ended}건으로 나뉩니다. 방문하려는 날짜가 행사 기간 안에 있는지 먼저 확인하세요.`,
        "축제 장소와 요금은 같은 지역 안에서도 차이가 큽니다. 대중교통 막차, 주차, 현장 매표 마감 시간을 함께 보는 편이 좋습니다.",
        "일정이 여러 날 이어지는 축제는 요일마다 프로그램과 혼잡도가 달라질 수 있습니다. 방문 날짜를 정한 뒤 주요 프로그램 시간과 입장 마감 시간을 먼저 살피세요.",
        "야외 행사는 날씨와 현장 통제에 따라 관람 동선이 달라질 수 있습니다. 우천 안내, 임시 주차장, 셔틀 운영 여부를 함께 확인하면 이동 계획을 세우기 쉽습니다.",
        "야간 행사나 불꽃, 공연이 있는 일정은 귀가 교통편을 먼저 정하세요. 마지막 프로그램을 보고 나오는 시간이 몰리면 이동 시간이 길어질 수 있습니다.",
        "어린이와 함께 방문한다면 화장실, 유모차 이동, 휴식 가능한 공간을 먼저 확인하는 편이 좋습니다.",
      ]],
      ["일정과 운영 흐름", [
        "표의 시작일과 종료일을 먼저 비교하면 당일 방문 가능한 행사와 미리 계획해야 할 행사를 나누기 쉽습니다.",
        "도심 행사라면 대중교통 시간을, 외곽 행사라면 주차장과 셔틀 여부를 먼저 확인하세요.",
        "오전부터 이어지는 행사는 점심 시간대 혼잡을 고려해 이동 시간을 넉넉히 잡는 편이 좋습니다.",
        "야간 프로그램이 있는 행사는 귀가 교통편을 먼저 정하면 마지막 관람 시간을 정하기 쉽습니다.",
        "행사장이 여러 구역으로 나뉘면 입구와 주요 프로그램 위치가 다를 수 있습니다. 동행자와 만날 장소를 미리 정하면 현장 이동이 편합니다.",
      ]],
      ["가격표를 읽는 방법", [
        "무료 행사는 현장 체험이나 부대 프로그램에 별도 비용이 붙을 수 있습니다. 유료 행사는 예매처와 현장 판매 조건이 다를 수 있습니다.",
        "종료일이 가까운 행사는 마지막 운영일의 마감 시간이 평소와 다를 수 있으니 공식 안내를 한 번 더 확인하세요.",
        "요금이 표시된 행사는 관람권, 체험권, 좌석 등급에 따라 실제 결제 금액이 달라질 수 있습니다. 가족 단위 방문은 무료 대상과 할인 조건을 함께 확인하세요.",
        "장소가 넓거나 여러 구역으로 나뉜 축제는 입구와 프로그램 위치가 다를 수 있습니다. 지도와 셔틀 정보를 먼저 보면 현장 이동 시간을 줄일 수 있습니다.",
        "현장 체험권은 행사장 안에서 따로 판매되는 경우가 있습니다. 무료 입장 행사라도 체험, 먹거리, 주차 비용은 별도로 살펴보세요.",
        "예매가 필요한 축제는 취소 가능 기간과 입장권 수령 방식을 함께 보세요. 현장 수령이면 줄 서는 시간까지 일정에 넣는 편이 좋습니다.",
      ]],
      ["함께 볼 글", [
        "같은 지역의 축제 글을 함께 보면 행사 기간과 장소를 비교하기 쉽습니다.",
        "시작일과 종료일, 장소, 현재 상태는 위 표에서 먼저 확인하세요.",
        "같은 지역 축제를 묶어서 보면 여행 날짜를 정하기 쉽습니다. 진행 중인 행사는 바로 방문 가능성을 보고, 예정 행사는 숙소와 교통 예약 시점을 함께 판단하세요.",
        "종료로 표시된 행사는 다음 회차 일정이 아직 열리지 않았을 수 있습니다. 같은 장소에서 반복되는 행사라면 공식 안내를 통해 다음 운영 여부를 확인하는 편이 좋습니다.",
        "여러 행사가 같은 주에 열리면 동선을 묶어 하루 일정으로 볼 수도 있습니다. 다만 장소가 멀리 떨어져 있으면 한 곳을 충분히 보는 편이 낫습니다.",
      ]],
    ],
    faq: [
      ["종료 표시는 어떻게 계산하나요?", `${formatKoreanDate(STAY.today)} 기준 종료일이 지난 행은 종료로 표시합니다.`],
      ["방문 전 무엇을 확인해야 하나요?", "운영 시간, 장소 변경, 현장 매표 여부, 우천 시 운영 여부를 먼저 확인하세요."],
      ["주소가 바뀌나요?", `${region} 축제 일정 정리는 /data-festival-schedule-${regionSlug(region)}/ 주소에서 이어집니다.`],
    ],
    affiliateLinkCount: 0,
  });
  return {
    type: "festival-schedule",
    region,
    post,
    tableRows: rows,
    tableKind: "festival",
    affiliateUrls: [],
    affiliateLinkCount: 0,
    affiliateTextLength: 0,
    internalUrls: rows.map((row) => `/${row.slug}/`),
    sourceOverviews: rows.map((row) => row.overview).filter(Boolean),
    sourcePostSlugs: rows.map((row) => row.slug).filter(Boolean),
    allowedNumbers: new Set([
      ...allowedDateNumbers(STAY.today, ...rows.flatMap((row) => [row.startDate, row.endDate])),
      ...sourceNumbersFromValues([rows.length, ongoing, upcoming, ended]),
      ...rows.flatMap((row) => [...row.sourceNumbers, ...sourceNumbersFromValues(Object.values(row))]),
    ]),
  };
}

function tableHtml(candidate) {
  if (candidate.tableKind === "stay") {
    return `<table class="data-table"><thead><tr><th>숙소명</th><th>성급</th><th>평점</th><th>원가</th><th>판매가</th></tr></thead><tbody>${candidate.tableRows.map((row) => `<tr><td><a data-affiliate-link href="${esc(row.url)}" target="_blank" rel="sponsored nofollow noopener">${esc(row.title)}</a></td><td>${esc(row.starRating)}</td><td>${esc(reviewLabel(row))}</td><td>${esc(formatWon(row.originalPrice))}</td><td>${esc(formatWon(row.salePrice))}</td></tr>`).join("")}</tbody></table>`;
  }
  if (candidate.tableKind === "ticket") {
    return `<table class="data-table"><thead><tr><th>상품명</th><th>카테고리</th><th>평점</th><th>가격</th></tr></thead><tbody>${candidate.tableRows.map((row) => `<tr><td><a data-affiliate-link href="${esc(row.url)}" target="_blank" rel="sponsored nofollow noopener">${esc(row.title)}</a></td><td>${esc(row.category)}</td><td>${esc(reviewLabel(row))}</td><td>${esc(formatWon(row.price))}</td></tr>`).join("")}</tbody></table>`;
  }
  return `<table class="data-table"><thead><tr><th>축제명</th><th>시작일</th><th>종료일</th><th>장소</th><th>상태</th></tr></thead><tbody>${candidate.tableRows.map((row) => `<tr><td><a href="/${esc(row.slug)}/">${esc(row.title)}</a></td><td>${esc(formatKoreanDate(row.startDate))}</td><td>${esc(formatKoreanDate(row.endDate))}</td><td>${esc(row.place)}</td><td>${esc(festivalStatus(row))}</td></tr>`).join("")}</tbody></table>`;
}

function renderDataArticle(candidate) {
  const post = candidate.post;
  const rows = post.info.map(([key, value]) => `<tr><th>${esc(key)}</th><td>${esc(value)}</td></tr>`).join("");
  const sections = post.sections.map(([heading, paragraphs]) => {
    const body = paragraphs.map((paragraph) => normalizeText(paragraph)).filter(Boolean);
    if (!body.length) return "";
    return `<section class="article-section"><h2>${esc(heading)}</h2>${body.map((paragraph) => `<p>${esc(paragraph)}</p>`).join("")}</section>`;
  }).join("");
  const faqs = post.faq.map(([question, answer]) => `<details><summary>${esc(question)}</summary><p>${esc(answer)}</p></details>`).join("");
  const affiliateNotice = candidate.affiliateLinkCount
    ? `<p class="affiliate-disclosure">이 글에는 마이리얼트립 제휴 링크가 포함되어 있으며, 예약이나 구매가 발생하면 트립뷰가 수수료를 받을 수 있습니다. 제휴 링크는 글당 ${MAX_AFFILIATE_LINKS}개 이하로 제한합니다.</p>`
    : "";
  const imageFigure = post.image
    ? `<figure class="cover-figure"><img class="cover" src="${esc(post.image)}" alt="${esc(post.alt)}" loading="lazy"><figcaption>${esc(post.alt)}</figcaption></figure>`
    : "";
  const tableTitle = candidate.tableKind === "festival" ? "축제 일정 표" : "상품 비교 표";
  const sourceNote = candidate.tableKind === "festival"
    ? "관광 정보는 공공 관광 정보를 바탕으로 정리했습니다."
    : candidate.tableKind === "stay"
      ? "숙소 정보는 마이리얼트립 상품 정보 기준입니다."
      : "상품 정보는 마이리얼트립 상품 정보 기준입니다.";
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${esc(post.description)}">
    <meta property="og:title" content="${esc(post.title)} | 트립뷰">
    <meta property="og:description" content="${esc(post.excerpt)}">
    ${post.image ? `<meta property="og:image" content="${esc(post.image)}">` : ""}
    <title>${esc(post.title)} | 트립뷰</title>
    <style>
      :root{--ink:#111;--muted:#666;--line:#ddd;--soft:#f6f6f6;--paper:#fff}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:Arial,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;line-height:1.72;letter-spacing:0}a{color:inherit}.wrap{width:min(1080px,calc(100% - 32px));margin:auto}.top{border-bottom:1px solid var(--line);background:#fff}.nav{min-height:68px;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{font-size:24px;font-weight:900;text-decoration:none}.links{display:flex;gap:18px;overflow-x:auto;white-space:nowrap;font-size:14px;font-weight:800}.links a{text-decoration:none}.hero{padding:34px 0 22px}.hero h1{max-width:920px;margin:0 0 12px;font-size:clamp(32px,5vw,50px);line-height:1.16}.meta{display:flex;flex-wrap:wrap;gap:12px;color:var(--muted);font-size:14px;font-weight:800}.affiliate-disclosure{max-width:820px;margin:14px 0 0;color:#444;font-size:13px}.cover-figure{width:min(1080px,calc(100% - 32px));margin:0 auto}.cover{display:block;width:100%;max-height:520px;object-fit:cover;background:var(--soft)}figcaption{margin-top:8px;color:var(--muted);font-size:13px}.layout{display:block;padding:34px 0 58px}.content{max-width:820px;font-size:18px}.content h2{margin:34px 0 12px;font-size:25px;line-height:1.25}.content p{margin:0 0 18px}.info-table,.data-table{width:100%;border-collapse:collapse;margin:0 0 28px;font-size:15px}.info-table th,.info-table td,.data-table th,.data-table td{padding:11px 0;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}.info-table th{width:132px}.data-table th{font-weight:900}.data-table a{font-weight:900;text-decoration:underline;text-underline-offset:3px}.faq{margin-top:32px;border-top:1px solid var(--line)}details{border-bottom:1px solid var(--line)}summary{cursor:pointer;padding:15px 0;font-weight:900}details p{color:#444}.footer{border-top:1px solid var(--line);padding:28px 0 42px;color:var(--muted);font-size:13px}@media(max-width:820px){.nav{align-items:flex-start;flex-direction:column;padding:14px 0}.links{width:100%;padding-bottom:4px}.content{font-size:17px}.data-table{display:block;overflow-x:auto;white-space:nowrap}.info-table th{width:104px}}
    </style>
  </head>
  <body>
    <header class="top"><div class="wrap nav"><a class="brand" href="/">트립뷰</a><nav class="links" aria-label="주요 메뉴"><a href="/">홈</a><a href="/travel/">여행지</a><a href="/festival/">축제</a><a href="/stay/">숙소</a><a href="/ticket/">입장권·투어</a></nav></div></header>
    <main>
      <section class="wrap hero">
        <h1>${esc(post.title)}</h1>
        <div class="meta"><span>${esc(post.editorialReviewer)}</span><span>${esc(post.date)}</span><span>${esc(post.read)}</span><span>${esc(post.region)}</span></div>
        ${affiliateNotice}
      </section>
      ${imageFigure}
      <section class="wrap layout">
        <article class="content">
          <table class="info-table"><tbody>${rows}</tbody></table>
          <section class="${candidate.affiliateLinkCount ? "affiliate-block" : "schedule-block"}" aria-label="${esc(tableTitle)}">
            <h2>${esc(tableTitle)}</h2>
            ${tableHtml(candidate)}
          </section>
          ${sections}
          <section class="faq"><h2>자주 묻는 질문</h2>${faqs}</section>
        </article>
      </section>
    </main>
    <footer class="wrap footer">${esc(sourceNote)} 최종 확인일: ${esc(formatKoreanDate(post.updatedAt || STAY.today))}.</footer>
  </body>
</html>
`;
}

async function writePost(candidate) {
  const dir = path.join(ROOT, candidate.post.slug);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "index.html"), renderDataArticle(candidate), "utf8");
}

function mergePosts(existingPosts, generatedCandidates, manifest) {
  const bySlug = new Map(existingPosts.map((post) => [post.slug, post]));
  for (const candidate of generatedCandidates) {
    const previous = bySlug.get(candidate.post.slug);
    const manifestEntry = (manifest.posts || []).find((entry) => entry.slug === candidate.post.slug);
    const firstPublishedAt = previous?.dataPipeline?.firstPublishedAt || manifestEntry?.firstPublishedAt || new Date().toISOString();
    bySlug.set(candidate.post.slug, {
      ...previous,
      ...candidate.post,
      dataPipeline: {
        ...(previous?.dataPipeline || {}),
        ...candidate.post.dataPipeline,
        firstPublishedAt,
      },
    });
  }
  return [...bySlug.values()].sort((a, b) => {
    const dateDiff = String(b.sortDate || b.updatedAt || "").localeCompare(String(a.sortDate || a.updatedAt || ""));
    if (dateDiff) return dateDiff;
    return String(a.slug).localeCompare(String(b.slug));
  });
}

function updateManifest(manifest, generatedCandidates) {
  const posts = new Map((manifest.posts || []).map((entry) => [entry.slug, entry]));
  for (const candidate of generatedCandidates) {
    const previous = posts.get(candidate.post.slug);
    posts.set(candidate.post.slug, {
      slug: candidate.post.slug,
      type: candidate.type,
      region: candidate.region,
      firstPublishedAt: previous?.firstPublishedAt || candidate.post.dataPipeline.generatedAt,
      lastGeneratedAt: candidate.post.dataPipeline.generatedAt,
      lastUpdatedDate: STAY.today,
      rowCount: candidate.tableRows.length,
      affiliateLinkCount: candidate.affiliateLinkCount,
    });
  }
  return {
    updatedAt: new Date().toISOString(),
    lastRunDate: STAY.today,
    policy: {
      maxDailyPosts: MAX_DAILY_POSTS,
      maxDailyPerType: MAX_DAILY_PER_TYPE,
      maxAffiliateLinks: MAX_AFFILIATE_LINKS,
      maxAutoGeneratedShare: MAX_AUTO_SHARE,
      urlPattern: "/data-{type}-{region}/",
    },
    posts: [...posts.values()].sort((a, b) => a.slug.localeCompare(b.slug)),
  };
}

function canPublishMore(existingPosts, plannedNewCount) {
  const dataPostCount = existingPosts.filter((post) => post?.dataPipeline?.generated).length + plannedNewCount;
  const total = existingPosts.length + plannedNewCount;
  return total === 0 || dataPostCount / total <= MAX_AUTO_SHARE;
}

async function appendLog(run) {
  const existing = await readJson(LOG_PATH, { runs: [] });
  const runs = Array.isArray(existing?.runs) ? existing.runs : [];
  const sameDate = runs.find((entry) => entry.runDate === run.runDate && !entry.stoppedReason);
  if (sameDate && !run.stoppedReason) {
    const generated = new Map((sameDate.generated || []).map((entry) => [`${entry.type}:${entry.slug}`, entry]));
    for (const entry of run.generated || []) generated.set(`${entry.type}:${entry.slug}`, entry);
    sameDate.runAt = run.runAt;
    sameDate.generated = [...generated.values()];
    sameDate.generatedCount = sameDate.generated.length;
    sameDate.discarded = [...(sameDate.discarded || []), ...(run.discarded || [])];
    sameDate.discardedCount = sameDate.discarded.length;
    sameDate.rerunCount = Number(sameDate.rerunCount || 0) + 1;
  } else {
    runs.push(run);
  }
  await writeJson(LOG_PATH, { runs: runs.slice(-180) });
}

async function main() {
  const [posts, accommodationCache, tnaProducts, manifest] = await Promise.all([
    readJson(POSTS_PATH, []),
    readJson(ACCOMMODATION_CACHE_PATH, null),
    readJson(TNA_PRODUCTS_PATH, []),
    readJson(MANIFEST_PATH, { posts: [] }),
  ]);
  const allCandidateGroups = [
    accommodationCandidates(accommodationCache),
    festivalCandidates(posts),
    ticketCandidates(Array.isArray(tnaProducts) ? tnaProducts : []),
  ];
  const generated = [];
  const discarded = [];
  const dailyTypes = new Set();

  if (!canPublishMore(posts, 1)) {
    const run = {
      runAt: new Date().toISOString(),
      runDate: STAY.today,
      generatedCount: 0,
      discardedCount: 0,
      generated: [],
      discarded: [],
      stoppedReason: "auto_generated_share_over_70",
    };
    await appendLog(run);
    console.log("Data post pipeline stopped: auto-generated data posts would exceed 70% of all posts.");
    return;
  }

  for (const candidates of allCandidateGroups) {
    if (generated.length >= MAX_DAILY_POSTS) break;
    for (const candidate of candidates) {
      if (dailyTypes.has(candidate.type)) break;
      if (!canPublishMore(posts, generated.filter((item) => !posts.some((post) => post.slug === item.post.slug)).length + 1)) {
        discarded.push({ slug: candidate.post.slug, type: candidate.type, region: candidate.region, reasons: ["auto_generated_share_over_70"] });
        break;
      }
      const reasons = await validateCandidate(candidate, posts, manifest);
      if (reasons.length) {
        discarded.push({ slug: candidate.post.slug, type: candidate.type, region: candidate.region, reasons });
        continue;
      }
      candidate.post.dataPipeline.validation = candidateValidationMetadata(
        candidate,
        String(process.env.DATA_PIPELINE_VALIDATE_LIVE_URLS || "").toLowerCase() === "true",
      );
      generated.push(candidate);
      dailyTypes.add(candidate.type);
      break;
    }
  }

  for (const candidate of generated) await writePost(candidate);
  const mergedPosts = mergePosts(posts, generated, manifest);
  await writeJson(POSTS_PATH, mergedPosts);
  await writeJson(MANIFEST_PATH, updateManifest(manifest, generated));
  const run = {
    runAt: new Date().toISOString(),
    runDate: STAY.today,
    generatedCount: generated.length,
    discardedCount: discarded.length,
    generated: generated.map((candidate) => ({
      slug: candidate.post.slug,
      type: candidate.type,
      region: candidate.region,
      rowCount: candidate.tableRows.length,
      affiliateLinkCount: candidate.affiliateLinkCount,
    })),
    discarded,
  };
  await appendLog(run);
  console.log(`Data post pipeline generated ${generated.length} post(s), discarded ${discarded.length} candidate(s).`);
  for (const item of generated) console.log(`- ${item.post.slug}: ${item.post.title}`);
  for (const item of discarded) console.log(`- discarded ${item.slug}: ${item.reasons.join(", ")}`);
}

await main();
