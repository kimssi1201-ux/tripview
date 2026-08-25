const REGION_RULES = [
  ["서울", /^(?:서울특별시|서울)(?:\s|$)/],
  ["경기", /^(?:경기도|경기)(?:\s|$)/],
  ["인천", /^(?:인천광역시|인천)(?:\s|$)/],
  ["강원", /^(?:강원특별자치도|강원도|강원)(?:\s|$)/],
  ["대전", /^(?:대전광역시|대전)(?:\s|$)/],
  ["세종", /^(?:세종특별자치시|세종)(?:\s|$)/],
  ["충북", /^(?:충청북도|충북)(?:\s|$)/],
  ["충남", /^(?:충청남도|충남)(?:\s|$)/],
  ["광주", /^(?:광주광역시|광주)(?:\s|$)/],
  ["전북", /^(?:전북특별자치도|전라북도|전북)(?:\s|$)/],
  ["전남", /^(?:전라남도|전남)(?:\s|$)/],
  ["대구", /^(?:대구광역시|대구)(?:\s|$)/],
  ["부산", /^(?:부산광역시|부산)(?:\s|$)/],
  ["울산", /^(?:울산광역시|울산)(?:\s|$)/],
  ["경북", /^(?:경상북도|경북)(?:\s|$)/],
  ["경남", /^(?:경상남도|경남)(?:\s|$)/],
  ["제주", /^(?:제주특별자치도|제주)(?:\s|$)/],
];

const DOMESTIC_REGIONS = new Set(REGION_RULES.map(([region]) => region));
const METRO_SEARCH_REGIONS = new Set(["서울", "인천", "대전", "세종", "광주", "대구", "부산", "울산", "제주"]);
const FOCUSED_INTENTS = new Set(["festival", "water", "indoor", "family"]);
const SECTION_INTENTS = {
  popular: ["tour", "activity", "booking"],
  weekend: ["tour", "activity", "booking"],
  festival: ["festival", "tour", "booking"],
  water: ["water", "activity", "booking"],
  indoor: ["indoor", "activity", "booking"],
  family: ["family", "activity", "booking"],
  booking: ["booking", "tour", "activity"],
  flight: ["tour", "transport", "activity", "booking"],
  article: ["tour", "activity", "booking"],
};

function clean(value = "") {
  return String(value || "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[·∙,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function itemText(item = {}) {
  return [
    item.title,
    item.sourceTitle,
    item.description,
    item.excerpt,
    item.category,
    item.type,
    item.region,
    item.city,
    ...(Array.isArray(item.tags) ? item.tags : []),
    ...(Array.isArray(item.intents) ? item.intents : []),
    ...(Array.isArray(item.memo) ? item.memo : []),
    ...(Array.isArray(item.info) ? item.info.flat() : []),
  ].filter(Boolean).join(" ");
}

export function normalizeRegion(value = "") {
  const text = clean(value);
  if (!text) return "";
  for (const [region, pattern] of REGION_RULES) {
    if (pattern.test(text)) return region;
  }
  return text.split(/\s+/)[0] || "";
}

export function isDomesticRegion(value = "") {
  return DOMESTIC_REGIONS.has(normalizeRegion(value));
}

function localityTokens(value = "") {
  const text = clean(value);
  if (!text) return [];
  const topLevel = /^(서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|경기도|강원특별자치도|강원도|충청북도|충청남도|전북특별자치도|전라북도|전라남도|경상북도|경상남도|제주특별자치도)$/;
  return text.split(/\s+/)
    .filter((token) => token && !topLevel.test(token) && !DOMESTIC_REGIONS.has(token))
    .map((token) => token.replace(/(?:특별자치시|특별시|광역시|자치구|시|군|구|읍|면)$/u, ""))
    .filter((token) => token.length >= 2);
}

export function regionMatchScore(productRegion, postRegion) {
  const productText = clean(productRegion);
  const postText = clean(postRegion);
  if (!productText || !postText) return 0;
  if (productText === postText) return 14;

  const productLocalities = localityTokens(productText);
  const postLocalities = new Set(localityTokens(postText));
  if (productLocalities.some((token) => postLocalities.has(token))) return 12;
  return normalizeRegion(productText) === normalizeRegion(postText) ? 8 : 0;
}

export function inferredIntents(value = {}) {
  const text = itemText(value);
  const intents = new Set(Array.isArray(value.intents) ? value.intents : []);
  const rules = [
    ["water", /물놀이|계곡|해수욕장|해변|바다|요트|서핑|스노클링|워터|수영|폭포|래프팅|카약/],
    ["indoor", /실내|전시|박물관|미술관|과학관|도서관|공연|클래스|스파|아쿠아리움/],
    ["festival", /축제|행사|페스티벌|콘서트|공연/],
    ["family", /아이|가족|어린이|키즈|체험|농장|목장|동물|테마파크|아쿠아리움/],
    ["tour", /투어|여행|가이드|근교/],
    ["activity", /액티비티|체험|클래스|스파|서핑|요트|래프팅|카약/],
    ["transport", /교통|이동|픽업|샌딩|패스|렌터카/],
    ["booking", /예약|숙소|호텔|티켓|입장권|항공권|투어/],
  ];
  for (const [intent, pattern] of rules) {
    if (pattern.test(text)) intents.add(intent);
  }
  if (value.type === "accommodation" || value.source === "myrealtrip-accommodation") intents.add("booking");
  return intents;
}

export function isSafeMyRealTripUrl(value = "") {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" && (url.hostname === "myrealtrip.com" || url.hostname.endsWith(".myrealtrip.com"));
  } catch {
    return false;
  }
}

function imageUrlFromValue(value, depth = 0) {
  if (!value || depth > 2) return "";
  if (typeof value === "string") {
    try {
      const url = new URL(value.trim());
      return url.protocol === "https:" ? url.toString() : "";
    } catch {
      return "";
    }
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const image = imageUrlFromValue(item, depth + 1);
      if (image) return image;
    }
    return "";
  }
  if (typeof value === "object") {
    for (const key of ["url", "src", "image", "imageUrl", "thumbnail", "thumbnailUrl"]) {
      const image = imageUrlFromValue(value[key], depth + 1);
      if (image) return image;
    }
  }
  return "";
}

export function affiliateProductImage(product = {}) {
  for (const value of [
    product.image,
    product.imageUrl,
    product.thumbnail,
    product.thumbnailUrl,
    product.mainImage,
    product.mainImageUrl,
    product.coverImage,
    product.coverImageUrl,
    product.images,
    product.imageUrls,
    product.thumbnails,
  ]) {
    const image = imageUrlFromValue(value);
    if (image) return image;
  }
  return "";
}

function productRegion(product = {}) {
  return clean(product.region || product.city || product.location || "");
}

function productSource(product = {}) {
  return clean(product.source || "");
}

function matchReason(product) {
  const region = productRegion(product) || "여행지";
  if (productSource(product) === "myrealtrip-accommodation" || product.type === "accommodation") {
    return `${region} 숙소`;
  }
  if (productSource(product) === "myrealtrip-flight" || product.type === "flight") {
    return `${region} 항공권`;
  }
  return `${region} 투어·티켓`;
}

function productKey(product = {}) {
  return `${productSource(product)}:${clean(product.url)}:${clean(product.title)}`;
}

export function selectAffiliateProducts({ sectionId = "article", posts = [], products = [], limit = 2 } = {}) {
  const safeLimit = Math.max(0, Math.min(12, Number.parseInt(limit, 10) || 0));
  if (!safeLimit || !Array.isArray(posts) || !posts.length || !Array.isArray(products) || !products.length) return [];

  const postRegions = posts
    .map((post) => clean(post?.region || post?.city || ""))
    .filter((region) => isDomesticRegion(region));
  if (!postRegions.length) return [];

  const contextIntents = new Set(SECTION_INTENTS[sectionId] || SECTION_INTENTS.article);
  for (const post of posts) {
    for (const intent of inferredIntents(post)) contextIntents.add(intent);
  }
  const focusedIntent = FOCUSED_INTENTS.has(sectionId)
    ? sectionId
    : [...FOCUSED_INTENTS].find((intent) => contextIntents.has(intent)) || "";

  const ranked = products
    .map((product, index) => {
      const source = productSource(product);
      if (!clean(product?.title) || !source.startsWith("myrealtrip-") || !isSafeMyRealTripUrl(product?.url)) return null;

      const image = affiliateProductImage(product);

      const regionScore = Math.max(0, ...postRegions.map((region) => regionMatchScore(productRegion(product), region)));
      if (!regionScore) return null;

      const intents = inferredIntents(product);
      const isAccommodation = source === "myrealtrip-accommodation" || product.type === "accommodation";
      if (focusedIntent && !isAccommodation && !intents.has(focusedIntent)) return null;

      const overlap = [...contextIntents].filter((intent) => intents.has(intent)).length;
      const sourceScore = isAccommodation ? 3 : source === "myrealtrip-tna" ? 4 : 2;
      const score = regionScore + overlap * 3 + sourceScore + (image ? 1 : 0);
      return { product: { ...product, image, matchReason: matchReason(product) }, score, index, source };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const seen = new Set();
  const picked = [];
  const add = (entry) => {
    if (!entry || picked.length >= safeLimit) return;
    const key = productKey(entry.product);
    if (seen.has(key)) return;
    seen.add(key);
    picked.push(entry.product);
  };

  add(ranked[0]);
  if (picked.length < safeLimit && ranked[0]) {
    add(ranked.find((entry) => entry.source !== ranked[0].source));
  }
  for (const entry of ranked) add(entry);
  return picked.slice(0, safeLimit);
}

export function affiliateRegionKeyword(value = "") {
  const region = normalizeRegion(value);
  if (!DOMESTIC_REGIONS.has(region)) return "";
  if (METRO_SEARCH_REGIONS.has(region)) return region;
  const locality = localityTokens(value)[0];
  return locality || region;
}

export function deriveAffiliateRegionKeywords(posts = [], limit = 8) {
  const safeLimit = Math.max(1, Math.min(240, Number.parseInt(limit, 10) || 8));
  const scores = new Map();
  for (const [index, post] of (Array.isArray(posts) ? posts : []).entries()) {
    const keyword = affiliateRegionKeyword(post?.region || post?.city || "");
    if (!keyword) continue;
    const recencyWeight = index < 30 ? 3 : index < 80 ? 2 : 1;
    scores.set(keyword, (scores.get(keyword) || 0) + recencyWeight);
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
    .slice(0, safeLimit)
    .map(([keyword]) => keyword);
}

export function deriveTourSearchQueries(posts = [], limit = 8) {
  const safeLimit = Math.max(1, Math.min(120, Number.parseInt(limit, 10) || 8));
  const themedLimit = Math.max(1, Math.ceil(safeLimit / 2));
  const queries = [];
  const seen = new Set();
  const add = (query) => {
    const value = clean(query);
    if (!value || seen.has(value) || queries.length >= safeLimit) return;
    seen.add(value);
    queries.push(value);
  };
  const themes = [
    [/물놀이|계곡|해수욕장|해변|바다|워터|서핑|요트|래프팅|카약/, "액티비티"],
    [/실내|전시|박물관|미술관|과학관|아쿠아리움/, "입장권"],
    [/아이|가족|어린이|키즈|체험|테마파크/, "가족 체험"],
    [/축제|행사|페스티벌|공연|콘서트/, "티켓"],
  ];

  for (const post of (Array.isArray(posts) ? posts : [])) {
    const region = affiliateRegionKeyword(post?.region || post?.city || "");
    if (!region) continue;
    if (post?.category === "공연/축제") {
      add(`${region} 티켓`);
      if (queries.length >= themedLimit) break;
      continue;
    }
    const text = itemText(post);
    const theme = themes.find(([pattern]) => pattern.test(text));
    if (theme) add(`${region} ${theme[1]}`);
    if (queries.length >= themedLimit) break;
  }
  for (const region of deriveAffiliateRegionKeywords(posts, safeLimit)) add(`${region} 투어`);
  return queries.slice(0, safeLimit);
}
