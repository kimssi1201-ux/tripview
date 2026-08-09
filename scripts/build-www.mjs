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
const ARTICLE_NAVIGATION = '<nav class="links" aria-label="주요 메뉴"><a href="/">홈</a><a href="/#popular">8월 가볼만한 곳</a><a href="/#water">물놀이·계곡</a><a href="/#weekend">이번 주말</a><a href="/#festival">8월 축제</a><a href="/#indoor">실내여행</a><a href="/#family">아이와</a><a href="/#booking">예약 전 체크</a><a href="/#flight-deals">항공권</a></nav>';

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
  "flight-deals"
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
  return post.sortDate || post.date || new Date().toISOString().slice(0, 10);
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

function cleanGeneratedHtml(value) {
  return String(value ?? "").replace(/[ \t]+$/gm, "");
}

function canonicalUrl(pathname = "/") {
  const normalized = `/${String(pathname).replace(/^\/+|\/+$/g, "")}`;
  if (normalized === "/") return `${baseUrl}/`;
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
    ? `<section class="block"><h2>같이 보면 좋은 예약 정보</h2><div class="products">${products.map(productCard).join("")}</div></section>`
    : "";
  const description = `${deal.region || deal.city || "해외"} 여행을 검토할 때 참고할 항공권 가격, 출발일, 여행 기간을 한 번에 정리했습니다.`;
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    ${NAVER_VERIFICATION_META}
    <meta name="description" content="${html(description)}">
    ${ADSENSE_SCRIPT}
    <link rel="canonical" href="${html(flightUrl(deal))}">
    <title>${html(deal.title)} - 트립뷰</title>
    <style>
      :root{--ink:#111;--muted:#707070;--line:#e1e1e1;--paper:#fff;--soft:#f5f5f5}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:Arial,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;line-height:1.65}a{color:inherit;text-decoration:none}img{display:block;width:100%;height:100%;object-fit:cover}.wrap{width:min(760px,calc(100% - 32px));margin:auto}.top{position:sticky;top:0;background:rgba(255,255,255,.96);border-bottom:1px solid var(--line);z-index:10}.nav{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:68px}.brand{font-size:22px;font-weight:900}.links{display:flex;gap:14px;overflow-x:auto;white-space:nowrap;font-size:13px;font-weight:800}.language-switch{display:flex;gap:8px;white-space:nowrap}.language-switch a{font-size:12px;font-weight:900;color:#555;border-bottom:1px solid transparent}.language-switch a.is-active{color:#111;border-bottom-color:#111}.hero{padding:34px 0 22px}.hero h1{margin:0 0 14px;font-size:clamp(30px,8vw,46px);line-height:1.18;letter-spacing:-.01em}.meta{color:var(--muted);font-size:14px;font-weight:800}.fare{margin:22px 0 0;padding:20px 0;border-top:2px solid var(--ink);border-bottom:1px solid var(--line)}.fare strong{display:block;font-size:30px;line-height:1.1}.fare span{display:block;margin-top:8px;color:var(--muted);font-size:14px}.booking-cta{display:flex;align-items:center;justify-content:center;margin-top:16px;min-height:48px;background:#111;color:#fff;font-weight:900}.block{padding:28px 0;border-bottom:1px solid var(--line)}.block h2{margin:0 0 12px;font-size:23px;line-height:1.25}.info{display:grid;grid-template-columns:110px 1fr;gap:10px 16px;margin:0}.info dt{font-weight:900}.info dd{margin:0;color:#333}.products{display:grid;gap:0;border-top:1px solid var(--line)}.product-card{display:grid;grid-template-columns:92px minmax(0,1fr);gap:12px;align-items:center;padding:13px 0;border-bottom:1px solid var(--line)}.product-card .thumb{grid-row:1/3;display:block;aspect-ratio:1.28/1;background:var(--soft);overflow:hidden}.product-card .empty{background:linear-gradient(135deg,#f1f1f1,#dedede)}.product-card strong{font-size:17px;line-height:1.35;font-weight:900}.product-card span{display:block;color:var(--muted);font-size:12px}.note{color:var(--muted);font-size:14px}.footer{padding:28px 0 46px;color:var(--muted);font-size:13px}@media(max-width:520px){.nav{align-items:flex-start;flex-direction:column;padding:14px 0}.links{width:100%}.hero{padding-top:28px}.info{grid-template-columns:88px 1fr}.product-card{grid-template-columns:84px minmax(0,1fr)}}
    </style>
  </head>
  <body>
    <header class="top"><div class="wrap nav"><a class="brand" href="/">트립뷰</a><nav class="links" aria-label="주요 메뉴"><a href="/">홈</a><a href="/#flight-deals">항공권 최저가 여행지</a><a href="/#booking">예약 전 체크</a></nav>${LANGUAGE_SWITCH}</div></header>
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
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${NAVER_VERIFICATION_META}<meta name="description" content="항공권 가격을 기준으로 여행지를 비교하고 함께 볼 숙소와 투어 정보를 확인하세요.">${ADSENSE_SCRIPT}<title>항공권 최저가 여행지 - 트립뷰</title><style>body{margin:0;font-family:Arial,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;color:#111}.wrap{width:min(760px,calc(100% - 32px));margin:auto}a{color:inherit;text-decoration:none}.top{border-bottom:1px solid #e1e1e1}.top .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px}.brand{display:block;padding:22px 0;font-size:26px;font-weight:900}.hero{padding:30px 0}.hero h1{margin:0;font-size:38px;line-height:1.15}.products{border-top:1px solid #e1e1e1}.product-card{display:grid;gap:6px;align-items:center;padding:16px 0;border-bottom:1px solid #e1e1e1}strong{font-size:19px;line-height:1.35}span{color:#707070;font-size:13px}${LANGUAGE_SWITCH_CSS}@media(max-width:520px){.top .wrap{align-items:flex-start;flex-direction:column;padding:14px 0}.brand{padding:0}}</style></head><body><header class="top"><div class="wrap"><a class="brand" href="/">트립뷰</a>${LANGUAGE_SWITCH}</div></header><main class="wrap"><section class="hero"><h1>항공권 최저가 여행지</h1><p>항공권 가격을 기준으로 여행지를 고르고, 상세 페이지에서 함께 볼 숙소와 투어 정보를 확인하세요.</p></section><section class="products">${rows}</section></main>${I18N_SCRIPT}${TOPIC_FILTER_SCRIPT}</body></html>`;
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
    { loc: `${baseUrl}/about.html`, lastmod: today },
    { loc: `${baseUrl}/contact.html`, lastmod: today },
    { loc: `${baseUrl}/editorial-policy.html`, lastmod: today },
    { loc: `${baseUrl}/affiliate-disclosure.html`, lastmod: today },
    { loc: `${baseUrl}/privacy.html`, lastmod: today },
    { loc: `${baseUrl}/flight-deals/`, lastmod: today },
    ...(Array.isArray(flightDeals) ? flightDeals : [])
      .filter((deal) => deal?.title)
      .map((deal) => ({ loc: flightUrl(deal), lastmod: deal.departureDate || today })),
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
  return `${TRUST_STYLE_MARK}.trust-note{margin:36px 0 10px;padding:18px 0 0;border-top:2px solid #111;color:#333}.trust-note h2{margin:0 0 12px;font-size:22px;line-height:1.25}.trust-note dl{display:grid;grid-template-columns:118px minmax(0,1fr);gap:8px 14px;margin:0 0 14px}.trust-note dt{font-weight:900;color:#111}.trust-note dd{margin:0}.trust-note p{margin:0 0 10px;color:var(--muted);font-size:14px;line-height:1.6}.trust-note a{font-weight:900;text-decoration:underline;text-underline-offset:3px}@media(max-width:520px){.trust-note dl{grid-template-columns:1fr;gap:4px}.trust-note dd{padding-bottom:8px;border-bottom:1px solid var(--line)}}/* end-tripview-trust-note */`;
}

function stripExistingArticleAds(document) {
  return document
    .replace(new RegExp(`${MRT_AD_START}[\\s\\S]*?${MRT_AD_END}`, "g"), "")
    .replace(new RegExp(`${TRUST_NOTE_START}[\\s\\S]*?${TRUST_NOTE_END}`, "g"), "")
    .replace(new RegExp(`${COUPANG_AD_START}[\\s\\S]*?${COUPANG_AD_END}`, "g"), "")
    .replace(new RegExp(`${COUPANG_WIDGET_START}[\\s\\S]*?${COUPANG_WIDGET_END}`, "g"), "")
    .replace(/\/\* tripview-mrt-native-ad \*\/[\s\S]*?\/\* end-tripview-mrt-native-ad \*\//g, "")
    .replace(/\/\* tripview-trust-note \*\/[\s\S]*?\/\* end-tripview-trust-note \*\//g, "")
    .replace(/\/\* tripview-coupang-native-ad \*\/[\s\S]*?\/\* end-tripview-coupang-native-ad \*\//g, "")
    .replace(/\s*<script\s+src=["']\/assets\/coupang\.js\?v=[^"']+["']\s+defer><\/script>/g, "")
    .replace(/\s*<script\s+src=["']https:\/\/ads-partners\.coupang\.com\/g\.js["']><\/script>/g, "")
    .replace(/\s*<script\s+src=["']\/assets\/beach-(?:info|weather)\.js\?v=[^"']+["']\s+defer><\/script>/g, "");
}

function injectArticleAdCss(document, includeAffiliate = false) {
  let next = document;
  if (includeAffiliate && !next.includes(MRT_STYLE_MARK)) next = next.replace("</style>", `${articleAdCss()}</style>`);
  if (!next.includes(TRUST_STYLE_MARK)) next = next.replace("</style>", `${articleTrustCss()}</style>`);
  return next;
}

function formatKoreanDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(value || "");
  return `${match[1]}년 ${Number(match[2])}월 ${Number(match[3])}일`;
}

function articleImageSource(post) {
  const images = [post?.image, ...(Array.isArray(post?.images) ? post.images : [])].filter(Boolean);
  if (!images.length) return "이미지 없음";
  if (images.some((src) => /visitkorea\.or\.kr|tong\.visitkorea/i.test(String(src)))) return "한국관광공사";
  return "본문 표기 이미지 또는 공개 자료";
}

function articleContentSource(post) {
  if (post?.contentid) return "한국관광공사 공개 여행 정보와 트립뷰 편집 기준";
  return "트립뷰 편집 기준";
}

function articleTrustBlock(post) {
  const checkedAt = formatKoreanDate(new Date().toISOString().slice(0, 10));
  const source = articleContentSource(post);
  const imageSource = articleImageSource(post);
  const updateBase = formatKoreanDate(postDate(post));
  return `${TRUST_NOTE_START} -->
<aside class="trust-note" aria-label="콘텐츠 신뢰 정보">
  <h2>콘텐츠 확인 기준</h2>
  <dl>
    <dt>최종 확인일</dt><dd>${html(checkedAt)}</dd>
    <dt>정보 기준</dt><dd>${html(source)}</dd>
    <dt>사진 출처</dt><dd>${html(imageSource)}</dd>
    <dt>발행 기준일</dt><dd>${html(updateBase)}</dd>
  </dl>
  <p>운영 시간, 요금, 프로그램, 주차 가능 여부는 현장 사정에 따라 바뀔 수 있습니다. 출발 전 공식 안내나 현장 문의처를 한 번 더 확인하는 것을 권장합니다.</p>
  <p>글 안의 예약, 숙소, 투어, 상품 링크는 제휴 링크일 수 있으며 예약 또는 구매가 발생할 경우 트립뷰가 일정 수수료를 받을 수 있습니다. 콘텐츠 판단 기준과 정정 요청은 <a href="/editorial-policy.html">콘텐츠 운영 기준</a>, <a href="/affiliate-disclosure.html">제휴 안내</a>, <a href="/contact.html">문의</a>에서 확인할 수 있습니다.</p>
</aside>
<!-- ${TRUST_NOTE_END}`;
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
  return item?.url || "https://www.myrealtrip.com/";
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
    <em>${html(articleAdMeta(item) || "\uB9C8\uC774\uB9AC\uC5BC\uD2B8\uB9BD \uC608\uC57D \uC815\uBCF4")}</em>
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

function articleAdItems(post, count = 2) {
  return selectAffiliateProducts({
    sectionId: articleSectionId(post),
    posts: [post],
    products: [...tnaProducts, ...accommodationProducts],
    limit: count,
  });
}

function articleAdBlock(post) {
  const items = articleAdItems(post, 2);
  if (!items.length) return "";
  const title = "이 여행지 예약 정보";
  return `${MRT_AD_START} context -->
<section class="mrt-native-ad" aria-label="${title}">
  <div class="mrt-native-head"><strong>${title}</strong><span>숙소·투어·티켓</span></div>
  <p class="mrt-affiliate-note">현재 글의 지역과 여행 목적이 일치하는 상품만 표시합니다. 제휴 링크를 통해 예약하면 트립뷰가 수수료를 받을 수 있습니다.</p>
  <div class="mrt-native-grid">${items.map(articleAdCard).join("")}</div>
</section>
<!-- ${MRT_AD_END}`;
}

function injectArticleAffiliate(document, block) {
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

    const affiliateBlock = isIndexablePost(post) ? articleAdBlock(post) : "";
    let next = injectArticleAdCss(stripExistingArticleAds(document), Boolean(affiliateBlock));
    next = alignArticleNavigation(next);
    next = injectArticleAffiliate(next, affiliateBlock);
    next = injectArticleTrust(next, post);
    next = ensureCanonical(next, `/${post.slug}/`);
    next = ensureRobotsMeta(next, isIndexablePost(post));
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
    ["about.html", "/about.html"],
    ["contact.html", "/contact.html"],
    ["editorial-policy.html", "/editorial-policy.html"],
    ["affiliate-disclosure.html", "/affiliate-disclosure.html"],
    ["privacy.html", "/privacy.html"],
  ]);

  for (const [fileName, pathname] of pages) {
    const file = join(root, fileName);
    try {
      const document = await readFile(file, "utf8");
      const alignedNavigation = document
        .replaceAll('<a href="/#latest">최신글</a>', '<a href="/#popular">8월 가볼만한 곳</a>')
        .replaceAll('<a href="/#routes">전체글</a>', '<a href="/#festival">8월 축제/행사</a>');
      const next = cleanGeneratedHtml(ensureCanonical(alignedNavigation, pathname));
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
await generateSitemap();
await generateFeed();
await polishGeneratedArticles();
await polishStaticPages();
await copySite(outDir);
await copySite(siteDir);

console.log(`Built ${posts.length} posts into www and site`);
