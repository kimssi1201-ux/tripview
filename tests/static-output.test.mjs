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

test("homepage has one merged water section without a dedicated beach filter", async () => {
  const homepage = await readFile("index.html", "utf8");
  assert.doesNotMatch(homepage, /id="beach"/);
  assert.doesNotMatch(homepage, /data-filter="beach"/);

  const waterSection = homepage.match(/<section[^>]*id="water"[\s\S]*?<\/section>/)?.[0];
  assert.ok(waterSection, "water section should exist");
  assert.equal((waterSection.match(/class="[^"]*\bmagazine-card\b[^"]*"/g) || []).length, 12);
  assert.equal(beachSlugs.filter((slug) => waterSection.includes(`/${slug}/`)).length, 6);
});

test("homepage uses one editorial masthead and a five-story lead package", async () => {
  const homepage = await readFile("index.html", "utf8");
  assert.equal((homepage.match(/class="masthead-row"/g) || []).length, 1);
  assert.equal((homepage.match(/class="nav-scroll"/g) || []).length, 1);
  assert.match(homepage, /<h1 class="brand-heading"><a class="brand" href="\/">트립뷰<\/a><\/h1>/);
  assert.equal((homepage.match(/class="hero-main magazine-card"/g) || []).length, 1);
  assert.equal((homepage.match(/class="hero-rail-card magazine-card"/g) || []).length, 4);
  assert.match(homepage, /class="category-top"/);
  assert.match(homepage, /class="news-list category-list"/);
});

test("beach article pages do not include the removed API information widget", async () => {
  for (const slug of beachSlugs) {
    const html = await readFile(`${slug}/index.html`, "utf8");
    assert.doesNotMatch(html, /\/assets\/beach-(?:info|weather)\.js/);
    assert.doesNotMatch(html, /data-beach-info|article-beach-info/);
  }
});

test("homepage is aligned to August and avoids expired seasonal or Coupang review content", async () => {
  const homepage = await readFile("index.html", "utf8");
  assert.match(homepage, /8월 가볼만한 곳/);
  assert.match(homepage, /8월 축제\/행사/);
  assert.doesNotMatch(homepage, />7~8월/);
  assert.doesNotMatch(homepage, />7월 (?:가볼만한 곳|축제\/행사)</);
  assert.doesNotMatch(homepage, /coupang-travel-items|coupang-partners-widget|assets\/coupang\.js/);
  assert.match(homepage, /<link rel="canonical" href="https:\/\/tripview\.kr\/">/);

  const festivalSection = homepage.match(/<section[^>]*id="festival"[\s\S]*?<\/section>/)?.[0];
  assert.ok(festivalSection, "August festival section should exist");
  assert.equal((festivalSection.match(/class="[^"]*\bmagazine-card\b[^"]*"/g) || []).length, 6);
  assert.doesNotMatch(festivalSection, /festival-4088257/);
});

test("affiliate cards are contextual, limited, safely linked, and absent from pending articles", async () => {
  const [homepage, articleBuildScript] = await Promise.all([
    readFile("index.html", "utf8"),
    readFile("scripts/build-www.mjs", "utf8"),
  ]);
  const cards = [...homepage.matchAll(/<a[^>]*data-affiliate-match="context"[^>]*>/g)].map((match) => match[0]);
  assert.equal(cards.length, 2, "homepage affiliate products should remain a small supporting section");

  const urls = cards.map((card) => card.match(/href="([^"]+)"/)?.[1]).filter(Boolean);
  assert.equal(new Set(urls).size, urls.length, "homepage affiliate products should not repeat");
  assert.ok(urls.every((url) => /^https:\/\/(?:[^/]+\.)?myrealtrip\.com\//.test(url)));
  assert.ok(cards.every((card) => /rel="sponsored noopener"/.test(card)));
  assert.match(homepage, /여행지별 숙소·투어/);
  assert.doesNotMatch(homepage, /콘텐츠와 맞는 예약 정보|맞춤 예약 정보/);
  assert.match(articleBuildScript, /const title = "주변 숙소·투어"/);
  assert.doesNotMatch(articleBuildScript, /이 여행지 예약 정보|일정에 맞춘 인근 숙소/);
  const productCards = [...homepage.matchAll(/<a class="check-card product-card"[^>]*data-affiliate-match="context"[^>]*>[\s\S]*?<\/a>/g)]
    .map((match) => match[0]);
  assert.equal(productCards.length, cards.length);
  assert.ok(productCards.some((card) => /<img src="https:\/\/[^\"]+"[^>]*loading="lazy"/.test(card)));
  assert.ok(productCards.every((card) => /<img /.test(card) || /\bno-thumb\b/.test(card)));
  assert.doesNotMatch(homepage, /data-affiliate-match="context"[\s\S]{0,500}오사카/);

  const [reviewedArticle, pendingArticle] = await Promise.all([
    readFile("travel-126078/index.html", "utf8"),
    readFile("festival-4094595/index.html", "utf8"),
  ]);
  assert.match(reviewedArticle, /<!-- MRT_AD_START context -->/);
  assert.match(reviewedArticle, /class="mrt-thumb"><img src="https:\/\/[^\"]+"[^>]*loading="lazy"/);
  assert.match(reviewedArticle, /<meta name="robots" content="index, follow, max-image-preview:large">/);
  assert.doesNotMatch(pendingArticle, /<!-- MRT_AD_START context -->/);
  assert.doesNotMatch(pendingArticle, /adsbygoogle\.js\?client=/);
  assert.doesNotMatch(pendingArticle, /data-tripview-article/);
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
    assert.match(document, new RegExp(`<link rel="canonical" href="https://tripview\\.kr/${fileName}">`));
    assert.doesNotMatch(document, /\/#(?:latest|routes)/);
  }
});

test("sitemap includes only indexable articles and article robots match content quality", async () => {
  const [sitemap, postsText] = await Promise.all([
    readFile("sitemap.xml", "utf8"),
    readFile("data/generated-posts.json", "utf8"),
  ]);
  const posts = JSON.parse(postsText);
  const indexable = posts.filter(isIndexablePost);
  const articleUrls = [...sitemap.matchAll(/<loc>https:\/\/tripview\.kr\/((?:travel|festival)-\d+)\/<\/loc>/g)]
    .map((match) => match[1]);

  assert.equal(indexable.length, 48);
  assert.equal(articleUrls.length, indexable.length);
  assert.ok(articleUrls.every((slug) => indexable.some((post) => post.slug === slug)));
  assert.match(sitemap, /<loc>https:\/\/tripview\.kr\/editorial-team\.html<\/loc>/);
  assert.doesNotMatch(sitemap, /<loc>https:\/\/tripview\.kr\/flight-deals(?:\/|<)/);

  const strongPost = indexable[0];
  const thinPost = posts.find((post) => !isIndexablePost(post));
  assert.ok(strongPost);
  const strongDocument = await readFile(`${strongPost.slug}/index.html`, "utf8");
  assert.match(strongDocument, /<meta name="robots" content="index, follow, max-image-preview:large">/);
  assert.match(strongDocument, /adsbygoogle\.js\?client=ca-pub-5751319666030430/);
  assert.match(strongDocument, /data-tripview-article/);
  assert.match(strongDocument, /class="author-link" href="\/editorial-team\.html"/);
  assert.match(strongDocument, /작성·검수 정보/);
  if (thinPost) {
    const thinDocument = await readFile(`${thinPost.slug}/index.html`, "utf8");
    assert.match(thinDocument, /<meta name="robots" content="noindex, follow">/);
    assert.doesNotMatch(thinDocument, /adsbygoogle\.js\?client=/);
    assert.doesNotMatch(thinDocument, /data-tripview-article/);
    assert.doesNotMatch(thinDocument, /<!-- MRT_AD_START context -->/);
  } else {
    assert.equal(indexable.length, posts.length);
  }
});

test("editorial review manifest selects 48 unique, traceable articles", async () => {
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

  assert.equal(manifest.posts.length, 48);
  assert.equal(new Set(slugs).size, slugs.length);
  assert.deepEqual(topicCounts, { popular: 6, weekend: 6, festival: 10, water: 12, indoor: 8, family: 6 });
  for (const entry of manifest.posts) {
    const post = posts.find((candidate) => candidate.slug === entry.slug);
    assert.ok(post, `reviewed post ${entry.slug} should exist`);
    assert.equal(post.editorialStatus, "reviewed");
    assert.equal(post.title, entry.title);
    assert.equal(post.editorialReviewedAt, manifest.reviewedAt);
    assert.equal(post.editorialAuthorProfile, "/editorial-team.html");
    assert.ok(entry.angle.length >= 40);
  }
});
