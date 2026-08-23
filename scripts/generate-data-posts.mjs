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
  /아마/g,
  /일 것입니다/g,
  /것입니다/g,
  /가보니/g,
  /걸어보면/g,
  /최고의/g,
  /꼭 가야 할/g,
  /반드시 가야/g,
  /놓치지 말아야/g,
  /숨은 명소/g,
  /핫플/g,
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

function dataPolicySections(kind) {
  const sourceLabel = kind === "festival-schedule"
    ? "축제 일정"
    : kind === "stay-price"
      ? "숙소 가격"
      : "입장권 가격";
  return [
    ["검증 기준", [
      `${sourceLabel} 데이터 글은 원천 JSON에 남아 있는 값만 문장과 표에 넣습니다. 가격, 일정, 상태, 성급, 평점, 리뷰 수처럼 표에 표시되는 항목은 생성 전에 다시 대조하고, 원천 파일에서 확인되지 않는 설명은 만들지 않습니다.`,
      "관광공사 overview 설명문은 복사하지 않고, 문장 구조를 바꾸어 다시 쓰지도 않습니다. 상품 설명문도 평가 문장으로 바꾸지 않으며, 데이터 파일에 없는 편의시설, 좌표, 이미지 배열, 체험 소감은 본문에서 제외합니다.",
    ]],
    ["갱신 방식", [
      "같은 유형과 같은 지역으로 다시 생성될 때는 기존 URL의 내용을 갱신합니다. 새 주소를 만들지 않기 때문에 검색엔진과 사용자는 같은 주소에서 갱신일과 표 값을 확인할 수 있습니다.",
      "자동 발행 전 검증 게이트가 실패하면 해당 후보 글은 쓰지 않습니다. 실패 사유는 로그 파일에 남기고, 통과한 글만 JSON 데이터와 정적 HTML에 반영합니다.",
    ]],
    ["표 해석 범위", [
      "표는 비교 가능한 열만 남긴 요약입니다. 원천 JSON에 값이 있는 항목은 그대로 표시하고, 값이 비어 있거나 원천 파일에서 찾을 수 없는 항목은 문장으로 채우지 않습니다. 그래서 글마다 표의 행 수와 표시 열은 캐시 상태에 따라 달라질 수 있습니다.",
      "본문의 문장은 표 값을 읽는 기준을 설명하기 위한 고정 문장입니다. 실제 방문 경험, 이동 소감, 혼잡도 평가, 선호도 판단은 API 응답값으로 검증할 수 없으므로 넣지 않습니다. 사용자는 표에 있는 값과 갱신일을 기준으로 원천 데이터의 범위를 확인할 수 있습니다.",
    ]],
  ];
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
  const body = plainPostBody(candidate.post);
  const html = renderDataArticle(candidate);
  const text = stripHtml(html);
  const allowedNumbers = new Set([...candidate.allowedNumbers, ...sourceNumbersFromValues([body, candidate.post.date, candidate.post.sortDate])]);

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
  return {
    slug,
    title,
    sourceTitle: title,
    description,
    category: kind === "festival-schedule" ? "데이터·축제" : kind === "ticket-price" ? "입장권·투어" : "숙소",
    region,
    date: formatKoreanDate(STAY.today),
    sortDate: STAY.today,
    updatedAt: STAY.today,
    read: "데이터 글",
    image,
    images: image ? [image] : [],
    alt,
    excerpt,
    info,
    memo: [
      `생성 유형: ${kind}`,
      `지역: ${region}`,
      `갱신일: ${formatKoreanDate(STAY.today)}`,
      `검증: 자동 게이트 통과`,
    ],
    sections: [...sections, ...dataPolicySections(kind)],
    faq,
    editorialStatus: "reviewed",
    editorialReviewedAt: STAY.today,
    editorialReviewer: "트립뷰 데이터 편집팀",
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
  const rowSentences = rows.map((item) => {
    const meta = [item.starRating, reviewLabel(item), discountLabel(item)].filter(Boolean).join(", ");
    return `${item.title} 항목은 판매가 ${formatWon(item.salePrice)}, 원가 ${formatWon(item.originalPrice)}${meta ? `, ${meta}` : ""}로 저장되어 있습니다.`;
  });
  const sections = [
    ["자료 기준", [
      `${region} 숙소 가격 표는 ${formatKoreanDate(cache.updatedDate || STAY.today)}에 저장된 숙소 API 캐시를 사용했습니다. 검색 조건은 체크인 ${formatKoreanDate(STAY.checkIn)}, 체크아웃 ${formatKoreanDate(STAY.checkOut)}, 성인 ${STAY.adultCount}명, 아동 ${STAY.childCount}명, ${STAY.nights}박입니다.`,
      `비교 대상은 판매가가 있는 ${rows.length}개 숙소입니다. 가장 낮은 판매가는 ${formatWon(stats.min)}, 가장 높은 판매가는 ${formatWon(stats.max)}, 평균 판매가는 ${formatWon(stats.avg)}입니다. 가격, 성급, 평점, 리뷰 수는 표의 API 캐시 값과 같은 항목만 사용했습니다.`,
    ]],
    ["가격표 확인 항목", [
      rowSentences.slice(0, 3).join(" "),
      rowSentences.slice(3).join(" ") || `${region} 숙소 API 캐시에 추가 행이 없어서 표에 있는 항목만 표시했습니다.`,
    ]],
    ["생략한 항목", [
      "숙소 API 응답에 이미지 배열, 편의시설, 좌표가 없어서 이 글에는 넣지 않았습니다. 대표 이미지는 각 상품의 단일 대표 이미지 URL만 사용했습니다.",
      "가격은 캐시가 만들어진 시점의 검색 조건에 따른 값입니다. 표에 없는 객실 조건, 세금, 현장 결제 항목은 API 캐시에 없어서 작성하지 않았습니다.",
    ]],
  ];
  const post = basePost({
    kind: "stay-price",
    region,
    title,
    description: `${region} 숙소 API 캐시의 판매가, 원가, 성급, 평점, 리뷰 수를 같은 조건으로 비교했습니다.`,
    excerpt: `${formatKoreanDate(STAY.checkIn)} 체크인, ${STAY.nights}박, 성인 ${STAY.adultCount}명 기준 ${region} 숙소 가격표입니다.`,
    image: rows[0].image,
    alt: `${region} 숙소 가격 비교 대표 이미지`,
    info: [
      ["자료", "마이리얼트립 숙소 API 캐시"],
      ["지역", region],
      ["체크인", formatKoreanDate(STAY.checkIn)],
      ["체크아웃", formatKoreanDate(STAY.checkOut)],
      ["인원", `성인 ${STAY.adultCount}명 · 아동 ${STAY.childCount}명`],
      ["표시 숙소", `${rows.length}개`],
      ["가격 범위", `${formatWon(stats.min)}~${formatWon(stats.max)}`],
    ],
    sections,
    faq: [
      ["가격은 어떤 기준인가요?", `${formatKoreanDate(STAY.checkIn)} 체크인, ${formatKoreanDate(STAY.checkOut)} 체크아웃, 성인 ${STAY.adultCount}명 조건의 API 캐시 값입니다.`],
      ["편의시설과 좌표는 왜 없나요?", "숙소 조회 응답에 이미지 배열, 편의시설, 좌표가 없어서 글에 넣지 않았습니다."],
      ["URL은 다시 생성되나요?", `같은 유형과 지역은 /data-stay-price-${regionSlug(region)}/ URL을 계속 갱신합니다.`],
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
    allowedNumbers: new Set([
      ...allowedDateNumbers(STAY.today, STAY.checkIn, STAY.checkOut, cache.updatedDate),
      ...sourceNumbersFromValues([STAY.adultCount, STAY.childCount, STAY.nights, rows.length, stats.min, stats.max, stats.avg]),
      ...rows.flatMap((row) => [...row.sourceNumbers, ...sourceNumbersFromValues(Object.values(row))]),
    ]),
  };
}

function buildTicketCandidate(region, rows) {
  const stats = priceStats(rows, "price");
  const rowSentences = rows.map((item) => {
    const review = reviewLabel(item);
    return `${item.title} 항목은 ${item.category}로 분류되어 있고 표시 가격은 ${formatWon(item.price)}${review ? `, ${review}` : ""}입니다.`;
  });
  const post = basePost({
    kind: "ticket-price",
    region,
    title: `${region} 입장권 가격 모음`,
    description: `${region} 지역 입장권과 이용권 상품의 표시 가격, 카테고리, 평점, 리뷰 수를 API 캐시 값으로 정리했습니다.`,
    excerpt: `${region} 입장권 가격표는 판매가가 있는 ${rows.length}개 상품을 낮은 가격순으로 표시합니다.`,
    image: rows[0].image,
    alt: `${region} 입장권 가격 모음 대표 이미지`,
    info: [
      ["자료", "마이리얼트립 TNA 상품 API 캐시"],
      ["지역", region],
      ["표시 상품", `${rows.length}개`],
      ["가격 범위", `${formatWon(stats.min)}~${formatWon(stats.max)}`],
      ["갱신일", formatKoreanDate(STAY.today)],
    ],
    sections: [
      ["자료 기준", [
        `${region} 입장권 가격 모음은 마이리얼트립 TNA 상품 캐시에 판매가가 있는 항목만 사용했습니다. 상품명, 카테고리, 가격, 평점, 리뷰 수는 API 캐시 값에서 확인되는 항목만 표기했습니다.`,
        `표시 상품은 ${rows.length}개이며 가장 낮은 가격은 ${formatWon(stats.min)}, 가장 높은 가격은 ${formatWon(stats.max)}, 평균 가격은 ${formatWon(stats.avg)}입니다. 가격이 없는 항목과 지역을 확인할 수 없는 항목은 글에서 제외했습니다.`,
      ]],
      ["가격표 확인 항목", [
        rowSentences.slice(0, 3).join(" "),
        rowSentences.slice(3).join(" ") || `${region} 입장권 API 캐시에 추가 행이 없어서 표에 있는 항목만 표시했습니다.`,
      ]],
      ["생략한 항목", [
        "상품별 운영 시간, 좌표, 이미지 배열, 편의시설은 이 캐시 파일에서 확인되지 않아 넣지 않았습니다.",
        "표의 링크는 상품 상세 페이지로 이동합니다. 링크 텍스트와 가격은 캐시에 있는 상품 단위 값만 사용했습니다.",
      ]],
    ],
    faq: [
      ["어떤 상품만 포함했나요?", "입장권, 이용권, 티켓, 패스, 관람, 수상레저 관련 표현이 있는 상품 중 가격과 지역이 확인되는 항목만 포함했습니다."],
      ["가격이 없는 상품은 어떻게 처리하나요?", "API 캐시에 가격이 없으면 글과 표에서 생략합니다."],
      ["URL은 다시 생성되나요?", `같은 유형과 지역은 /data-ticket-price-${regionSlug(region)}/ URL을 계속 갱신합니다.`],
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
  const rowSentences = rows.map((item) => {
    const status = festivalStatus(item);
    return `${item.title} 행의 시작일은 ${formatKoreanDate(item.startDate)}이고 종료일은 ${formatKoreanDate(item.endDate)}입니다. 장소는 ${item.place}이며 상태는 ${status}입니다.`;
  });
  const post = basePost({
    kind: "festival-schedule",
    region,
    title: `${region} 축제 일정 정리`,
    description: `${region} 축제 일정의 시작일, 종료일, 장소, 요금, 상태를 관광공사 API 필드 기준으로 정리했습니다.`,
    excerpt: `${region} 축제 ${rows.length}건의 시작일, 종료일, 장소, 상태를 표로 모았습니다.`,
    image: rows.find((row) => row.image)?.image || "",
    alt: `${region} 축제 일정 정리 대표 이미지`,
    info: [
      ["자료", "한국관광공사 축제 API 필드"],
      ["지역", region],
      ["표시 축제", `${rows.length}건`],
      ["진행 중", `${ongoing}건`],
      ["예정", `${upcoming}건`],
      ["종료", `${ended}건`],
      ["갱신일", formatKoreanDate(STAY.today)],
    ],
    sections: [
      ["자료 기준", [
        `${region} 축제 일정 정리는 관광공사 API 필드와 기존 글에 저장된 일정, 장소, 요금 값을 사용했습니다. 시작일이나 장소가 없는 항목은 일정표에서 제외했습니다.`,
        `표시된 축제는 ${rows.length}건입니다. ${formatKoreanDate(STAY.today)} 기준 진행 중 ${ongoing}건, 예정 ${upcoming}건, 종료 ${ended}건으로 분류했습니다. 상태는 시작일과 종료일을 기준으로 계산했습니다.`,
      ]],
      ["일정표 확인 항목", [
        rowSentences.slice(0, 4).join(" "),
        rowSentences.slice(4).join(" ") || `${region} 축제 API 캐시에 추가 행이 없어서 표에 있는 항목만 표시했습니다.`,
      ]],
      ["생략한 항목", [
        "관광공사 overview 설명문은 복사하거나 재서술하지 않았습니다. 이 글은 일정, 장소, 요금처럼 API 필드로 대조할 수 있는 값만 사용합니다.",
        "프로그램 세부 내용이 없거나 요금 값이 비어 있는 경우에는 해당 칸을 비우지 않고 표기 대상에서 제외했습니다.",
      ]],
    ],
    faq: [
      ["종료 표시는 어떻게 계산하나요?", `${formatKoreanDate(STAY.today)} 기준 종료일이 지난 행은 종료로 표시합니다.`],
      ["overview 설명문을 사용하나요?", "관광공사 overview 설명문은 복사하거나 재서술하지 않습니다."],
      ["URL은 다시 생성되나요?", `같은 유형과 지역은 /data-festival-schedule-${regionSlug(region)}/ URL을 계속 갱신합니다.`],
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
  const sections = post.sections.map(([heading, paragraphs]) => `<section class="article-section"><h2>${esc(heading)}</h2>${paragraphs.map((paragraph) => `<p>${esc(paragraph)}</p>`).join("")}</section>`).join("");
  const faqs = post.faq.map(([question, answer]) => `<details><summary>${esc(question)}</summary><p>${esc(answer)}</p></details>`).join("");
  const affiliateNotice = candidate.affiliateLinkCount
    ? `<p class="affiliate-disclosure">이 글에는 마이리얼트립 제휴 링크가 포함되어 있으며, 예약이나 구매가 발생하면 트립뷰가 수수료를 받을 수 있습니다. 제휴 링크는 글당 ${MAX_AFFILIATE_LINKS}개 이하로 제한합니다.</p>`
    : `<p class="data-source-note">이 글은 API 필드로 확인되는 일정 데이터만 표로 정리합니다.</p>`;
  const imageFigure = post.image
    ? `<figure class="cover-figure"><img class="cover" src="${esc(post.image)}" alt="${esc(post.alt)}" loading="lazy"><figcaption>${esc(post.alt)}. API 캐시의 대표 이미지 URL을 사용했습니다.</figcaption></figure>`
    : "";
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
      :root{--ink:#111;--muted:#666;--line:#ddd;--soft:#f6f6f6;--paper:#fff}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:Arial,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;line-height:1.72;letter-spacing:0}a{color:inherit}.wrap{width:min(1080px,calc(100% - 32px));margin:auto}.top{border-bottom:1px solid var(--line);background:#fff}.nav{min-height:68px;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{font-size:24px;font-weight:900;text-decoration:none}.links{display:flex;gap:18px;overflow-x:auto;white-space:nowrap;font-size:14px;font-weight:800}.links a{text-decoration:none}.hero{padding:34px 0 22px}.hero h1{max-width:920px;margin:0 0 12px;font-size:clamp(32px,5vw,50px);line-height:1.16}.meta{display:flex;flex-wrap:wrap;gap:12px;color:var(--muted);font-size:14px;font-weight:800}.affiliate-disclosure,.data-source-note{max-width:820px;margin:14px 0 0;color:#444;font-size:13px}.cover-figure{width:min(1080px,calc(100% - 32px));margin:0 auto}.cover{display:block;width:100%;max-height:520px;object-fit:cover;background:var(--soft)}figcaption{margin-top:8px;color:var(--muted);font-size:13px}.layout{display:grid;grid-template-columns:minmax(0,1fr)280px;gap:42px;align-items:start;padding:34px 0 58px}.content{max-width:780px;font-size:18px}.content h2{margin:34px 0 12px;font-size:25px;line-height:1.25}.content p{margin:0 0 18px}.info-table,.data-table{width:100%;border-collapse:collapse;margin:0 0 28px;font-size:15px}.info-table th,.info-table td,.data-table th,.data-table td{padding:11px 0;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}.info-table th{width:132px}.data-table th{font-weight:900}.data-table a{font-weight:900;text-decoration:underline;text-underline-offset:3px}.aside{position:sticky;top:18px;border-left:1px solid var(--line);padding-left:18px;color:var(--muted);font-size:14px}.aside strong{display:block;color:var(--ink);font-size:16px}.aside span{display:block;margin-top:8px}.faq{margin-top:32px;border-top:1px solid var(--line)}details{border-bottom:1px solid var(--line)}summary{cursor:pointer;padding:15px 0;font-weight:900}details p{color:#444}.footer{border-top:1px solid var(--line);padding:28px 0 42px;color:var(--muted);font-size:13px}@media(max-width:820px){.nav{align-items:flex-start;flex-direction:column;padding:14px 0}.links{width:100%;padding-bottom:4px}.layout{grid-template-columns:1fr}.aside{position:static;border-left:0;border-top:1px solid var(--line);padding:18px 0 0}.content{font-size:17px}.data-table{display:block;overflow-x:auto;white-space:nowrap}.info-table th{width:104px}}
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
          <section class="${candidate.affiliateLinkCount ? "affiliate-block" : "data-block"}" aria-label="데이터 표">
            <h2>데이터 표</h2>
            ${tableHtml(candidate)}
          </section>
          ${sections}
          <section class="faq"><h2>자주 묻는 질문</h2>${faqs}</section>
        </article>
        <aside class="aside"><strong>자동 생성 로그</strong>${post.memo.map((item) => `<span>${esc(item)}</span>`).join("")}<span><a href="/region/${regionSlug(post.region)}/">${esc(post.region)} 허브</a></span></aside>
      </section>
    </main>
    <footer class="wrap footer">트립뷰 데이터 글은 API 응답값으로 검증 가능한 항목만 사용합니다.</footer>
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
  runs.push(run);
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
