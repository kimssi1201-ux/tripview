import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const shortcutRoutes = [
  "/tools/calendar/",
  "/tools/world-time/",
  "/tools/#budget",
  "/tools/#packing",
  "https://mustview.co.kr/train",
];
const fallback = "/assets/tripview-thumbnail-fallback.svg";

test("all five travel tools are visible before the homepage news stream", async () => {
  const source = await readFile("src/pages/index.astro", "utf8");
  const bar = source.indexOf('class="home-tools-quickbar"');
  const news = source.indexOf('class="home-news-layout"');
  assert.ok(bar > 0 && bar < news, "shortcuts must appear before news cards");
  assert.match(source, /class="home-tools-quickbar-grid"/);
  for (const route of shortcutRoutes) assert.ok(source.includes('href="'+route+'"'), route);
  assert.equal((source.match(/class="home-tools-quicklink"/g)||[]).length, 5);
  assert.doesNotMatch(source, /id="travel-tools" aria-labelledby="home-travel-tools-title"/, "no duplicate lower-page tools hub");
  const css = await readFile("src/styles/global.css", "utf8");
  assert.match(css, /\.home-tools-quickbar-grid\s*\{[^}]*grid-template-columns:\s*repeat\(5,/);
  assert.match(css, /@media\(max-width:700px\)\s*\{[\s\S]*?\.home-tools-quickbar-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,/);
});

test("missing and failed thumbnails display an intentional, local editorial illustration", async () => {
  assert.ok(existsSync("assets/tripview-thumbnail-fallback.svg"));
  const svg = await readFile("assets/tripview-thumbnail-fallback.svg", "utf8");
  assert.match(svg, /<svg\b/);
  assert.match(svg, /사진 준비 중/);
  for (const path of [
    "src/components/HomeStoryCard.astro",
    "src/components/TravelCard.astro",
    "src/pages/index.astro",
  ]) {
    const source = await readFile(path, "utf8");
    assert.ok(source.includes(fallback), path);
  }
  for (const path of [
    "src/components/MediaFrame.astro",
    "src/pages/index.astro",
  ]) {
    const source = await readFile(path, "utf8");
    assert.match(source, /onerror=/, path);
  }
});

test("built homepage shows all travel shortcuts with no sideways swipe requirement", async () => {
  if (!existsSync("dist/index.html")) return;
  const html = await readFile("dist/index.html", "utf8");
  const sectionPos = html.indexOf("home-tools-quickbar");
  const newsPos = html.indexOf("home-news-layout");
  assert.ok(sectionPos > 0 && sectionPos < newsPos);
  for (const route of shortcutRoutes) assert.ok(html.includes('href="'+route+'"'), route);
  assert.ok(existsSync("dist/assets/tripview-thumbnail-fallback.svg"), "fallback asset copied for production");
});
