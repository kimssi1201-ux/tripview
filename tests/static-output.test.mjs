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

test("affiliate cards are contextual, unique, safely linked, and absent from unmatched articles", async () => {
  const homepage = await readFile("index.html", "utf8");
  const cards = [...homepage.matchAll(/<a[^>]*data-affiliate-match="context"[^>]*>/g)].map((match) => match[0]);
  assert.ok(cards.length > 0, "at least one contextual affiliate card should be rendered");

  const urls = cards.map((card) => card.match(/href="([^"]+)"/)?.[1]).filter(Boolean);
  assert.equal(new Set(urls).size, urls.length, "homepage affiliate products should not repeat");
  assert.ok(urls.every((url) => /^https:\/\/(?:[^/]+\.)?myrealtrip\.com\//.test(url)));
  assert.ok(cards.every((card) => /rel="sponsored noopener"/.test(card)));
  assert.doesNotMatch(homepage, /data-affiliate-match="context"[\s\S]{0,500}오사카/);

  const [seoulArticle, unmatchedArticle, thinSeoulArticle] = await Promise.all([
    readFile("festival-4094595/index.html", "utf8"),
    readFile("festival-4008618/index.html", "utf8"),
    readFile("travel-142733/index.html", "utf8"),
  ]);
  assert.match(seoulArticle, /<!-- MRT_AD_START context -->/);
  assert.match(seoulArticle, /서울 일정에 맞춘 인근 숙소/);
  assert.doesNotMatch(unmatchedArticle, /<!-- MRT_AD_START context -->/);
  assert.match(thinSeoulArticle, /<meta name="robots" content="noindex, follow">/);
  assert.doesNotMatch(thinSeoulArticle, /<!-- MRT_AD_START context -->/);

  const flightDirectories = await readdir("flight-deals", { withFileTypes: true });
  const overseasFlightDirectory = flightDirectories.find((entry) => entry.isDirectory() && entry.name.includes("-osa-"));
  assert.ok(overseasFlightDirectory, "an Osaka flight article should exist for the overseas-product guard");
  const overseasFlightArticle = await readFile(`flight-deals/${overseasFlightDirectory.name}/index.html`, "utf8");
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
  for (const fileName of ["about.html", "contact.html", "editorial-policy.html", "affiliate-disclosure.html", "privacy.html"]) {
    const document = await readFile(fileName, "utf8");
    assert.match(document, new RegExp(`<link rel="canonical" href="https://tripview\\.kr/${fileName}">`));
    assert.doesNotMatch(document, /\/#(?:latest|routes)/);
  }
});

test("sitemap includes only indexable articles and thin pages use noindex", async () => {
  const [sitemap, postsText] = await Promise.all([
    readFile("sitemap.xml", "utf8"),
    readFile("data/generated-posts.json", "utf8"),
  ]);
  const posts = JSON.parse(postsText);
  const indexable = posts.filter(isIndexablePost);
  const articleUrls = [...sitemap.matchAll(/<loc>https:\/\/tripview\.kr\/((?:travel|festival)-\d+)\/<\/loc>/g)]
    .map((match) => match[1]);

  assert.equal(articleUrls.length, indexable.length);
  assert.ok(articleUrls.every((slug) => indexable.some((post) => post.slug === slug)));

  const thinPost = posts.find((post) => !isIndexablePost(post));
  const strongPost = indexable[0];
  assert.ok(thinPost && strongPost);
  assert.match(await readFile(`${thinPost.slug}/index.html`, "utf8"), /<meta name="robots" content="noindex, follow">/);
  assert.match(await readFile(`${strongPost.slug}/index.html`, "utf8"), /<meta name="robots" content="index, follow, max-image-preview:large">/);
});
