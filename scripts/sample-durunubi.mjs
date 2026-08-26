import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const DURUNUBI_API_BASES = [
  process.env.DURUNUBI_API_BASE || "https://apis.data.go.kr/B551011/Durunubi",
  "https://gwapi.visitkorea.or.kr/openapi/service/gwrest/Durunubi",
].filter((value, index, values) => value && values.indexOf(value) === index);
const SERVICE_KEY = process.env.DURUNUBI_API_KEY || process.env.DURUNUBI_API_KEY_PARAM || "";
const SAMPLE_SIZE = Math.max(20, Math.min(30, Number.parseInt(process.env.DURUNUBI_SAMPLE_SIZE || "25", 10) || 25));
const PAGE_SIZE = Math.max(20, Math.min(200, Number.parseInt(process.env.DURUNUBI_PAGE_SIZE || "100", 10) || 100));
const FETCH_TIMEOUT_MS = Math.max(1000, Number.parseInt(process.env.DURUNUBI_FETCH_TIMEOUT_MS || "8000", 10) || 8000);
const REQUEST_RETRIES = Math.max(1, Math.min(3, Number.parseInt(process.env.DURUNUBI_REQUEST_RETRIES || "1", 10) || 1));
const MAX_PAGES = Math.max(1, Math.min(20, Number.parseInt(process.env.DURUNUBI_MAX_PAGES || "10", 10) || 10));
export const CONFIDENT_MATCH_SCORE = 20;

const TRAIL_KEYWORDS = [
  "둘레길",
  "트레일",
  "산책로",
  "숲길",
  "탐방로",
  "등산로",
  "올레",
  "해파랑길",
  "남파랑길",
  "서해랑길",
  "코리아둘레길",
  "걷기",
  "산책",
];

const STRONG_TRAIL_KEYWORDS = new Set([
  "둘레길",
  "트레일",
  "산책로",
  "숲길",
  "탐방로",
  "등산로",
  "올레",
  "해파랑길",
  "남파랑길",
  "서해랑길",
  "코리아둘레길",
]);

const TOKEN_STOPWORDS = new Set([
  "가이드",
  "구간별",
  "근처",
  "나누는",
  "동선",
  "방법",
  "방문",
  "방문전",
  "산책",
  "시간",
  "알아둘",
  "여름",
  "여행",
  "예약",
  "위치",
  "이동",
  "이용시간",
  "일정",
  "전",
  "정리",
  "준비물",
  "주말",
  "주차",
  "체크",
  "코스",
  "확인",
]);

const REGION_ALIASES = new Map([
  ["강원특별자치도", "강원"],
  ["경기도", "경기"],
  ["경상남도", "경남"],
  ["경상북도", "경북"],
  ["광주광역시", "광주"],
  ["대구광역시", "대구"],
  ["대전광역시", "대전"],
  ["부산광역시", "부산"],
  ["서울특별시", "서울"],
  ["세종특별자치시", "세종"],
  ["울산광역시", "울산"],
  ["인천광역시", "인천"],
  ["전라남도", "전남"],
  ["전라북도", "전북"],
  ["제주특별자치도", "제주"],
  ["충청남도", "충남"],
  ["충청북도", "충북"],
]);

const BROAD_REGION_TOKENS = new Set(["강원", "경기", "경남", "경북", "광주", "대구", "대전", "부산", "서울", "세종", "울산", "인천", "전남", "전북", "제주", "충남", "충북"]);

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

function buildUrl(base, endpoint, extra, encodedKey) {
  const params = new URLSearchParams({
    MobileOS: "ETC",
    MobileApp: "Tripview",
    _type: "json",
    ...extra,
  });
  const key = encodedKey ? encodeURIComponent(SERVICE_KEY) : SERVICE_KEY;
  return `${base.replace(/\/$/u, "")}/${endpoint}?serviceKey=${key}&${params.toString()}`;
}

function responseBody(json = {}) {
  return json.response?.body || json.body || {};
}

function responseHeader(json = {}) {
  return json.response?.header || json.header || json;
}

function responseItems(json = {}) {
  const item = responseBody(json)?.items?.item;
  return Array.isArray(item) ? item : item ? [item] : [];
}

function responseTotalCount(json = {}) {
  const value = Number.parseInt(String(responseBody(json)?.totalCount || "0"), 10);
  return Number.isFinite(value) ? value : 0;
}

function resultError(json = {}) {
  const header = responseHeader(json);
  const code = String(json.resultCode || header?.resultCode || "").trim();
  if (!code || ["0", "00", "0000"].includes(code)) return "";
  return `${code} ${json.resultMsg || header?.resultMsg || ""}`.trim();
}

async function requestDurunubi(endpoint, extra = {}) {
  let lastError = "";
  for (const base of DURUNUBI_API_BASES) {
    for (const encodedKey of [false, true]) {
      for (let attempt = 0; attempt <= REQUEST_RETRIES; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        try {
          const res = await fetch(buildUrl(base, endpoint, extra, encodedKey), {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          });
          const text = await res.text();
          try {
            const json = JSON.parse(text);
            const error = resultError(json);
            if (error) {
              lastError = error;
              break;
            }
            return {
              items: responseItems(json),
              totalCount: responseTotalCount(json),
            };
          } catch {
            lastError = text.slice(0, 160);
            break;
          }
        } catch (error) {
          lastError = error.name === "AbortError" ? `request timed out after ${FETCH_TIMEOUT_MS}ms` : error.message;
          if (attempt < REQUEST_RETRIES) continue;
        } finally {
          clearTimeout(timeout);
        }
      }
    }
  }
  throw new Error(`Durunubi ${endpoint} request failed: ${lastError}`);
}

async function fetchAllDurunubiItems(endpoint, extra = {}) {
  const all = [];
  let expectedTotal = 0;
  for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo += 1) {
    const result = await requestDurunubi(endpoint, {
      brdDiv: "DNWW",
      ...extra,
      numOfRows: String(PAGE_SIZE),
      pageNo: String(pageNo),
    });
    if (!expectedTotal && result.totalCount) expectedTotal = result.totalCount;
    all.push(...result.items);
    if (!result.items.length) break;
    if (expectedTotal && all.length >= expectedTotal) break;
  }
  return all;
}

function unique(values = []) {
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

function compactPlaceToken(value = "") {
  const raw = strip(value);
  const alias = REGION_ALIASES.get(raw) || raw;
  const compacted = alias
    .replace(/특별자치도|특별자치시|특별시|광역시|자치구/u, "")
    .replace(/시|군|구|읍|면|동|리$/u, "")
    .trim();
  return compacted.length >= 2 ? compacted : alias.replace(/특별자치도|특별자치시|특별시|광역시|자치구/u, "").trim();
}

export function textTokens(value = "") {
  return strip(value)
    .replace(/[()[\]{}"'“”‘’·:|/\\_,.-]/g, " ")
    .split(/\s+/)
    .map(compactPlaceToken)
    .filter((token) => /^[가-힣A-Za-z0-9]{2,}$/u.test(token));
}

function searchablePostText(post = {}) {
  return [
    post.title,
    post.sourceTitle,
    Array.isArray(post.tags) ? post.tags.join(" ") : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function durunubiCandidateScore(post = {}) {
  const haystack = searchablePostText(post);
  return TRAIL_KEYWORDS.reduce((score, keyword) => {
    if (!haystack.includes(keyword)) return score;
    return score + (STRONG_TRAIL_KEYWORDS.has(keyword) ? 8 : 2);
  }, 0);
}

export function selectDurunubiSamplePosts(posts = [], size = SAMPLE_SIZE) {
  return posts
    .map((post, index) => ({ post, index, score: durunubiCandidateScore(post) }))
    .filter((item) => item.score > 0 && item.post?.slug)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, size)
    .map((item) => item.post);
}

export function regionTokensForPost(post = {}) {
  return unique(textTokens(post.region || post.city || "").map(compactPlaceToken));
}

function specificRegionTokensForPost(post = {}) {
  return regionTokensForPost(post).filter((token) => !BROAD_REGION_TOKENS.has(token) && token !== "국내");
}

export function titleTokensForPost(post = {}) {
  const regionTokens = new Set(regionTokensForPost(post));
  return unique(textTokens(`${post.title || ""} ${post.sourceTitle || ""}`))
    .filter((token) => !regionTokens.has(token))
    .filter((token) => !TOKEN_STOPWORDS.has(token));
}

function includesNormalized(haystack = "", needle = "") {
  const cleanHaystack = strip(haystack).replace(/\s+/g, "");
  const cleanNeedle = strip(needle).replace(/\s+/g, "");
  return Boolean(cleanNeedle && cleanHaystack.includes(cleanNeedle));
}

function normalizedTokenSet(value = "") {
  return new Set(textTokens(value).map(compactPlaceToken));
}

function tokenMatchesText(token = "", tokenSet = new Set(), haystack = "") {
  return tokenSet.has(token) || (token.length >= 4 && includesNormalized(haystack, token));
}

function routeByIndex(routes = []) {
  const map = new Map();
  for (const route of routes) {
    const key = strip(route.routeIdx);
    if (key && !map.has(key)) map.set(key, route);
  }
  return map;
}

function levelLabel(value = "") {
  const key = String(value || "").trim();
  return { 1: "하", 2: "중", 3: "상" }[key] || key || "";
}

export function scoreDurunubiCourse(post = {}, course = {}, route = {}) {
  const regionTokens = regionTokensForPost(post);
  const titleTokens = titleTokensForPost(post);
  const postText = searchablePostText(post);
  const courseName = strip(course.crsKorNm);
  const routeName = strip(route.themeNm);
  const sigun = strip(course.sigun);
  const haystack = strip([
    sigun,
    courseName,
    routeName,
    route.linemsg,
    route.themedescs,
  ].filter(Boolean).join(" "));
  const courseTokens = normalizedTokenSet(haystack);
  const regionMatches = regionTokens.filter((token) => includesNormalized(`${sigun} ${haystack}`, token));
  const specificRegionTokens = specificRegionTokensForPost(post);
  const specificRegionMatches = specificRegionTokens.filter((token) => tokenMatchesText(token, courseTokens, haystack));
  const titleMatches = titleTokens.filter((token) => tokenMatchesText(token, courseTokens, haystack));
  const keywordMatches = TRAIL_KEYWORDS.filter((keyword) => postText.includes(keyword) && haystack.includes(keyword));
  const exactCourseName = courseName && (includesNormalized(postText, courseName) || includesNormalized(courseName, postText));
  const exactRouteName = routeName && includesNormalized(postText, routeName);
  const strongKeywordMatch = keywordMatches.some((keyword) => STRONG_TRAIL_KEYWORDS.has(keyword));
  const rawScore =
    regionMatches.length * 3
    + titleMatches.length * 4
    + keywordMatches.length * 2
    + (exactCourseName ? 10 : 0)
    + (exactRouteName ? 8 : 0)
    + (strongKeywordMatch ? 3 : 0);

  const hasCourseTextMatch = Boolean(titleMatches.length || exactCourseName || exactRouteName || strongKeywordMatch);
  const regionExcluded = strip(post.region) !== "국내" && specificRegionTokens.length > 0 && !specificRegionMatches.length;
  const score = regionExcluded ? 0 : rawScore;
  const hasRegionMatch = strip(post.region) === "국내"
    ? true
    : specificRegionTokens.length
      ? Boolean(specificRegionMatches.length)
      : Boolean(regionMatches.length);
  return {
    score,
    rawScore,
    matched: score >= CONFIDENT_MATCH_SCORE && hasCourseTextMatch && hasRegionMatch && !regionExcluded,
    regionExcluded,
    regionMatches,
    specificRegionMatches,
    titleMatches,
    keywordMatches,
  };
}

export function matchDurunubiCourse(post = {}, courses = [], routes = []) {
  const routesById = routeByIndex(routes);
  let best = null;
  for (const course of courses) {
    const route = routesById.get(strip(course.routeIdx)) || {};
    const score = scoreDurunubiCourse(post, course, route);
    if (!best || score.score > best.score.score) best = { course, route, score };
  }
  if (!best) return { matched: false, score: 0 };
  return {
    matched: best.score.matched,
    score: best.score.score,
    rawScore: best.score.rawScore,
    regionExcluded: best.score.regionExcluded,
    regionMatches: best.score.regionMatches,
    specificRegionMatches: best.score.specificRegionMatches,
    titleMatches: best.score.titleMatches,
    keywordMatches: best.score.keywordMatches,
    routeIdx: strip(best.course.routeIdx),
    themeNm: strip(best.route.themeNm),
    crsKorNm: strip(best.course.crsKorNm),
    sigun: strip(best.course.sigun),
    distance: strip(best.course.crsDstnc),
    requiredTime: strip(best.course.crsTotlRqrmHour),
    level: levelLabel(best.course.crsLevel),
    hasGpx: Boolean(strip(best.course.gpxpath)),
  };
}

export function summarizeDurunubiResults(results = []) {
  const matched = results.filter((result) => result.matched).length;
  const failed = results.length - matched;
  return {
    checked: results.length,
    matched,
    failed,
    matchRate: results.length ? matched / results.length : 0,
    failureRate: results.length ? failed / results.length : 0,
  };
}

function percent(value) {
  return `${Math.round(value * 1000) / 10}%`;
}

function routeExample(route = {}) {
  return `routeIdx=${strip(route.routeIdx) || "-"}, themeNm=${strip(route.themeNm) || "-"}, linemsg=${strip(route.linemsg) || "-"}`;
}

function courseExample(course = {}) {
  return [
    `routeIdx=${strip(course.routeIdx) || "-"}`,
    `sigun=${strip(course.sigun) || "-"}`,
    `crsKorNm=${strip(course.crsKorNm) || "-"}`,
    `distance=${strip(course.crsDstnc) || "-"}`,
    `time=${strip(course.crsTotlRqrmHour) || "-"}`,
    `level=${levelLabel(course.crsLevel) || "-"}`,
    `hasGpx=${Boolean(strip(course.gpxpath))}`,
  ].join(", ");
}

async function runSample() {
  if (!SERVICE_KEY) {
    throw new Error("DURUNUBI_API_KEY is required for Durunubi sample. Add it as a GitHub Actions secret.");
  }

  const posts = await readJson("data/generated-posts.json", []);
  const candidates = selectDurunubiSamplePosts(posts, Number.MAX_SAFE_INTEGER);
  const sample = candidates.slice(0, SAMPLE_SIZE);
  if (!sample.length) {
    throw new Error("No Durunubi trail-like Tripview posts were found in title/sourceTitle/tags.");
  }

  console.log(`Durunubi trail-like candidate posts: ${candidates.length}. Sample size: ${sample.length}.`);
  for (const post of sample.slice(0, 10)) {
    console.log(`Candidate: ${post.slug} | ${strip(post.region) || "-"} | ${strip(post.title)}`);
  }

  const routes = await fetchAllDurunubiItems("routeList");
  console.log(`Durunubi routeList fetched ${routes.length} route(s).`);
  if (!routes.length) throw new Error("Durunubi routeList returned no routes.");
  for (const route of routes.slice(0, 3)) console.log(`routeList example: ${routeExample(route)}`);

  const courses = await fetchAllDurunubiItems("courseList");
  console.log(`Durunubi courseList fetched ${courses.length} course(s).`);
  if (!courses.length) throw new Error("Durunubi courseList returned no courses.");
  for (const course of courses.slice(0, 3)) console.log(`courseList example: ${courseExample(course)}`);

  const results = sample.map((post) => ({
    slug: post.slug,
    title: strip(post.title),
    region: strip(post.region),
    ...matchDurunubiCourse(post, courses, routes),
  }));
  const summary = summarizeDurunubiResults(results);
  console.log(
    `Durunubi sample complete. Matched ${summary.matched}/${summary.checked} (${percent(summary.matchRate)}). Failed ${summary.failed}/${summary.checked} (${percent(summary.failureRate)}).`,
  );

  const matchedExamples = results.filter((result) => result.matched).sort((a, b) => b.score - a.score).slice(0, SAMPLE_SIZE);
  console.log(`Durunubi matched examples: ${matchedExamples.length}`);
  for (const item of matchedExamples) {
    console.log(
      `- ${item.slug} | ${item.region || "-"} | ${item.title} -> ${item.sigun || "-"} ${item.crsKorNm || "-"} (${item.distance || "-"}, ${item.requiredTime || "-"}, level ${item.level || "-"}, score ${item.score})`,
    );
  }

  const failedExamples = results.filter((result) => !result.matched).sort((a, b) => b.score - a.score).slice(0, SAMPLE_SIZE);
  console.log(`Durunubi unmatched examples: ${failedExamples.length}`);
  for (const item of failedExamples) {
    console.log(
      `- ${item.slug} | ${item.region || "-"} | ${item.title} | best=${item.sigun || "-"} ${item.crsKorNm || "-"} | score ${item.score || 0}`,
    );
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  await runSample();
}
