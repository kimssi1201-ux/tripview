import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
  assert.equal((waterSection.match(/class="magazine-card"/g) || []).length, 12);
  assert.equal(beachSlugs.filter((slug) => waterSection.includes(`/${slug}/`)).length, 6);
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
  assert.doesNotMatch(homepage, /7~8월/);
  assert.doesNotMatch(homepage, /coupang-travel-items|coupang-partners-widget|assets\/coupang\.js/);
  assert.match(homepage, /<link rel="canonical" href="https:\/\/tripview\.kr\/">/);

  const festivalSection = homepage.match(/<section[^>]*id="festival"[\s\S]*?<\/section>/)?.[0];
  assert.ok(festivalSection, "August festival section should exist");
  assert.equal((festivalSection.match(/class="magazine-card"/g) || []).length, 6);
  assert.doesNotMatch(festivalSection, /festival-4088257/);
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
