import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { affiliateProductImage, selectAffiliateProducts } from "./lib/affiliate-matching.mjs";
import { isIndexablePost } from "./lib/content-quality.mjs";
import { PRETENDARD_LINK, SITE_CSS, siteFooter, siteHeader, siteNavScript } from "./lib/site-design.mjs";
import { postImageWithProcessed, readTourImageManifest } from "./lib/tour-image-assets.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POSTS_PATH = path.join(ROOT, "data", "generated-posts.json");
const MYREALTRIP_PRODUCTS_PATH = path.join(ROOT, "data", "myrealtrip-products.json");
const MYREALTRIP_ACCOMMODATIONS_PATH = path.join(ROOT, "data", "myrealtrip-accommodations.json");
const MYREALTRIP_TNA_PATH = path.join(ROOT, "data", "myrealtrip-tna-products.json");
const MYREALTRIP_FLIGHTS_PATH = path.join(ROOT, "data", "myrealtrip-flight-deals.json");
const INDEX_PATH = path.join(ROOT, "index.html");
const processedTourImages = await readTourImageManifest(ROOT);

const BRAND = "\uD2B8\uB9BD\uBDF0";
const CAT_DOMESTIC = "\uAD6D\uB0B4\uC5EC\uD589";
const CAT_FESTIVAL = "\uACF5\uC5F0/\uCD95\uC81C";
const REGION_OTHER = "\uAE30\uD0C0";
const LANGUAGE_SWITCH = "";
const CONTENT_TODAY = formatDateInKorea();
const FEATURE_YEAR = Number(CONTENT_TODAY.slice(0, 4));
const FEATURE_MONTH = Number(CONTENT_TODAY.slice(5, 7));
const FEATURE_MONTH_START = isoDate(FEATURE_YEAR, FEATURE_MONTH, 1);
const FEATURE_MONTH_END = isoDate(FEATURE_YEAR, FEATURE_MONTH, new Date(Date.UTC(FEATURE_YEAR, FEATURE_MONTH, 0)).getUTCDate());
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
  description: `${BRAND}\uB294 \uC5EC\uD589\uC9C0, \uCD95\uC81C, \uC219\uC18C\u00B7\uC608\uC57D\uC744 \uB530\uB85C \uBCF4\uACE0 \uC9C0\uC5ED\uBCC4 \uC5EC\uD589 \uAE00\uC744 \uBE60\uB974\uAC8C \uCC3E\uC744 \uC218 \uC788\uAC8C \uC815\uB9AC\uD55C \uC5EC\uD589 \uC815\uBCF4 \uB9E4\uAC70\uC9C4\uC785\uB2C8\uB2E4.`,
  ogTitle: `${BRAND} - \uC5EC\uD589 \uB274\uC2A4 \uD53C\uB4DC`,
  ogDescription: "\uC5EC\uD589\uC9C0, \uCD95\uC81C, \uC219\uC18C\u00B7\uC608\uC57D \uD398\uC774\uC9C0\uC640 \uC9C0\uC5ED\uBCC4 \uD5C8\uBE0C\uB85C \uD544\uC694\uD55C \uAD6D\uB0B4\uC5EC\uD589 \uAE00\uC744 \uBC14\uB85C \uCC3E\uC744 \uC218 \uC788\uAC8C \uC815\uB9AC\uD569\uB2C8\uB2E4.",
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
  footer: "\uC5EC\uD589\uC9C0, \uCD95\uC81C, \uC219\uC18C\u00B7\uC608\uC57D\uC744 \uB530\uB85C \uBCF4\uACE0 \uC9C0\uC5ED\uBCC4 \uAE00\uB85C \uC774\uC5B4\uC9C0\uB294 \uC5EC\uD589 \uB274\uC2A4 \uD53C\uB4DC\uC785\uB2C8\uB2E4.",
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
const imageOf = (post) => postImageWithProcessed(processedTourImages, post);
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
  if (lastDay && lastDay < CONTENT_TODAY) return `2:${lastDay}`;
  const ongoingRank = start && start <= CONTENT_TODAY && lastDay >= CONTENT_TODAY ? "0" : "1";
  return `${ongoingRank}:${ongoingRank === "0" ? lastDay : start || lastDay || dateOf(post)}`;
}

function festivalEnded(post) {
  if (!isFestival(post)) return false;
  const { start, end } = festivalSchedule(post);
  const lastDay = end || start;
  return Boolean(lastDay && lastDay < CONTENT_TODAY);
}

function festivalStatusLabel(post) {
  return festivalEnded(post) ? "종료" : "";
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
  return [festivalStatusLabel(post), categoryOf(post), dateOf(post), compactRegion(regionOf(post))].filter(Boolean).join(" \u00B7 ");
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
  ];

  return sectionDefs
    .map((section) => {
      if (section.kind === "booking") return { ...section, posts: takePosts(section.posts, 4) };
      const freshPosts = takeFresh(section.posts, used, section.id === "water" ? 12 : 10);
      return freshPosts.length ? { ...section, posts: freshPosts } : { ...section, posts: takePosts(section.fallbackPosts || [], 10) };
    })
    .filter((section) => section.kind === "booking" || section.posts.length);
}

function categoryNav() {
  return [
    '<a class="is-active" href="/">\uD648</a>',
    '<a href="/travel/">\uC5EC\uD589\uC9C0</a>',
    '<a href="/festival/">\uCD95\uC81C</a>',
    '<a href="/stay/">\uC219\uC18C\u00B7\uC608\uC57D</a>',
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

const HOME_REGION_SLUGS = new Map([
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

function homeRegionSlug(region = "") {
  return HOME_REGION_SLUGS.get(compactRegion(region)) || "other";
}

function readingMinutes(post = {}) {
  const text = [
    titleOf(post),
    post.description,
    post.excerpt,
    ...(Array.isArray(post.sections) ? post.sections.flatMap((section) => [section?.heading, ...(section?.paragraphs || [])]) : []),
    ...(Array.isArray(post.faq) ? post.faq.flatMap((item) => [item?.question, item?.answer]) : []),
  ].filter(Boolean).join(" ");
  return Math.max(2, Math.ceil(text.length / 520));
}

function homeDateLabel(post = {}) {
  return formatIsoDate(post.sortDate || post.updatedAt || post.date || dateOf(post) || CONTENT_TODAY);
}

function homeStoryCard(post, className = "") {
  const image = imageOf(post);
  if (!image) return "";
  const thumb = `<span class="story-thumb"><img src="${esc(image)}" alt="${esc(titleOf(post))}" loading="lazy"></span>`;
  return `<a class="story-card${className ? ` ${esc(className)}` : ""}" href="${esc(hrefOf(post))}">
    ${thumb}
    <span class="story-card-body">
      <span class="story-label">${esc(categoryOf(post))}</span>
      <strong>${esc(titleOf(post))}</strong>
      ${summaryOf(post) ? `<p>${esc(summaryOf(post))}</p>` : ""}
      <span class="story-meta">${esc(homeDateLabel(post))} · 약 ${readingMinutes(post)}분</span>
    </span>
  </a>`;
}

function homeHeroSection(posts = []) {
  const items = uniquePosts(posts).filter((post) => imageOf(post)).slice(0, 5);
  if (items.length < 5) return "";
  return `<section class="home-hero" aria-label="대표 글">
    <div class="home-hero-grid">
      ${homeStoryCard(items[0], "home-hero-main")}
      <div class="home-hero-rail">${items.slice(1, 5).map((post) => homeStoryCard(post, "home-hero-small")).join("")}</div>
    </div>
  </section>`;
}

function homeRegionGroups(posts = []) {
  const groups = new Map();
  for (const post of posts) {
    const label = compactRegion(regionOf(post));
    const slug = homeRegionSlug(label);
    if (!groups.has(slug)) groups.set(slug, { label, slug, posts: [] });
    groups.get(slug).posts.push(post);
  }
  return [...groups.values()]
    .filter((group) => group.posts.length >= 1)
    .sort((a, b) => b.posts.length - a.posts.length || a.label.localeCompare(b.label, "ko"));
}

function homeRegionCard(group) {
  const lead = group.posts.find((post) => imageOf(post)) || group.posts[0];
  const image = imageOf(lead);
  const thumb = image ? `<span class="story-thumb"><img src="${esc(image)}" alt="${esc(group.label)} 여행 허브 대표 글" loading="lazy"></span>` : "";
  return `<a class="story-card region-card" href="/region/${esc(group.slug)}/">
    ${thumb}
    <span class="story-card-body">
      <span class="story-label">지역별로 찾기</span>
      <strong>${esc(group.label)} 여행 허브</strong>
      <p>${esc(group.label)} 지역 글과 숙소 카드, 하위 지역별 글을 한곳에 모았습니다.</p>
      <span class="story-meta">${group.posts.length.toLocaleString("ko-KR")}개 글</span>
    </span>
  </a>`;
}

function homeAffiliateCard(product = {}) {
  const title = normalize(product.title || product.name || product.itemName || "");
  const url = normalize(product.url || product.productUrl || "");
  if (!title || !url) return "";
  const imageUrl = affiliateProductImage(product);
  if (!imageUrl) return "";
  const thumb = `<span class="story-thumb"><img src="${esc(imageUrl)}" alt="${esc(title)} 예약 상품 이미지" loading="lazy"></span>`;
  const meta = [product.region || product.city, product.category || product.type, product.priceText || product.price].filter(Boolean).join(" · ");
  return `<a class="story-card home-affiliate-card" href="${esc(url)}" rel="sponsored nofollow" target="_blank">
    ${thumb}
    <span class="story-card-body">
      <span class="story-label">숙소·예약</span>
      <strong>${esc(title)}</strong>
      <p>${esc(meta || "예약 전 가격과 조건을 확인하세요.")}</p>
      <span class="story-meta">제휴 링크 · 조건 확인 필요</span>
    </span>
  </a>`;
}

function homeSection({ id, title, href, cards = [] }) {
  const visibleCards = cards.filter(Boolean);
  if (visibleCards.length < 3) return "";
  return `<section class="site-section" id="${esc(id)}" aria-labelledby="${esc(id)}-title">
    <div class="site-section-head">
      <h2 id="${esc(id)}-title">${esc(title)}</h2>
      <a class="site-section-more" href="${esc(href)}">더보기</a>
    </div>
    <div class="story-grid">${visibleCards.join("")}</div>
  </section>`;
}

const HOMEPAGE_CSS = `
.home-hero{padding:32px 0 48px}
.home-hero-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(320px,.95fr);gap:24px}
.home-hero-rail{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.home-hero-main .story-card-body{gap:10px;padding:24px}
.home-hero-main strong{font-size:28px;line-height:1.28}
.home-hero-small strong{font-size:16px}
.home-hero-small .story-card-body{padding:14px}
.home-hero-small p{display:none}
.home-affiliate-card{border-left:3px solid var(--cta)}
@media(max-width:900px){.home-hero{padding:24px 0 32px}.home-hero-grid,.home-hero-rail{grid-template-columns:1fr}.home-hero-main strong{font-size:22px}.home-hero-main .story-card-body{padding:16px}}
`;

function html(posts, products = [], accommodations = [], tnaProducts = []) {
  const editorialPosts = posts.filter((post) => !post?.dataPipeline?.generated);
  const hero = editorialPosts[0] || posts[0];
  const ogImage = imageOf(hero);
  const domestic = sortLatest(posts.filter((post) => categoryOf(post) === CAT_DOMESTIC && !isFestival(post)));
  const festivals = posts.filter(isFestival).sort((a, b) => festivalOrder(a).localeCompare(festivalOrder(b)));
  const seasonPosts = sortCurrentPlaces(domestic);
  const regionCards = homeRegionGroups(posts).slice(0, 6).map(homeRegionCard);
  const latestCards = sortLatest(posts).slice(0, 6).map((post) => homeStoryCard(post));
  const seasonCards = seasonPosts.slice(0, 6).map((post) => homeStoryCard(post));
  const festivalCards = festivals.slice(0, 6).map((post) => homeStoryCard(post));
  const stayProducts = [...accommodations, ...tnaProducts, ...products].filter((item) => item?.title && item?.url).slice(0, 6);
  const stayCards = stayProducts.map(homeAffiliateCard);
  const regionLinks = homeRegionGroups(posts).map((group) => ({ href: `/region/${group.slug}/`, label: group.label }));
  const sections = [
    homeSection({ id: "regions", title: "지역별로 찾기", href: "/region/", cards: regionCards }),
    homeSection({ id: "latest", title: "최신 글", href: "/travel/#all-posts", cards: latestCards }),
    homeSection({ id: "season", title: `${FEATURE_MONTH_LABEL} 시즌 추천`, href: "/travel/#tag-weekend", cards: seasonCards }),
    homeSection({ id: "festival", title: "축제·행사", href: "/festival/", cards: festivalCards }),
    homeSection({ id: "stay", title: "숙소·예약", href: "/stay/", cards: stayCards }),
  ].join("\n");

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta name="naver-site-verification" content="38616b4b4209994ed384d0d2439bddcbec2cc711">
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5751319666030430" crossorigin="anonymous"></script>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${esc(TEXT.description)}">
    <meta name="theme-color" content="#FAFAF8">
    <meta property="og:title" content="${esc(TEXT.ogTitle)}">
    <meta property="og:description" content="${esc(TEXT.ogDescription)}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://tripview.kr/">
    ${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : ""}
    <meta name="twitter:card" content="summary_large_image">
    <link rel="canonical" href="https://tripview.kr/">
    <link rel="alternate" type="application/rss+xml" title="${esc(TEXT.rssTitle)}" href="https://tripview.kr/rss.xml">
    ${PRETENDARD_LINK}
    <title>${esc(TEXT.ogTitle)}</title>
    <style>${SITE_CSS}${HOMEPAGE_CSS}</style>
  </head>
  <body>
    ${siteHeader("/")}
    <main class="site-page">
      ${homeHeroSection(sortLatest(editorialPosts.length ? editorialPosts : posts))}
      ${sections}
    </main>
    ${siteFooter({ regionLinks })}
    ${siteNavScript()}
    <script src="/assets/homepage.js?v=booking-search-20260712-flight-links" defer></script>
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
