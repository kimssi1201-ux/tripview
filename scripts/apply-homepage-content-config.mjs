import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POSTS_PATH = path.join(ROOT, "data", "generated-posts.json");
const INDEX_PATH = path.join(ROOT, "index.html");

const BRAND = "\uD2B8\uB9BD\uBDF0";
const CAT_DOMESTIC = "\uAD6D\uB0B4\uC5EC\uD589";
const CAT_FESTIVAL = "\uACF5\uC5F0/\uCD95\uC81C";
const REGION_OTHER = "\uAE30\uD0C0";

const TEXT = {
  articleFallback: "\uC5EC\uD589 \uAE30\uC0AC",
  infoFallback: "\uC5EC\uD589 \uC815\uBCF4",
  description: `${BRAND}\uB294 \uC9C0\uAE08 \uB9CE\uC774 \uCC3E\uB294 \uC5EC\uD589\uC9C0, \uC8FC\uB9D0 \uC5EC\uD589, 7~8\uC6D4 \uCD95\uC81C, \uBB3C\uB180\uC774, \uC2E4\uB0B4\uC5EC\uD589, \uC544\uC774\uC640 \uAC00\uAE30 \uC88B\uC740 \uACF3, \uC608\uC57D \uC804 \uCCB4\uD06C\uB97C \uC815\uB9AC\uD55C \uC5EC\uD589 \uC815\uBCF4 \uB9E4\uAC70\uC9C4\uC785\uB2C8\uB2E4.`,
  ogTitle: `${BRAND} - \uC5EC\uD589 \uB274\uC2A4 \uD53C\uB4DC`,
  ogDescription: "\uC9C0\uAE08 \uB9CE\uC774 \uCC3E\uB294 \uC5EC\uD589\uC9C0, \uC8FC\uB9D0 \uC5EC\uD589, \uCD95\uC81C, \uBB3C\uB180\uC774, \uC2E4\uB0B4\uC5EC\uD589, \uC608\uC57D \uC804 \uCCB4\uD06C\uB97C \uB274\uC2A4 \uC139\uC158\uC73C\uB85C \uC815\uB9AC\uD569\uB2C8\uB2E4.",
  rssTitle: `${BRAND} RSS`,
  navLabel: "\uCE74\uD14C\uACE0\uB9AC",
  navAll: "\uC804\uCCB4",
  navPopular: "\uC9C0\uAE08 \uB9CE\uC774 \uCC3E\uB294 \uC5EC\uD589\uC9C0",
  navWeekend: "\uC774\uBC88 \uC8FC\uB9D0 \uAC00\uBCFC\uB9CC\uD55C \uACF3",
  navTravel: "\uAC00\uBCFC\uB9CC\uD55C \uACF3",
  navFestival: "\uCD95\uC81C/\uD589\uC0AC",
  navWater: "\uBB3C\uB180\uC774\u00B7\uACC4\uACE1\u00B7\uD574\uC218\uC695\uC7A5",
  navIndoor: "\uBE44 \uC624\uB294 \uB0A0 \uC2E4\uB0B4 \uC5EC\uD589",
  navFamily: "\uC544\uC774\uC640 \uAC00\uAE30 \uC88B\uC740 \uACF3",
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

const TENPING_HOME_AD = `<aside class="home-ad" data-ad-block aria-label="Ad">
  <span class="ad-label">Ad</span>
  <tenping class="adsbytenping" style="width: 100%; margin: 0px auto; display: block; max-width: 768px;" tenping-ad-client="%2fnyDIt3jSiYh7KXeo4%2bsm7S2Hydb6U%2fzbuFekGjT%2frlZrkiEUQ%2btrnyYLz7zJ6Li" tenping-ad-display-type="67%2be3LHzHbblsB9oLrOpWQ%3d%3d"></tenping>
</aside>
<script async src="https://ads.tenping.kr/scripts/adsbytenping.min.js"></script>`;

const esc = (value = "") =>
  String(value).replace(/[&<>"']/g, (match) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[match]));

const normalize = (value = "") => String(value).trim();
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

function festivalInJulyAugust(post) {
  if (!isFestival(post)) return false;
  const { start, end } = festivalSchedule(post);
  if (!start) return false;
  const month = Number(start.slice(5, 7));
  return month === 7 || month === 8;
}

function festivalStart(post) {
  return festivalSchedule(post).start || post?.sortDate || "";
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

function leadArticle(post) {
  if (!post) return "";
  return `<a class="news-lead" href="${esc(hrefOf(post))}">
    ${articleImage(post, "lead-thumb")}
    <strong>${esc(titleOf(post))}</strong>
    <span>${esc(metaLine(post))}</span>
  </a>`;
}

function pickCard(post) {
  return `<a class="pick-card" href="${esc(hrefOf(post))}">
    ${articleImage(post, "pick-thumb")}
    <strong>${esc(titleOf(post))}</strong>
  </a>`;
}

function listItem(post) {
  return `<a class="news-row" href="${esc(hrefOf(post))}">
    ${articleImage(post, "row-thumb")}
    <span><strong>${esc(titleOf(post))}</strong><em>${esc(metaLine(post))}</em></span>
  </a>`;
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

function newsSection({ id, title, posts }) {
  const items = uniquePosts(posts).slice(0, 10);
  if (!items.length) return "";
  const lead = items[0];
  const picks = items.slice(1, 4);
  const list = items.slice(4, 10);
  return `<section class="news-section" id="${esc(id)}" aria-labelledby="${esc(id)}-title" data-headline="${esc(title)}">
    <h2 id="${esc(id)}-title">${esc(title)}</h2>
    ${leadArticle(lead)}
    <div class="pick-grid">${picks.map(pickCard).join("")}</div>
    <div class="news-list">${list.map(listItem).join("")}</div>
  </section>`;
}

const BOOKING_CHECKS = [
  {
    title: "\uC219\uC18C \uC608\uC57D \uC804 \uCCB4\uD06C",
    text: "\uD6C4\uAE30\uB9CC \uBCF4\uAE30\uBCF4\uB2E4 \uC704\uCE58, \uC785\uC2E4 \uC2DC\uAC04, \uC8FC\uCC28, \uCDE8\uC18C \uAE30\uD55C, \uC870\uC2DD \uD3EC\uD568 \uC5EC\uBD80\uB97C \uBA3C\uC800 \uD655\uC778\uD558\uC138\uC694.",
    href: "#booking-stay",
  },
  {
    title: "\uCD95\uC81C\u00B7\uC785\uC7A5\uAD8C \uC608\uC57D",
    text: "\uD604\uC7A5 \uBC1C\uAD8C\uB9CC \uAC00\uB2A5\uD55C\uC9C0, \uC0AC\uC804 \uC608\uC57D\uC774 \uD544\uC694\uD55C\uC9C0, \uC785\uC7A5 \uB9C8\uAC10 \uC2DC\uAC04\uACFC \uD658\uBD88 \uAE30\uC900\uC744 \uAC19\uC774 \uBCF4\uC138\uC694.",
    href: "#booking-ticket",
  },
  {
    title: "\uD22C\uC5B4\u00B7\uCCB4\uD5D8 \uC0C1\uD488",
    text: "\uC9D1\uACB0 \uC7A5\uC18C, \uC18C\uC694 \uC2DC\uAC04, \uC6B0\uCC9C \uC2DC \uC9C4\uD589 \uC5EC\uBD80, \uC900\uBE44\uBB3C\uC744 \uC608\uC57D \uC804\uC5D0 \uD655\uC778\uD558\uBA74 \uC2E4\uD328\uAC00 \uC904\uC5B4\uB4ED\uB2C8\uB2E4.",
    href: "#booking-tour",
  },
  {
    title: "\uD560\uC778\uCF54\uB4DC\u00B7\uCD94\uAC00\uBE44\uC6A9",
    text: "\uD45C\uC2DC\uAC00\uC640 \uCD5C\uC885 \uACB0\uC81C\uAC00\uAC00 \uB2E4\uB97C \uC218 \uC788\uC73C\uB2C8 \uC138\uAE08, \uBD09\uC0AC\uB8CC, \uC218\uC218\uB8CC, \uD560\uC778 \uC801\uC6A9 \uC870\uAC74\uC744 \uB05D\uAE4C\uC9C0 \uBCF4\uC138\uC694.",
    href: "#booking-discount",
  },
];

function bookingSection({ id, title, posts = [] }) {
  const items = uniquePosts(posts).slice(0, 4);
  const postCards = items.map((post) => `<a class="check-card" href="${esc(hrefOf(post))}">
    <strong>${esc(titleOf(post))}</strong>
    <span>${esc(metaLine(post))}</span>
  </a>`);
  const guideCards = BOOKING_CHECKS.map((item) => `<a class="check-card" href="${esc(item.href)}">
    <strong>${esc(item.title)}</strong>
    <span>${esc(item.text)}</span>
  </a>`);
  return `<section class="news-section check-section" id="${esc(id)}" aria-labelledby="${esc(id)}-title" data-headline="${esc(title)}">
    <h2 id="${esc(id)}-title">${esc(title)}</h2>
    <div class="check-grid">${[...postCards, ...guideCards].slice(0, 6).join("")}</div>
  </section>`;
}

function buildSections(posts) {
  const domestic = posts.filter((post) => categoryOf(post) === CAT_DOMESTIC && !isFestival(post));
  const festivals = posts
    .filter(festivalInJulyAugust)
    .sort((a, b) => festivalStart(a).localeCompare(festivalStart(b)));
  const waterKeywords = ["\uC218\uC601\uC7A5", "\uACC4\uACE1", "\uD574\uC218\uC695\uC7A5", "\uD574\uBCC0", "\uBC14\uB2E4", "\uBB3C\uB180\uC774", "\uC6CC\uD130\uD30C\uD06C", "\uD3ED\uD3EC", "\uC218\uBCC0"];
  const indoorKeywords = ["\uBC15\uBB3C\uAD00", "\uBBF8\uC220\uAD00", "\uC804\uC2DC", "\uBB38\uD654", "\uC13C\uD130", "\uC544\uD2B8", "\uACF5\uC5F0\uC7A5"];
  const familyKeywords = ["\uC544\uC774", "\uAC00\uC871", "\uC5B4\uB9B0\uC774", "\uCCB4\uD5D8", "\uACF5\uC6D0", "\uC0DD\uD0DC", "\uB3D9\uBB3C", "\uB18D\uCD0C", "\uC790\uC5F0\uD559\uC2B5"];
  const bookingKeywords = ["\uC219\uC18C", "\uD638\uD154", "\uC608\uC57D", "\uD22C\uC5B4", "\uC785\uC7A5\uAD8C", "\uD560\uC778", "\uC2DD\uB2F9", "\uB9DB\uC9D1", "\uCE74\uD398", "\uC1FC\uD551"];

  const byType = (typeId) => posts.filter((post) => contentTypeOf(post) === typeId);
  const used = new Set();
  const waterPool = domestic.filter((post) => hasAnyKeyword(post, waterKeywords));
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
  const generalTravel = domestic.filter((post) => (
    !hasAnyKeyword(post, waterKeywords) &&
    !hasAnyKeyword(post, indoorKeywords) &&
    !hasAnyKeyword(post, familyKeywords)
  ));
  const sectionDefs = [
    { id: "popular", title: TEXT.navPopular, posts: sortCurrentPlaces(generalTravel.length ? generalTravel : domestic) },
    { id: "weekend", title: TEXT.navWeekend, posts: sortLatest(weekendPool.length ? weekendPool : domestic) },
    { id: "festival", title: "7~8\uC6D4 \uCD95\uC81C/\uD589\uC0AC", posts: festivals },
    { id: "water", title: TEXT.navWater, posts: sortCurrentPlaces(waterPool) },
    { id: "indoor", title: TEXT.navIndoor, posts: indoorPool.length ? indoorPool : sortLatest(domestic), fallbackPosts: sortLatest(domestic) },
    { id: "family", title: TEXT.navFamily, posts: familyPool.length ? familyPool : sortLatest(domestic), fallbackPosts: sortLatest(domestic) },
    { id: "booking", title: TEXT.navBooking, kind: "booking", posts: bookingPool },
  ];

  return sectionDefs
    .map((section) => {
      if (section.kind === "booking") return { ...section, posts: takePosts(section.posts, 4) };
      const freshPosts = takeFresh(section.posts, used);
      return freshPosts.length ? { ...section, posts: freshPosts } : { ...section, posts: takePosts(section.fallbackPosts || [], 10) };
    })
    .filter((section) => section.kind === "booking" || section.posts.length);
}

function categoryNav(sections) {
  return [
    `<a class="is-active" href="#all" data-filter="all">${esc(TEXT.navAll)}</a>`,
    ...sections.map((section) => `<a href="#${esc(section.id)}" data-filter="${esc(section.id)}">${esc(section.title)}</a>`),
  ].join("");
}

function html(posts) {
  const sections = buildSections(posts).filter((section) => section.kind === "booking" || section.posts.length);
  const hero = posts[0];
  const ogImage = imageOf(hero);
  const defaultHeadline = "\uC8FC\uC81C\uBCC4 \uCD5C\uC2E0 \uC5EC\uD589 \uC815\uBCF4";
  const sectionHtml = sections
    .map((section) => section.kind === "booking" ? bookingSection(section) : newsSection(section))
    .reduce((parts, markup, index) => {
      parts.push(markup);
      if (index === 3) parts.push(TENPING_HOME_AD);
      return parts;
    }, [])
    .join("\n");

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta name="naver-site-verification" content="38616b4b4209994ed384d0d2439bddcbec2cc711">
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8468106244002167" crossorigin="anonymous"></script>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${esc(TEXT.description)}">
    <meta name="theme-color" content="#ffffff">
    <meta property="og:title" content="${esc(TEXT.ogTitle)}">
    <meta property="og:description" content="${esc(TEXT.ogDescription)}">
    <meta property="og:type" content="website">
    ${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : ""}
    <meta name="twitter:card" content="summary_large_image">
    <link rel="alternate" type="application/rss+xml" title="${esc(TEXT.rssTitle)}" href="https://tripview.kr/rss.xml">
    <title>${esc(TEXT.ogTitle)}</title>
    <style>
      :root{--ink:#111;--muted:#777;--line:#e2e2e2;--paper:#fff;--soft:#f5f5f5}*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:128px}body{margin:0;background:var(--paper);color:var(--ink);font-family:Arial,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;letter-spacing:0;line-height:1.45}a{color:inherit;text-decoration:none}img{display:block;width:100%;height:100%;object-fit:cover;background:var(--soft)}.site-header{position:sticky;top:0;z-index:10;background:rgba(255,255,255,.96);border-bottom:1px solid var(--line);backdrop-filter:blur(12px)}.header-inner{max-width:720px;margin:0 auto;padding:15px 16px 10px}.brand{display:block;margin-bottom:12px;font-size:28px;font-weight:900;line-height:1}.nav-scroll{display:flex;gap:18px;overflow-x:auto;padding-bottom:4px;white-space:nowrap;font-size:15px;font-weight:800}.nav-scroll a{display:block;padding:2px 0;border-bottom:2px solid transparent}.nav-scroll a.is-active{border-bottom-color:#111}.nav-scroll::-webkit-scrollbar,.pick-grid::-webkit-scrollbar{display:none}.page{max-width:720px;margin:0 auto;padding:10px 16px 40px}.top-line{display:flex;align-items:center;justify-content:space-between;padding:10px 0 18px;color:var(--muted);font-size:13px;border-bottom:1px solid var(--line)}.top-line b{color:var(--ink)}.news-section{padding:28px 0 34px;border-bottom:8px solid #f2f2f2;scroll-margin-top:128px}.news-section.is-hidden{display:none}.news-section h2{margin:0 0 16px;font-size:31px;line-height:1.05;font-weight:900;letter-spacing:-.01em}.news-lead{display:block}.lead-thumb{display:block;width:100%;aspect-ratio:1.78/1;overflow:hidden;background:var(--soft)}.news-lead strong{display:block;margin-top:12px;font-size:24px;line-height:1.22;font-weight:900}.news-lead span{display:block;margin-top:7px;color:var(--muted);font-size:13px}.pick-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:20px}.pick-card{min-width:0}.pick-thumb{display:block;aspect-ratio:1.2/1;overflow:hidden;background:var(--soft)}.pick-card strong{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-top:7px;font-size:13px;line-height:1.34;font-weight:800}.news-list{margin-top:22px;border-top:1px solid var(--line)}.news-row{display:grid;grid-template-columns:92px minmax(0,1fr);gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line)}.row-thumb{display:block;aspect-ratio:1.28/1;overflow:hidden;background:var(--soft)}.news-row strong{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:17px;line-height:1.35;font-weight:900}.news-row em{display:block;margin-top:5px;color:var(--muted);font-size:12px;font-style:normal}.check-grid{display:grid;grid-template-columns:1fr;gap:0;border-top:1px solid var(--line)}.check-card{display:block;padding:15px 0;border-bottom:1px solid var(--line)}.check-card strong{display:block;font-size:18px;line-height:1.32;font-weight:900}.check-card span{display:block;margin-top:6px;color:var(--muted);font-size:13px;line-height:1.55}.home-ad{display:block;width:100%;min-height:124px;margin:8px 0 28px;padding:14px 0;border-bottom:8px solid #f2f2f2;overflow:visible}.home-ad.is-hidden{display:none}.home-ad .ad-label{display:block;margin:0 0 6px;color:#999;font-size:12px;font-weight:700}.home-ad tenping{display:block!important;width:100%!important;min-height:110px!important}.no-image{background:linear-gradient(135deg,#f1f1f1,#dedede)}.site-footer{max-width:720px;margin:0 auto;padding:28px 16px 44px;color:var(--muted);font-size:13px}.site-footer strong{display:block;color:var(--ink);font-size:20px;margin-bottom:6px}@media(min-width:760px){.header-inner,.page,.site-footer{max-width:1040px}.page{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 36px}.top-line{grid-column:1/-1}.news-section{border-bottom:1px solid var(--line)}.news-section h2{font-size:34px}.check-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:0 18px}.home-ad{grid-column:1/-1;border-bottom:1px solid var(--line)}}@media(max-width:360px){.news-section h2{font-size:28px}.news-lead strong{font-size:21px}.news-row{grid-template-columns:82px minmax(0,1fr)}.pick-grid{gap:7px}.pick-card strong{font-size:12px}}
    </style>
  </head>
  <body>
    <header class="site-header">
      <div class="header-inner">
        <a class="brand" href="/">${esc(BRAND)}</a>
        <nav class="nav-scroll" aria-label="${esc(TEXT.navLabel)}">${categoryNav(sections)}</nav>
      </div>
    </header>
    <main class="page">
      <div class="top-line"><span data-feed-label>${esc(defaultHeadline)}</span><span>${esc(new Date().toISOString().slice(0, 10))}</span></div>
      ${sectionHtml}
    </main>
    <footer class="site-footer">
      <strong>${esc(BRAND)}</strong>
      <span>${esc(TEXT.footer)}</span>
    </footer>
    <script>
      const links = [...document.querySelectorAll('[data-filter]')];
      const sections = [...document.querySelectorAll('.news-section')];
      const adBlocks = [...document.querySelectorAll('[data-ad-block]')];
      const label = document.querySelector('[data-feed-label]');
      links.forEach((link) => {
        link.addEventListener('click', (event) => {
          event.preventDefault();
          const id = link.dataset.filter || link.getAttribute('href').replace('#', '');
          const title = link.textContent.trim();
          const showAll = id === 'all';
          const selectedSection = document.getElementById(id);
          const headline = showAll ? '${esc(defaultHeadline)}' : (selectedSection?.dataset.headline || title);
          links.forEach((item) => item.classList.remove('is-active'));
          link.classList.add('is-active');
          sections.forEach((section) => section.classList.toggle('is-hidden', !showAll && section.id !== id));
          adBlocks.forEach((ad) => ad.classList.toggle('is-hidden', !showAll));
          if (label) label.textContent = headline;
          document.querySelector('.page').scrollIntoView({ block: 'start' });
        });
      });
    </script>
  </body>
</html>`;
}

const posts = JSON.parse(await fs.readFile(POSTS_PATH, "utf8"))
  .filter((post) => post?.slug && post?.title)
  .sort((a, b) => String(b.sortDate || "").localeCompare(String(a.sortDate || "")));

await fs.writeFile(INDEX_PATH, html(posts), "utf8");
console.log(`Homepage rebuilt as topic-based travel news feed with ${posts.length} post(s).`);
