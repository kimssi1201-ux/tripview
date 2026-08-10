import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { affiliateProductImage, selectAffiliateProducts } from "./lib/affiliate-matching.mjs";
import { isIndexablePost } from "./lib/content-quality.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POSTS_PATH = path.join(ROOT, "data", "generated-posts.json");
const MYREALTRIP_PRODUCTS_PATH = path.join(ROOT, "data", "myrealtrip-products.json");
const MYREALTRIP_ACCOMMODATIONS_PATH = path.join(ROOT, "data", "myrealtrip-accommodations.json");
const MYREALTRIP_TNA_PATH = path.join(ROOT, "data", "myrealtrip-tna-products.json");
const MYREALTRIP_FLIGHTS_PATH = path.join(ROOT, "data", "myrealtrip-flight-deals.json");
const INDEX_PATH = path.join(ROOT, "index.html");

const BRAND = "\uD2B8\uB9BD\uBDF0";
const CAT_DOMESTIC = "\uAD6D\uB0B4\uC5EC\uD589";
const CAT_FESTIVAL = "\uACF5\uC5F0/\uCD95\uC81C";
const REGION_OTHER = "\uAE30\uD0C0";
const LANGUAGE_SWITCH = '<div class="language-switch notranslate" translate="no" aria-label="Language selector"><a href="?lang=ko" data-lang="ko" lang="ko">KO</a><a href="?lang=en" data-lang="en" lang="en">EN</a><a href="?lang=ja" data-lang="ja" lang="ja">JA</a><a href="?lang=zh" data-lang="zh" lang="zh-CN">ZH</a></div>';
const CONTENT_TODAY = formatDateInKorea();
const FEATURE_YEAR = Number(CONTENT_TODAY.slice(0, 4));
const FEATURE_MONTH = 8;
const FEATURE_MONTH_START = isoDate(FEATURE_YEAR, FEATURE_MONTH, 1);
const FEATURE_MONTH_END = isoDate(FEATURE_YEAR, FEATURE_MONTH, 31);
const FEATURE_MONTH_LABEL = `${FEATURE_MONTH}\uC6D4`;
const DESKTOP_LAYOUT_CSS = `
      .product-card>.booking-thumb{grid-column:1}
      .masthead-row{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:14px}.masthead-row .brand{margin:0}.brand-note{display:none;color:var(--muted);font-size:10px;font-weight:900;letter-spacing:.16em}.section-kicker{display:block;margin:0 0 3px;color:var(--ink);font-size:10px;font-weight:900;letter-spacing:.12em}.section-headline{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin:0 0 18px;padding-top:11px;border-top:2px solid var(--ink)}.section-headline h2{margin:0;font-size:28px;line-height:1.12}.section-more{color:var(--muted);font-size:12px;font-weight:900;white-space:nowrap}.magazine-card{display:block;min-width:0}.editorial-hero{padding-top:24px}.editorial-hero-grid{display:grid;grid-template-columns:1fr;gap:3px;background:#fff}.hero-main,.hero-rail-card{position:relative;display:block;overflow:hidden;background:var(--soft);color:#fff}.hero-main:after,.hero-rail-card:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.02) 25%,rgba(0,0,0,.78) 100%);pointer-events:none}.hero-thumb{display:block;width:100%;height:100%;aspect-ratio:1.28/1;overflow:hidden}.hero-content,.hero-rail-content{position:absolute;z-index:1;right:0;bottom:0;left:0;padding:22px}.hero-label{display:block;margin-bottom:7px;font-size:11px;font-weight:900;letter-spacing:.08em}.hero-main h2{max-width:780px;margin:0;font-size:30px;line-height:1.14;font-weight:900}.hero-main p{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;max-width:700px;overflow:hidden;margin:10px 0 0;color:rgba(255,255,255,.84);font-size:13px;line-height:1.55}.hero-rail{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:3px}.hero-rail-card{aspect-ratio:1/1}.hero-rail-content{padding:14px}.category-top{display:grid;grid-template-columns:1fr;gap:18px}.news-lead .lead-thumb{aspect-ratio:1.55/1}.story-label{display:block!important;margin:11px 0 0!important;color:var(--ink)!important;font-size:10px!important;font-weight:900!important;letter-spacing:.04em}.news-lead .story-summary{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-top:8px;color:var(--muted);font-size:13px;line-height:1.55;font-style:normal}.category-picks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.category-picks .pick-card{min-width:0}.category-picks .pick-thumb{aspect-ratio:1/1}.category-picks .pick-card strong{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;margin-top:7px;font-size:13px;line-height:1.35}.category-list{margin-top:22px;border-top:1px solid var(--line)}.category-list .news-row{margin:0}.magazine-thumb{display:block;aspect-ratio:1.56/1;overflow:hidden;background:var(--soft)}.magazine-card strong{display:block;margin-top:8px;font-size:19px;line-height:1.28;font-weight:900}.magazine-card em{display:block;margin-top:7px;color:var(--muted);font-size:13px;line-height:1.55;font-style:normal}.magazine-meta{display:block;margin-top:10px;color:var(--ink);font-size:10px;font-weight:900;letter-spacing:.04em}.hero-rail-card.magazine-card strong{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;margin:0;color:#fff;font-size:15px;line-height:1.3}.news-lead.magazine-card strong{margin-top:5px;font-size:24px}.coupang-widget-scroll{width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden;padding-bottom:2px}.coupang-widget-inner{width:680px;max-width:680px;min-height:140px}.site-footer>span{display:none}.footer-brand strong{display:block;color:var(--ink);font-size:20px;margin-bottom:8px}.footer-brand p,.footer-col a{display:block;margin:0 0 7px;color:var(--muted);font-size:13px}.footer-col b{display:block;margin-bottom:10px;color:var(--ink);font-size:13px}.footer-bottom{grid-column:1/-1;margin-top:10px;padding-top:16px;border-top:1px solid #eee;color:#aaa;font-size:12px}
      .brand-heading{margin:0;font:inherit;line-height:1}
      @media(min-width:900px){
        html{scroll-padding-top:132px}
        body{background:#fff}
        .site-header{position:sticky;background:rgba(255,255,255,.98);border-bottom:1px solid #ededed}
        .header-inner,.page,.site-footer{max-width:1180px}
        .header-inner{padding:20px 24px 12px}.masthead-row{position:relative;justify-content:center;margin-bottom:18px}.brand{font-size:34px}.brand-note{display:block;position:absolute;left:0}.language-switch{position:absolute;right:0}.nav-scroll{justify-content:center;gap:32px;padding:12px 0 0;border-top:1px solid #eee;font-size:14px}
        .page{display:block;padding:0 24px 64px}
        .page.is-filtered .news-section:not(.is-hidden){width:100%;max-width:none}
        .top-line{display:none}
        .news-section{padding:42px 0 54px;border-bottom:0}.editorial-hero{padding-top:28px}
        .news-section h2{font-size:28px}
        .editorial-hero-grid{grid-template-columns:minmax(0,1.92fr) minmax(330px,1fr);height:520px}.hero-main,.hero-thumb{height:520px}.hero-main h2{font-size:44px}.hero-main p{font-size:15px}.hero-content{padding:38px}.hero-rail{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr))}.hero-rail-card{height:auto;aspect-ratio:auto}.hero-rail-card.magazine-card strong{font-size:17px}.hero-rail-content{padding:18px}
        .category-top{grid-template-columns:minmax(0,1.8fr) minmax(310px,1fr);gap:24px}.news-lead .lead-thumb{aspect-ratio:1.58/1}.news-lead.magazine-card strong{font-size:28px}.category-picks{grid-template-columns:1fr;gap:0;border-top:1px solid var(--line)}.category-picks .pick-card{display:grid;grid-template-columns:116px minmax(0,1fr);gap:14px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line)}.category-picks .pick-thumb{aspect-ratio:1.34/1}.category-picks .pick-card strong{margin:0;font-size:15px;-webkit-line-clamp:2}.category-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:26px 20px;margin-top:28px;padding-top:28px}.category-list .news-row{display:block;padding:0;border:0}.category-list .row-thumb{aspect-ratio:1.5/1}.category-list .news-row strong{margin-top:9px;font-size:18px}.category-list .news-row em{margin-top:7px}
        .check-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:0 20px}
        .mrt-ad-section .check-grid,.coupang-ad-section .check-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
        .booking-search{grid-column:auto}
        .booking-launchers{gap:12px}
        .flight-section{display:block}
        .flight-section .flight-lead{padding:16px 0;border-top:1px solid var(--line)}
        .flight-section .news-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0 20px}
        .flight-section .flight-row{border-bottom:1px solid var(--line)}
        .site-footer{display:grid;grid-template-columns:1.1fr repeat(4,minmax(0,.75fr));gap:28px;padding:44px 24px 64px;border-top:1px solid #eee}
      }
      @media(max-width:899px){.site-header{position:relative}.nav-scroll{margin:0 -16px;padding:2px 16px 5px}.editorial-hero{margin-right:-16px;margin-left:-16px;padding-top:18px}.hero-main h2{font-size:28px}.hero-main p{display:none}.hero-rail{padding-top:3px}.news-section{border-bottom:1px solid var(--line)}.section-headline{padding-top:10px}.section-headline h2{font-size:28px}}
      @media(max-width:899px){.site-header{position:sticky}.hero-main .hero-thumb{aspect-ratio:1.5/1}.hero-rail-card{aspect-ratio:1.24/1}}
      @media(max-width:430px){.hero-content{padding:18px}.hero-main h2{font-size:25px}.hero-rail-content{padding:11px}.hero-rail-card strong{font-size:13px}.category-picks{gap:7px}.category-picks .pick-card strong{font-size:12px}.section-headline h2{font-size:26px}}`;

const TEXT = {
  articleFallback: "\uC5EC\uD589 \uAE30\uC0AC",
  infoFallback: "\uC5EC\uD589 \uC815\uBCF4",
  description: `${BRAND}\uB294 8\uC6D4 \uAC00\uBCFC\uB9CC\uD55C \uACF3, \uC774\uBC88 \uC8FC\uB9D0 \uC5EC\uD589, 8\uC6D4 \uCD95\uC81C, \uBB3C\uB180\uC774, \uD574\uC218\uC695\uC7A5, \uC2E4\uB0B4\uC5EC\uD589, \uC544\uC774\uC640 \uAC00\uAE30 \uC88B\uC740 \uACF3, \uC608\uC57D \uC804 \uCCB4\uD06C\uB97C \uC815\uB9AC\uD55C \uC5EC\uD589 \uC815\uBCF4 \uB9E4\uAC70\uC9C4\uC785\uB2C8\uB2E4.`,
  ogTitle: `${BRAND} - \uC5EC\uD589 \uB274\uC2A4 \uD53C\uB4DC`,
  ogDescription: "8\uC6D4 \uAC00\uBCFC\uB9CC\uD55C \uACF3, \uC8FC\uB9D0 \uC5EC\uD589, 8\uC6D4 \uCD95\uC81C, \uBB3C\uB180\uC774, \uD574\uC218\uC695\uC7A5, \uC2E4\uB0B4\uC5EC\uD589, \uC608\uC57D \uC804 \uCCB4\uD06C\uB97C \uB274\uC2A4 \uC139\uC158\uC73C\uB85C \uC815\uB9AC\uD569\uB2C8\uB2E4.",
  rssTitle: `${BRAND} RSS`,
  navLabel: "\uCE74\uD14C\uACE0\uB9AC",
  navAll: "\uC804\uCCB4",
  navPopular: "8\uC6D4 \uAC00\uBCFC\uB9CC\uD55C \uACF3",
  navWeekend: "\uC774\uBC88 \uC8FC\uB9D0 \uAC00\uBCFC\uB9CC\uD55C \uACF3",
  navTravel: "\uAC00\uBCFC\uB9CC\uD55C \uACF3",
  navFestival: "\uCD95\uC81C/\uD589\uC0AC",
  navWater: "\uBB3C\uB180\uC774\u00B7\uACC4\uACE1\u00B7\uD574\uC218\uC695\uC7A5",
  navIndoor: "\uBE44 \uC624\uB294 \uB0A0 \uC2E4\uB0B4 \uC5EC\uD589",
  navFamily: "\uC544\uC774\uC640 \uAC00\uAE30 \uC88B\uC740 \uACF3",
  navFlight: "\uD56D\uACF5\uAD8C \uCD5C\uC800\uAC00 \uC5EC\uD589\uC9C0",
  navCourse: "\uC5EC\uD589\uCF54\uC2A4",
  navActivity: "\uC561\uD2F0\uBE44\uD2F0",
  navBooking: "\uC608\uC57D \uC804 \uCCB4\uD06C",
  navStay: "\uC219\uC18C\u00B7\uC608\uC57D",
  navFood: "\uB9DB\uC9D1\u00B7\uCE74\uD398",
  feedAll: "\uC804\uCCB4 \uAE00",
  feedShowing: "\uBCF4\uAE30",
  feedSelected: "\uC120\uD0DD\uB428",
  footer: "\uC5EC\uD589\uC9C0, \uCD95\uC81C\u00B7\uD589\uC0AC, \uBB3C\uB180\uC774, \uC2E4\uB0B4\uC5EC\uD589, \uC608\uC57D \uC804 \uCCB4\uD06C\uB97C \uC758\uB3C4\uBCC4\uB85C \uBE60\uB974\uAC8C \uD655\uC778\uD558\uB294 \uC5EC\uD589 \uB274\uC2A4 \uD53C\uB4DC\uC785\uB2C8\uB2E4.",
};

const esc = (value = "") =>
  String(value).replace(/[&<>"']/g, (match) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[match]));

const normalize = (value = "") => String(value).trim();

function formatDateInKorea(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
const BEACH_POST_SLUGS = new Set([
  "travel-126078",
  "travel-126302",
  "travel-125711",
  "travel-125713",
  "travel-127722",
  "travel-127764",
  "travel-126098",
  "travel-128767",
  "travel-129255",
  "travel-129256",
  "travel-127698",
  "travel-129400",
]);
const CURRENT_TRAVEL_KEYWORDS = [
  "\uC218\uC601\uC7A5",
  "\uACC4\uACE1",
  "\uD574\uC218\uC695\uC7A5",
  "\uD574\uBCC0",
  "\uBC14\uB2E4",
  "\uBB3C\uB180\uC774",
  "\uC6CC\uD130\uD30C\uD06C",
  "\uD3ED\uD3EC",
  "\uC218\uBCC0",
  "\uAC15",
  "\uD638\uC218",
  "\uC5EC\uB984",
];
const hrefOf = (post) => (post?.slug ? `/${post.slug}/` : "#");
const imageOf = (post) => post?.image || post?.images?.[0] || "";
const titleOf = (post) => normalize(post?.title || post?.sourceTitle || TEXT.articleFallback);
const categoryOf = (post) => normalize(post?.category || TEXT.infoFallback);
const regionOf = (post) => normalize(post?.region || "");
const isFestival = (post) => categoryOf(post) === CAT_FESTIVAL;
const contentTypeOf = (post) => String(post?.tourApi?.contentTypeId || post?.contentTypeId || post?.contenttypeid || "");

function infoValue(post, label) {
  const rows = Array.isArray(post?.info) ? post.info : [];
  const found = rows.find((row) => Array.isArray(row) && normalize(row[0]) === label);
  return normalize(found?.[1] || "");
}

function isoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function extractScheduleDates(value = "") {
  const text = normalize(value);
  const dates = [];
  for (const match of text.matchAll(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/g)) {
    dates.push(isoDate(match[1], match[2], match[3]));
  }
  if (dates.length) return dates;

  const compact = [...text.matchAll(/(\d{4})(\d{2})(\d{2})/g)].map((match) => isoDate(match[1], match[2], match[3]));
  if (compact.length) return compact;

  return [];
}

function festivalSchedule(post) {
  const intro = post?.tourApi?.intro || {};
  const period = infoValue(post, "\uAE30\uAC04");
  const introStart = normalize(intro.eventstartdate || "");
  const introEnd = normalize(intro.eventenddate || "");
  const dates = extractScheduleDates(period || `${introStart} ${introEnd}`);
  const start = dates[0] || "";
  const end = dates[1] || dates[0] || "";
  return { start, end, label: period || [start, end].filter(Boolean).join("~") };
}

function formatIsoDate(value = "") {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return normalize(value);
  return `${match[1]}\uB144 ${Number(match[2])}\uC6D4 ${Number(match[3])}\uC77C`;
}

function festivalDateLabel(post) {
  const schedule = festivalSchedule(post);
  if (schedule.label) return schedule.label;
  if (schedule.start && schedule.end && schedule.start !== schedule.end) return `${formatIsoDate(schedule.start)}~${formatIsoDate(schedule.end)}`;
  return formatIsoDate(schedule.start);
}

function dateOf(post) {
  if (isFestival(post)) return festivalDateLabel(post) || normalize(post?.date || post?.sortDate || "");
  return normalize(post?.date || post?.sortDate || "");
}

function festivalInFeaturedAugust(post) {
  if (!isFestival(post)) return false;
  const { start, end } = festivalSchedule(post);
  if (!start) return false;
  const lastDay = end || start;
  return start <= FEATURE_MONTH_END && lastDay >= FEATURE_MONTH_START && lastDay >= CONTENT_TODAY;
}

function festivalOrder(post) {
  const { start, end } = festivalSchedule(post);
  const lastDay = end || start;
  const ongoingRank = start <= CONTENT_TODAY && lastDay >= CONTENT_TODAY ? "0" : "1";
  return `${ongoingRank}:${ongoingRank === "0" ? lastDay : start}`;
}

function compactRegion(value = "") {
  const text = normalize(value).replace(/\([^)]*\)/g, "");
  if (!text) return REGION_OTHER;
  if (text.includes("\uC11C\uC6B8")) return "\uC11C\uC6B8";
  if (text.includes("\uACBD\uAE30")) return "\uACBD\uAE30";
  if (text.includes("\uC778\uCC9C")) return "\uC778\uCC9C";
  if (text.includes("\uAC15\uC6D0")) return "\uAC15\uC6D0";
  if (text.includes("\uB300\uC804")) return "\uB300\uC804";
  if (text.includes("\uC138\uC885")) return "\uC138\uC885";
  if (text.includes("\uCDA9\uBD81") || text.includes("\uCDA9\uCCAD\uBD81")) return "\uCDA9\uBD81";
  if (text.includes("\uCDA9\uB0A8") || text.includes("\uCDA9\uCCAD\uB0A8")) return "\uCDA9\uB0A8";
  if (text.includes("\uAD11\uC8FC")) return "\uAD11\uC8FC";
  if (text.includes("\uC804\uBD81") || text.includes("\uC804\uB77C\uBD81")) return "\uC804\uBD81";
  if (text.includes("\uC804\uB0A8") || text.includes("\uC804\uB77C\uB0A8")) return "\uC804\uB0A8";
  if (text.includes("\uB300\uAD6C")) return "\uB300\uAD6C";
  if (text.includes("\uBD80\uC0B0")) return "\uBD80\uC0B0";
  if (text.includes("\uC6B8\uC0B0")) return "\uC6B8\uC0B0";
  if (text.includes("\uACBD\uBD81") || text.includes("\uACBD\uC0C1\uBD81")) return "\uACBD\uBD81";
  if (text.includes("\uACBD\uB0A8") || text.includes("\uACBD\uC0C1\uB0A8")) return "\uACBD\uB0A8";
  if (text.includes("\uC81C\uC8FC")) return "\uC81C\uC8FC";
  return text.split(/\s+/).filter(Boolean)[0] || REGION_OTHER;
}

function uniquePosts(posts) {
  const seen = new Set();
  return posts.filter((post) => {
    const key = post?.slug || post?.title;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function fillSection(posts, preferred, count = 10) {
  return uniquePosts([...preferred, ...posts]).slice(0, count);
}

function takePosts(posts, count = 10) {
  return uniquePosts(posts).slice(0, count);
}

function articleImage(post, className) {
  const image = imageOf(post);
  if (!image) return `<span class="${className} no-image"></span>`;
  return `<span class="${className}"><img src="${esc(image)}" alt="${esc(titleOf(post))}" loading="lazy"></span>`;
}

function metaLine(post) {
  return [categoryOf(post), dateOf(post), compactRegion(regionOf(post))].filter(Boolean).join(" \u00B7 ");
}

function productRegionOf(product) {
  return compactRegion(product?.region || product?.city || product?.location || "");
}

function productMeta(product) {
  return [productRegionOf(product), product.category || product.type, product.priceText || product.price].filter(Boolean).join(" \u00B7 ");
}

function externalAttrs(url = "") {
  return ' rel="sponsored noopener"';
}

function productCard(product) {
  const imageUrl = affiliateProductImage(product);
  const image = imageUrl ? `<span class="booking-thumb"><img src="${esc(imageUrl)}" alt="${esc(product.title)}" loading="lazy"></span>` : "";
  const className = `check-card product-card${image ? "" : " no-thumb"}`;
  return `<a class="${className}" href="${esc(product.url)}" data-affiliate-match="context"${externalAttrs(product.url)}>
    ${image}
    <small class="affiliate-match">제휴 · ${esc(product.matchReason || "숙소·투어 상품")}</small>
    <strong>${esc(product.title)}</strong>
    <span>${esc(productMeta(product) || "\uC5EC\uD589 \uC804 \uC608\uC57D \uC815\uBCF4")}</span>
  </a>`;
}

function flightSlug(deal) {
  return String(deal?.id || deal?.title || "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "") || "flight-deal";
}

function flightHref(deal) {
  return `/flight-deals/${encodeURIComponent(flightSlug(deal))}/`;
}

function flightBookingHref(deal) {
  return deal?.bookingUrl || "https://flights.myrealtrip.com/";
}

function flightMeta(deal) {
  return [
    deal?.priceText ? `최저가 ${deal.priceText}` : "",
    deal?.departureDate ? `출발 ${formatIsoDate(deal.departureDate)}` : "",
    deal?.period ? `${deal.period}일 일정` : "",
  ].filter(Boolean).join(" · ");
}

function flightDealSection(flights = []) {
  const deals = [...flights]
    .filter((deal) => deal?.title && deal?.price)
    .sort((a, b) => Number(a.price || 0) - Number(b.price || 0))
    .slice(0, 8);
  if (!deals.length) return "";

  const lead = deals[0];
  const rows = deals.slice(1).map((deal) => `<a class="news-row flight-row" href="${esc(flightHref(deal))}">
    <span><strong>${esc(deal.title)}</strong><em>${esc(flightMeta(deal))}</em></span>
  </a>`).join("");

  return `<section class="news-section flight-section" id="flight-deals" aria-labelledby="flight-deals-title" data-headline="${esc(TEXT.navFlight)}">
    <h2 id="flight-deals-title">${esc(TEXT.navFlight)}</h2>
    <a class="news-lead flight-lead" href="${esc(flightHref(lead))}">
      <strong>${esc(lead.title)}</strong>
      <span>${esc(flightMeta(lead))}</span>
    </a>
    <div class="news-list">${rows}</div>
  </section>`;
}

function flightAdCard(deal) {
  return `<a class="check-card product-card no-thumb mrt-flight-card" href="${esc(flightBookingHref(deal))}" rel="sponsored noopener">
    <strong>${esc(deal.title)}</strong>
    <span>${esc(flightMeta(deal) || TEXT.navFlight)}</span>
  </a>`;
}

function myRealTripAdSection(products = []) {
  const cards = products.filter(Boolean).map(productCard).join("");

  if (!cards) return "";
  const title = "여행지별 숙소·투어";
  return `<section class="news-section check-section mrt-ad-section" id="myrealtrip-deals" aria-labelledby="myrealtrip-deals-title" data-headline="${title}">
    <h2 id="myrealtrip-deals-title">${title}</h2>
    <p class="affiliate-disclosure">\uC77C\uBD80 \uB9C1\uD06C\uB97C \uD1B5\uD574 \uC608\uC57D\uD558\uBA74 \uC0AC\uC774\uD2B8 \uC6B4\uC601\uC790\uAC00 \uC218\uC218\uB8CC\uB97C \uC81C\uACF5\uBC1B\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uAC00\uACA9\uACFC \uC608\uC57D \uC870\uAC74\uC740 \uC608\uC57D\uCC98\uC5D0\uC11C \uCD5C\uC885 \uD655\uC778\uD558\uC138\uC694.</p>
    <div class="check-grid">${cards}</div>
  </section>`;
}

function bookingSearch() {
  return `<div class="booking-search" aria-label="예약 상품 검색">
    <div class="booking-launchers" aria-label="예약 검색 선택">
      <button type="button" class="booking-launcher" data-open-booking="accommodation" onclick="window.tripviewOpenBooking && window.tripviewOpenBooking('accommodation')">
        <span>국내숙소</span>
        <strong>여행지·숙소 검색</strong>
        <em>체크인, 인원, 지역으로 찾기</em>
      </button>
      <button type="button" class="booking-launcher" data-open-booking="tna" onclick="window.tripviewOpenBooking && window.tripviewOpenBooking('tna')">
        <span>투어·티켓</span>
        <strong>입장권·액티비티 검색</strong>
        <em>지역 키워드와 인기순으로 찾기</em>
      </button>
      <button type="button" class="booking-launcher" data-open-booking="flight" onclick="window.tripviewOpenBooking && window.tripviewOpenBooking('flight')">
        <span>항공권</span>
        <strong>출발지별 최저가 보기</strong>
        <em>3~7일 왕복 최저가 여행지</em>
      </button>
    </div>
    <div class="booking-results" data-booking-results aria-live="polite" hidden></div>
    <div class="booking-sheet-backdrop" data-booking-backdrop hidden></div>
    <section class="booking-sheet" data-booking-sheet="accommodation" role="dialog" aria-modal="true" aria-labelledby="booking-accommodation-title" hidden>
      <div class="sheet-handle" aria-hidden="true"></div>
      <div class="sheet-head">
        <h3 id="booking-accommodation-title">여행지나 숙소 검색</h3>
        <button type="button" data-booking-close aria-label="닫기" onclick="window.tripviewCloseBooking && window.tripviewCloseBooking()">×</button>
      </div>
      <form class="booking-search-card" data-booking-search="accommodation" onsubmit="return window.tripviewSubmitBooking ? window.tripviewSubmitBooking(event) : true">
        <label>검색어 <input name="keyword" type="search" value="제주" placeholder="여행지나 숙소명 검색" autocomplete="off"></label>
        <div class="booking-fields">
          <label>체크인 <input name="checkIn" type="date"></label>
          <label>체크아웃 <input name="checkOut" type="date"></label>
        </div>
        <label>인원 <input name="adultCount" type="number" min="1" max="9" value="2"></label>
        <div class="booking-chip-group" aria-label="인기 지역">
          <b>인기 지역</b>
          <div class="booking-chip-row">
            ${["제주", "강릉", "서울", "부산", "경주", "전주", "여수", "속초"].map((keyword) => `<button type="button" class="booking-chip" data-booking-preset data-field="keyword" data-value="${esc(keyword)}" onclick="window.tripviewPresetBooking && window.tripviewPresetBooking(this)">${esc(keyword)}</button>`).join("")}
          </div>
        </div>
        <button type="submit">숙소 검색</button>
      </form>
    </section>
    <section class="booking-sheet" data-booking-sheet="tna" role="dialog" aria-modal="true" aria-labelledby="booking-tna-title" hidden>
      <div class="sheet-handle" aria-hidden="true"></div>
      <div class="sheet-head">
        <h3 id="booking-tna-title">투어·티켓 검색</h3>
        <button type="button" data-booking-close aria-label="닫기" onclick="window.tripviewCloseBooking && window.tripviewCloseBooking()">×</button>
      </div>
      <form class="booking-search-card" data-booking-search="tna" onsubmit="return window.tripviewSubmitBooking ? window.tripviewSubmitBooking(event) : true">
        <label>검색어 <input name="keyword" type="search" value="서울 투어" placeholder="서울 뷰티, 제주 투어, 오사카 입장권" autocomplete="off"></label>
        <label>정렬
          <select name="sort">
            <option value="selling_count_desc">판매 많은순</option>
            <option value="review_score_desc">리뷰 높은순</option>
            <option value="price_asc">가격 낮은순</option>
            <option value="price_desc">가격 높은순</option>
          </select>
        </label>
        <div class="booking-chip-group" aria-label="추천 키워드">
          <b>추천 키워드</b>
          <div class="booking-chip-row">
            ${["서울 뷰티", "서울 키즈", "제주 투어", "부산 요트", "오사카 입장권", "클래스", "액티비티"].map((keyword) => `<button type="button" class="booking-chip" data-booking-preset data-field="keyword" data-value="${esc(keyword)}" onclick="window.tripviewPresetBooking && window.tripviewPresetBooking(this)">${esc(keyword)}</button>`).join("")}
          </div>
        </div>
        <button type="submit">투어·티켓 검색</button>
      </form>
    </section>
    <section class="booking-sheet" data-booking-sheet="flight" role="dialog" aria-modal="true" aria-labelledby="booking-flight-title" hidden>
      <div class="sheet-handle" aria-hidden="true"></div>
      <div class="sheet-head">
        <h3 id="booking-flight-title">출발지별 항공권 최저가</h3>
        <button type="button" data-booking-close aria-label="닫기" onclick="window.tripviewCloseBooking && window.tripviewCloseBooking()">×</button>
      </div>
      <form class="booking-search-card" data-booking-search="flight" onsubmit="return window.tripviewSubmitBooking ? window.tripviewSubmitBooking(event) : true">
        <label>출발지 <input name="departure" type="search" value="ICN" placeholder="ICN, 서울, 김포, 부산" autocomplete="off"></label>
        <label>여행 기간
          <select name="period">
            <option value="3">왕복 3일</option>
            <option value="4">왕복 4일</option>
            <option value="5" selected>왕복 5일</option>
            <option value="6">왕복 6일</option>
            <option value="7">왕복 7일</option>
          </select>
        </label>
        <div class="booking-chip-group" aria-label="국내 출발지">
          <b>국내 출발지</b>
          <div class="booking-chip-row">
            ${[
              ["ICN", "인천"],
              ["GMP", "김포"],
              ["CJU", "제주"],
              ["PUS", "부산"],
              ["CJJ", "청주"],
            ].map(([value, label]) => `<button type="button" class="booking-chip" data-booking-preset data-field="departure" data-value="${esc(value)}" onclick="window.tripviewPresetBooking && window.tripviewPresetBooking(this)">${esc(label)}</button>`).join("")}
          </div>
        </div>
        <button type="submit">최저가 여행지 검색</button>
      </form>
    </section>
  </div>`;
}

function affiliateProductKey(product = {}) {
  return `${product.source || ""}:${product.url || ""}:${product.title || ""}`;
}

function unusedAffiliateProducts({ sectionId, posts, products, used, limit }) {
  const candidates = selectAffiliateProducts({ sectionId, posts, products, limit: 12 });
  const picked = [];
  for (const product of candidates) {
    const key = affiliateProductKey(product);
    if (!key || used.has(key)) continue;
    used.add(key);
    picked.push(product);
    if (picked.length >= limit) break;
  }
  return picked;
}

function interleaveListItems(posts, products = []) {
  const rows = [];
  posts.forEach((post, index) => {
    rows.push(listItem(post));
    if (index === 1 && products[0]) rows.push(productCard(products[0]));
  });
  return rows.join("");
}

function leadArticle(post) {
  if (!post) return "";
  const summary = summaryOf(post);
  const region = compactRegion(regionOf(post));
  return `<a class="news-lead magazine-card" href="${esc(hrefOf(post))}">
    ${articleImage(post, "lead-thumb")}
    <span class="story-label">${esc([categoryOf(post), region].filter(Boolean).join(" · "))}</span>
    <strong>${esc(titleOf(post))}</strong>
    ${summary ? `<em class="story-summary">${esc(summary)}</em>` : ""}
  </a>`;
}

function pickCard(post) {
  return `<a class="pick-card magazine-card" href="${esc(hrefOf(post))}">
    ${articleImage(post, "pick-thumb")}
    <strong>${esc(titleOf(post))}</strong>
  </a>`;
}

function listItem(post) {
  return `<a class="news-row magazine-card" href="${esc(hrefOf(post))}">
    ${articleImage(post, "row-thumb")}
    <span><strong>${esc(titleOf(post))}</strong><em>${esc(metaLine(post))}</em></span>
  </a>`;
}

function summaryOf(post) {
  const value = normalize(post?.excerpt || post?.description || (Array.isArray(post?.memo) ? post.memo[0] : ""));
  return value.length > 112 ? `${value.slice(0, 112)}...` : value;
}

function sectionKicker(id) {
  return ({
    popular: "PLACES",
    weekend: "LATEST",
    festival: "FESTIVAL",
    water: "WATER",
    indoor: "INDOOR",
    family: "FAMILY",
    booking: "BOOKING",
    "flight-deals": "AIRFARE",
    "myrealtrip-deals": "BOOKING",
    "coupang-travel-items": "READY",
  }[id] || "TRAVEL");
}

function searchableText(post) {
  return [
    titleOf(post),
    post?.sourceTitle,
    post?.description,
    post?.excerpt,
    ...(Array.isArray(post?.memo) ? post.memo : []),
    ...(Array.isArray(post?.info) ? post.info.flat() : []),
  ].filter(Boolean).join(" ");
}

function currentKeywordScore(post) {
  const text = searchableText(post);
  return CURRENT_TRAVEL_KEYWORDS.reduce((score, keyword) => (
    text.includes(keyword) ? score + 1 : score
  ), 0);
}

function sortCurrentPlaces(posts) {
  return [...posts].sort((a, b) => {
    const scoreDiff = currentKeywordScore(b) - currentKeywordScore(a);
    if (scoreDiff) return scoreDiff;
    return String(b.sortDate || "").localeCompare(String(a.sortDate || ""));
  });
}

function hasAnyKeyword(post, keywords) {
  const text = searchableText(post);
  return keywords.some((keyword) => text.includes(keyword));
}

function sortLatest(posts) {
  return [...posts].sort((a, b) => String(b.sortDate || "").localeCompare(String(a.sortDate || "")));
}

function takeFresh(posts, used, count = 10) {
  const items = [];
  for (const post of uniquePosts(posts)) {
    const key = post?.slug || post?.title;
    if (!key || used.has(key)) continue;
    used.add(key);
    items.push(post);
    if (items.length >= count) break;
  }
  return items;
}

function newsSection({ id, title, posts, inlineProducts = [] }) {
  const count = id === "popular" ? 9 : id === "water" ? 12 : 6;
  const items = uniquePosts(posts).slice(0, count);
  if (!items.length) return "";
  return `<section class="news-section" id="${esc(id)}" aria-labelledby="${esc(id)}-title" data-headline="${esc(title)}">
    <div class="section-headline">
      <div><span class="section-kicker">${esc(sectionKicker(id))}</span><h2 id="${esc(id)}-title">${esc(title)}</h2></div>
      <a class="section-more" href="#${esc(id)}" data-filter="${esc(id)}">\uB354\uBCF4\uAE30 +</a>
    </div>
    <div class="category-top">
      ${leadArticle(items[0])}
      <div class="category-picks">${items.slice(1, 4).map(pickCard).join("")}</div>
    </div>
    ${items.length > 4 ? `<div class="news-list category-list">${interleaveListItems(items.slice(4), inlineProducts)}</div>` : ""}
  </section>`;
}

function heroSection({ id, title, posts }) {
  const items = uniquePosts(posts).slice(0, 5);
  const lead = items[0];
  if (!lead) return "";
  const summary = summaryOf(lead);
  const leadRegion = compactRegion(regionOf(lead));
  return `<section class="news-section editorial-hero" id="${esc(id)}" aria-labelledby="${esc(id)}-title" data-headline="${esc(title)}">
    <div class="editorial-hero-grid">
      <a class="hero-main magazine-card" href="${esc(hrefOf(lead))}">
        ${articleImage(lead, "hero-thumb")}
        <span class="hero-content">
          <span class="hero-label">${esc([FEATURE_MONTH_LABEL, leadRegion || categoryOf(lead)].filter(Boolean).join(" · "))}</span>
          <h2 id="${esc(id)}-title">${esc(titleOf(lead))}</h2>
          ${summary ? `<p>${esc(summary)}</p>` : ""}
        </span>
      </a>
      <div class="hero-rail" aria-label="${esc(title)} \uCD94\uCC9C \uAE00">
        ${items.slice(1).map((post) => `<a class="hero-rail-card magazine-card" href="${esc(hrefOf(post))}">
          ${articleImage(post, "hero-thumb")}
          <span class="hero-rail-content"><span class="hero-label">${esc(compactRegion(regionOf(post)) || categoryOf(post))}</span><strong>${esc(titleOf(post))}</strong></span>
        </a>`).join("")}
      </div>
    </div>
  </section>`;
}

function bookingSection({ id, title, affiliateProducts = [] }) {
  const productCards = affiliateProducts.map(productCard).join("");
  return `<section class="news-section check-section" id="${esc(id)}" aria-labelledby="${esc(id)}-title" data-headline="${esc(title)}">
    <h2 id="${esc(id)}-title">${esc(title)}</h2>
    ${bookingSearch()}
    ${productCards ? `<div class="check-grid">${productCards}</div>` : ""}
  </section>`;
}

function buildSections(posts) {
  const domestic = posts.filter((post) => categoryOf(post) === CAT_DOMESTIC && !isFestival(post));
  const festivals = posts
    .filter(festivalInFeaturedAugust)
    .sort((a, b) => festivalOrder(a).localeCompare(festivalOrder(b)));
  const waterKeywords = ["\uC218\uC601\uC7A5", "\uACC4\uACE1", "\uD574\uC218\uC695\uC7A5", "\uD574\uBCC0", "\uBC14\uB2E4", "\uBB3C\uB180\uC774", "\uC6CC\uD130\uD30C\uD06C", "\uD3ED\uD3EC", "\uC218\uBCC0"];
  const indoorKeywords = ["\uBC15\uBB3C\uAD00", "\uBBF8\uC220\uAD00", "\uC804\uC2DC", "\uBB38\uD654", "\uC13C\uD130", "\uC544\uD2B8", "\uACF5\uC5F0\uC7A5"];
  const familyKeywords = ["\uC544\uC774", "\uAC00\uC871", "\uC5B4\uB9B0\uC774", "\uCCB4\uD5D8", "\uACF5\uC6D0", "\uC0DD\uD0DC", "\uB3D9\uBB3C", "\uB18D\uCD0C", "\uC790\uC5F0\uD559\uC2B5"];
  const bookingKeywords = ["\uC219\uC18C", "\uD638\uD154", "\uC608\uC57D", "\uD22C\uC5B4", "\uC785\uC7A5\uAD8C", "\uD560\uC778", "\uC2DD\uB2F9", "\uB9DB\uC9D1", "\uCE74\uD398", "\uC1FC\uD551"];

  const byType = (typeId) => posts.filter((post) => contentTypeOf(post) === typeId);
  const used = new Set();
  const beachPool = domestic.filter((post) => BEACH_POST_SLUGS.has(post.slug));
  const waterPool = domestic.filter((post) => !BEACH_POST_SLUGS.has(post.slug) && hasAnyKeyword(post, waterKeywords));
  const valleyPool = waterPool.filter((post) => hasAnyKeyword(post, ["계곡", "폭포"]));
  const indoorPool = sortLatest([...byType("14"), ...domestic.filter((post) => hasAnyKeyword(post, indoorKeywords))]);
  const familyPool = sortLatest(posts.filter((post) => !isFestival(post) && hasAnyKeyword(post, familyKeywords)));
  const bookingPool = sortLatest([
    ...byType("32"),
    ...byType("38"),
    ...byType("39"),
    ...posts.filter((post) => hasAnyKeyword(post, bookingKeywords)),
  ]);
  const weekendPool = [...byType("12"), ...byType("25"), ...byType("28"), ...domestic]
    .filter((post) => !hasAnyKeyword(post, waterKeywords));
  const nonBeachWaterPool = uniquePosts([...valleyPool, ...waterPool]);
  const waterPosts = [
    ...sortCurrentPlaces(beachPool).slice(0, 6),
    ...sortCurrentPlaces(nonBeachWaterPool).slice(0, 6),
    ...sortCurrentPlaces(beachPool).slice(6),
    ...sortCurrentPlaces(nonBeachWaterPool).slice(6),
  ];
  const generalTravel = domestic.filter((post) => (
    !hasAnyKeyword(post, waterKeywords) &&
    !hasAnyKeyword(post, indoorKeywords) &&
    !hasAnyKeyword(post, familyKeywords)
  ));
  const reviewedTopic = (topic, fallback) => {
    const curated = posts.filter((post) => Array.isArray(post.editorialTopics) && post.editorialTopics.includes(topic));
    return curated.length ? curated : fallback;
  };
  const sectionDefs = [
    { id: "popular", title: TEXT.navPopular, posts: reviewedTopic("popular", sortCurrentPlaces(generalTravel.length ? generalTravel : domestic)) },
    { id: "weekend", title: TEXT.navWeekend, posts: reviewedTopic("weekend", sortLatest(weekendPool.length ? weekendPool : domestic)) },
    { id: "festival", title: `${FEATURE_MONTH_LABEL} \uCD95\uC81C/\uD589\uC0AC`, posts: reviewedTopic("festival", festivals) },
    { id: "water", title: TEXT.navWater, posts: reviewedTopic("water", waterPosts) },
    { id: "indoor", title: TEXT.navIndoor, posts: reviewedTopic("indoor", indoorPool.length ? indoorPool : sortLatest(domestic)), fallbackPosts: sortLatest(domestic) },
    { id: "family", title: TEXT.navFamily, posts: reviewedTopic("family", familyPool.length ? familyPool : sortLatest(domestic)), fallbackPosts: sortLatest(domestic) },
    { id: "booking", title: TEXT.navBooking, kind: "booking", posts: bookingPool },
  ];

  return sectionDefs
    .map((section) => {
      if (section.kind === "booking") return { ...section, posts: takePosts(section.posts, 4) };
      const freshPosts = takeFresh(section.posts, used, section.id === "water" ? 12 : 10);
      return freshPosts.length ? { ...section, posts: freshPosts } : { ...section, posts: takePosts(section.fallbackPosts || [], 10) };
    })
    .filter((section) => section.kind === "booking" || section.posts.length);
}

function categoryNav(sections) {
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const primaryItems = [
    ["popular", TEXT.navPopular],
    ["water", "\uBB3C\uB180\uC774\u00B7\uACC4\uACE1"],
    ["weekend", "\uC774\uBC88 \uC8FC\uB9D0"],
    ["festival", `${FEATURE_MONTH_LABEL} \uCD95\uC81C`],
    ["indoor", "\uC2E4\uB0B4\uC5EC\uD589"],
    ["family", "\uC544\uC774\uC640"],
    ["booking", "\uC608\uC57D \uC804 \uCCB4\uD06C"],
    ["flight-deals", "\uD56D\uACF5\uAD8C"],
  ].filter(([id]) => sectionById.has(id));
  return [
    `<a class="is-active" href="#all" data-filter="all">\uD648</a>`,
    ...primaryItems.map(([id, label]) => `<a href="#${esc(id)}" data-filter="${esc(id)}">${esc(label)}</a>`),
  ].join("");
}

async function readMyRealTripProducts() {
  try {
    const products = JSON.parse(await fs.readFile(MYREALTRIP_PRODUCTS_PATH, "utf8"));
    return Array.isArray(products) ? products : [];
  } catch {
    return [];
  }
}

async function readMyRealTripAccommodations() {
  try {
    const accommodations = JSON.parse(await fs.readFile(MYREALTRIP_ACCOMMODATIONS_PATH, "utf8"));
    return Array.isArray(accommodations) ? accommodations : [];
  } catch {
    return [];
  }
}

async function readMyRealTripTnaProducts() {
  try {
    const products = JSON.parse(await fs.readFile(MYREALTRIP_TNA_PATH, "utf8"));
    return Array.isArray(products) ? products : [];
  } catch {
    return [];
  }
}

async function readMyRealTripFlights() {
  try {
    const flights = JSON.parse(await fs.readFile(MYREALTRIP_FLIGHTS_PATH, "utf8"));
    return Array.isArray(flights) ? flights : [];
  } catch {
    return [];
  }
}

function html(posts, products = [], accommodations = [], tnaProducts = [], flights = []) {
  const sections = buildSections(posts).filter((section) => section.kind === "booking" || section.posts.length);
  const hero = posts[0];
  const ogImage = imageOf(hero);
  const allProducts = [...accommodations, ...tnaProducts, ...products];
  const editorialSections = sections.filter((section) => section.kind !== "booking");
  const editorialPosts = editorialSections.flatMap((section) => section.posts || []);
  const usedAffiliateProducts = new Set();

  const bookingAffiliateProducts = [];
  const mrtProducts = unusedAffiliateProducts({
    sectionId: "booking",
    posts: editorialPosts,
    products: allProducts,
    used: usedAffiliateProducts,
    limit: 2,
  });
  const mrtHtml = myRealTripAdSection(mrtProducts);
  const mrtNav = mrtHtml ? { id: "myrealtrip-deals", title: "숙소·투어", kind: "ad" } : null;
  const navSections = [...sections.slice(0, -1), mrtNav, sections.at(-1)].filter(Boolean);
  const sectionHtml = sections
    .map((section) => {
      const html = section.kind === "booking"
        ? bookingSection({ ...section, affiliateProducts: bookingAffiliateProducts })
        : section.id === "popular"
          ? heroSection(section)
        : newsSection({ ...section, inlineProducts: [] });
      return html;
    })
    .join("\n")
    .replace(/(<section class="news-section check-section" id="booking")/, `${mrtHtml}\n$1`);

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta name="naver-site-verification" content="38616b4b4209994ed384d0d2439bddcbec2cc711">
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5751319666030430" crossorigin="anonymous"></script>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${esc(TEXT.description)}">
    <meta name="theme-color" content="#ffffff">
    <meta property="og:title" content="${esc(TEXT.ogTitle)}">
    <meta property="og:description" content="${esc(TEXT.ogDescription)}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://tripview.kr/">
    ${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : ""}
    <meta name="twitter:card" content="summary_large_image">
    <link rel="canonical" href="https://tripview.kr/">
    <link rel="alternate" type="application/rss+xml" title="${esc(TEXT.rssTitle)}" href="https://tripview.kr/rss.xml">
    <title>${esc(TEXT.ogTitle)}</title>
    <style>
      :root{--ink:#111;--muted:#777;--line:#e2e2e2;--paper:#fff;--soft:#f5f5f5}*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:128px}body{margin:0;background:var(--paper);color:var(--ink);font-family:Arial,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;letter-spacing:0;line-height:1.45}a{color:inherit;text-decoration:none}img{display:block;width:100%;height:100%;object-fit:cover;background:var(--soft)}.site-header{position:sticky;top:0;z-index:10;background:rgba(255,255,255,.96);border-bottom:1px solid var(--line);backdrop-filter:blur(12px)}.header-inner{max-width:720px;margin:0 auto;padding:15px 16px 10px}.brand{display:block;margin-bottom:12px;font-size:28px;font-weight:900;line-height:1}.nav-scroll{display:flex;gap:18px;overflow-x:auto;padding-bottom:4px;white-space:nowrap;font-size:15px;font-weight:800}.nav-scroll a{display:block;padding:2px 0;border-bottom:2px solid transparent}.nav-scroll a.is-active{border-bottom-color:#111}.nav-scroll::-webkit-scrollbar,.pick-grid::-webkit-scrollbar{display:none}.page{max-width:720px;margin:0 auto;padding:10px 16px 40px}.top-line{display:flex;align-items:center;justify-content:space-between;padding:10px 0 18px;color:var(--muted);font-size:13px;border-bottom:1px solid var(--line)}.top-line b{color:var(--ink)}.news-section{padding:28px 0 34px;border-bottom:8px solid #f2f2f2;scroll-margin-top:128px}.news-section.is-hidden{display:none}.news-section h2{margin:0 0 16px;font-size:31px;line-height:1.05;font-weight:900;letter-spacing:-.01em}.news-lead{display:block}.lead-thumb{display:block;width:100%;aspect-ratio:1.78/1;overflow:hidden;background:var(--soft)}.news-lead strong{display:block;margin-top:12px;font-size:24px;line-height:1.22;font-weight:900}.news-lead span{display:block;margin-top:7px;color:var(--muted);font-size:13px}.pick-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:20px}.pick-card{min-width:0}.pick-thumb{display:block;aspect-ratio:1.2/1;overflow:hidden;background:var(--soft)}.pick-card strong{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-top:7px;font-size:13px;line-height:1.34;font-weight:800}.news-list{margin-top:22px;border-top:1px solid var(--line)}.news-row{display:grid;grid-template-columns:92px minmax(0,1fr);gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line)}.row-thumb{display:block;aspect-ratio:1.28/1;overflow:hidden;background:var(--soft)}.news-row strong{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:17px;line-height:1.35;font-weight:900}.news-row em{display:block;margin-top:5px;color:var(--muted);font-size:12px;font-style:normal}.check-grid{display:grid;grid-template-columns:1fr;gap:0;border-top:1px solid var(--line)}.booking-group{margin-top:22px}.booking-group h3{margin:0 0 8px;font-size:20px;line-height:1.2;font-weight:900}.booking-group:first-of-type{margin-top:0}.check-card{display:block;padding:15px 0;border-bottom:1px solid var(--line)}.check-card strong{display:block;font-size:18px;line-height:1.32;font-weight:900}.check-card span{display:block;margin-top:6px;color:var(--muted);font-size:13px;line-height:1.55}.product-card{display:grid;grid-template-columns:84px minmax(0,1fr);gap:8px 12px;align-items:center}.product-card .affiliate-match,.product-card strong,.product-card span{grid-column:2}.product-card .affiliate-match{display:block;color:#555;font-size:10px;font-weight:900;line-height:1.35}.product-card.no-thumb{grid-template-columns:1fr}.product-card.no-thumb .affiliate-match,.product-card.no-thumb strong,.product-card.no-thumb span{grid-column:1}.booking-thumb{grid-row:1/4;display:block;aspect-ratio:1.28/1;overflow:hidden;background:var(--soft)}.no-image{background:linear-gradient(135deg,#f1f1f1,#dedede)}.affiliate-disclosure{margin:-6px 0 14px;color:var(--muted);font-size:12px;line-height:1.55}.coupang-ad-section .booking-status{grid-column:1/-1}.coupang-card strong{font-size:16px}.booking-search{margin:0 0 24px;border-top:2px solid var(--ink);border-bottom:1px solid var(--line)}.booking-search-card{display:grid;gap:9px;padding:14px 0;border-bottom:1px solid var(--line)}.booking-search-card strong{font-size:18px;font-weight:900}.booking-search-card label{display:grid;gap:5px;color:var(--muted);font-size:12px;font-weight:800}.booking-search-card input,.booking-search-card select{width:100%;border:1px solid var(--line);border-radius:0;background:#fff;color:var(--ink);padding:10px 11px;font:inherit;font-size:14px}.booking-search-card button{border:0;background:var(--ink);color:#fff;padding:11px 12px;font:inherit;font-weight:900;cursor:pointer}.booking-fields{display:grid;grid-template-columns:1fr 1fr;gap:8px}.booking-results{display:grid;grid-template-columns:1fr;gap:0}.booking-results[hidden]{display:none}.booking-status{padding:13px 0;color:var(--muted);font-size:13px;border-bottom:1px solid var(--line)}.site-footer{max-width:720px;margin:0 auto;padding:28px 16px 44px;color:var(--muted);font-size:13px}.site-footer strong{display:block;color:var(--ink);font-size:20px;margin-bottom:6px}@media(min-width:760px){.header-inner,.page,.site-footer{max-width:1040px}.page{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 36px}.page.is-filtered .news-section:not(.is-hidden){grid-column:1/-1;width:100%;max-width:720px;justify-self:center}.top-line{grid-column:1/-1}.news-section{border-bottom:1px solid var(--line)}.news-section h2{font-size:34px}.check-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:0 18px}.booking-search{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 18px}.booking-search-card{border-bottom:0}.booking-results{grid-column:1/-1;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 18px;border-top:1px solid var(--line)}}@media(max-width:360px){.news-section h2{font-size:28px}.news-lead strong{font-size:21px}.news-row{grid-template-columns:82px minmax(0,1fr)}.pick-grid{gap:7px}.pick-card strong{font-size:12px}.product-card{grid-template-columns:76px minmax(0,1fr)}.product-card.no-thumb{grid-template-columns:1fr}.booking-fields{grid-template-columns:1fr}}
      .booking-search{position:relative;display:block;margin:0 0 24px;padding:16px 0 22px;border-top:2px solid var(--ink);border-bottom:1px solid var(--line)}.booking-launchers{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.booking-launcher{min-width:0;border:1px solid var(--line);border-radius:14px;background:#fff;color:var(--ink);padding:13px 10px;text-align:left;font:inherit;cursor:pointer}.booking-launcher span{display:block;color:var(--muted);font-size:11px;font-weight:900}.booking-launcher strong{display:block;margin-top:5px;font-size:15px;line-height:1.25;font-weight:900}.booking-launcher em{display:block;margin-top:5px;color:var(--muted);font-size:11px;line-height:1.35;font-style:normal}.booking-launcher:focus-visible,.booking-chip:focus-visible,.sheet-head button:focus-visible{outline:2px solid #111;outline-offset:2px}.booking-sheet-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.42);z-index:40}.booking-sheet-backdrop[hidden],.booking-sheet[hidden]{display:none}.booking-sheet{position:fixed;left:50%;bottom:0;z-index:41;width:min(100%,620px);max-height:88vh;overflow:auto;transform:translateX(-50%);border-radius:18px 18px 0 0;background:#fff;padding:10px 24px 26px;box-shadow:0 -18px 50px rgba(0,0,0,.2)}body.booking-sheet-open{overflow:hidden}.sheet-handle{width:58px;height:4px;border-radius:999px;background:#d5d5d5;margin:0 auto 18px}.sheet-head{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:18px}.sheet-head h3{margin:0;font-size:24px;line-height:1.2;font-weight:900}.sheet-head button{border:0;background:transparent;color:#222;font-size:34px;line-height:1;cursor:pointer}.booking-search-card{display:grid;gap:12px;padding:0;border:0}.booking-search-card label{display:grid;gap:7px;color:var(--muted);font-size:12px;font-weight:900}.booking-search-card input,.booking-search-card select{width:100%;border:1px solid var(--line);border-radius:14px;background:#f7f7f7;color:var(--ink);padding:14px 15px;font:inherit;font-size:16px}.booking-search-card input:focus,.booking-search-card select:focus{outline:2px solid #111;background:#fff}.booking-search-card button[type="submit"]{border:0;border-radius:12px;background:#111;color:#fff;padding:15px;font:inherit;font-weight:900;cursor:pointer}.booking-fields{display:grid;grid-template-columns:1fr 1fr;gap:8px}.booking-chip-group{display:grid;gap:10px;margin:7px 0}.booking-chip-group b{font-size:16px}.booking-chip-row{display:flex;flex-wrap:wrap;gap:9px}.booking-chip{border:1px solid var(--line);border-radius:999px;background:#fff;color:#222;padding:10px 16px;font:inherit;font-size:14px;font-weight:800;cursor:pointer}.booking-chip.is-selected{border-color:#111;background:#111;color:#fff}.booking-results{display:grid;grid-template-columns:1fr;gap:0;margin-top:18px;border-top:1px solid var(--line)}.booking-results[hidden]{display:none}.booking-results-title{grid-column:1/-1;margin:0;padding:16px 0 4px;font-size:20px;font-weight:900}.booking-status{grid-column:1/-1;padding:13px 0;color:var(--muted);font-size:13px;border-bottom:1px solid var(--line)}.language-switch{display:flex;align-items:center;gap:8px;white-space:nowrap}.language-switch a{font-size:12px;font-weight:900;color:#555;border-bottom:1px solid transparent;padding:2px 0}.language-switch a.is-active{color:#111;border-bottom-color:#111}.flight-section .flight-lead{padding:0 0 18px;border-bottom:1px solid var(--line)}.flight-section .flight-lead strong{margin-top:0;font-size:22px}.flight-section .news-list{margin-top:0}.flight-section .flight-row{grid-template-columns:1fr;padding:15px 0}.flight-section .flight-row span{min-width:0}.news-lead img,.pick-card img,.news-row img{transition:transform .42s ease,filter .28s ease}.news-lead:hover img,.news-lead:focus-visible img,.pick-card:hover img,.pick-card:focus-visible img,.news-row:hover img,.news-row:focus-visible img{transform:scale(1.04)}.news-lead.is-opening img,.pick-card.is-opening img,.news-row.is-opening img{transform:scale(1.12);filter:brightness(.92)}.news-lead.is-opening,.pick-card.is-opening,.news-row.is-opening{pointer-events:none}@media(prefers-reduced-motion:reduce){.news-lead img,.pick-card img,.news-row img{transition:none}.news-lead:hover img,.news-lead:focus-visible img,.pick-card:hover img,.pick-card:focus-visible img,.news-row:hover img,.news-row:focus-visible img,.news-lead.is-opening img,.pick-card.is-opening img,.news-row.is-opening img{transform:none;filter:none}}@media(min-width:760px){.booking-search{grid-column:1/-1;display:block}.booking-launchers{grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.booking-launcher{padding:16px}.booking-launcher strong{font-size:18px}.booking-results{grid-template-columns:repeat(2,minmax(0,1fr));gap:0 18px}.booking-sheet{top:50%;bottom:auto;max-height:min(720px,86vh);transform:translate(-50%,-50%);border-radius:18px;padding:12px 28px 28px}.booking-sheet-backdrop{backdrop-filter:blur(2px)}}@media(max-width:920px){.language-switch{gap:10px}.language-switch a{font-size:12px}}@media(max-width:430px){.booking-launchers{gap:7px}.booking-launcher{padding:11px 8px;border-radius:12px}.booking-launcher strong{font-size:13px}.booking-launcher em{display:none}.booking-sheet{padding:10px 20px 24px}.sheet-head h3{font-size:22px}.booking-fields{grid-template-columns:1fr}}
      ${DESKTOP_LAYOUT_CSS.trim()}
    </style>
  </head>
  <body>
    <header class="site-header">
      <div class="header-inner">
        <div class="masthead-row">
          <span class="brand-note">KOREA TRAVEL MAGAZINE</span>
          <h1 class="brand-heading"><a class="brand" href="/">${esc(BRAND)}</a></h1>
          ${LANGUAGE_SWITCH}
        </div>
        <nav class="nav-scroll" aria-label="${esc(TEXT.navLabel)}">${categoryNav(navSections)}</nav>
      </div>
    </header>
    <main class="page">
      ${sectionHtml}
    </main>
    <footer class="site-footer">
      <div class="footer-brand">
        <strong>${esc(BRAND)}</strong>
        <p>${esc(TEXT.footer)}</p>
      </div>
      <div class="footer-col">
        <b>\uAC00\uBCFC\uB9CC\uD55C \uACF3</b>
        <a href="#popular">8\uC6D4 \uAC00\uBCFC\uB9CC\uD55C \uACF3</a>
        <a href="#weekend">\uC774\uBC88 \uC8FC\uB9D0 \uAC00\uBCFC\uB9CC\uD55C \uACF3</a>
        <a href="#water">\uBB3C\uB180\uC774\u00B7\uACC4\uACE1\u00B7\uD574\uC218\uC695\uC7A5</a>
        <a href="#indoor">\uBE44 \uC624\uB294 \uB0A0 \uC2E4\uB0B4 \uC5EC\uD589</a>
      </div>
      <div class="footer-col">
        <b>\uCD95\uC81C\uC815\uBCF4</b>
        <a href="#festival">${FEATURE_MONTH_LABEL} \uCD95\uC81C/\uD589\uC0AC</a>
        <a href="#weekend">\uC774\uBC88 \uC8FC\uB9D0 \uCD95\uC81C \uCCB4\uD06C</a>
      </div>
      <div class="footer-col">
        <b>\uD2B8\uB9BD\uBDF0</b>
        <a href="/editorial-team">\uD3B8\uC9D1\uD300</a>
        <a href="/editorial-policy">\uCF58\uD150\uCE20 \uC6B4\uC601 \uAE30\uC900</a>
      </div>
      <div class="footer-col">
        <b>\uC608\uC57D</b>
        <a href="#booking">\uC219\uC18C\u00B7\uD22C\uC5B4 \uAC80\uC0C9</a>
        <a href="#myrealtrip-deals">\uD22C\uC5B4\u00B7\uD2F0\uCF13 \uCD94\uCC9C</a>
        <a href="/affiliate-disclosure">\uC81C\uD734 \uC548\uB0B4</a>
      </div>
      <div class="footer-bottom">Copyright 2026 ${esc(BRAND)}. All rights reserved. · <a href="/about">\uC18C\uAC1C</a> · <a href="/editorial-team">\uD3B8\uC9D1\uD300</a> · <a href="/editorial-policy">\uCF58\uD150\uCE20 \uC6B4\uC601 \uAE30\uC900</a> · <a href="/contact">\uBB38\uC758</a> · <a href="/privacy">\uAC1C\uC778\uC815\uBCF4\uCC98\uB9AC\uBC29\uCE68</a></div>
    </footer>
    <script type="application/json" data-disabled-homepage-inline>
      const bookingResults = document.querySelector('[data-booking-results]');
      const today = new Date();
      const toDateInput = (date) => date.toISOString().slice(0, 10);
      const addDays = (date, days) => {
        const next = new Date(date);
        next.setDate(next.getDate() + days);
        return next;
      };
      document.querySelectorAll('[data-booking-search] input[type="date"]').forEach((input, index) => {
        input.value = toDateInput(addDays(today, index === 0 ? 14 : 16));
        input.min = toDateInput(today);
      });
      const bookingBackdrop = document.querySelector('[data-booking-backdrop]');
      const bookingSheets = [...document.querySelectorAll('[data-booking-sheet]')];
      const bookingTitle = (type) => ({
        accommodation: '숙소 검색 결과',
        tna: '투어·티켓 검색 결과',
        flight: '항공권 최저가 여행지',
      }[type] || '예약 검색 결과');
      function closeBookingSheet() {
        bookingSheets.forEach((sheet) => { sheet.hidden = true; });
        if (bookingBackdrop) bookingBackdrop.hidden = true;
        document.body.classList.remove('booking-sheet-open');
      }
      function openBookingSheet(type) {
        bookingSheets.forEach((sheet) => { sheet.hidden = sheet.dataset.bookingSheet !== type; });
        if (bookingBackdrop) bookingBackdrop.hidden = false;
        document.body.classList.add('booking-sheet-open');
        const activeSheet = bookingSheets.find((sheet) => sheet.dataset.bookingSheet === type);
        window.setTimeout(() => activeSheet?.querySelector('form input, form select, form button')?.focus(), 30);
      }
      window.tripviewOpenBooking = openBookingSheet;
      window.tripviewCloseBooking = closeBookingSheet;
      function applyBookingPreset(preset) {
        const form = preset.closest('form');
        const field = preset.dataset.field || 'keyword';
        const input = form?.elements?.namedItem(field);
        if (!input) return;
        input.value = preset.dataset.value || preset.textContent.trim();
        form.querySelectorAll('[data-booking-preset]').forEach((item) => {
          if ((item.dataset.field || 'keyword') === field) item.classList.remove('is-selected');
        });
        preset.classList.add('is-selected');
        input.focus();
      }
      window.tripviewPresetBooking = applyBookingPreset;
      document.addEventListener('click', (event) => {
        const opener = event.target.closest('[data-open-booking]');
        if (opener) {
          event.preventDefault();
          openBookingSheet(opener.dataset.openBooking);
          return;
        }
        if (event.target.closest('[data-booking-close]') || event.target === bookingBackdrop) {
          event.preventDefault();
          closeBookingSheet();
          return;
        }
        const preset = event.target.closest('[data-booking-preset]');
        if (!preset) return;
        event.preventDefault();
        applyBookingPreset(preset);
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeBookingSheet();
      });
      function startBookingResults(type) {
        if (!bookingResults) return;
        bookingResults.hidden = false;
        bookingResults.innerHTML = '';
        const title = document.createElement('h3');
        title.className = 'booking-results-title';
        title.textContent = bookingTitle(type);
        bookingResults.appendChild(title);
      }
      function setBookingStatus(message, type = '') {
        startBookingResults(type);
        const status = document.createElement('p');
        status.className = 'booking-status';
        status.textContent = message;
        bookingResults.appendChild(status);
      }
      function appendBookingResult(item) {
        const card = document.createElement('a');
        card.className = 'check-card product-card' + (item.image ? '' : ' no-thumb');
        const fallbackFlightUrl = 'https://flights.myrealtrip.com/';
        const url = item.type === 'flight'
          ? (item.bookingUrl || (/^https?:\/\//.test(item.url || '') ? item.url : fallbackFlightUrl))
          : (item.url || 'https://www.myrealtrip.com/');
        card.href = url;
        if (/^https?:\/\//.test(url)) {
          card.target = '_blank';
          card.rel = 'sponsored noopener';
        }
        if (item.image) {
          const thumb = document.createElement('span');
          thumb.className = 'booking-thumb';
          const image = document.createElement('img');
          image.src = item.image;
          image.alt = item.title || '예약 상품';
          image.loading = 'lazy';
          thumb.appendChild(image);
          card.appendChild(thumb);
        }
        const title = document.createElement('strong');
        title.textContent = item.title || '예약 상품';
        const meta = document.createElement('span');
        meta.textContent = item.meta || '예약 정보';
        card.appendChild(title);
        card.appendChild(meta);
        bookingResults.appendChild(card);
      }
      async function runBookingSearch(form) {
        const type = form.dataset.bookingSearch;
        const params = new URLSearchParams(new FormData(form));
        if (type === 'accommodation') params.set('type', 'accommodation');
        if (type === 'tna') params.set('type', 'tna');
        if (type === 'flight') params.set('type', 'flight');
        setBookingStatus('검색 중입니다.', type);
        try {
          const response = await fetch('/api/myrealtrip/search?' + params.toString(), { headers: { accept: 'application/json' } });
          const payload = await response.json();
          if (!response.ok || !payload.ok) throw new Error(payload.message || '검색에 실패했습니다.');
          startBookingResults(type);
          const items = Array.isArray(payload.items) ? payload.items : [];
          if (!items.length) {
            setBookingStatus(payload.message || '검색 결과가 없습니다. 다른 키워드로 다시 검색해 보세요.', type);
            closeBookingSheet();
            bookingResults?.scrollIntoView({ block: 'start', behavior: 'smooth' });
            return;
          }
          items.forEach(appendBookingResult);
          closeBookingSheet();
          bookingResults?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        } catch (error) {
          setBookingStatus(error.message || '검색 중 오류가 발생했습니다.', type);
          closeBookingSheet();
          bookingResults?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }
      }
      function submitBookingForm(event) {
        const form = event.target.closest('[data-booking-search]');
        if (!form) return true;
        event.preventDefault();
        event.tripviewBookingHandled = true;
        runBookingSearch(form);
        return false;
      }
      window.tripviewSubmitBooking = submitBookingForm;
      document.addEventListener('submit', (event) => {
        if (event.tripviewBookingHandled) return;
        submitBookingForm(event);
      });
      const links = [...document.querySelectorAll('[data-filter]')];
      const sections = [...document.querySelectorAll('.news-section')];
      const page = document.querySelector('.page');
      links.forEach((link) => {
        link.addEventListener('click', (event) => {
          event.preventDefault();
          const id = link.dataset.filter || link.getAttribute('href').replace('#', '');
          const showAll = id === 'all';
          links.forEach((item) => item.classList.remove('is-active'));
          link.classList.add('is-active');
          page?.classList.toggle('is-filtered', !showAll);
          sections.forEach((section) => section.classList.toggle('is-hidden', !showAll && section.id !== id));
          page?.scrollIntoView({ block: 'start' });
        });
      });
    </script>
    <script id="post-card-transition">(() => { const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; const selector = 'a.news-lead, a.pick-card, a.news-row, a.latest-primary, a.side-card, a.card'; document.addEventListener('click', (event) => { const card = event.target.closest(selector); if (!card || !card.href || card.target || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.defaultPrevented) return; const url = new URL(card.href, window.location.href); if (url.origin !== window.location.origin) return; if (reduce) return; event.preventDefault(); card.classList.add('is-opening'); window.setTimeout(() => { window.location.href = card.href; }, 180); }, { capture: true }); })();</script>
    <script src="/assets/homepage.js?v=booking-search-20260712-flight-links" defer></script>
    <script src="/assets/i18n.js?v=i18n-link-fix-20260706" defer></script>
    <script src="/assets/topic-filter.js?v=topic-filter-20260712-no-hero" defer></script>
  </body>
</html>`;
}

const allPosts = JSON.parse(await fs.readFile(POSTS_PATH, "utf8"));
const posts = allPosts
  .filter(isIndexablePost)
  .sort((a, b) => String(b.sortDate || "").localeCompare(String(a.sortDate || "")));

const myrealtripProducts = await readMyRealTripProducts();
const myrealtripAccommodations = await readMyRealTripAccommodations();
const myrealtripTnaProducts = await readMyRealTripTnaProducts();
const myrealtripFlights = await readMyRealTripFlights();

await fs.writeFile(INDEX_PATH, html(posts, myrealtripProducts, myrealtripAccommodations, myrealtripTnaProducts, myrealtripFlights), "utf8");
console.log(`Homepage rebuilt with ${posts.length} indexable post(s) from ${allPosts.length} total, ${myrealtripProducts.length} MyRealTrip product(s), ${myrealtripAccommodations.length} accommodation(s), ${myrealtripTnaProducts.length} TNA product(s), ${myrealtripFlights.length} flight deal(s).`);
