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
