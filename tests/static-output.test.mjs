import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
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

test("homepage categories use real URLs and travel keeps old topics as tags", async () => {
  const [homepage, travelPage] = await Promise.all([
    readFile("index.html", "utf8"),
    readFile("travel/index.html", "utf8"),
  ]);
  assert.match(homepage, /<a class="is-active" href="\/">홈<\/a>/);
  assert.match(homepage, /<a href="\/travel\/">여행지<\/a>/);
  assert.match(homepage, /<a href="\/festival\/">축제<\/a>/);
  assert.match(homepage, /<a href="\/stay\/">숙소·예약<\/a>/);
  assert.doesNotMatch(homepage, /<a[^>]+href="#(?:water|weekend|festival|indoor|family|booking|myrealtrip-deals)"/);
  assert.doesNotMatch(homepage, /data-filter="(?:water|weekend|festival|indoor|family|booking)"/);

  for (const tag of ["tag-weekend", "tag-water", "tag-indoor", "tag-family"]) {
    assert.match(travelPage, new RegExp(`id="${tag}"`));
  }
  assert.match(travelPage, /물놀이·계곡/);
  assert.match(travelPage, /실내여행/);
  assert.match(travelPage, /아이와/);
  assert.equal(beachSlugs.filter((slug) => travelPage.includes(`/${slug}/`)).length, 6);
});

test("homepage uses one editorial masthead and a five-story lead package", async () => {
  const homepage = await readFile("index.html", "utf8");
  assert.equal((homepage.match(/class="masthead-row"/g) || []).length, 1);
  assert.equal((homepage.match(/class="nav-scroll"/g) || []).length, 1);
  assert.match(homepage, /<h1 class="brand-heading"><a class="brand" href="\/">트립뷰<\/a><\/h1>/);
  assert.equal((homepage.match(/class="hero-main magazine-card"/g) || []).length, 1);
  assert.equal((homepage.match(/class="hero-rail-card magazine-card"/g) || []).length, 4);
  assert.equal((homepage.match(/<section class="news-section editorial-hero"/g) || []).length, 1);
  assert.doesNotMatch(homepage, /class="category-top"/);
  assert.doesNotMatch(homepage, /class="news-list category-list"/);
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
  assert.match(homepage, /8월 가볼만한 곳/);
  assert.doesNotMatch(homepage, />7~8월/);
  assert.doesNotMatch(homepage, />7월 (?:가볼만한 곳|축제\/행사)</);
  assert.doesNotMatch(homepage, /coupang-travel-items|coupang-partners-widget|assets\/coupang\.js/);
  assert.match(homepage, /<link rel="canonical" href="https:\/\/tripview\.kr\/">/);
  assert.equal((homepage.match(/<section class="news-section/g) || []).length, 1);
  assert.doesNotMatch(homepage, /id="(?:weekend|water|festival|indoor|family|booking|myrealtrip-deals)"/);

  const festivalSection = festivalPage.match(/<section[^>]*id="featured"[\s\S]*?<\/section>/)?.[0];
  assert.ok(festivalSection, "August festival section should exist");
  const festivalCards = (festivalSection.match(/class="[^"]*\bstory-card\b[^"]*"/g) || []).length;
  assert.ok(festivalCards >= 6 && festivalCards <= 10);
  for (const slug of ["festival-3351451", "festival-1939183", "festival-4096371"]) {
    assert.match(festivalSection, new RegExp(`/${slug}/`));
  }
  assert.ok(festivalSection.indexOf("/festival-4096371/") < festivalSection.indexOf("/festival-3351451/"));
  assert.match(festivalSection, /종료 · 서울/);
  assert.doesNotMatch(festivalSection, /festival-4088257/);
});

test("accommodation cards use cached MyRealTrip stay links and stay out of pending articles", async () => {
  const stayPage = await readFile("stay/index.html", "utf8");
  const cards = [...stayPage.matchAll(/<a[^>]*data-mrt-accommodation-card[^>]*>/g)].map((match) => match[0]);
  assert.ok(cards.length >= 3 && cards.length <= 12, "stay page should keep a focused accommodation card set");

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
  assert.match(stayPage, /숙소 카드/);
  assert.match(stayPage, /class="mrt-accommodation-badge"/);
  assert.match(stayPage, /<del>[\d,]+원<\/del><strong>[\d,]+원<\/strong>/);
  assert.doesNotMatch(stayPage, /checkIn=2026-08-24|checkOut=2026-08-26/);
  const productCards = [...stayPage.matchAll(/<a class="mrt-accommodation-card"[^>]*data-mrt-accommodation-card[^>]*>[\s\S]*?<\/a>/g)]
    .map((match) => match[0]);
  assert.equal(productCards.length, cards.length);
  assert.ok(productCards.some((card) => /<img src="https:\/\/[^\"]+"[^>]*loading="lazy"/.test(card)));
  assert.ok(productCards.every((card) => /<img /.test(card)));
  assert.doesNotMatch(stayPage, /data-mrt-accommodation-card[\s\S]{0,500}오사카/);

  const [reviewedArticle, pendingArticle] = await Promise.all([
    readFile("travel-126078/index.html", "utf8"),
    readFile("festival-4094595/index.html", "utf8"),
  ]);
  assert.match(reviewedArticle, /<!-- MRT_ACCOMMODATION_START mid -->/);
  assert.match(reviewedArticle, /<!-- MRT_ACCOMMODATION_START bottom -->/);
  const midBlock = reviewedArticle.match(/<!-- MRT_ACCOMMODATION_START mid -->[\s\S]*?<!-- MRT_ACCOMMODATION_END -->/)?.[0] || "";
  const bottomBlock = reviewedArticle.match(/<!-- MRT_ACCOMMODATION_START bottom -->[\s\S]*?<!-- MRT_ACCOMMODATION_END -->/)?.[0] || "";
  assert.equal((midBlock.match(/data-mrt-accommodation-card/g) || []).length, 1);
  assert.ok((bottomBlock.match(/data-mrt-accommodation-card/g) || []).length <= 2);
  assert.ok(((midBlock + bottomBlock).match(/data-mrt-accommodation-card/g) || []).length <= 3);
  assert.match(reviewedArticle, /class="mrt-accommodation-thumb"><img src="https:\/\/[^\"]+"[^>]*loading="lazy"/);
  assert.match(reviewedArticle, /<meta name="robots" content="index, follow, max-image-preview:large">/);
  assert.doesNotMatch(pendingArticle, /<!-- MRT_ACCOMMODATION_START/);
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
  const stay = expectedStayWindow();
  assert.equal(cache.checkIn, stay.checkIn);
  assert.equal(cache.checkOut, stay.checkOut);
  assert.equal(cache.adultCount, 2);
  assert.equal(cache.childCount, 0);
  assert.equal(cache.presets.default, "threestar,fourstar,fivestar");
  assert.equal(cache.presets.family, "fourstar,fivestar");
  assert.equal(regionMap.endpoint, "/v1/products/accommodation/region-autocomplete");
  assert.ok(Object.keys(regionMap.regions || {}).length >= 1);
  assert.match(fetchScript, /\/v1\/products\/accommodation\/region-autocomplete/);
  assert.match(fetchScript, /\/v1\/products\/accommodation\/search/);
  assert.match(fetchScript, /starRating/);
  assert.doesNotMatch(cacheText, /"images"|"imageUrls"|"amenities"|"facilities"|"coordinates"|"latitude"|"longitude"/);
});

test("Korea Tourism images render through processed WebP assets", async () => {
  const [manifestText, article, busanHub, homepage, topicFilter] = await Promise.all([
    readFile("data/processed-tour-images.json", "utf8"),
    readFile("travel-126078/index.html", "utf8"),
    readFile("region/busan/index.html", "utf8"),
    readFile("index.html", "utf8"),
    readFile("assets/topic-filter.js", "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);
  const files = await readdir("assets/processed");
  assert.equal(Object.keys(manifest.items || {}).length, 51);
  assert.ok(files.filter((file) => file.endsWith(".webp")).length >= 51);
  assert.equal(manifest.items["travel-2774026"].cover.src, "/assets/processed/hoengseong-lake-trail-parking.webp");
  assert.equal(manifest.items["travel-2774026"].cover.caption, "출처: 한국관광공사 공공누리 · 트립뷰 편집 썸네일");
  assert.match(manifestText, /\/assets\/processed\/samcheok-hwanseongul-parking\.webp/);

  assert.match(article, /src="\/assets\/processed\/busan-gwangalli-beach-parking\.webp"/);
  assert.match(article, /alt="부산 광안리해수욕장 주차·동선 정보를 한눈에 볼 수 있게 편집한 트립뷰 썸네일"/);
  assert.match(article, /loading="lazy"/);
  assert.match(article, /출처: 한국관광공사 공공누리 · 트립뷰 편집 썸네일/);
  assert.match(article, /"image":\["https:\/\/tripview\.kr\/assets\/processed\/busan-gwangalli-beach-parking\.webp"\]/);
  assert.doesNotMatch(article, /tong\.visitkorea\.or\.kr/);
  assert.doesNotMatch(article, /이미지 1|대표 이미지/);

  assert.match(homepage, /\/assets\/processed\/[a-z0-9-]+\.webp/);
  assert.doesNotMatch(homepage, /tong\.visitkorea\.or\.kr/);
  assert.match(busanHub, /\/assets\/processed\/busan-gwangalli-beach-parking\.webp/);
  assert.doesNotMatch(busanHub, /tong\.visitkorea\.or\.kr/);
  assert.match(topicFilter, /processed-tour-images\.json/);
  assert.match(topicFilter, /processedImage\(post\)/);
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
  assert.ok((relatedBlock.match(/class="region-related-card"/g) || []).length <= 3);
});

test("sitemap includes only indexable articles and article robots match content quality", async () => {
  const [sitemap, postsText] = await Promise.all([
    readFile("sitemap.xml", "utf8"),
    readFile("data/generated-posts.json", "utf8"),
  ]);
  const posts = JSON.parse(postsText);
  const indexable = posts.filter(isIndexablePost);
  const regions = expectedRegionSlugs(posts);
  const articleUrls = [...sitemap.matchAll(/<loc>https:\/\/tripview\.kr\/((?:travel|festival)-\d+)\/<\/loc>/g)]
    .map((match) => match[1]);
  const regionUrls = [...sitemap.matchAll(/<loc>https:\/\/tripview\.kr\/region\/([a-z0-9-]+)\/<\/loc>/g)]
    .map((match) => match[1])
    .sort();

  assert.equal(indexable.length, 51);
  assert.equal(articleUrls.length, indexable.length);
  assert.ok(articleUrls.every((slug) => indexable.some((post) => post.slug === slug)));
  assert.match(sitemap, /<loc>https:\/\/tripview\.kr\/travel\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/tripview\.kr\/festival\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/tripview\.kr\/stay\/<\/loc>/);
  assert.deepEqual(regionUrls, regions);
  assert.match(sitemap, /<loc>https:\/\/tripview\.kr\/editorial-team<\/loc>/);
  assert.doesNotMatch(sitemap, /<loc>https:\/\/tripview\.kr\/flight-deals(?:\/|<)/);

  const strongPost = indexable[0];
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
    assert.equal(post.editorialStatus, "reviewed");
    assert.equal(post.title, entry.title);
    assert.equal(post.editorialReviewedAt, entry.reviewedAt || manifest.reviewedAt);
    assert.equal(post.editorialAuthorProfile, "/editorial-team");
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
