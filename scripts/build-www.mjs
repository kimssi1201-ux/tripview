import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { affiliateProductImage, selectAffiliateProducts } from "./lib/affiliate-matching.mjs";
import { isIndexablePost } from "./lib/content-quality.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "www");
const siteDir = join(root, "site");
const baseUrl = "https://tripview.kr";
const NAVER_VERIFICATION_META = '<meta name="naver-site-verification" content="38616b4b4209994ed384d0d2439bddcbec2cc711" />';
const ADSENSE_SCRIPT = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5751319666030430" crossorigin="anonymous"></script>';
const LANGUAGE_SWITCH = '<div class="language-switch notranslate" translate="no" aria-label="Language selector"><a href="?lang=ko" data-lang="ko" lang="ko">KO</a><a href="?lang=en" data-lang="en" lang="en">EN</a><a href="?lang=ja" data-lang="ja" lang="ja">JA</a><a href="?lang=zh" data-lang="zh" lang="zh-CN">ZH</a></div>';
const I18N_SCRIPT = '<script src="/assets/i18n.js?v=i18n-link-fix-20260706" defer></script>';
const TOPIC_FILTER_SCRIPT = '<script src="/assets/topic-filter.js?v=topic-filter-20260712-no-hero" defer></script>';
const LANGUAGE_SWITCH_CSS = ".language-switch{display:flex;gap:8px;white-space:nowrap}.language-switch a{font-size:12px;font-weight:900;color:#555;border-bottom:1px solid transparent}.language-switch a.is-active{color:#111;border-bottom-color:#111}";
const FLIGHT_BOOKING_URL = "https://flights.myrealtrip.com/";
const ARTICLE_NAVIGATION = '<nav class="links" aria-label="주요 메뉴"><a href="/">홈</a><a href="/travel/">여행지</a><a href="/festival/">축제</a><a href="/stay/">숙소·예약</a></nav>';
const CATEGORY_PAGES = [
  { path: "/travel/", title: "여행지", description: "물놀이·계곡, 실내여행, 아이와, 이번 주말 글을 태그로 묶어 국내 여행지를 탐색합니다." },
  { path: "/festival/", title: "축제", description: "전국 축제와 행사를 지역, 일정, 방문 전 확인 포인트 중심으로 모았습니다." },
  { path: "/stay/", title: "숙소·예약", description: "여행지별 숙소와 투어·티켓 예약 카드를 한곳에서 확인합니다." },
];
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

const generatedPosts = await readJson("data/generated-posts.json");
const legacyPosts = await readJson("data/posts.json");
const posts = generatedPosts.length ? generatedPosts : legacyPosts;
const indexablePosts = posts.filter(isIndexablePost);
const flightDeals = await readJson("data/myrealtrip-flight-deals.json");
const accommodationProducts = await readJson("data/myrealtrip-accommodations.json");
const tnaProducts = await readJson("data/myrealtrip-tna-products.json");

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
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return text || "other";
}

function regionSlug(region) {
  const label = compactRegion(region);
  return REGION_SLUGS.get(label) || fallbackSlug(label);
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
  return String(post?.contentTypeId || post?.contenttypeid || post?.contentType || "");
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
  ].filter(Boolean).join(" ");
}

function hasKeyword(post, keywords) {
  const text = searchablePostText(post);
  return keywords.some((keyword) => text.includes(keyword));
}

function postTitle(post) {
  return normalizeText(post?.title || post?.sourceTitle || "여행 글");
}

function postSummary(post, length = 92) {
  const value = normalizeText(post?.excerpt || post?.description || "");
  return value.length > length ? `${value.slice(0, length)}...` : value;
}

function postImage(post) {
  return [post?.image, ...(Array.isArray(post?.images) ? post.images : [])].find(Boolean) || "";
}

function sortedPosts(items) {
  return [...items].sort((a, b) => String(b.sortDate || b.updatedAt || "").localeCompare(String(a.sortDate || a.updatedAt || "")));
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

function cleanGeneratedHtml(value) {
  return String(value ?? "").replace(/[ \t]+$/gm, "");
}

function canonicalUrl(pathname = "/") {
  const normalized = `/${String(pathname).replace(/^\/+|\/+$/g, "")}`;
  if (normalized === "/") return `${baseUrl}/`;
  if (/^\/(?:about|contact|editorial-team|editorial-policy|affiliate-disclosure|privacy)$/.test(normalized)) {
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

function alignArticleNavigation(document) {
  return String(document).replace(
    /<nav class=["']links["'] aria-label=["']주요 메뉴["']>[\s\S]*?<\/nav>/i,
    ARTICLE_NAVIGATION,
  );
}

function alignStaticInternalLinks(document) {
  return String(document).replace(
    /href=(["'])\/(about|contact|editorial-team|editorial-policy|affiliate-disclosure|privacy)\.html\1/g,
    (_match, quote, slug) => `href=${quote}/${slug}${quote}`,
  );
}

function formatDate(value = "") {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(value || "");
  return `${match[1]}년 ${Number(match[2])}월 ${Number(match[3])}일`;
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
  const image = product?.image
    ? `<span class="thumb"><img src="${html(product.image)}" alt="${html(product.title)}" loading="lazy"></span>`
    : `<span class="thumb empty"></span>`;
  return `<a class="product-card" href="${html(product.url)}" rel="sponsored noopener">
    ${image}
    <strong>${html(product.title)}</strong>
    <span>${html([product?.region || product?.city, product?.category, product?.priceText].filter(Boolean).join(" · "))}</span>
  </a>`;
}

function flightPageHtml(deal) {
  const products = relatedProducts(deal);
  const related = products.length
    ? `<section class="block"><h2>여행 준비에 필요한 예약</h2><div class="products">${products.map(productCard).join("")}</div></section>`
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
      :root{--ink:#111;--muted:#707070;--line:#e1e1e1;--paper:#fff;--soft:#f5f5f5}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:Arial,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;line-height:1.65}a{color:inherit;text-decoration:none}img{display:block;width:100%;height:100%;object-fit:cover}.wrap{width:min(760px,calc(100% - 32px));margin:auto}.top{position:sticky;top:0;background:rgba(255,255,255,.96);border-bottom:1px solid var(--line);z-index:10}.nav{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:68px}.brand{font-size:22px;font-weight:900}.links{display:flex;gap:14px;overflow-x:auto;white-space:nowrap;font-size:13px;font-weight:800}.language-switch{display:flex;gap:8px;white-space:nowrap}.language-switch a{font-size:12px;font-weight:900;color:#555;border-bottom:1px solid transparent}.language-switch a.is-active{color:#111;border-bottom-color:#111}.hero{padding:34px 0 22px}.hero h1{margin:0 0 14px;font-size:clamp(30px,8vw,46px);line-height:1.18;letter-spacing:-.01em}.meta{color:var(--muted);font-size:14px;font-weight:800}.fare{margin:22px 0 0;padding:20px 0;border-top:2px solid var(--ink);border-bottom:1px solid var(--line)}.fare strong{display:block;font-size:30px;line-height:1.1}.fare span{display:block;margin-top:8px;color:var(--muted);font-size:14px}.booking-cta{display:flex;align-items:center;justify-content:center;margin-top:16px;min-height:48px;background:#111;color:#fff;font-weight:900}.block{padding:28px 0;border-bottom:1px solid var(--line)}.block h2{margin:0 0 12px;font-size:23px;line-height:1.25}.info{display:grid;grid-template-columns:110px 1fr;gap:10px 16px;margin:0}.info dt{font-weight:900}.info dd{margin:0;color:#333}.products{display:grid;gap:0;border-top:1px solid var(--line)}.product-card{display:grid;grid-template-columns:92px minmax(0,1fr);gap:12px;align-items:center;padding:13px 0;border-bottom:1px solid var(--line)}.product-card .thumb{grid-row:1/3;display:block;aspect-ratio:1.28/1;background:var(--soft);overflow:hidden}.product-card .empty{background:linear-gradient(135deg,#f1f1f1,#dedede)}.product-card strong{font-size:17px;line-height:1.35;font-weight:900}.product-card span{display:block;color:var(--muted);font-size:12px}.note{color:var(--muted);font-size:14px}.footer{padding:28px 0 46px;color:var(--muted);font-size:13px}@media(max-width:520px){.nav{align-items:flex-start;flex-direction:column;padding:14px 0}.links{width:100%}.hero{padding-top:28px}.info{grid-template-columns:88px 1fr}.product-card{grid-template-columns:84px minmax(0,1fr)}}
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
    ["/stay/", "숙소·예약"],
  ];
  return `<nav class="links" aria-label="주요 메뉴">${items.map(([href, label]) => `<a${href === activePath ? ' class="is-active"' : ""} href="${href}">${label}</a>`).join("")}</nav>`;
}

function hubPageStyle() {
  return `:root{--ink:#111;--muted:#707070;--line:#e1e1e1;--paper:#fff;--soft:#f5f5f5;--accent:#22543d}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:Arial,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;line-height:1.62;letter-spacing:0}a{color:inherit;text-decoration:none}img{display:block;width:100%;height:100%;object-fit:cover;background:var(--soft)}.wrap{width:min(1040px,calc(100% - 32px));margin:auto}.top{position:sticky;top:0;z-index:10;background:rgba(255,255,255,.97);border-bottom:1px solid var(--line);backdrop-filter:blur(10px)}.nav{display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:70px}.brand{font-size:26px;font-weight:900;line-height:1}.links{display:flex;gap:18px;overflow-x:auto;white-space:nowrap;font-size:14px;font-weight:900}.links a{padding:2px 0;border-bottom:2px solid transparent}.links a.is-active{border-bottom-color:#111}.hero{padding:38px 0 22px;border-bottom:1px solid var(--line)}.kicker{display:block;color:var(--accent);font-size:12px;font-weight:900;letter-spacing:.12em}.hero h1{margin:7px 0 12px;font-size:clamp(32px,6vw,58px);line-height:1.05}.hero p{max-width:720px;margin:0;color:#333;font-size:17px}.tag-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}.tag-row a,.tag-row span{display:inline-flex;align-items:center;min-height:34px;border:1px solid var(--line);border-radius:999px;padding:7px 13px;background:#fff;font-size:13px;font-weight:900}.summary-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;padding:18px 0;border-bottom:1px solid var(--line)}.summary-row strong{display:block;font-size:24px;line-height:1.1}.summary-row span{display:block;color:var(--muted);font-size:13px}.block{padding:34px 0;border-bottom:1px solid var(--line)}.block-head{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:15px}.block h2{margin:0;font-size:28px;line-height:1.18}.block-note{margin:0;color:var(--muted);font-size:14px}.story-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px 18px}.story-card{display:block;min-width:0}.thumb{display:block;aspect-ratio:1.45/1;overflow:hidden;background:var(--soft)}.story-card strong{display:block;margin-top:10px;font-size:19px;line-height:1.32}.story-card em{display:block;margin-top:6px;color:var(--muted);font-size:12px;font-style:normal}.story-card p{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin:7px 0 0;color:#444;font-size:13px}.story-list{display:grid;gap:0;border-top:1px solid var(--line)}.story-list .story-card{display:grid;grid-template-columns:112px minmax(0,1fr);gap:13px;align-items:center;padding:14px 0;border-bottom:1px solid var(--line)}.story-list .thumb{grid-row:1/4;aspect-ratio:1.3/1}.stay-slot{background:#f8faf9}.product-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0 18px;border-top:1px solid var(--line)}.product-card{display:grid;grid-template-columns:90px minmax(0,1fr);gap:12px;align-items:center;padding:14px 0;border-bottom:1px solid var(--line)}.product-card.no-image{grid-template-columns:1fr}.product-card .product-thumb{grid-row:1/3;display:block;aspect-ratio:1.26/1;overflow:hidden;background:var(--soft)}.product-card strong{font-size:16px;line-height:1.35}.product-card span{display:block;color:var(--muted);font-size:12px}.affiliate-note{margin:0 0 12px;color:var(--muted);font-size:12px}.empty-slot{margin:0;padding:16px 0;border-top:1px solid var(--line);color:var(--muted)}.footer{padding:28px 0 46px;color:var(--muted);font-size:13px}${LANGUAGE_SWITCH_CSS}@media(max-width:780px){.nav{align-items:flex-start;flex-direction:column;padding:15px 0}.links{width:100%;padding-bottom:3px}.summary-row{grid-template-columns:1fr}.story-grid,.product-grid{grid-template-columns:1fr}.story-list .story-card,.product-card{grid-template-columns:88px minmax(0,1fr)}.hero{padding-top:30px}.block-head{display:block}.block-note{margin-top:5px}}`;
}

function storyCard(post) {
  const image = postImage(post);
  const thumb = image
    ? `<span class="thumb"><img src="${html(image)}" alt="${html(postTitle(post))}" loading="lazy"></span>`
    : `<span class="thumb"></span>`;
  const meta = [compactRegion(post?.region), post?.category, formatDate(postDate(post))].filter(Boolean).join(" · ");
  return `<a class="story-card" href="/${encodeURIComponent(post.slug)}/">
    ${thumb}
    <strong>${html(postTitle(post))}</strong>
    <em>${html(meta)}</em>
    ${postSummary(post) ? `<p>${html(postSummary(post))}</p>` : ""}
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

function staySlot({ title, posts, products = [], placeholder = "지역별 숙소 카드 자리입니다. 추천 숙소 데이터가 연결되면 이 위치에 카드가 표시됩니다." }) {
  const cards = products.map(hubProductCard).filter(Boolean);
  return `<section class="block stay-slot" id="accommodation-cards" aria-labelledby="accommodation-cards-title">
    <div class="block-head">
      <div><span class="kicker">STAY</span><h2 id="accommodation-cards-title">${html(title)}</h2></div>
      <p class="block-note">${html(posts.length ? `${compactRegion(posts[0]?.region)} 글 기준 추천` : "여행지 기준 추천")}</p>
    </div>
    <p class="affiliate-note">마이리얼트립 숙소·투어 링크는 제휴 링크일 수 있으며, 숙소 날짜는 접속 시점 기준 다음 금요일 체크인과 2박으로 자동 보정됩니다.</p>
    ${cards.length ? `<div class="product-grid">${cards.join("")}</div>` : `<p class="empty-slot">${html(placeholder)}</p>`}
  </section>`;
}

function sectionBlock({ id, title, posts, note = "" }) {
  const items = sortedPosts(posts).slice(0, 9);
  if (!items.length) return "";
  return `<section class="block" id="${html(id)}" aria-labelledby="${html(id)}-title">
    <div class="block-head">
      <div><span class="kicker">TAG</span><h2 id="${html(id)}-title">${html(title)}</h2></div>
      ${note ? `<p class="block-note">${html(note)}</p>` : ""}
    </div>
    <div class="story-grid">${items.map(storyCard).join("")}</div>
  </section>`;
}

function pageShell({ path, title, description, kicker = "TRIPVIEW", tags = [], body }) {
  const canonical = canonicalUrl(path);
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    ${NAVER_VERIFICATION_META}
    <meta name="description" content="${html(description)}">
    <link rel="canonical" href="${html(canonical)}">
    <title>${html(title)} - 트립뷰</title>
    <style>${hubPageStyle()}</style>
  </head>
  <body>
    <header class="top"><div class="wrap nav"><a class="brand" href="/">트립뷰</a>${primaryNavigation(path)}${LANGUAGE_SWITCH}</div></header>
    <main class="wrap">
      <section class="hero">
        <span class="kicker">${html(kicker)}</span>
        <h1>${html(title)}</h1>
        <p>${html(description)}</p>
        ${tags.length ? `<div class="tag-row">${tags.map((tag) => tag.href ? `<a href="${html(tag.href)}">${html(tag.label)}</a>` : `<span>${html(tag.label)}</span>`).join("")}</div>` : ""}
      </section>
      ${body}
    </main>
    <footer class="wrap footer">트립뷰는 여행지, 축제, 숙소·예약 정보를 실제 URL과 지역 허브로 정리합니다.</footer>
    <script src="/assets/homepage.js?v=booking-search-20260712-flight-links" defer></script>
    ${I18N_SCRIPT}
    ${TOPIC_FILTER_SCRIPT}
  </body>
</html>`;
}

function categoryPageHtml({ path, title, description, posts, tags = [], sections = [], products = [] }) {
  const rows = sortedPosts(posts).slice(0, 48);
  const body = [
    `<div class="summary-row"><div><strong>${rows.length.toLocaleString("ko-KR")}</strong><span>검수된 글</span></div><div><strong>${regionGroups().length.toLocaleString("ko-KR")}</strong><span>지역 허브</span></div><div><strong>3</strong><span>대표 카테고리</span></div></div>`,
    ...sections.map(sectionBlock),
    staySlot({ title: title === "숙소·예약" ? "숙소 카드" : "숙소 카드 자리", posts, products }),
    `<section class="block" id="all-posts" aria-labelledby="all-posts-title">
      <div class="block-head"><div><span class="kicker">ALL</span><h2 id="all-posts-title">${html(title)} 글 목록</h2></div><p class="block-note">최신 검수 글 기준</p></div>
      <div class="story-list">${rows.map(storyCard).join("")}</div>
    </section>`,
  ].join("");
  return pageShell({ path, title, description, kicker: "CATEGORY", tags, body });
}

function regionHubHtml(group) {
  const description = `${group.label} 지역의 여행지와 축제 글을 최신순으로 모았습니다. 지역 소개와 함께 관련 글, 숙소 카드 자리를 한 번에 확인하세요.`;
  const products = selectedHubProducts({ sectionId: "booking", posts: group.posts, limit: 3 });
  const body = [
    `<section class="block" id="region-intro" aria-labelledby="region-intro-title"><div class="block-head"><div><span class="kicker">REGION</span><h2 id="region-intro-title">${html(group.label)} 여행 소개</h2></div><p class="block-note">${html(group.posts.length)}개 글</p></div><p>${html(group.label)} 여행은 계절 행사, 실내 명소, 자연 여행지를 함께 보면 동선 선택이 쉬워집니다. 아래 목록에서 방문 목적에 맞는 글을 먼저 확인하고, 숙소 카드는 일정이 정해진 뒤 비교용으로 활용하세요.</p></section>`,
    `<section class="block" id="region-posts" aria-labelledby="region-posts-title"><div class="block-head"><div><span class="kicker">POSTS</span><h2 id="region-posts-title">${html(group.label)} 글 목록</h2></div><p class="block-note">같은 광역 지역 기준</p></div><div class="story-list">${group.posts.map(storyCard).join("")}</div></section>`,
    staySlot({ title: `${group.label} 숙소 카드 자리`, posts: group.posts, products }),
  ].join("");
  return pageShell({
    path: `/region/${group.slug}/`,
    title: `${group.label} 여행 허브`,
    description,
    kicker: "REGION HUB",
    tags: [
      { label: "여행지", href: "/travel/" },
      { label: "축제", href: "/festival/" },
      { label: "숙소·예약", href: "/stay/" },
    ],
    body,
  });
}

async function writePage(pathname, document) {
  const parts = pathname.split("/").filter(Boolean);
  const dir = join(root, ...parts);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "index.html"), cleanGeneratedHtml(document), "utf8");
}

async function generateHubPages() {
  for (const dirName of ["travel", "festival", "stay", "region"]) {
    await rm(join(root, dirName), { recursive: true, force: true });
  }

  const travelPosts = sortedPosts(indexablePosts.filter((post) => !isFestivalPost(post)));
  const festivalPosts = sortedPosts(indexablePosts.filter(isFestivalPost));
  const waterKeywords = ["수영장", "계곡", "해수욕장", "해변", "바다", "물놀이", "워터파크", "폭포", "수변"];
  const indoorKeywords = ["실내", "박물관", "미술관", "전시", "문화", "센터", "아트", "공연장"];
  const familyKeywords = ["아이", "가족", "어린이", "체험", "공원", "생태", "자연학습"];
  const stayPosts = sortedPosts(indexablePosts.filter((post) => ["32", "38", "39"].includes(contentTypeOf(post)) || hasKeyword(post, ["숙소", "호텔", "예약", "투어", "입장권"])));

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
    products: selectedHubProducts({ sectionId: "booking", posts: travelPosts, limit: 3 }),
  }));

  await writePage("/festival/", categoryPageHtml({
    path: "/festival/",
    title: "축제",
    description: CATEGORY_PAGES[1].description,
    posts: festivalPosts,
    tags: [
      { label: "이달의 축제", href: "#featured" },
      { label: "지역 허브", href: "#all-posts" },
    ],
    sections: [
      { id: "featured", title: "이달의 축제", posts: festivalPosts, note: "검수된 축제 글 최신순" },
    ],
    products: selectedHubProducts({ sectionId: "festival", posts: festivalPosts, limit: 3 }),
  }));

  await writePage("/stay/", categoryPageHtml({
    path: "/stay/",
    title: "숙소·예약",
    description: CATEGORY_PAGES[2].description,
    posts: stayPosts.length ? stayPosts : indexablePosts,
    tags: [
      { label: "숙소 카드", href: "#accommodation-cards" },
      { label: "여행지", href: "/travel/" },
      { label: "축제", href: "/festival/" },
    ],
    sections: [],
    products: selectedHubProducts({ sectionId: "booking", posts: indexablePosts, limit: 12, accommodationOnly: true }),
  }));

  for (const group of regionGroups()) {
    await writePage(`/region/${group.slug}/`, regionHubHtml(group));
  }
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
    ...CATEGORY_PAGES.map((page) => ({ loc: canonicalUrl(page.path), lastmod: today })),
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
const TRUST_NOTE_START = "<!-- TRUST_NOTE_START";
const TRUST_NOTE_END = "TRUST_NOTE_END -->";
const TRUST_STYLE_MARK = "/* tripview-trust-note */";
const REGION_RELATED_START = "<!-- REGION_RELATED_START";
const REGION_RELATED_END = "REGION_RELATED_END -->";
const REGION_RELATED_STYLE_MARK = "/* tripview-region-related */";
const COUPANG_AD_START = "<!-- COUPANG_AD_START";
const COUPANG_AD_END = "COUPANG_AD_END -->";
const COUPANG_WIDGET_START = "<!-- COUPANG_WIDGET_START";
const COUPANG_WIDGET_END = "COUPANG_WIDGET_END -->";
const COUPANG_STYLE_MARK = "/* tripview-coupang-native-ad */";
const COUPANG_SCRIPT = '<script src="/assets/coupang.js?v=coupang-20260708" defer></script>';

function articleAdCss() {
  return `${MRT_STYLE_MARK}.mrt-native-ad{margin:34px 0;padding:18px 0 20px;border-top:2px solid #111;border-bottom:1px solid var(--line)}.mrt-native-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:6px}.mrt-native-head strong{font-size:20px;line-height:1.25}.mrt-native-head span{color:var(--muted);font-size:13px}.mrt-affiliate-note{margin:0 0 12px;color:var(--muted);font-size:12px;line-height:1.55}.mrt-native-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px;border-top:1px solid var(--line)}.mrt-card{display:grid;grid-template-columns:88px minmax(0,1fr);gap:12px;align-items:center;padding:13px 0;border-bottom:1px solid var(--line)}.mrt-card.no-image{grid-template-columns:1fr}.mrt-thumb{grid-row:1/3;display:block;aspect-ratio:1.28/1;overflow:hidden;background:var(--soft)}.mrt-card strong{font-size:16px;line-height:1.35}.mrt-card em{display:block;color:var(--muted);font-size:12px;font-style:normal}.mrt-card.no-image strong,.mrt-card.no-image em{grid-column:1}@media(max-width:640px){.mrt-native-grid{grid-template-columns:1fr}.mrt-card{grid-template-columns:84px minmax(0,1fr)}}/* end-tripview-mrt-native-ad */`;
}

function articleCoupangCss() {
  return `${COUPANG_STYLE_MARK}.coupang-native-ad,.coupang-widget-ad{margin:30px 0;padding:18px 0 20px;border-top:2px solid #111;border-bottom:1px solid var(--line)}.coupang-native-ad h2,.coupang-widget-ad h2{margin:0 0 8px;font-size:22px}.coupang-native-ad .affiliate-disclosure,.coupang-widget-ad .affiliate-disclosure{margin:0 0 13px;color:var(--muted);font-size:12px;line-height:1.55}.coupang-native-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px;border-top:1px solid var(--line)}.coupang-card strong{font-size:16px}.coupang-widget-scroll{width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden;padding-bottom:2px}.coupang-widget-inner{width:680px;max-width:680px;min-height:140px}@media(max-width:640px){.coupang-native-grid{grid-template-columns:1fr}}/* end-tripview-coupang-native-ad */`;
}

function articleTrustCss() {
  return `${TRUST_STYLE_MARK}.meta .author-link,.trust-note a{font-weight:900;text-decoration:underline;text-underline-offset:3px}.trust-note{margin:36px 0 10px;padding:18px 0 0;border-top:2px solid #111;color:#333}.trust-note h2{margin:0 0 12px;font-size:22px;line-height:1.25}.trust-note dl{display:grid;grid-template-columns:118px minmax(0,1fr);gap:8px 14px;margin:0 0 14px}.trust-note dt{font-weight:900;color:#111}.trust-note dd{margin:0}.trust-note p{margin:0 0 10px;color:var(--muted);font-size:14px;line-height:1.6}@media(max-width:520px){.trust-note dl{grid-template-columns:1fr;gap:4px}.trust-note dd{padding-bottom:8px;border-bottom:1px solid var(--line)}}/* end-tripview-trust-note */`;
}

function articleRegionRelatedCss() {
  return `${REGION_RELATED_STYLE_MARK}.region-related{margin:34px 0;padding:18px 0 20px;border-top:2px solid #111;border-bottom:1px solid var(--line)}.region-related-head{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin-bottom:12px}.region-related h2{margin:0;font-size:22px;line-height:1.25}.region-hub-link{font-size:13px;font-weight:900;text-decoration:underline;text-underline-offset:3px;white-space:nowrap}.region-related-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0 16px;border-top:1px solid var(--line)}.region-related-card{display:block;padding:13px 0;border-bottom:1px solid var(--line)}.region-related-card strong{display:block;font-size:16px;line-height:1.35}.region-related-card span{display:block;margin-top:6px;color:var(--muted);font-size:12px}.region-related-empty{margin:0;color:var(--muted);font-size:14px}@media(max-width:640px){.region-related-head{display:block}.region-hub-link{display:inline-block;margin-top:8px}.region-related-grid{grid-template-columns:1fr}}/* end-tripview-region-related */`;
}

function stripExistingArticleAds(document) {
  return document
    .replace(new RegExp(`${MRT_AD_START}[\\s\\S]*?${MRT_AD_END}`, "g"), "")
    .replace(new RegExp(`${TRUST_NOTE_START}[\\s\\S]*?${TRUST_NOTE_END}`, "g"), "")
    .replace(new RegExp(`${REGION_RELATED_START}[\\s\\S]*?${REGION_RELATED_END}`, "g"), "")
    .replace(new RegExp(`${COUPANG_AD_START}[\\s\\S]*?${COUPANG_AD_END}`, "g"), "")
    .replace(new RegExp(`${COUPANG_WIDGET_START}[\\s\\S]*?${COUPANG_WIDGET_END}`, "g"), "")
    .replace(/\/\* tripview-mrt-native-ad \*\/[\s\S]*?\/\* end-tripview-mrt-native-ad \*\//g, "")
    .replace(/\/\* tripview-trust-note \*\/[\s\S]*?\/\* end-tripview-trust-note \*\//g, "")
    .replace(/\/\* tripview-region-related \*\/[\s\S]*?\/\* end-tripview-region-related \*\//g, "")
    .replace(/\/\* tripview-coupang-native-ad \*\/[\s\S]*?\/\* end-tripview-coupang-native-ad \*\//g, "")
    .replace(/\s*<script\s+src=["']\/assets\/coupang\.js\?v=[^"']+["']\s+defer><\/script>/g, "")
    .replace(/\s*<script\s+src=["']https:\/\/ads-partners\.coupang\.com\/g\.js["']><\/script>/g, "")
    .replace(/\s*<script\s+src=["']\/assets\/beach-(?:info|weather)\.js\?v=[^"']+["']\s+defer><\/script>/g, "");
}

function injectArticleAdCss(document, includeAffiliate = false, includeRegionRelated = false) {
  let next = document;
  if (includeAffiliate && !next.includes(MRT_STYLE_MARK)) next = next.replace("</style>", `${articleAdCss()}</style>`);
  if (includeRegionRelated && !next.includes(REGION_RELATED_STYLE_MARK)) next = next.replace("</style>", `${articleRegionRelatedCss()}</style>`);
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
  if (images.some((src) => /visitkorea\.or\.kr|tong\.visitkorea/i.test(String(src)))) return "한국관광공사";
  return "본문 표기 이미지 또는 공개 자료";
}

function articleTrustBlock(post) {
  const reviewed = isIndexablePost(post);
  const checkedAt = reviewed ? formatKoreanDate(post.editorialReviewedAt) : "편집 검수 대기";
  const imageSource = articleImageSource(post);
  const updateBase = formatKoreanDate(postDate(post));
  const authorProfile = post.editorialAuthorProfile || "/editorial-team";
  return `${TRUST_NOTE_START} -->
<aside class="trust-note" aria-label="콘텐츠 신뢰 정보">
  <h2>작성·검수 정보</h2>
  <dl>
    <dt>작성·검수</dt><dd><a href="${html(authorProfile)}">${html(post.editorialReviewer || "트립뷰 편집팀")}</a></dd>
    <dt>검수 상태</dt><dd>${reviewed ? "편집 검수 완료" : "편집 검수 대기"}</dd>
    <dt>최종 확인일</dt><dd>${html(checkedAt)}</dd>
    <dt>확인 자료</dt><dd>${articleSourceHtml(post)}</dd>
    <dt>사진 출처</dt><dd>${html(imageSource)}</dd>
    <dt>수정일</dt><dd>${html(updateBase)}</dd>
  </dl>
  <p>운영 시간, 요금, 프로그램, 주차 가능 여부는 현장 사정에 따라 바뀔 수 있습니다. 출발 전 공식 안내나 현장 문의처를 한 번 더 확인하는 것을 권장합니다.</p>
  <p>글 안의 예약, 숙소, 투어, 상품 링크는 제휴 링크일 수 있으며 예약 또는 구매가 발생할 경우 트립뷰가 일정 수수료를 받을 수 있습니다. 콘텐츠 판단 기준과 정정 요청은 <a href="/editorial-policy">콘텐츠 운영 기준</a>, <a href="/affiliate-disclosure">제휴 안내</a>, <a href="/contact">문의</a>에서 확인할 수 있습니다.</p>
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

function ensureArticleSchema(document, post, indexable) {
  const withoutExisting = String(document).replace(
    /\s*<script type="application\/ld\+json" data-tripview-article>[\s\S]*?<\/script>/g,
    "",
  );
  if (!indexable || !withoutExisting.includes("</head>")) return withoutExisting;

  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description || post.excerpt || "",
    mainEntityOfPage: postUrl(post),
    datePublished: post.sortDate || post.updatedAt,
    dateModified: post.editorialReviewedAt || post.updatedAt || post.sortDate,
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
    image: [post.image, ...(Array.isArray(post.images) ? post.images : [])].filter(Boolean),
    citation: articleSourceLinks(post).map((source) => source.url),
    isAccessibleForFree: true,
    inLanguage: "ko-KR",
  };
  const json = JSON.stringify(schema).replaceAll("<", "\\u003c");
  return withoutExisting.replace("</head>", `    <script type="application/ld+json" data-tripview-article>${json}</script>\n  </head>`);
}

function ensureArticleAdsense(document, enabled) {
  if (enabled) return document;
  return String(document).replace(
    /\s*<script\s+async\s+src=["']https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-\d+["'][^>]*><\/script>/gi,
    "",
  );
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

function articleRegionRelatedItems(post) {
  const slug = regionSlug(post?.region);
  return sortedPosts(indexablePosts)
    .filter((candidate) => candidate?.slug && candidate.slug !== post?.slug && regionSlug(candidate?.region) === slug)
    .slice(0, 3);
}

function articleRegionRelatedCard(post) {
  return `<a class="region-related-card" href="/${encodeURIComponent(post.slug)}/">
    <strong>${html(postTitle(post))}</strong>
    <span>${html([compactRegion(post?.region), formatDate(postDate(post))].filter(Boolean).join(" · "))}</span>
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
    const affiliateBlock = indexable ? articleAdBlock(post) : "";
    const regionRelatedBlock = indexable ? articleRegionRelatedBlock(post) : "";
    let next = injectArticleAdCss(stripExistingArticleAds(document), Boolean(affiliateBlock), Boolean(regionRelatedBlock));
    next = alignArticleNavigation(next);
    next = alignArticleByline(next, post);
    next = injectArticleAffiliate(next, affiliateBlock);
    next = injectArticleRegionRelated(next, regionRelatedBlock);
    next = injectArticleTrust(next, post);
    next = ensureCanonical(next, `/${post.slug}/`);
    next = ensureRobotsMeta(next, indexable);
    next = ensureArticleSchema(next, post, indexable);
    next = ensureArticleAdsense(next, indexable);
    next = ensureAccommodationLinkScript(next);
    next = alignStaticInternalLinks(next);
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
      const next = cleanGeneratedHtml(ensureCanonical(alignStaticInternalLinks(alignedNavigation), pathname));
      if (next !== document) await writeFile(file, next, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}

async function copySite(targetDir) {
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
}

await generateFlightDealPages();
await generateHubPages();
await generateSitemap();
await generateFeed();
await polishGeneratedArticles();
await polishStaticPages();
await copySite(outDir);
await copySite(siteDir);

console.log(`Built ${posts.length} posts into www and site`);
