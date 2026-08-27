import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import { isIndexablePost } from "../scripts/lib/content-quality.mjs";

const beachSlugs = [
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
];

const regionSlugs = new Map([
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

function compactRegion(value = "") {
  const text = String(value || "");
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
  return "기타";
}

function expectedRegionSlugs(posts) {
  return [...new Set(posts.filter(isIndexablePost).map((post) => regionSlugs.get(compactRegion(post.region)) || "other"))].sort();
}

function visibleText(document = "") {
  return String(document)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function articleBodyHtml(document = "") {
  return String(document).match(/<article\b[^>]*\bclass=["'][^"']*\bcontent\b[^"']*["'][^>]*>([\s\S]*?)<\/article>/i)?.[1] || "";
}

function imageIdentity(value = "") {
  const src = String(value || "").trim().replaceAll("\\", "/");
  if (!src) return "";
  try {
    const url = new URL(src, "https://tripview.kr");
    url.hash = "";
    return url.origin === "https://tripview.kr"
      ? `${url.pathname}${url.search}`
      : `${url.protocol}//${url.hostname.toLowerCase()}${url.pathname}${url.search}`;
  } catch {
    return src;
  }
}

function tourismImageContentKey(value = "") {
  const clean = String(value || "").split("?")[0];
  const resource = clean.match(/\/resource(?:_photo)?\/\d+\/([^/_]+)_image\d+_\d+/i);
  return resource ? `tour:${resource[1].toLowerCase()}` : "";
}

function processedImageAssets(manifest, post) {
  const entry = manifest.items?.[post.slug] || {};
  return [entry.cover, entry.hero, entry.banner, ...(Array.isArray(entry.images) ? entry.images : [])].filter(Boolean);
}

function articleImageOriginal(manifest, post, src) {
  const key = imageIdentity(src);
  const asset = processedImageAssets(manifest, post).find((item) => (
    imageIdentity(item.src) === key || imageIdentity(item.original) === key
  ));
  return asset?.original || src;
}

function articleInlineImageSources(body = "") {
  const figures = [...String(body).matchAll(/<figure\b[^>]*\bclass=["'][^"']*\barticle-inline-figure\b[^"']*["'][^>]*>[\s\S]*?<\/figure>/gi)];
  return figures
    .map((figure) => figure[0].match(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/i)?.[1])
    .filter(Boolean);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dateText(date) {
  return date.toISOString().slice(0, 10);
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

function expectedStayWindow(reference = new Date()) {
  const today = todayInKorea(reference);
  const day = today.getUTCDay();
  let daysUntilFriday = (5 - day + 7) % 7;
  if (daysUntilFriday === 0) daysUntilFriday = 7;
  const checkInDate = addDays(today, daysUntilFriday);
  return {
    checkIn: dateText(checkInDate),
    checkOut: dateText(addDays(checkInDate, 2)),
  };
}

async function collectHtmlFiles(dir = ".", files = []) {
  const ignored = new Set([".git", "node_modules", "www", "site"]);
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectHtmlFiles(path, files);
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(path);
    }
  }
  return files;
}

test("Coupang product images keep the site referrer policy", async () => {
  const script = await readFile("assets/coupang.js", "utf8");

  assert.doesNotMatch(script, /referrerPolicy\s*=\s*["']no-referrer["']/);
  assert.match(script, /referrerPolicy\s*=\s*["']strict-origin-when-cross-origin["']/);
});

test("homepage categories use real URLs and travel keeps old topics as tags", async () => {
  const [homepage, travelPage, ticketPage] = await Promise.all([
    readFile("index.html", "utf8"),
    readFile("travel/index.html", "utf8"),
    readFile("ticket/index.html", "utf8"),
  ]);
  assert.match(homepage, /class="site-home-link is-active" href="\/">홈<\/a>/);
  assert.match(homepage, /<summary class="nav-summary">여행지<\/summary>/);
  assert.match(homepage, /<summary class="nav-summary">축제·행사<\/summary>/);
  assert.match(homepage, /<summary class="nav-summary">숙소·예약<\/summary>/);
  assert.match(homepage, /href="\/travel\/#tag-water"/);
  assert.match(homepage, /href="\/festival\/#ongoing"/);
  assert.match(homepage, /href="\/stay\/"/);
  assert.match(homepage, /href="\/ticket\/"/);
  assert.match(homepage, /class="site-mobile-categories"/);
  assert.match(homepage, /class="site-mobile-category[^"]*" href="\/travel\/">여행지<\/a>/);
  assert.match(homepage, /class="site-mobile-category[^"]*" href="\/ticket\/">입장권·투어<\/a>/);
  assert.doesNotMatch(homepage, /data-site-menu-toggle/);
  assert.doesNotMatch(homepage, /mobile-menu-panel/);
  assert.match(homepage, /href="\/ticket\/"><span class="nav-item-icon" aria-hidden="true">권<\/span>/);
  assert.doesNotMatch(homepage, /<a[^>]+href="#(?:water|weekend|festival|indoor|family|booking|myrealtrip-deals)"/);
  assert.doesNotMatch(homepage, /data-filter="(?:water|weekend|festival|indoor|family|booking)"/);

  for (const tag of ["tag-weekend", "tag-water", "tag-indoor", "tag-family"]) {
    assert.match(travelPage, new RegExp(`id="${tag}"`));
  }
  assert.match(travelPage, /물놀이·계곡/);
  assert.match(travelPage, /실내여행/);
  assert.match(travelPage, /아이와/);
  assert.equal(beachSlugs.filter((slug) => travelPage.includes(`/${slug}/`)).length, 6);

  assert.match(ticketPage, /<link rel="canonical" href="https:\/\/tripview\.kr\/ticket\/">/);
  assert.match(ticketPage, /입장권·투어/);
  assert.match(ticketPage, /id="region-[a-z]+"/);
  assert.match(ticketPage, /data-mrt-ticket-card/);
});

test("homepage uses dropdown navigation and a five-story lead package", async () => {
  const homepage = await readFile("index.html", "utf8");
  assert.equal((homepage.match(/class="site-header"/g) || []).length, 1);
  assert.ok((homepage.match(/class="nav-dropdown"/g) || []).length >= 3);
  assert.match(homepage, /\.nav-dropdown\{[^}]*z-index:420[^}]*background:var\(--card\)[^}]*box-shadow:/);
  assert.match(homepage, /\.nav-dropdown a\{display:flex;align-items:flex-start;gap:12px/);
  assert.match(homepage, /\.site-mobile-categories\{[^}]*display:flex[^}]*overflow-x:auto/);
  assert.doesNotMatch(homepage, /\.mobile-menu-panel\{/);
  assert.doesNotMatch(homepage, /let menuOpen = false;/);
  assert.match(homepage, /const closeGroups = \(except\) =>/);
  assert.match(homepage, /group\.addEventListener\("mouseenter", \(\) => openGroup\(group, true\)\)/);
  assert.match(homepage, /openedByHover/);
  assert.doesNotMatch(homepage, /\.nav-group:hover \.nav-dropdown/);
  assert.equal((homepage.match(/class="story-card home-hero-main"/g) || []).length, 1);
  assert.equal((homepage.match(/class="story-card home-hero-small"/g) || []).length, 4);
  assert.equal((homepage.match(/<section class="home-hero"/g) || []).length, 1);
  assert.equal((homepage.match(/<section class="site-section"/g) || []).length, 5);
  for (const id of ["regions", "latest", "season", "festival", "stay"]) {
    assert.match(homepage, new RegExp(`<section class="site-section" id="${id}"`));
  }
  assert.doesNotMatch(homepage, /class="masthead-row"|class="nav-scroll"|post-card-transition/);
});

test("homepage thumbnails use fixed ratios without gray placeholders", async () => {
  const homepage = await readFile("index.html", "utf8");
  assert.match(homepage, /\.story-thumb\{position:relative;display:block;width:100%;aspect-ratio:16\/10;overflow:hidden;background:var\(--card\)\}/);
  assert.match(homepage, /\.story-thumb img\{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;display:block\}/);
  assert.match(homepage, /\.home-hero-grid\{display:grid;grid-template-columns:minmax\(0,1\.3fr\) minmax\(340px,1fr\);align-items:stretch;gap:16px\}/);
  assert.match(homepage, /\.home-hero-main \.story-thumb\{aspect-ratio:4\/3\}/);
  assert.match(homepage, /\.home-hero-small \.story-thumb\{aspect-ratio:16\/10\}/);
  assert.match(homepage, /\.home-hero-main p\{-webkit-line-clamp:2\}/);
  assert.match(homepage, /\.home-hero-small p\{-webkit-line-clamp:2;font-size:13px;line-height:1\.45\}/);
  assert.doesNotMatch(homepage, /\.story-thumb\{[^}]*background:var\(--line\)/);
  // Scoped to the thumbnail rules themselves (not the whole document) so
  // unrelated CSS elsewhere on the page - e.g. a max-height on a dropdown -
  // can't trip this thumbnail-regression guard.
  assert.doesNotMatch(homepage, /\.story-thumb(?: img)?\{[^}]*(?:object-fit:(?:contain|scale-down)|height:auto|max-height)[^}]*\}/);
  assert.doesNotMatch(homepage, /class="thumb empty"/);
});

test("header search box has a client-side index covering every generated post", async () => {
  const [homepage, generatedPosts, searchIndexRaw] = await Promise.all([
    readFile("index.html", "utf8"),
    readFile("data/generated-posts.json", "utf8").then(JSON.parse),
    readFile("assets/search-index.json", "utf8"),
  ]);
  assert.match(homepage, /<details class="site-search" data-site-search>/);
  assert.match(homepage, /data-site-search-input/);
  assert.match(homepage, /fetch\("\/assets\/search-index\.json"\)/);

  const searchIndex = JSON.parse(searchIndexRaw);
  assert.equal(searchIndex.length, generatedPosts.length);
  for (const entry of searchIndex.slice(0, 20)) {
    assert.equal(typeof entry.slug, "string");
    assert.equal(typeof entry.title, "string");
    assert.ok(entry.slug.length > 0 && entry.title.length > 0);
  }
});

test("common site design clamps mobile page overflow", async () => {
  const [siteDesign, dataPage] = await Promise.all([
    readFile("scripts/lib/site-design.mjs", "utf8"),
    readFile("data-stay-price-seoul/index.html", "utf8"),
  ]);
  assert.match(siteDesign, /html\{scroll-padding-top:96px;overflow-x:hidden\}/);
  assert.match(siteDesign, /body\{margin:0;overflow-x:hidden;/);
  assert.match(siteDesign, /\.site-mobile-categories\{display:none\}/);
  assert.match(siteDesign, /\.site-mobile-categories\{display:flex;[^}]*overflow-x:auto/);
  assert.match(siteDesign, /\.data-table\{background:linear-gradient\(to right,var\(--card\) 30%/);
  assert.doesNotMatch(siteDesign, /\.mobile-menu-panel/);
  assert.match(dataPage, /html\{scroll-padding-top:96px;overflow-x:hidden\}/);
  assert.match(dataPage, /class="site-mobile-categories"/);
  assert.doesNotMatch(dataPage, /data-site-menu-toggle/);
  assert.doesNotMatch(dataPage, /mobile-menu-panel/);
  assert.doesNotMatch(dataPage, /transform:translateX\(100%\)/);
});

test("article product sections stay inside mobile content width", async () => {
  const [buildScript, paidArticle, accommodationArticle] = await Promise.all([
    readFile("scripts/build-www.mjs", "utf8"),
    readFile("travel-2994364/index.html", "utf8"),
    readFile("travel-992130/index.html", "utf8"),
  ]);

  assert.match(buildScript, /\.article-product-compare-wrap\{[^}]*max-width:100%[^}]*overflow-x:auto[^}]*-webkit-overflow-scrolling:touch/);
  assert.match(buildScript, /@media\(max-width:640px\)\{[^}]*\.article-product-compare-wrap\{overflow-x:visible\}/);
  assert.match(buildScript, /@media\(max-width:640px\)\{[\s\S]*\.article-product-compare\{display:block;width:100%;min-width:0\}/);
  assert.match(buildScript, /\.article-product-compare td\{[^}]*overflow-wrap:anywhere/);
  assert.match(buildScript, /<td data-label="상품명">/);
  assert.match(buildScript, /<td data-label="조건">/);
  assert.match(buildScript, /\.article-product-section\[data-article-product-type="accommodation"\] \.mrt-accommodation-grid\{grid-template-columns:1fr;gap:10px\}/);
  assert.match(buildScript, /class="mrt-accommodation-grid article-accommodation-list"/);
  assert.match(buildScript, /class="article-accommodation-condition"/);

  const ticketBlock = paidArticle.match(/<!-- ARTICLE_PRODUCT_START ticket -->[\s\S]*?<!-- ARTICLE_PRODUCT_END -->/)?.[0] || "";
  assert.match(ticketBlock, /class="article-product-compare-wrap"/);
  assert.match(ticketBlock, /class="article-product-compare"/);
  assert.match(ticketBlock, /<td data-label="상품명">/);
  assert.match(ticketBlock, /<td data-label="조건">/);
  assert.match(paidArticle, /\.article-product-compare-wrap\{[^}]*max-width:100%[^}]*overflow-x:auto/);
  assert.match(paidArticle, /\.article-product-compare\{display:block;width:100%;min-width:0\}/);

  const accommodationBlock =
    accommodationArticle.match(/<!-- ARTICLE_PRODUCT_START accommodation -->[\s\S]*?<!-- ARTICLE_PRODUCT_END -->/)?.[0] || "";
  assert.match(accommodationBlock, /class="mrt-accommodation-grid article-accommodation-list"/);
  assert.match(accommodationBlock, /class="article-accommodation-condition"/);
  assert.match(accommodationBlock, /class="article-product-compare-wrap"/);
  assert.match(accommodationBlock, /class="article-product-compare"/);
  assert.match(accommodationBlock, /class="article-product-link" href="https:\/\/accommodation\.myrealtrip\.com\/[^"]+" rel="sponsored nofollow" target="_blank"/);
  assert.match(
    accommodationBlock,
    /class="article-product-reserve" href="https:\/\/accommodation\.myrealtrip\.com\/[^"]+" rel="sponsored nofollow" target="_blank">예약하기<\/a>/,
  );
});

test("homepage accommodation cards use the dynamic default stay window", async () => {
  const homepage = await readFile("index.html", "utf8");
  const stay = expectedStayWindow();
  const cards = [...homepage.matchAll(/<a class="story-card home-affiliate-card"[^>]*>/g)].map((match) => match[0]);
  assert.ok(cards.length >= 3, "homepage should render a focused set of accommodation cards");
  assert.ok(cards.every((card) => card.includes(`checkIn=${stay.checkIn}`)));
  assert.ok(cards.every((card) => card.includes(`checkOut=${stay.checkOut}`)));
  assert.ok(cards.every((card) => card.includes("adultCount=2")));
  assert.ok(cards.every((card) => card.includes("childCount=0")));
  assert.ok(cards.every((card) => /rel="sponsored nofollow"/.test(card)));
  assert.ok(cards.every((card) => /target="_blank"/.test(card)));
  assert.doesNotMatch(homepage, /checkIn=2026-08-24|checkOut=2026-08-26/);
});

test("beach article pages do not include the removed API information widget", async () => {
  for (const slug of beachSlugs) {
    const html = await readFile(`${slug}/index.html`, "utf8");
    assert.doesNotMatch(html, /\/assets\/beach-(?:info|weather)\.js/);
    assert.doesNotMatch(html, /data-beach-info|article-beach-info/);
  }
});

test("homepage is aligned to August and avoids expired seasonal or Coupang review content", async () => {
  const [homepage, festivalPage] = await Promise.all([
    readFile("index.html", "utf8"),
    readFile("festival/index.html", "utf8"),
  ]);
  assert.match(homepage, /8월 시즌 추천/);
  assert.doesNotMatch(homepage, />7~8월/);
  assert.doesNotMatch(homepage, />7월 (?:가볼만한 곳|축제\/행사)</);
  assert.doesNotMatch(homepage, /coupang-travel-items|coupang-partners-widget|assets\/coupang\.js/);
  assert.match(homepage, /<link rel="canonical" href="https:\/\/tripview\.kr\/">/);
  assert.equal((homepage.match(/<section class="site-section/g) || []).length, 5);
  assert.doesNotMatch(homepage, /id="(?:weekend|water|indoor|family|booking|myrealtrip-deals)"/);

  const ongoingSection = festivalPage.match(/<section[^>]*id="ongoing"[\s\S]*?<\/section>/)?.[0];
  const upcomingSection = festivalPage.match(/<section[^>]*id="upcoming"[\s\S]*?<\/section>/)?.[0];
  const pastSection = festivalPage.match(/<section[^>]*id="past"[\s\S]*?<\/section>/)?.[0];
  assert.ok(pastSection, "ended festival section should exist");
  for (const section of [ongoingSection, upcomingSection, pastSection].filter(Boolean)) {
    assert.ok((section.match(/<a class="story-card/g) || []).length >= 3, "visible festival sections should have at least 3 image cards");
  }
  if (ongoingSection) assert.match(festivalPage, /진행 중인 축제/);
  if (upcomingSection) assert.match(festivalPage, /예정 축제/);
  assert.match(festivalPage, /지난 축제/);
  assert.match(pastSection, /종료 ·/);
  if (upcomingSection) assert.ok(festivalPage.indexOf('id="past"') > festivalPage.indexOf('id="upcoming"'));
});

test("accommodation cards use cached MyRealTrip stay links and stay out of pending articles", async () => {
  const stayPage = await readFile("stay/index.html", "utf8");
  const cards = [...stayPage.matchAll(/<a[^>]*data-mrt-accommodation-card[^>]*>/g)].map((match) => match[0]);
  // /stay/ browses region-first: one <section id="region-..."> per province
  // with up to 6 cards each (see bookingProvinceSections()), not one flat
  // capped list - so the total scales with how many regions have stock.
  const regionSections = [...stayPage.matchAll(/<section class="block" id="region-[^"]+"[\s\S]*?<\/section>/g)].map((match) => match[0]);
  assert.ok(regionSections.length >= 3, "stay page should group accommodation cards under region sections");
  for (const section of regionSections) {
    const sectionCards = (section.match(/data-mrt-accommodation-card/g) || []).length;
    assert.ok(sectionCards >= 1 && sectionCards <= 6, "each region section should keep a focused card set");
  }
  assert.ok(cards.length >= 3, "stay page should have accommodation cards");

  const urls = cards.map((card) => card.match(/href="([^"]+)"/)?.[1]).filter(Boolean);
  const stay = expectedStayWindow();
  assert.equal(new Set(urls).size, urls.length, "stay page accommodation products should not repeat");
  assert.ok(urls.every((url) => /^https:\/\/accommodation\.myrealtrip\.com\//.test(url)));
  assert.ok(urls.every((url) => url.includes(`checkIn=${stay.checkIn}`)));
  assert.ok(urls.every((url) => url.includes(`checkOut=${stay.checkOut}`)));
  assert.ok(urls.every((url) => url.includes("adultCount=2")));
  assert.ok(urls.every((url) => url.includes("childCount=0")));
  assert.ok(cards.every((card) => /rel="sponsored nofollow"/.test(card)));
  assert.ok(cards.every((card) => /target="_blank"/.test(card)));
  assert.match(stayPage, /가격보다 위치와 취소 조건을 먼저 비교하세요/);
  assert.doesNotMatch(stayPage, /id="quick-search"|quick-search-title|조건별 빠른 검색|class="booking-condition"/);
  assert.match(stayPage, /class="booking-affiliate-box"/);
  assert.match(stayPage, /class="booking-city-grid"/);
  assert.match(stayPage, /id="region-seoul"/);
  assert.match(stayPage, /class="booking-product-price">[\d,]+원부터<\/span>/);
  assert.doesNotMatch(stayPage, /checkIn=2026-08-24|checkOut=2026-08-26/);
  const productCards = [...stayPage.matchAll(/<a class="booking-product-card"[^>]*data-mrt-accommodation-card[^>]*>[\s\S]*?<\/a>/g)]
    .map((match) => match[0]);
  assert.equal(productCards.length, cards.length);
  assert.ok(productCards.some((card) => /<img src="https:\/\/[^\"]+"[^>]*loading="lazy"/.test(card)));
  assert.ok(productCards.every((card) => /<img /.test(card)));
  assert.doesNotMatch(stayPage, /data-mrt-accommodation-card[\s\S]{0,500}오사카/);

  const ticketPage = await readFile("ticket/index.html", "utf8");
  const ticketCards = [...ticketPage.matchAll(/<a class="booking-product-card"[^>]*data-mrt-ticket-card[^>]*>/g)].map((match) => match[0]);
  assert.ok(ticketCards.length >= 3, "ticket page should render rating-sorted ticket products");
  assert.match(ticketPage, /일정 확정 전에 운영 조건을 먼저 비교하세요/);
  assert.doesNotMatch(ticketPage, /id="quick-search"|quick-search-title|조건별 빠른 검색|class="booking-condition"/);
  assert.match(ticketPage, /class="booking-affiliate-box"/);
  assert.match(ticketPage, /class="booking-city-grid"/);
  assert.match(ticketPage, /id="region-seoul"/);
  assert.match(ticketPage, /전체 입장권·투어 보기/);
  assert.ok(ticketCards.every((card) => /rel="sponsored nofollow"/.test(card)));
  assert.ok(ticketCards.every((card) => /target="_blank"/.test(card)));

  const [reviewedArticle, paidArticle, pendingArticle] = await Promise.all([
    readFile("travel-126078/index.html", "utf8"),
    readFile("travel-2994364/index.html", "utf8"),
    readFile("festival-4094595/index.html", "utf8"),
  ]);
  assert.match(reviewedArticle, /<section class="article-hero-band"/);
  assert.match(reviewedArticle, /<p class="article-affiliate-disclosure"/);
  assert.match(reviewedArticle, /<table class="article-fact-table"/);
  assert.doesNotMatch(reviewedArticle, /<table class="info-table"/);
  assert.doesNotMatch(reviewedArticle, /<div class="article-info-grid"/);
  assert.match(reviewedArticle, /<!-- ARTICLE_PRODUCT_START accommodation -->/);
  const articleProductBlock = reviewedArticle.match(/<!-- ARTICLE_PRODUCT_START accommodation -->[\s\S]*?<!-- ARTICLE_PRODUCT_END -->/)?.[0] || "";
  const articleAccommodationCards = articleProductBlock.match(/data-mrt-accommodation-card/g) || [];
  assert.ok(articleAccommodationCards.length > 0 && articleAccommodationCards.length <= 6);
  assert.match(articleProductBlock, /class="mrt-accommodation-grid article-accommodation-list"/);
  assert.match(articleProductBlock, /class="article-accommodation-condition"/);
  assert.match(articleProductBlock, /class="article-product-compare-wrap"/);
  assert.match(articleProductBlock, /class="article-product-compare"/);
  assert.match(articleProductBlock, /<td data-label="상품명"><a class="article-product-link" href="https:\/\/accommodation\.myrealtrip\.com\/[^"]+" rel="sponsored nofollow" target="_blank">/);
  assert.match(articleProductBlock, /<td data-label="예약"><a class="article-product-reserve" href="https:\/\/accommodation\.myrealtrip\.com\/[^"]+" rel="sponsored nofollow" target="_blank">예약하기<\/a><\/td>/);
  assert.doesNotMatch(articleProductBlock, /마이리얼트립 숙소/);
  assert.match(articleProductBlock, /class="mrt-accommodation-thumb"><img src="https:\/\/[^\"]+"[^>]*loading="lazy"[^>]*decoding="async"/);
  assert.match(articleProductBlock, /class="mrt-rating-badge"/);
  assert.match(articleProductBlock, /<del>[\d,]+원<\/del><strong>[\d,]+원<\/strong>|<strong>[\d,]+원<\/strong>/);
  assert.match(articleProductBlock, /예약하기/);
  assert.doesNotMatch(reviewedArticle, /<!-- MRT_ACCOMMODATION_START/);
  assert.match(paidArticle, /<!-- ARTICLE_PRODUCT_START ticket -->/);
  assert.doesNotMatch(paidArticle, /data-mrt-accommodation-card/);
  const paidTicketCards = paidArticle.match(/data-mrt-ticket-card/g) || [];
  assert.ok(paidTicketCards.length > 0 && paidTicketCards.length <= 6);
  assert.match(paidArticle, /class="article-product-compare-wrap"/);
  assert.match(paidArticle, /class="article-product-compare"/);
  assert.match(paidArticle, /<td data-label="조건">/);
  assert.match(paidArticle, /<td data-label="예약"><a class="article-product-reserve" href="https:\/\/[^"]*\.myrealtrip\.com\/[^"]+" rel="sponsored nofollow" target="_blank">예약하기<\/a><\/td>/);
  assert.match(paidArticle, /예약하기/);
  assert.match(reviewedArticle, /<meta name="robots" content="index, follow, max-image-preview:large">/);
  assert.doesNotMatch(pendingArticle, /<!-- MRT_ACCOMMODATION_START/);
  assert.doesNotMatch(pendingArticle, /<!-- ARTICLE_PRODUCT_START/);
  assert.doesNotMatch(pendingArticle, /adsbygoogle\.js\?client=/);
  assert.match(pendingArticle, /data-tripview-article/);
  assert.match(pendingArticle, /data-tripview-event/);
  assert.match(pendingArticle, /<meta name="robots" content="noindex, follow">/);

  const flightDirectories = await readdir("flight-deals", { withFileTypes: true });
  const overseasFlightDirectory = flightDirectories.find((entry) => entry.isDirectory() && entry.name.includes("-osa-"));
  assert.ok(overseasFlightDirectory, "an Osaka flight article should exist for the overseas-product guard");
  const overseasFlightArticle = await readFile(`flight-deals/${overseasFlightDirectory.name}/index.html`, "utf8");
  assert.match(overseasFlightArticle, /<meta name="robots" content="noindex, follow">/);
  assert.doesNotMatch(overseasFlightArticle, /adsbygoogle\.js\?client=/);
  assert.doesNotMatch(overseasFlightArticle, /같이 보면 좋은 예약 정보/);
  assert.doesNotMatch(overseasFlightArticle, /experiences\.myrealtrip\.com\/products\//);
});

test("accommodation cache keeps the MyRealTrip API contract lean", async () => {
  const [cacheText, regionMapText, fetchScript] = await Promise.all([
    readFile("data/myrealtrip-accommodation-cache.json", "utf8"),
    readFile("data/myrealtrip-accommodation-region-map.json", "utf8"),
    readFile("scripts/fetch-myrealtrip-accommodations.mjs", "utf8"),
  ]);
  const cache = JSON.parse(cacheText);
  const regionMap = JSON.parse(regionMapText);
  assert.match(cache.checkIn, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(cache.checkOut, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(cache.adultCount, 2);
  assert.equal(cache.childCount, 0);
  assert.equal(cache.presets.default, "threestar,fourstar,fivestar");
  assert.equal(cache.presets.family, "fourstar,fivestar");
  assert.equal(regionMap.endpoint, "/v1/products/accommodation/region-autocomplete");
  assert.ok(Object.keys(regionMap.regions || {}).length >= 1);
  if (regionMap.source === "myrealtrip-accommodation-region-autocomplete") {
    assert.ok(Object.values(regionMap.regions || {}).every((region) => region.regionId), "API-generated region map must keep regionId values");
  } else {
    assert.equal(regionMap.source, "legacy-myrealtrip-accommodation-region-map");
    assert.equal(cache.source, "legacy-myrealtrip-accommodation-cache");
    assert.match(fetchScript, /useLegacyFallback/);
  }
  assert.match(fetchScript, /\/v1\/products\/accommodation\/region-autocomplete/);
  assert.match(fetchScript, /\/v1\/products\/accommodation\/search/);
  assert.match(fetchScript, /starRating/);
  assert.doesNotMatch(cacheText, /"images"|"imageUrls"|"amenities"|"facilities"|"coordinates"|"latitude"|"longitude"/);
});

test("Korea Tourism images render through processed WebP assets", async () => {
  const [manifestText, postsText, article, busanHub, homepage, topicFilter] = await Promise.all([
    readFile("data/processed-tour-images.json", "utf8"),
    readFile("data/generated-posts.json", "utf8"),
    readFile("travel-126078/index.html", "utf8"),
    readFile("region/busan/index.html", "utf8"),
    readFile("index.html", "utf8"),
    readFile("assets/topic-filter.js", "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);
  const posts = JSON.parse(postsText);
  const files = await readdir("assets/processed");
  const processedSlugs = Object.keys(manifest.items || {});
  const indexableSlugs = new Set(posts.filter(isIndexablePost).map((post) => post.slug));
  assert.ok(processedSlugs.length > 0);
  assert.ok(processedSlugs.every((slug) => indexableSlugs.has(slug)));
  assert.ok(files.filter((file) => file.endsWith(".webp")).length >= processedSlugs.length);
  assert.equal(manifest.items["travel-2774026"].cover.src, "/assets/processed/hoengseong-lake-trail-parking.webp");
  assert.equal(manifest.items["travel-2774026"].cover.caption, "출처: 한국관광공사 공공누리 · 트립뷰 편집 이미지");
  assert.equal(manifest.items["travel-2774026"].cover.overlay, null);
  assert.equal(manifest.items["travel-2774026"].cover.width, 800);
  assert.equal(manifest.items["travel-2774026"].cover.height, 500);
  assert.equal(manifest.items["travel-2774026"].cover.processorVersion, "fixed-size-thumbnail-canvas-20260825");
  assert.equal(manifest.items["travel-2774026"].hero.kind, "hero-cover");
  assert.match(manifest.items["travel-2774026"].hero.src, /-hero\.webp$/);
  assert.equal(manifest.items["travel-2774026"].hero.width, 1200);
  assert.equal(manifest.items["travel-2774026"].hero.height, 900);
  assert.equal(manifest.items["travel-2774026"].hero.overlay, null);
  assert.equal(manifest.items["travel-2774026"].hero.processorVersion, "fixed-size-thumbnail-canvas-20260825");
  assert.equal(manifest.items["travel-2774026"].banner.kind, "hub-banner");
  assert.match(manifest.items["travel-2774026"].banner.src, /-banner\.webp$/);
  assert.equal(manifest.items["travel-2774026"].banner.overlay, null);
  assert.equal(manifest.items["travel-2774026"].banner.processorVersion, "fixed-size-thumbnail-canvas-20260825");
  assert.equal(manifest.items["festival-1939183"].cover.posterCanvas, true);
  assert.equal(manifest.items["festival-1939183"].cover.processorVersion, "blurred-poster-canvas-20260827");
  assert.equal(manifest.items["festival-1939183"].hero.processorVersion, "blurred-poster-canvas-20260827");
  assert.equal(manifest.items["festival-1939183"].banner.processorVersion, "blurred-poster-canvas-20260827");
  for (const entry of Object.values(manifest.items || {})) {
    for (const asset of [entry.cover, entry.hero, entry.banner, ...(Array.isArray(entry.images) ? entry.images : [])].filter(Boolean)) {
      assert.equal(asset.overlay, null);
    }
  }
  assert.match(manifestText, /\/assets\/processed\/samcheok-hwanseongul-parking\.webp/);

  assert.match(article, /style="--article-hero-image:url\('\/assets\/processed\/busan-gwangalli-beach-parking\.webp'\)"/);
  assert.match(article, /role="img" aria-label="부산 광안리해수욕장 방문 동선을 참고할 수 있는 트립뷰 편집 이미지"/);
  assert.doesNotMatch(article, /<figure class="cover-figure"/);
  assert.match(article, /출처: 한국관광공사 공공누리 · 트립뷰 편집 이미지/);
  assert.match(
    article,
    /"image":\["https:\/\/tripview\.kr\/assets\/processed\/busan-gwangalli-beach-parking\.webp"(?:,"https:\/\/tripview\.kr\/assets\/processed\/[a-z0-9-]+\.webp")*\]/,
  );
  const articleBody = article.match(/<article\b[^>]*\bclass=["'][^"']*\bcontent\b[^"']*["'][^>]*>([\s\S]*?)<\/article>/i)?.[1] || "";
  assert.doesNotMatch(article, /tong\.visitkorea\.or\.kr/);
  assert.doesNotMatch(article, /이미지 1|<figcaption>대표 이미지/);

  assert.match(homepage, /\/assets\/processed\/[a-z0-9-]+\.webp/);
  assert.match(homepage, /class="story-card home-hero-main"[\s\S]*\/assets\/processed\/[a-z0-9-]+\.webp/);
  assert.doesNotMatch(homepage, /class="story-card home-hero-main"[\s\S]*?\/assets\/processed\/[a-z0-9-]+-banner\.webp/);
  assert.doesNotMatch(homepage, /tong\.visitkorea\.or\.kr/);
  assert.doesNotMatch(homepage, /<span class="story-thumb"><\/span>/);
  assert.doesNotMatch(homepage, /story-thumb no-image/);
  assert.match(busanHub, /\/assets\/processed\/busan-gwangalli-beach-parking\.webp/);
  assert.match(busanHub, /class="hub-banner has-image"/);
  assert.match(busanHub, /\/assets\/processed\/busan-[a-z0-9-]+-banner\.webp/);
  assert.match(busanHub, /출처: 한국관광공사 공공누리 · 트립뷰 편집 배너/);
  assert.doesNotMatch(busanHub, /tong\.visitkorea\.or\.kr/);
  assert.match(topicFilter, /processed-tour-images\.json/);
  assert.match(topicFilter, /processedImage\(post\)/);
});

test("article inline images do not repeat the same Korea Tourism content id", async () => {
  const [manifestText, postsText] = await Promise.all([
    readFile("data/processed-tour-images.json", "utf8"),
    readFile("data/generated-posts.json", "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);
  const posts = JSON.parse(postsText);
  const failures = [];

  for (const post of posts.filter(isIndexablePost)) {
    let document = "";
    try {
      document = await readFile(`${post.slug}/index.html`, "utf8");
    } catch {
      continue;
    }
    const body = articleBodyHtml(document);
    const seen = new Map();
    for (const src of articleInlineImageSources(body)) {
      const original = articleImageOriginal(manifest, post, src);
      const key = tourismImageContentKey(original) || tourismImageContentKey(src);
      if (!key) continue;
      const images = seen.get(key) || [];
      images.push(src);
      seen.set(key, images);
    }
    for (const [key, images] of seen) {
      if (images.length > 1) failures.push({ slug: post.slug, contentKey: key, images });
    }
  }

  assert.deepEqual(failures, []);
});

test("article body uses three to five inline images when enough photos are available", async () => {
  const article = await readFile("travel-125900/index.html", "utf8");
  const body = articleBodyHtml(article);
  const sources = articleInlineImageSources(body);

  assert.equal(sources.length, 5);
  assert.ok(sources.length >= 3 && sources.length <= 5);
  assert.doesNotMatch(body, /src="\/assets\/processed\/cheongyang-janggoksa-parking\.webp"/);
  assert.match(body, /ARTICLE_INLINE_PHOTO_START 5/);
});

test("article schema, festival schema, lodging schema, and language policy are applied", async () => {
  const [festivalArticle, endedFestivalArticle, lodgingArticle, homepage, topicFilter] = await Promise.all([
    readFile("festival-3351451/index.html", "utf8"),
    readFile("festival-1939183/index.html", "utf8"),
    readFile("travel-142733/index.html", "utf8"),
    readFile("index.html", "utf8"),
    readFile("assets/topic-filter.js", "utf8"),
  ]);

  assert.match(festivalArticle, /data-tripview-article/);
  assert.match(festivalArticle, /"@type":"Article"/);
  for (const field of ["headline", "description", "image", "datePublished", "author", "publisher"]) {
    assert.match(festivalArticle, new RegExp(`"${field}"`));
  }
  assert.match(festivalArticle, /data-tripview-event/);
  assert.match(festivalArticle, /"@type":"Event"/);
  for (const field of ["name", "startDate", "endDate", "location"]) {
    assert.match(festivalArticle, new RegExp(`"${field}"`));
  }
  const festivalBody = festivalArticle.match(/<article\b[^>]*\bclass=["'][^"']*\bcontent\b[^"']*["'][^>]*>([\s\S]*?)<\/article>/i)?.[1] || "";
  assert.match(festivalArticle, /--article-hero-image:url\('\/assets\/processed\/seoul-k-illustration-fair-magok-parking\.webp'\)/);
  assert.doesNotMatch(festivalBody, /<section class="article-photo-grid"/);
  assert.equal((festivalBody.match(/ARTICLE_INLINE_PHOTO_START/g) || []).length, 3);
  assert.match(festivalBody, /ARTICLE_INLINE_PHOTO_START 1[\s\S]*seoul-k-illustration-fair-magok-parking-detail-1\.webp[\s\S]*ARTICLE_INLINE_PHOTO_START 2[\s\S]*seoul-k-illustration-fair-magok-parking-detail-2\.webp[\s\S]*ARTICLE_INLINE_PHOTO_START 3[\s\S]*seoul-k-illustration-fair-magok-parking-detail-3\.webp/);
  assert.ok(festivalBody.indexOf("ARTICLE_INLINE_PHOTO_START 1") > festivalBody.indexOf("<h2>관람 포인트</h2>"));
  assert.ok(festivalBody.indexOf("ARTICLE_INLINE_PHOTO_START 3") < festivalBody.indexOf("<h2>자주 묻는 질문</h2>"));
  assert.match(endedFestivalArticle, /<span class="festival-status is-ended">종료<\/span>/);
  assert.match(lodgingArticle, /data-tripview-lodging/);
  assert.match(lodgingArticle, /"@type":"LodgingBusiness"/);

  for (const document of [festivalArticle, lodgingArticle, homepage]) {
    assert.doesNotMatch(document, /\?lang=/);
    assert.doesNotMatch(document, /class="language-switch/);
    assert.doesNotMatch(document, /\/assets\/i18n\.js/);
    assert.doesNotMatch(document, /hreflang=/);
  }
  assert.doesNotMatch(topicFilter, /\?lang=|tripview-lang|currentLangQuery/);
});

test("every generated article has required JSON-LD and festival pages keep ended items low", async () => {
  const [postsText, festivalPage] = await Promise.all([
    readFile("data/generated-posts.json", "utf8"),
    readFile("festival/index.html", "utf8"),
  ]);
  const posts = JSON.parse(postsText);
  let checked = 0;

  for (const post of posts) {
    if (!post?.slug) continue;
    const document = await readFile(`${post.slug}/index.html`, "utf8");
    if (!document.includes('<article class="content"')) continue;
    checked += 1;
    assert.match(document, /data-tripview-article/, post.slug);
    for (const field of ["headline", "description", "image", "datePublished", "author", "publisher"]) {
      assert.match(document, new RegExp(`"${field}"`), post.slug);
    }

    const contentType = String(post.contenttype || post.contentType || "");
    if (contentType === "15" && !post?.dataPipeline?.generated) {
      assert.match(document, /data-tripview-event/, post.slug);
      for (const field of ["name", "startDate", "endDate", "location"]) {
        assert.match(document, new RegExp(`"${field}"`), post.slug);
      }
    }
    if (contentType === "32" && !post?.dataPipeline?.generated) {
      assert.match(document, /data-tripview-lodging/, post.slug);
      assert.match(document, /"@type":"LodgingBusiness"/, post.slug);
    }
  }

  assert.ok(checked > 50);
  const ongoingIndex = festivalPage.indexOf('id="ongoing"');
  const upcomingIndex = festivalPage.indexOf('id="upcoming"');
  const pastIndex = festivalPage.indexOf('id="past"');
  const allPostsIndex = festivalPage.indexOf('id="all-posts"');
  assert.ok(pastIndex > -1);
  for (const index of [ongoingIndex, upcomingIndex].filter((value) => value > -1)) {
    assert.ok(pastIndex > index);
  }
  assert.ok(allPostsIndex > pastIndex);
});

test("generated HTML output does not keep language switch artifacts", async () => {
  const htmlFiles = await collectHtmlFiles(".");
  const failures = [];
  for (const file of htmlFiles) {
    const document = await readFile(file, "utf8");
    if (/\?lang=|hreflang=|class=["']language-switch|\/assets\/i18n\.js|\.language-switch/.test(document)) {
      failures.push(file);
    }
  }
  assert.ok(htmlFiles.length > 50);
  assert.deepEqual(failures, []);
});

test("AdSense script and ads.txt use the same publisher ID", async () => {
  const [homepage, adsText] = await Promise.all([
    readFile("index.html", "utf8"),
    readFile("ads.txt", "utf8"),
  ]);
  const scriptPublisher = homepage.match(/adsbygoogle\.js\?client=(ca-pub-\d+)/)?.[1];
  const adsTextPublisher = adsText.match(/pub-(\d+)/)?.[1];
  assert.equal(scriptPublisher, "ca-pub-5751319666030430");
  assert.equal(`ca-pub-${adsTextPublisher}`, scriptPublisher);
});

test("trust pages use canonical URLs and current homepage anchors", async () => {
  for (const fileName of ["about.html", "contact.html", "editorial-team.html", "editorial-policy.html", "affiliate-disclosure.html", "privacy.html"]) {
    const document = await readFile(fileName, "utf8");
    const canonicalPath = fileName.replace(/\.html$/, "");
    assert.match(document, new RegExp(`<link rel="canonical" href="https://tripview\\.kr/${canonicalPath}">`));
    assert.doesNotMatch(document, /href="\/#/);
    assert.doesNotMatch(document, /href="\/(?:about|contact|editorial-team|editorial-policy|affiliate-disclosure|privacy)\.html"/);
  }
});

test("region hubs are generated and articles link to same-region content", async () => {
  const [gangwonHub, busanHub, article] = await Promise.all([
    readFile("region/gangwon/index.html", "utf8"),
    readFile("region/busan/index.html", "utf8"),
    readFile("travel-2774026/index.html", "utf8"),
  ]);
  assert.match(gangwonHub, /강원 여행 소개/);
  assert.match(gangwonHub, /강원 글 목록/);
  assert.match(gangwonHub, /<link rel="canonical" href="https:\/\/tripview\.kr\/region\/gangwon\/">/);
  assert.match(busanHub, /부산 추천 숙소/);
  const busanAccommodationCards = busanHub.match(/data-mrt-accommodation-card/g) || [];
  assert.ok(busanAccommodationCards.length >= 1 && busanAccommodationCards.length <= 6);
  assert.match(article, /<!-- REGION_RELATED_START -->/);
  assert.match(article, /강원에서 함께 볼 글/);
  assert.match(article, /href="\/region\/gangwon\/"/);
  const relatedBlock = article.match(/<!-- REGION_RELATED_START -->[\s\S]*?<!-- REGION_RELATED_END -->/)?.[0] || "";
  assert.ok((relatedBlock.match(/class="region-related-card"/g) || []).length <= 8);
  assert.match(relatedBlock, /class="region-related-thumb"><img/);
  assert.match(article, /region-related-grid\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
});

test("lodging articles keep place introductions and expanded lodging facts", async () => {
  const article = await readFile("travel-142733/index.html", "utf8");
  assert.match(article, /<section class="article-place-intro"/);
  assert.match(article, /<h2 id="article-place-intro-title">장소 소개<\/h2>/);
  assert.match(article, /객실 수/);
  assert.match(article, /객실 유형/);
  assert.match(article, /부대시설/);
  assert.match(article, /취사/);
  assert.match(article, /주차/);
});

test("lodging articles render photo guides and booking sidebars", async () => {
  const posts = JSON.parse(await readFile("data/generated-posts.json", "utf8"));
  const lodgingPosts = posts.filter((post) => String(post.tourApi?.contentTypeId || post.contentTypeId || post.contenttypeid || post.contentType || "") === "32");
  assert.ok(lodgingPosts.length >= 44, "lodging post count should include the original lodging corpus and any newer scheduled lodging posts");
  for (const post of lodgingPosts) {
    const article = await readFile(`${post.slug}/index.html`, "utf8");
    assert.match(article, /<section class="article-place-intro"/, `${post.slug} should keep a lodging introduction`);
    assert.match(article, /<section class="lodging-photo-guide"/, `${post.slug} should render a lodging photo guide`);
    assert.match(article, /class="lodging-photo-item"[\s\S]*?<img[^>]+loading="lazy"[^>]+decoding="async"/, `${post.slug} should render a lazy guide image`);
    const cta = article.match(/<a class="lodging-booking-button" href="([^"]+)"/);
    assert.ok(cta, `${post.slug} should render a lodging booking button`);
    assert.ok(cta[1].startsWith("/") || cta[1].startsWith("https://"), `${post.slug} should use a valid booking URL`);
    assert.doesNotMatch(article, /<section class="article-photo-grid"/, `${post.slug} should avoid the generic photo grid`);
  }
});

test("generated article pages keep one current site header", async () => {
  for (const fileName of ["travel-2774026/index.html", "festival-3351451/index.html", "data-ticket-price-busan/index.html"]) {
    const document = await readFile(fileName, "utf8");
    assert.equal((document.match(/class="site-header"/g) || []).length, 1);
    assert.equal((document.match(/<footer class="site-footer"/g) || []).length, 1);
    assert.match(document, /<summary class="nav-summary">여행지<\/summary>/);
    assert.match(document, /<summary class="nav-summary">축제·행사<\/summary>/);
    assert.match(document, /<summary class="nav-summary">숙소·예약<\/summary>/);
    assert.doesNotMatch(document, /<summary class="nav-summary">숙소<\/summary>/);
    assert.doesNotMatch(document, /<summary class="nav-summary">입장권·투어<\/summary>/);
  }
});

test("sitemap includes only indexable articles and article robots match content quality", async () => {
  const [sitemap, postsText] = await Promise.all([
    readFile("sitemap.xml", "utf8"),
    readFile("data/generated-posts.json", "utf8"),
  ]);
  const posts = JSON.parse(postsText);
  const indexable = posts.filter(isIndexablePost);
  const regions = expectedRegionSlugs(posts);
  const articleUrls = [...sitemap.matchAll(/<loc>https:\/\/tripview\.kr\/((?:(?:travel|festival)-\d+)|(?:data-[a-z0-9-]+))\/<\/loc>/g)]
    .map((match) => match[1]);
  const regionUrls = [...sitemap.matchAll(/<loc>https:\/\/tripview\.kr\/region\/([a-z0-9-]+)\/<\/loc>/g)]
    .map((match) => match[1])
    .sort();

  assert.equal(articleUrls.length, indexable.length);
  assert.ok(articleUrls.every((slug) => indexable.some((post) => post.slug === slug)));
  assert.match(sitemap, /<loc>https:\/\/tripview\.kr\/travel\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/tripview\.kr\/festival\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/tripview\.kr\/stay\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/tripview\.kr\/ticket\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/tripview\.kr\/data-stay-ticket-seoul\/<\/loc>/);
  assert.deepEqual(regionUrls, regions);
  assert.match(sitemap, /<loc>https:\/\/tripview\.kr\/editorial-team<\/loc>/);
  assert.doesNotMatch(sitemap, /<loc>https:\/\/tripview\.kr\/flight-deals(?:\/|<)/);

  const strongPost = indexable.find((post) => !post?.dataPipeline?.generated);
  const thinPost = posts.find((post) => !isIndexablePost(post));
  assert.ok(strongPost);
  const strongDocument = await readFile(`${strongPost.slug}/index.html`, "utf8");
  assert.match(strongDocument, /<meta name="robots" content="index, follow, max-image-preview:large">/);
  assert.match(strongDocument, /adsbygoogle\.js\?client=ca-pub-5751319666030430/);
  assert.match(strongDocument, /data-tripview-article/);
  assert.match(strongDocument, /class="author-link" href="\/editorial-team"/);
  assert.match(strongDocument, /작성·검수 정보/);
  if (thinPost) {
    const thinDocument = await readFile(`${thinPost.slug}/index.html`, "utf8");
    assert.match(thinDocument, /<meta name="robots" content="noindex, follow">/);
    assert.doesNotMatch(thinDocument, /adsbygoogle\.js\?client=/);
    assert.match(thinDocument, /data-tripview-article/);
    assert.doesNotMatch(thinDocument, /<!-- MRT_AD_START context -->/);
    assert.doesNotMatch(thinDocument, /<!-- MRT_ACCOMMODATION_START/);
  } else {
    assert.equal(indexable.length, posts.length);
  }
});

test("manual Seoul booking guide uses cached products and sponsored links", async () => {
  const [article, sitemap] = await Promise.all([
    readFile("data-stay-ticket-seoul/index.html", "utf8"),
    readFile("sitemap.xml", "utf8"),
  ]);

  assert.match(article, /서울 숙소와 체험 예약 전 비교 총정리/);
  const accommodationCards = [...article.matchAll(/<a\b[^>]*data-mrt-accommodation-card[^>]*>/g)];
  assert.ok(accommodationCards.length >= 3, "manual Seoul guide should render cached accommodation cards");
  assert.match(article, /class="article-product-compare"/);
  assert.match(article, /class="article-product-reserve"[^>]*>예약하기<\/a>/);
  const stay = expectedStayWindow();
  assert.match(article, new RegExp(`checkIn=${stay.checkIn}`));
  assert.match(article, new RegExp(`checkOut=${stay.checkOut}`));
  assert.match(article, /adultCount=2/);
  assert.match(article, /childCount=0/);
  assert.match(article, /data-tripview-article/);
  assert.match(article, /<meta name="robots" content="index, follow, max-image-preview:large">/);

  const affiliateLinks = [...article.matchAll(/<a\b[^>]*(?:data-affiliate-link|data-mrt-accommodation-card)[^>]*>/g)];
  assert.ok(affiliateLinks.length > 0 && affiliateLinks.length <= 8);
  assert.ok(affiliateLinks.every((match) => /target="_blank"/.test(match[0])));
  assert.ok(affiliateLinks.every((match) => /rel="[^"]*\bsponsored\b[^"]*\bnofollow\b[^"]*"/.test(match[0])));
  assert.match(sitemap, /<loc>https:\/\/tripview\.kr\/data-stay-ticket-seoul\/<\/loc>/);
});

test("data post pipeline outputs validated data pages", async () => {
  const [postsText, sitemap, stay, festival, ticket, logText, dataWorkflow, tourWorkflow, postNowWorkflow, tourScript] = await Promise.all([
    readFile("data/generated-posts.json", "utf8"),
    readFile("sitemap.xml", "utf8"),
    readFile("data-stay-price-seoul/index.html", "utf8"),
    readFile("data-festival-schedule-seoul/index.html", "utf8"),
    readFile("data-ticket-price-busan/index.html", "utf8"),
    readFile("data/data-post-pipeline-log.json", "utf8"),
    readFile(".github/workflows/data-post-pipeline.yml", "utf8"),
    readFile(".github/workflows/daily-tour-posts.yml", "utf8"),
    readFile(".github/workflows/post-10-now.yml", "utf8"),
    readFile("scripts/daily-tour-posts.mjs", "utf8"),
  ]);
  const posts = JSON.parse(postsText);
  const log = JSON.parse(logText);
  const dataPosts = posts.filter((post) => post?.dataPipeline?.generated);
  const allowedKinds = new Set(["stay-price", "festival-schedule", "ticket-price"]);
  const latestPublishedRun = [...log.runs].reverse().find((run) => !run.stoppedReason && Array.isArray(run.generated));
  assert.ok(dataPosts.length > 0);
  assert.ok(latestPublishedRun.generatedCount > 0 && latestPublishedRun.generatedCount <= 3);
  assert.equal(new Set(latestPublishedRun.generated.map((item) => item.type)).size, latestPublishedRun.generated.length);
  const latestRunSlugs = new Set([
    ...latestPublishedRun.generated,
    ...(latestPublishedRun.refreshed || []),
  ].map((item) => item.slug));
  assert.ok(dataPosts.every((post) => allowedKinds.has(post.dataPipeline.kind)));
  assert.ok(dataPosts.every((post) => /^data-(stay-price|festival-schedule|ticket-price)-[a-z0-9-]+$/.test(post.slug)));
  for (const post of dataPosts) {
    assert.equal(post.dataPipeline.validation.version, "2026-08-24-data-gate-v2");
    assert.ok(post.dataPipeline.validation.allowedNumbers.length > 0);
    assert.ok(post.dataPipeline.validation.rowCount >= 2);
    assert.ok(post.dataPipeline.validation.affiliateLinkCount <= 8);
    assert.ok(post.dataPipeline.validation.affiliateTextRatio <= 0.3);
  }
  for (const post of dataPosts.filter((post) => latestRunSlugs.has(post.slug) && isIndexablePost(post))) {
    assert.ok(sitemap.includes(`<loc>https://tripview.kr/${post.slug}/</loc>`));
  }

  const dataDocumentsWithAffiliateLinks = [stay, ticket].filter((document) => /<a\b[^>]*data-affiliate-link[^>]*>/.test(document));
  assert.ok(dataDocumentsWithAffiliateLinks.length > 0);
  for (const document of dataDocumentsWithAffiliateLinks) {
    const affiliateLinks = [...document.matchAll(/<a\b[^>]*data-affiliate-link[^>]*>/g)];
    assert.ok(affiliateLinks.length > 0 && affiliateLinks.length <= 8);
    assert.ok(affiliateLinks.every((match) => /rel="[^"]*\bsponsored\b[^"]*\bnofollow\b[^"]*"/.test(match[0])));
    assert.ok(affiliateLinks.every((match) => /target="_blank"/.test(match[0])));
    assert.ok(document.indexOf("affiliate-disclosure") < document.indexOf("<article class=\"content\""));
    assert.doesNotMatch(document, /<!-- MRT_ACCOMMODATION_START/);
  }

  assert.match(festival, /서울 축제 일정 정리/);
  assert.match(festival, /data-tripview-article/);
  assert.doesNotMatch(festival, /data-tripview-event/);
  assert.doesNotMatch(visibleText(`${stay}\n${festival}\n${ticket}`), /\[[^\]]+\]/);
  assert.ok(log.runs.some((run) => run.generatedCount === 3 && run.generated.some((item) => item.slug === "data-stay-price-seoul")));
  for (const run of log.runs) {
    assert.ok(run.generatedCount <= 3);
    const typeCounts = run.generated.reduce((counts, item) => {
      counts[item.type] = (counts[item.type] || 0) + 1;
      return counts;
    }, {});
    assert.ok(Object.values(typeCounts).every((count) => count <= 1));
    assert.ok(Array.isArray(run.discarded));
  }
  assert.match(dataWorkflow, /cron: "20 18 \* \* \*"/);
  assert.match(dataWorkflow, /npm run generate:data-posts/);
  assert.match(dataWorkflow, /DATA_PIPELINE_VALIDATE_LIVE_URLS: "true"/);
  assert.match(tourWorkflow, /\n\s*schedule:\s*\n\s*-\s*cron: "30 15 \* \* \*"/);
  assert.match(tourWorkflow, /default: "5"/);
  assert.match(tourWorkflow, /POST_LIMIT: \$\{\{ github\.event\.inputs\.limit \|\| '5' \}\}/);
  assert.match(tourScript, /Published category distribution/);
  assert.match(tourScript, /Image requirement skipped/);
  assert.match(postNowWorkflow, /Published category distribution/);
  assert.match(postNowWorkflow, /여행정보/);
});

test("editorial review manifest selects 51 unique, traceable articles", async () => {
  const [manifestText, postsText] = await Promise.all([
    readFile("data/editorial-review.json", "utf8"),
    readFile("data/generated-posts.json", "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);
  const posts = JSON.parse(postsText);
  const slugs = manifest.posts.map((entry) => entry.slug);
  const topicCounts = manifest.posts.flatMap((entry) => entry.topics).reduce((counts, topic) => {
    counts[topic] = (counts[topic] || 0) + 1;
    return counts;
  }, {});

  assert.equal(manifest.posts.length, 51);
  assert.equal(new Set(slugs).size, slugs.length);
  assert.deepEqual(topicCounts, { popular: 6, weekend: 6, festival: 13, water: 12, indoor: 8, family: 6 });
  for (const entry of manifest.posts) {
    const post = posts.find((candidate) => candidate.slug === entry.slug);
    assert.ok(post, `reviewed post ${entry.slug} should exist`);
    assert.ok(post.title);
    assert.ok(entry.title);
    if (post.editorialStatus) {
      assert.equal(post.editorialStatus, "reviewed");
      assert.equal(post.editorialReviewedAt, entry.reviewedAt || manifest.reviewedAt);
      assert.equal(post.editorialAuthorProfile, "/editorial-team");
    }
    assert.ok(entry.angle.length >= 40);
    if (entry.publishedAt) {
      assert.equal(post.sortDate, entry.publishedAt);
      assert.equal(post.date, "2026년 8월 15일");
      assert.ok(post.sections.length >= 7);
      assert.ok(post.faq.length >= 5);
      if (entry.officialUrl) assert.equal(post.tourApi.homepage, entry.officialUrl);
    }
  }
});
