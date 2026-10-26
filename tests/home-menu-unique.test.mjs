import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const fallback = "/assets/tripview-thumbnail-fallback.svg";

test("primary navigation shows exactly seven distinct categories, not both travel news and domestic travel", async () => {
  const header = await readFile("src/components/Header.astro", "utf8");
  const links = [...header.matchAll(/\{ href: "([^"]+)", label: "([^"]+)", key: "([^"]+)" \}/g)];
  assert.equal(links.length, 7);
  assert.equal(new Set(links.map((v) => v[2])).size, 7, "labels should be unique");
  assert.equal(new Set(links.map((v) => v[3])).size, 7, "keys should be unique");
  assert.ok(links.some((v) => v[2] === "국내여행"));
  assert.ok(!links.some((v) => v[2] === "여행뉴스"), "duplicate travel-news category must not return");
  assert.ok(header.includes("navLinks.map((item)"), "desktop and mobile should share one menu source");
  const css = await readFile("src/styles/global.css", "utf8");
  assert.match(css, /\.site-nav-main\s*\{[^}]*grid-template-columns:\s*repeat\(7,/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?\.site-nav-main\s*\{[^}]*grid-template-columns:\s*repeat\(4,/);
});

test("homepage travel tools are visually located before the news articles without duplicating top-level menu categories", async () => {
  const source = await readFile("src/pages/index.astro", "utf8");
  const quickbarAt = source.indexOf('class="home-tools-quickbar"');
  const leadAt = source.indexOf('class="home-news-layout"');
  assert.ok(quickbarAt > -1 && leadAt > quickbarAt);
  for (const url of ["/tools/calendar/", "/tools/world-time/", "/tools/#budget", "/tools/#packing", "https://mustview.co.kr/train"]) {
    assert.ok(source.includes('href="' + url + '"'), "missing shortcut " + url);
  }
});

test("article cards have an honest local placeholder and damaged images swap to it", async () => {
  assert.ok(existsSync("assets/tripview-thumbnail-fallback.svg"));
  const [hero, card, media, layout, home] = await Promise.all([
    readFile("src/components/HomeStoryCard.astro", "utf8"),
    readFile("src/components/TravelCard.astro", "utf8"),
    readFile("src/components/MediaFrame.astro", "utf8"),
    readFile("src/layouts/BaseLayout.astro", "utf8"),
    readFile("src/pages/index.astro", "utf8"),
  ]);
  for (const source of [hero, card, media, home]) assert.ok(source.includes(fallback));
  assert.match(media, /data-tripview-fallback="/);
  assert.match(layout, /document\.addEventListener\("error",/);
  if (existsSync("dist/index.html")) {
    const html = await readFile("dist/index.html", "utf8");
    const toolsAt = html.indexOf('class="home-tools-quickbar"');
    const newsAt = html.indexOf('class="home-news-layout"');
    assert.ok(toolsAt >= 0 && newsAt > toolsAt);
    assert.match(html, /data-tripview-fallback="\/assets\/tripview-thumbnail-fallback\.svg"/);
    assert.doesNotMatch(html, />여행뉴스<\/a>/);
  }
});
