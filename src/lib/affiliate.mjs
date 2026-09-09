import {
  accommodationProducts,
  articleCategoryLabel,
  compactRegion,
  coupangProducts,
  infoRows,
  isFestivalPost,
  isLodgingPost,
  myrealtripProducts,
  normalizeText,
  postAccommodationTargets,
  postTitle,
  productImage,
  productPriceText,
  productSourceLabel,
  productUpdatedText,
  searchablePostText,
  sectionPairs,
  tnaProducts,
} from "./content.mjs";

const MIN_SCORE = {
  accommodation: 36,
  ticket: 34,
  coupang: 24,
};

const DOMESTIC_REGIONS = new Set([
  "서울",
  "경기",
  "인천",
  "강원",
  "대전",
  "세종",
  "충북",
  "충남",
  "광주",
  "전북",
  "전남",
  "대구",
  "부산",
  "울산",
  "경북",
  "경남",
  "제주",
]);

const OVERSEAS_DESTINATIONS = [
  { label: "오사카", aliases: ["오사카", "osaka"] },
  { label: "타이베이", aliases: ["타이베이", "taipei"] },
  { label: "다낭", aliases: ["다낭", "danang", "da nang"] },
  { label: "방콕", aliases: ["방콕", "bangkok"] },
  { label: "도쿄", aliases: ["도쿄", "tokyo"] },
  { label: "후쿠오카", aliases: ["후쿠오카", "fukuoka"] },
  { label: "교토", aliases: ["교토", "kyoto"] },
  { label: "삿포로", aliases: ["삿포로", "sapporo"] },
  { label: "싱가포르", aliases: ["싱가포르", "singapore"] },
  { label: "홍콩", aliases: ["홍콩", "hong kong", "hongkong"] },
  { label: "마카오", aliases: ["마카오", "macau", "macao"] },
  { label: "세부", aliases: ["세부", "cebu"] },
  { label: "발리", aliases: ["발리", "bali"] },
  { label: "괌", aliases: ["괌", "guam"] },
  { label: "사이판", aliases: ["사이판", "saipan"] },
  { label: "하와이", aliases: ["하와이", "hawaii"] },
  { label: "파리", aliases: ["파리", "paris"] },
  { label: "런던", aliases: ["런던", "london"] },
  { label: "로마", aliases: ["로마", "rome"] },
  { label: "바르셀로나", aliases: ["바르셀로나", "barcelona"] },
  { label: "뉴욕", aliases: ["뉴욕", "new york", "nyc"] },
];

const STOP_WORDS = new Set([
  "여행",
  "추천",
  "코스",
  "정리",
  "확인",
  "방문",
  "정보",
  "기준",
  "가격",
  "예약",
  "부터",
  "까지",
  "하는",
  "있는",
]);

function clean(value = "") {
  return normalizeText(value)
    .replace(/\([^)]*\)/g, " ")
    .replace(/[·∙,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lower(value = "") {
  return clean(value).toLowerCase();
}

function words(value = "") {
  return [...lower(value).matchAll(/[a-z0-9]{2,}|[가-힣]{2,}/g)]
    .map((match) => match[0])
    .filter((word) => !STOP_WORDS.has(word));
}

function clamp(value, max) {
  return Math.min(max, Math.max(0, value));
}

function unique(values = []) {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function arrayValues(value) {
  return Array.isArray(value) ? value : [];
}

function safeUrl(value = "") {
  const raw = clean(value);
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return "";
    const host = url.hostname.toLowerCase();
    if (host === "link.coupang.com" || host === "www.coupang.com") return url.toString();
    if (host === "myrealtrip.com" || host.endsWith(".myrealtrip.com")) return url.toString();
  } catch {
    return "";
  }
  return "";
}

function productType(raw = {}) {
  const source = lower(raw.source);
  const type = lower(raw.type);
  const category = lower(raw.category);
  if (source.includes("coupang") || type.includes("coupang")) return "coupang";
  if (source.includes("accommodation") || type.includes("accommodation") || /숙소|호텔|리조트|펜션/.test(category)) return "accommodation";
  return "ticket";
}

function providerFor(raw = {}) {
  return productType(raw) === "coupang" ? "coupang" : "myrealtrip";
}

function providerSource(raw = {}) {
  const source = clean(raw.source);
  if (source) return source;
  return productType(raw) === "coupang" ? "coupang" : "myrealtrip";
}

function productText(raw = {}) {
  return [
    raw.title,
    raw.name,
    raw.description,
    raw.meta,
    raw.region,
    raw.city,
    raw.location,
    raw.category,
    raw.keyword,
    raw.intent,
    raw.type,
    raw.source,
    ...arrayValues(raw.tags),
    ...arrayValues(raw.keywords),
    ...arrayValues(raw.intents),
  ].filter(Boolean).join(" ");
}

function overseasLabelsFromText(value = "") {
  const text = lower(value);
  return OVERSEAS_DESTINATIONS
    .filter((destination) => destination.aliases.some((alias) => text.includes(alias.toLowerCase())))
    .map((destination) => destination.label);
}

function localityTokens(value = "") {
  const text = clean(value);
  if (!text) return [];
  const tokens = [];
  for (const match of text.matchAll(/([가-힣]{2,})(?:특별자치시|특별시|광역시|자치구|시|군|구|읍|면|동)/g)) {
    const token = match[1]
      .replace(/^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충청|전라|경상|제주)/, "")
      .trim();
    if (token.length >= 2 && !DOMESTIC_REGIONS.has(token)) tokens.push(token);
  }
  return unique(tokens);
}

function inferProductIntents(product = {}) {
  const type = product.type || productType(product.raw || product);
  const text = productText(product.raw || product);
  const intents = new Set([...arrayValues(product.intents), product.intent].filter(Boolean).map(lower));
  if (type === "accommodation") {
    intents.add("booking");
    intents.add("accommodation");
    intents.add("lodging");
  }
  if (type === "ticket") {
    intents.add("booking");
    intents.add("ticket");
    intents.add("tour");
  }
  if (type === "coupang") {
    intents.add("shopping");
    intents.add("travel-prep");
  }
  const rules = [
    ["water", /물놀이|계곡|해수욕장|해변|바다|요트|서핑|스노클링|워터|수영|폭포|래프팅|카약/],
    ["indoor", /실내|전시|박물관|미술관|과학관|공연|스파|아쿠아리움/],
    ["festival", /축제|행사|페스티벌|콘서트|공연/],
    ["family", /아이|가족|어린이|키즈|체험|테마파크|아쿠아리움/],
    ["fall", /단풍|가을|억새|국화|산행|트레킹/],
    ["transport", /교통|이동|픽업|샌딩|패스|렌터카/],
  ];
  for (const [intent, pattern] of rules) {
    if (pattern.test(text)) intents.add(intent);
  }
  return intents;
}

function postIntents(post = {}) {
  const text = postContextText(post);
  const intents = new Set(["travel"]);
  if (isLodgingPost(post)) {
    intents.add("accommodation");
    intents.add("lodging");
    intents.add("booking");
  }
  if (isFestivalPost(post)) {
    intents.add("festival");
    intents.add("booking");
  }
  if (articleCategoryLabel(post) === "해외여행" || compactRegion(post.region) === "해외") {
    intents.add("overseas");
    intents.add("accommodation");
    intents.add("tour");
  }
  const rules = [
    ["ticket", /입장권|티켓|관람권|이용권|예매|예약|투어/],
    ["tour", /코스|동선|가볼만한곳|관광|여행|근교/],
    ["water", /물놀이|계곡|해수욕장|해변|바다|요트|서핑|폭포/],
    ["indoor", /실내|전시|박물관|미술관|과학관|공연|스파|아쿠아리움/],
    ["family", /아이|가족|어린이|키즈|체험|테마파크/],
    ["fall", /단풍|가을|억새|국화|산행|트레킹/],
    ["travel-prep", /준비물|여권|항공|숙소|날씨|입국|체크인|주차|교통/],
  ];
  for (const [intent, pattern] of rules) {
    if (pattern.test(text)) intents.add(intent);
  }
  return intents;
}

function postContextText(post = {}) {
  const sections = sectionPairs(post);
  const sectionText = sections.flatMap((section) => [section.heading, ...section.paragraphs]).join(" ");
  return clean(`${searchablePostText(post)} ${sectionText}`);
}

function postHeadings(post = {}) {
  return sectionPairs(post).map((section) => section.heading).filter(Boolean);
}

export function createPostAffiliateContext(post = {}) {
  const text = postContextText(post);
  const titleText = clean(`${post.title || ""} ${post.sourceTitle || ""}`);
  const addressText = infoRows(post)
    .filter(([label]) => /주소|장소|위치/.test(label))
    .map((row) => row.join(" "))
    .join(" ");
  const accommodationTargets = postAccommodationTargets(post).map((target) => target.label || target.keyword);
  const overseasTargets = unique([
    ...accommodationTargets,
    ...overseasLabelsFromText(`${text} ${titleText}`),
  ]);
  return {
    post,
    text,
    lowerText: lower(text),
    titleText,
    titleWords: new Set(words(titleText)),
    keywordWords: new Set(words(arrayValues(post.keywords).join(" "))),
    headingWords: new Set(words(postHeadings(post).join(" "))),
    region: compactRegion(post.region),
    localities: new Set(localityTokens(`${post.region || ""} ${addressText} ${titleText}`)),
    overseasTargets: new Set(overseasTargets),
    intents: postIntents(post),
    category: articleCategoryLabel(post),
  };
}

export function normalizeAffiliateProduct(raw = {}) {
  const type = productType(raw);
  const title = clean(raw.title || raw.name || raw.productName);
  const url = safeUrl(raw.url || raw.productUrl || raw.deepLink);
  if (!title || !url) return null;
  const image = productImage(raw);
  const source = providerSource(raw);
  const provider = providerFor(raw);
  const tags = unique([...arrayValues(raw.tags), ...arrayValues(raw.keywords), raw.keyword, raw.intent, raw.category]);
  const normalized = {
    id: clean(raw.id || raw.gid || raw.productId || raw.pageKey || `${source}:${url}`),
    provider,
    source,
    type,
    title,
    url,
    image,
    price: raw.price || raw.salePrice || raw.productPrice || "",
    priceText: productPriceText(raw) || (type === "coupang" ? clean(raw.meta) : ""),
    region: clean(raw.region || raw.location),
    city: clean(raw.city || raw.regionSlug),
    category: clean(raw.category || raw.type),
    tags,
    keywords: tags,
    intent: clean(raw.intent || arrayValues(raw.intents)[0]),
    intents: [...inferProductIntents({ ...raw, type })],
    priority: Number(raw.priority || 0),
    updatedText: productUpdatedText(raw),
    sourceLabel: productSourceLabel(raw, type),
    raw,
  };
  return normalized;
}

export function affiliateProductKey(product = {}) {
  return clean(product.id || product.url || `${product.source}:${product.title}`);
}

export function allAffiliateProducts(sourceProducts = {}) {
  const {
    accommodations = accommodationProducts,
    tna = tnaProducts,
    myrealtrip = myrealtripProducts,
    coupang = coupangProducts,
    products = null,
  } = sourceProducts;
  const raw = products || [
    ...arrayValues(accommodations),
    ...arrayValues(tna),
    ...arrayValues(myrealtrip),
    ...arrayValues(coupang),
  ];
  const seen = new Set();
  const normalized = [];
  for (const item of raw) {
    const product = normalizeAffiliateProduct(item);
    const key = product && affiliateProductKey(product);
    if (!product || !key || seen.has(key)) continue;
    seen.add(key);
    normalized.push(product);
  }
  return normalized;
}

function disabledByConfig(product, config = {}) {
  const disabled = new Set(arrayValues(config.disableProviders).map(lower));
  return disabled.has(product.provider) || disabled.has(product.source) || disabled.has(product.type);
}

function productRegionInfo(product = {}) {
  const text = productText(product);
  const regionText = `${product.region || ""} ${product.city || ""}`;
  const region = compactRegion(regionText || text);
  return {
    text,
    lowerText: lower(text),
    region,
    localities: new Set(localityTokens(regionText || text)),
    overseasTargets: new Set(overseasLabelsFromText(`${regionText} ${product.title || ""}`)),
  };
}

function wrongRegionPenalty(context, productInfo) {
  const postDomestic = DOMESTIC_REGIONS.has(context.region);
  const productDomestic = DOMESTIC_REGIONS.has(productInfo.region);
  if (postDomestic && productDomestic && context.region !== productInfo.region) return -100;
  if (postDomestic && productInfo.region === "해외") return -100;
  if (context.region === "해외" && productDomestic) return -100;

  if (context.region === "해외" && context.overseasTargets.size && productInfo.overseasTargets.size) {
    const overlap = [...context.overseasTargets].some((target) => productInfo.overseasTargets.has(target));
    if (!overlap) return -90;
  }
  return 0;
}

function typePriority(context, product) {
  if (isLodgingPost(context.post)) {
    if (product.type === "accommodation") return 26;
    if (product.type === "ticket") return 10;
    return -6;
  }
  if (isFestivalPost(context.post)) {
    if (product.type === "accommodation") return 20;
    if (product.type === "ticket") return 14;
    return 4;
  }
  if (context.region === "해외") {
    if (product.type === "accommodation") return 24;
    if (product.type === "ticket") return 18;
    return -4;
  }
  if (product.type === "ticket") return 20;
  if (product.type === "accommodation") return 12;
  return 4;
}

export function scoreAffiliateProduct(postOrContext = {}, rawProduct = {}) {
  const context = postOrContext.post ? postOrContext : createPostAffiliateContext(postOrContext);
  const product = rawProduct.raw ? rawProduct : normalizeAffiliateProduct(rawProduct);
  if (!product) return null;

  const productInfo = productRegionInfo(product);
  let score = product.priority + typePriority(context, product);
  const reasons = [];

  const penalty = wrongRegionPenalty(context, productInfo);
  if (penalty) {
    score += penalty;
    reasons.push(`region-penalty:${penalty}`);
  }

  if (context.region && productInfo.region && context.region === productInfo.region) {
    score += context.region === "해외" ? 14 : 30;
    reasons.push(`region:${context.region}`);
  }

  const sharedLocalities = [...context.localities].filter((token) => productInfo.localities.has(token));
  if (sharedLocalities.length) {
    score += 25;
    reasons.push(`city:${sharedLocalities[0]}`);
  }

  const sharedOverseas = [...context.overseasTargets].filter((target) => productInfo.overseasTargets.has(target));
  if (sharedOverseas.length) {
    score += 35;
    reasons.push(`city:${sharedOverseas[0]}`);
  }

  const productWords = new Set(words(productInfo.text));
  const titleMatches = [...context.titleWords].filter((word) => productWords.has(word));
  if (titleMatches.length) {
    score += clamp(titleMatches.length * 6, 20);
    reasons.push(`title:${titleMatches[0]}`);
  }

  const keywordMatches = [...context.keywordWords].filter((word) => productWords.has(word));
  if (keywordMatches.length) {
    score += clamp(keywordMatches.length * 4, 16);
    reasons.push(`keyword:${keywordMatches[0]}`);
  }

  const headingMatches = [...context.headingWords].filter((word) => productWords.has(word));
  if (headingMatches.length) {
    score += clamp(headingMatches.length * 5, 15);
    reasons.push(`heading:${headingMatches[0]}`);
  }

  const productIntents = new Set(product.intents.map(lower));
  const intentMatches = [...context.intents].filter((intent) => productIntents.has(intent));
  if (intentMatches.length) {
    score += clamp(intentMatches.length * 8, 24);
    reasons.push(`intent:${intentMatches[0]}`);
  }

  const tagMatches = product.tags.filter((tag) => tag.length >= 2 && context.lowerText.includes(lower(tag)));
  if (tagMatches.length) {
    score += clamp(tagMatches.length * 4, 12);
    reasons.push(`tag:${tagMatches[0]}`);
  }

  if (product.type === "coupang" && /여행|준비물|날씨|체크인|가을|단풍|산행|물놀이|해외|축제/.test(context.text)) {
    score += 12;
    reasons.push("travel-prep");
  }

  if (product.image) score += 2;
  if (product.priceText || product.price) score += 1;

  return { product, score, reasons };
}

function minScoreFor(product = {}) {
  return MIN_SCORE[product.type] || 36;
}

function manualProducts(config = {}, products = []) {
  const ids = new Set(arrayValues(config.productIds).map(clean));
  if (!ids.size) return [];
  return products
    .filter((product) => ids.has(product.id) || ids.has(product.url) || ids.has(`${product.source}:${product.id}`))
    .map((product) => ({
      product,
      score: 999,
      reasons: ["manual:productIds"],
    }));
}

export function selectArticleAffiliateProducts({ post = {}, products = null, maxProducts = 2, limit = null } = {}) {
  const safeLimit = Math.max(0, Math.min(6, Number.parseInt(limit ?? maxProducts, 10) || 0));
  if (!safeLimit) return [];

  const config = post?.affiliate && typeof post.affiliate === "object" ? post.affiliate : {};
  const candidates = allAffiliateProducts(products ? { products } : {});
  const available = candidates.filter((product) => !disabledByConfig(product, config));
  const selected = [];
  const seen = new Set();
  const add = (entry) => {
    const key = affiliateProductKey(entry?.product);
    if (!key || seen.has(key) || selected.length >= safeLimit) return;
    seen.add(key);
    selected.push(entry);
  };

  for (const entry of manualProducts(config, available)) add(entry);
  if (config.disableAuto) return selected;

  const context = createPostAffiliateContext(post);
  const ranked = available
    .map((product, index) => {
      const scored = scoreAffiliateProduct(context, product);
      return scored ? { ...scored, index } : null;
    })
    .filter((entry) => entry && entry.score >= minScoreFor(entry.product))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  for (const entry of ranked) add(entry);
  return selected;
}

export function affiliateBlockCopy({ product, post }) {
  const region = product.city || product.region || compactRegion(post.region);
  const priceDate = clean(product.updatedText).replace(/\s*기준$/, "") || "표시일";
  const myrealtripDisclosure = `표시 가격은 ${priceDate} 데이터 기준이며, 최종 가격과 조건은 마이리얼트립 공식 예약 화면에서 확인하세요. 이 포스팅은 제휴마케팅 활동의 일환으로, 링크를 통한 예약 발생 시 일정액의 수수료를 제공받습니다.`;
  if (product.type === "accommodation") {
    return {
      heading: `${region} 숙소 가격 확인`,
      description: "일정과 위치가 맞는 숙소는 가격과 취소 조건이 자주 바뀝니다. 예약 화면에서 최신 조건을 다시 확인하세요.",
      ctaLabel: `${region} 숙소 보기`,
      disclosure: myrealtripDisclosure,
    };
  }
  if (product.type === "ticket") {
    return {
      heading: `${region} 입장권·투어 확인`,
      description: "운영 시간, 포함 사항, 집결지와 환불 조건을 공식 예약 화면에서 다시 확인하세요.",
      ctaLabel: `${region} 상품 보기`,
      disclosure: myrealtripDisclosure,
    };
  }
  return {
    heading: "여행 준비물 확인",
    description: "상품과 가격은 판매처 화면 기준으로 달라질 수 있습니다. 구매 전 배송, 옵션, 최종 가격을 다시 확인하세요.",
    ctaLabel: "준비물 보기",
    disclosure: "쿠팡 파트너스 활동의 일환으로 일정액의 수수료를 제공받을 수 있습니다.",
  };
}

export function articleAffiliatePlacements({ post = {}, sections = null, products = null, maxBlocks = 2 } = {}) {
  const sectionList = sections || sectionPairs(post);
  const selected = selectArticleAffiliateProducts({ post, products, maxProducts: maxBlocks });
  const afterSectionIndex = Math.min(1, Math.max(0, sectionList.length - 1));
  return selected.slice(0, maxBlocks).map((entry, index) => ({
    ...entry,
    ...affiliateBlockCopy({ product: entry.product, post }),
    placement: index === 0 ? "inline" : "bottom",
    afterSectionIndex: index === 0 ? afterSectionIndex : null,
  }));
}

export function debugArticleAffiliateSelection({ post = {}, products = null, maxBlocks = 2 } = {}) {
  const placements = articleAffiliatePlacements({ post, products, maxBlocks });
  return {
    post: post.slug || postTitle(post),
    selectedProducts: placements.map((placement) => ({
      id: placement.product.id,
      title: placement.product.title,
      provider: placement.product.provider,
      type: placement.product.type,
      score: placement.score,
      reasons: placement.reasons,
      placement: placement.placement,
      afterSectionIndex: placement.afterSectionIndex,
    })),
  };
}
