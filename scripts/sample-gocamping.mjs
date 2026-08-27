import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const GOCAMPING_API_BASES = [
  process.env.GOCAMPING_API_BASE || "https://apis.data.go.kr/B551011/GoCamping",
  "https://gwapi.visitkorea.or.kr/openapi/service/gwrest/GoCamping",
].filter((value, index, values) => value && values.indexOf(value) === index);

const SAMPLE_SIZE = Math.max(20, Math.min(30, Number.parseInt(process.env.GOCAMPING_SAMPLE_SIZE || "25", 10) || 25));
const PAGE_SIZE = Math.max(20, Math.min(200, Number.parseInt(process.env.GOCAMPING_PAGE_SIZE || "100", 10) || 100));
const MAX_PAGES = Math.max(1, Math.min(80, Number.parseInt(process.env.GOCAMPING_MAX_PAGES || "50", 10) || 50));
const FETCH_TIMEOUT_MS = Math.max(1000, Number.parseInt(process.env.GOCAMPING_FETCH_TIMEOUT_MS || "8000", 10) || 8000);
const REQUEST_RETRIES = Math.max(1, Math.min(3, Number.parseInt(process.env.GOCAMPING_REQUEST_RETRIES || "1", 10) || 1));
const IMAGE_SAMPLE_LIMIT = Math.max(1, Math.min(30, Number.parseInt(process.env.GOCAMPING_IMAGE_SAMPLE_LIMIT || "25", 10) || 25));

export const TEXT_MATCH_SCORE = 20;
export const REGION_CONFIRMED_SCORE = 12;

const CAMPING_KEYWORDS = [
  "캠핑",
  "캠핑장",
  "야영",
  "야영장",
  "오토캠핑",
  "글램핑",
  "카라반",
  "차박",
  "휴양림",
  "해수욕장야영장",
];

const STRONG_CAMPING_KEYWORDS = new Set(["캠핑", "캠핑장", "야영", "야영장", "오토캠핑", "글램핑", "카라반"]);

const TOKEN_STOPWORDS = new Set([
  "가이드",
  "근처",
  "동선",
  "방법",
  "방문",
  "방문전",
  "예약",
  "여름",
  "여행",
  "위치",
  "이동",
  "이용시간",
  "일정",
  "전",
  "정리",
  "주말",
  "주차",
  "체크",
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

const BROAD_REGION_TOKENS = new Set([
  "강원",
  "경기",
  "경남",
  "경북",
  "광주",
  "대구",
  "대전",
  "부산",
  "서울",
  "세종",
  "울산",
  "인천",
  "전남",
  "전북",
  "제주",
  "충남",
  "충북",
]);

const strip = (value = "") =>
  String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const compact = (value = "") =>
  strip(value)
    .replace(/[()[\]{}]/g, " ")
    .replace(/[·ㆍ,./\\|-]/g, " ")
    .replace(/\s+/g, "")
    .toLowerCase();

const textBlob = (post = {}) => strip([post.sourceTitle, post.title, ...(post.tags || [])].filter(Boolean).join(" "));

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(path.join(ROOT, file), "utf8"));
  } catch {
    return fallback;
  }
}

function serviceKeyCandidates() {
  return [
    { name: "GOCAMPING_API_KEY", value: process.env.GOCAMPING_API_KEY },
    { name: "GOCAMPING_API_KEY_PARAM", value: process.env.GOCAMPING_API_KEY_PARAM },
    { name: "TRIPVIEW_API_KEY", value: process.env.TRIPVIEW_API_KEY },
    { name: "TRIPVIEW_API_KEY_PARAM", value: process.env.TRIPVIEW_API_KEY_PARAM },
  ].filter((candidate, index, values) => candidate.value && values.findIndex((item) => item.value === candidate.value) === index);
}

function buildUrl(base, endpoint, extra, keyValue, encodedKey, keyParamName) {
  const params = new URLSearchParams({
    MobileOS: "ETC",
    MobileApp: "Tripview",
    _type: "json",
    ...extra,
  });
  const key = encodedKey ? encodeURIComponent(keyValue) : keyValue;
  return `${base.replace(/\/$/u, "")}/${endpoint}?${keyParamName}=${key}&${params.toString()}`;
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
  const gatewayHeader = json.OpenAPI_ServiceResponse?.cmmMsgHeader;
  if (gatewayHeader) {
    return `${gatewayHeader.returnReasonCode || gatewayHeader.errMsg || ""} ${
      gatewayHeader.returnAuthMsg || gatewayHeader.errMsg || ""
    }`.trim();
  }
  const header = responseHeader(json);
  const code = String(json.resultCode || header?.resultCode || "").trim();
  if (!code || ["0", "00", "0000"].includes(code)) return "";
  return `${code} ${json.resultMsg || header?.resultMsg || ""}`.trim();
}

let activeKey = null;

async function requestGocamping(endpoint, extra = {}) {
  const candidates = activeKey ? [activeKey] : serviceKeyCandidates();
  if (!candidates.length) {
    throw new Error("GOCAMPING_API_KEY or TRIPVIEW_API_KEY is required for GoCamping sample calls.");
  }

  let lastError = "";
  const errors = [];
  for (const candidate of candidates) {
    const bases = candidate.base ? [candidate.base] : GOCAMPING_API_BASES;
    const keyParamNames = candidate.keyParamName ? [candidate.keyParamName] : ["serviceKey", "ServiceKey"];
    const encodedModes = typeof candidate.encodedKey === "boolean" ? [candidate.encodedKey] : [false, true];
    for (const base of bases) {
      for (const keyParamName of keyParamNames) {
        for (const encodedKey of encodedModes) {
          for (let attempt = 0; attempt <= REQUEST_RETRIES; attempt += 1) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
            try {
              const res = await fetch(buildUrl(base, endpoint, extra, candidate.value, encodedKey, keyParamName), {
                headers: { Accept: "application/json" },
                signal: controller.signal,
              });
              const text = await res.text();
              try {
                const json = JSON.parse(text);
                const error = resultError(json);
                if (error) {
                  lastError = `${candidate.name} ${endpoint} ${keyParamName}: ${error}`;
                  errors.push(lastError);
                  break;
                }
                activeKey = { ...candidate, base, encodedKey, keyParamName };
                return {
                  items: responseItems(json),
                  totalCount: responseTotalCount(json),
                  keyName: candidate.name,
                  base,
                };
              } catch {
                lastError = `${candidate.name} ${endpoint} ${keyParamName}: ${text.slice(0, 160)}`;
                errors.push(lastError);
                break;
              }
            } catch (error) {
              lastError =
                error.name === "AbortError"
                  ? `${candidate.name} ${endpoint} ${keyParamName}: request timed out after ${FETCH_TIMEOUT_MS}ms`
                  : `${candidate.name} ${endpoint} ${keyParamName}: ${error.message}`;
              if (attempt < REQUEST_RETRIES) continue;
              errors.push(lastError);
            } finally {
              clearTimeout(timeout);
            }
          }
        }
      }
    }
  }
  const recentErrors = [...new Set(errors)].slice(-6).join(" | ");
  throw new Error(`GoCamping ${endpoint} request failed: ${recentErrors || lastError}`);
}

async function fetchAllGocampingItems(endpoint, extra = {}) {
  const all = [];
  let expectedTotal = 0;
  let keyName = "";
  let base = "";
  for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo += 1) {
    const result = await requestGocamping(endpoint, {
      ...extra,
      numOfRows: String(PAGE_SIZE),
      pageNo: String(pageNo),
    });
    if (!expectedTotal && result.totalCount) expectedTotal = result.totalCount;
    keyName ||= result.keyName;
    base ||= result.base;
    all.push(...result.items);
    if (!result.items.length) break;
    if (expectedTotal && all.length >= expectedTotal) break;
  }
  return { items: all, expectedTotal, keyName, base };
}

export function selectGocampingSamplePosts(posts = [], limit = SAMPLE_SIZE) {
  const candidates = posts
    .map((post, index) => {
      const searchText = textBlob(post);
      const keywordHits = CAMPING_KEYWORDS.filter((keyword) => searchText.includes(keyword));
      if (!keywordHits.length) return null;
      const strongHits = keywordHits.filter((keyword) => STRONG_CAMPING_KEYWORDS.has(keyword)).length;
      return {
        post,
        index,
        score: strongHits * 4 + keywordHits.length + (post.contentid ? 2 : 0),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  return candidates.slice(0, limit).map(({ post }) => post);
}

export function regionTokensForPost(post = {}) {
  const region = strip(post.region || "");
  if (!region || region === "국내") return [];
  const parts = region.split(/\s+/u).map((part) => REGION_ALIASES.get(part) || part.replace(/특별자치도|특별시|광역시|자치시/u, ""));
  const tokens = new Set();
  for (const part of parts) {
    const cleaned = part.replace(/시$/u, "시").replace(/군$/u, "군").replace(/구$/u, "구");
    if (cleaned) tokens.add(cleaned);
  }
  return [...tokens];
}

function specificRegionTokens(tokens = []) {
  return tokens.filter((token) => !BROAD_REGION_TOKENS.has(token));
}

function containsCompact(haystack = "", needle = "") {
  const normalizedNeedle = compact(needle);
  return Boolean(normalizedNeedle && compact(haystack).includes(normalizedNeedle));
}

function words(value = "") {
  return strip(value)
    .split(/[^0-9A-Za-z가-힣]+/u)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2 && !TOKEN_STOPWORDS.has(word));
}

export function postCoordinates(post = {}) {
  const candidates = [
    [post.mapX, post.mapY],
    [post.mapx, post.mapy],
    [post.longitude, post.latitude],
    [post.lon, post.lat],
    [post.tourApi?.common?.mapX, post.tourApi?.common?.mapY],
    [post.tourApi?.common?.mapx, post.tourApi?.common?.mapy],
  ];
  for (const [x, y] of candidates) {
    const lon = Number.parseFloat(String(x || ""));
    const lat = Number.parseFloat(String(y || ""));
    if (Number.isFinite(lon) && Number.isFinite(lat)) return { lon, lat };
  }
  return null;
}

export function distanceKm(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const toRad = (degree) => (degree * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const hav =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  return 6371 * 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
}

function itemCoordinates(item = {}) {
  const lon = Number.parseFloat(String(item.mapX || ""));
  const lat = Number.parseFloat(String(item.mapY || ""));
  return Number.isFinite(lon) && Number.isFinite(lat) ? { lon, lat } : null;
}

function titleTokens(post = {}) {
  return [...new Set(words(textBlob(post)).filter((word) => !CAMPING_KEYWORDS.includes(word)))];
}

export function scoreGocampingItem(post = {}, item = {}) {
  const postId = String(post.contentid || post.contentId || "");
  const itemId = String(item.contentId || "");
  const hasDirectContentId = Boolean(postId && itemId && postId === itemId);
  if (hasDirectContentId) {
    return {
      matched: true,
      method: "contentId",
      score: 100,
      regionConfirmed: true,
      regionExcluded: false,
      distanceKm: null,
    };
  }

  const postCoords = postCoordinates(post);
  const candidateCoords = itemCoordinates(item);
  if (postCoords && candidateCoords) {
    const kilometers = distanceKm(postCoords, candidateCoords);
    if (kilometers <= 20) {
      return {
        matched: true,
        method: "coordinates",
        score: 90,
        regionConfirmed: true,
        regionExcluded: false,
        distanceKm: kilometers,
      };
    }
  }

  const tokens = regionTokensForPost(post);
  const specificTokens = specificRegionTokens(tokens);
  const regionText = [item.doNm, item.sigunguNm, item.addr1, item.addr2].filter(Boolean).join(" ");
  const matchedRegionTokens = tokens.filter((token) => containsCompact(regionText, token));
  const specificRegionMatches = specificTokens.filter((token) => containsCompact(regionText, token));
  const regionConfirmed = specificTokens.length ? specificRegionMatches.length > 0 : matchedRegionTokens.length > 0;
  const regionExcluded = specificTokens.length > 0 && specificRegionMatches.length === 0;

  if (regionExcluded) {
    return {
      matched: false,
      method: "none",
      score: 0,
      regionConfirmed: false,
      regionExcluded: true,
      matchedRegionTokens,
      specificRegionMatches,
      distanceKm: postCoords && candidateCoords ? distanceKm(postCoords, candidateCoords) : null,
    };
  }

  const facility = strip(item.facltNm || "");
  const sourceText = textBlob(post);
  const exactFacilityName = containsCompact(sourceText, facility);
  const sourceTokens = titleTokens(post);
  const facilityText = [facility, item.lineIntro, item.intro].filter(Boolean).join(" ");
  const matchedNameTokens = sourceTokens.filter((token) => containsCompact(facilityText, token));
  let score = 0;
  if (regionConfirmed) score += REGION_CONFIRMED_SCORE;
  if (exactFacilityName) score += 30;
  score += Math.min(20, matchedNameTokens.length * 5);

  const matched = regionConfirmed && (exactFacilityName || matchedNameTokens.length >= 2) && score >= TEXT_MATCH_SCORE;
  return {
    matched,
    method: matched ? "text" : "none",
    score,
    regionConfirmed,
    regionExcluded: false,
    exactFacilityName,
    matchedRegionTokens,
    specificRegionMatches,
    matchedNameTokens,
    distanceKm: postCoords && candidateCoords ? distanceKm(postCoords, candidateCoords) : null,
  };
}

export function matchGocampingItem(post = {}, items = []) {
  let best = null;
  for (const item of items) {
    const score = scoreGocampingItem(post, item);
    const candidate = { ...score, item };
    if (!best || candidate.score > best.score) best = candidate;
    if (candidate.method === "contentId") break;
  }

  if (!best) {
    return { matched: false, method: "none", score: 0, post };
  }

  return {
    ...best,
    matched: best.matched,
    post,
    contentId: best.item?.contentId || "",
    facltNm: best.item?.facltNm || "",
    doNm: best.item?.doNm || "",
    sigunguNm: best.item?.sigunguNm || "",
    hasCoordinates: Boolean(itemCoordinates(best.item)),
    hasFirstImage: Boolean(best.item?.firstImageUrl),
  };
}

export function summarizeGocampingResults(results = []) {
  const checked = results.length;
  const matched = results.filter((result) => result.matched).length;
  const directId = results.filter((result) => result.method === "contentId").length;
  const coordinate = results.filter((result) => result.method === "coordinates").length;
  const text = results.filter((result) => result.method === "text").length;
  const failed = checked - matched;
  return {
    checked,
    matched,
    failed,
    directId,
    coordinate,
    text,
    matchRate: checked ? matched / checked : 0,
    failureRate: checked ? failed / checked : 0,
  };
}

async function imageCountsForMatches(matches) {
  const rows = [];
  for (const match of matches.slice(0, IMAGE_SAMPLE_LIMIT)) {
    if (!match.matched || !match.contentId) continue;
    try {
      const result = await requestGocamping("imageList", {
        contentId: match.contentId,
        numOfRows: "20",
        pageNo: "1",
      });
      rows.push({
        slug: match.post.slug,
        contentId: match.contentId,
        imageCount: result.items.filter((item) => item.imageUrl).length,
      });
    } catch (error) {
      rows.push({
        slug: match.post.slug,
        contentId: match.contentId,
        imageCount: 0,
        error: error.message,
      });
    }
  }
  return rows;
}

function pct(value) {
  return `${Math.round(value * 1000) / 10}%`;
}

export async function runSample() {
  const posts = await readJson("data/generated-posts.json", []);
  const samplePosts = selectGocampingSamplePosts(posts, SAMPLE_SIZE);
  const coordinatePosts = samplePosts.filter((post) => postCoordinates(post)).length;
  console.log(`GoCamping sample candidates: ${samplePosts.length}/${posts.length} selected; coordinate-capable posts: ${coordinatePosts}`);

  const { items, expectedTotal, keyName, base } = await fetchAllGocampingItems("basedList");
  const uniqueItems = [...new Map(items.filter((item) => item.contentId).map((item) => [String(item.contentId), item])).values()];
  const itemsWithCoordinates = uniqueItems.filter((item) => itemCoordinates(item)).length;
  const itemsWithFirstImage = uniqueItems.filter((item) => item.firstImageUrl).length;

  console.log(`GoCamping key accepted: ${keyName}; base: ${base}`);
  console.log(`GoCamping basedList fetched: ${uniqueItems.length}/${expectedTotal || "unknown"} unique rows`);
  console.log(`Rows with coordinates: ${itemsWithCoordinates}/${uniqueItems.length}; rows with firstImageUrl: ${itemsWithFirstImage}/${uniqueItems.length}`);

  const matches = samplePosts.map((post) => matchGocampingItem(post, uniqueItems));
  const summary = summarizeGocampingResults(matches);
  console.log(
    `GoCamping sample summary: checked ${summary.checked}, matched ${summary.matched} (${pct(summary.matchRate)}), failed ${summary.failed} (${pct(summary.failureRate)}), directId ${summary.directId}, coordinate ${summary.coordinate}, text ${summary.text}`,
  );

  console.log("GoCamping matched rows:");
  for (const result of matches.filter((match) => match.matched)) {
    const distance = Number.isFinite(result.distanceKm) ? `, distance=${result.distanceKm.toFixed(1)}km` : "";
    console.log(
      `- ${result.post.slug} | ${strip(result.post.title)} -> ${strip(result.facltNm)} (${strip(`${result.doNm} ${result.sigunguNm}`)}) | contentId=${result.contentId} | method=${result.method}, score=${result.score}, coords=${result.hasCoordinates ? "yes" : "no"}, image=${result.hasFirstImage ? "yes" : "no"}${distance}`,
    );
  }

  console.log("GoCamping failed rows:");
  for (const result of matches.filter((match) => !match.matched)) {
    const best = result.facltNm ? ` best=${strip(result.facltNm)} (${strip(`${result.doNm} ${result.sigunguNm}`)}), score=${result.score}` : "";
    console.log(`- ${result.post.slug} | ${strip(result.post.title)}${best}`);
  }

  const imageRows = await imageCountsForMatches(matches.filter((match) => match.matched));
  console.log("GoCamping imageList sample:");
  for (const row of imageRows) {
    console.log(`- ${row.slug} | contentId=${row.contentId} | imageList images=${row.imageCount}${row.error ? ` | error=${row.error}` : ""}`);
  }

  return { matches, summary, imageRows };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runSample().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
