import assert from "node:assert/strict";
import test from "node:test";
import { readFile, access } from "node:fs/promises";
import { existsSync } from "node:fs";

import { calculateTripBudget, PACKING_PRESETS, packingProgress } from "../assets/travel-tools.js";
import { AFFILIATE_DISPLAY_ENABLED } from "../src/lib/monetization.mjs";
import { homepageSections, sitemapUrls } from "../src/lib/content.mjs";

test("two people and three days produce a transparent and accurate budget", () => {
  const result = calculateTripBudget({
    travelers: 2, days: 3, rooms: 1,
    lodgingPerRoomNight: 100000, foodPerPersonDay: 30000,
    localTransportPerPersonDay: 10000, activitiesPerPersonDay: 15000,
    roundtripPerPerson: 50000, bufferPercent: 10,
  });
  assert.deepEqual(
    [result.lodging, result.food, result.localTransport, result.activities, result.roundtrip, result.subtotal, result.buffer, result.total, result.perPerson],
    [200000, 180000, 60000, 90000, 100000, 630000, 63000, 693000, 346500],
  );
});

test("day trips and zero costs do not create negative nights", () => {
  const result = calculateTripBudget({ travelers: 1, days: 1, rooms: 1, lodgingPerRoomNight: 300000 });
  assert.equal(result.nights, 0);
  assert.equal(result.lodging, 0);
  assert.equal(result.total, 0);
});

test("numeric values are bounded and not allowed to overflow with NaN", () => {
  const result = calculateTripBudget({ travelers: "invalid", days: -100, rooms: 1, bufferPercent: -20, foodPerPersonDay: "not-a-number" });
  assert.equal(result.travelers, 1);
  assert.equal(result.days, 1);
  assert.equal(result.total, 0);
  assert.ok(Number.isFinite(result.perPerson));
});

test("packing themes are unique and progress stays bounded", () => {
  for (const items of Object.values(PACKING_PRESETS)) {
    assert.ok(items.length >= 7);
    assert.equal(new Set(items).size, items.length);
  }
  assert.deepEqual(packingProgress(8, 3), {total: 8, checked: 3, percent: 38});
  assert.deepEqual(packingProgress(8, 20), {total: 8, checked: 8, percent: 100});
});

test("approval review hides homepage product recommendations without deleting data", () => {
  assert.equal(AFFILIATE_DISPLAY_ENABLED, false);
  assert.ok(homepageSections().magazineSections.every((section) => section.kind !== "products"));
  const urls = sitemapUrls().map((item) => item.loc);
  assert.ok(urls.includes("https://tripview.kr/tools/"));
  assert.ok(urls.includes("https://tripview.kr/guides/travel-budget/"));
});

test("generated pages hide affiliate cards and preserve live planner sections", async () => {
  if (!existsSync("dist/index.html")) return;
  for (const page of ["index.html", "travel/index.html", "festival/index.html", "stay/index.html", "ticket/index.html", "region/busan/index.html", "travel-125900/index.html"]) {
    const html = await readFile("dist/" + page, "utf8");
    assert.doesNotMatch(html, /<a\b[^>]*rel="[^"]*sponsored[^"]*"/, "found an affiliate link in " + page);
    assert.doesNotMatch(html, /<section\b[^>]*data-affiliate-provider/, "found affiliate block in " + page);
  }
  const tools = await readFile("dist/tools/index.html", "utf8");
  const guide = await readFile("dist/guides/travel-budget/index.html", "utf8");
  assert.match(tools, /data-budget-form/);
  assert.match(tools, /data-packing-theme/);
  assert.match(guide, /693,000원/);
});
