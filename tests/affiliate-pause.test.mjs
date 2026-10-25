import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { AFFILIATE_DISPLAY_ENABLED } from "../src/lib/monetization.mjs";
import { officialLinks, homepageSections } from "../src/lib/content.mjs";

test("affiliate output is hard-disabled regardless of environment variables", () => {
  assert.equal(AFFILIATE_DISPLAY_ENABLED, false);
  assert.ok(homepageSections().magazineSections.every((section) => section.kind !== "products"));
});

test("official editorial links exclude affiliate booking sources and disclosure CTAs", () => {
  const links = officialLinks({
    region: "제주",
    category: "여행지",
    officialLinks: [
      { label: "지자체 관광 사이트", url: "https://www.visitjeju.net/kr" },
      { label: "제휴 예약처 가격 확인", url: "https://accommodation.myrealtrip.com/products/100" },
      { label: "예약하기", url: "https://link.coupang.com/a/example" },
      { label: "마이리얼트립 할인", url: "https://www.myrealtrip.com/offers" },
      { label: "가격 안내", url: "https://www.agoda.com/hotel/" },
    ],
  });
  assert.deepEqual(links, [{label: "지자체 관광 사이트", url: "https://www.visitjeju.net/kr"}]);
});

test("core templates gate all affiliate offer cards and keep editorial content", async () => {
  for (const path of [
    "src/components/ProductCard.astro",
    "src/components/HomeProductCard.astro",
    "src/pages/stay/index.astro",
    "src/pages/ticket/index.astro",
    "src/pages/flight-deals/index.astro",
    "src/pages/flight-deals/[deal].astro",
  ]) {
    const content = await readFile(path, "utf8");
    assert.match(content, /AFFILIATE_DISPLAY_ENABLED/, path);
  }
});

test("built static pages have no sponsored anchors or outbound affiliate booking links", async () => {
  if (!existsSync("dist/index.html")) return;
  const prohibited = /<a\b[^>]*\brel=["'][^"']*\bsponsored\b|<a\b[^>]*\bhref=["']https?:\/\/[^"']*(?:myrealtrip\.com|link\.coupang\.com|agoda\.com|linkprice|tenping)/i;
  const paths = ["dist"];
  const flagged = [];
  let count = 0;
  while (paths.length) {
    const dir = paths.pop();
    for (const entry of await readdir(dir, {withFileTypes:true})) {
      const filename = dir + "/" + entry.name;
      if (entry.isDirectory()) paths.push(filename);
      if (entry.isFile() && entry.name.endsWith(".html")) {
        count++;
        const text = await readFile(filename, "utf8");
        if (prohibited.test(text)) flagged.push(filename);
      }
    }
  }
  assert.ok(count > 10, "expected generated pages to inspect");
  assert.deepEqual(flagged, [], "generated pages must not expose paused partner booking links");
});

test("primary navigation presents lodging and activity information, not affiliate booking menus", async () => {
  const source = await readFile("src/components/Header.astro", "utf8");
  assert.match(source, /href: "\/stay\/", label: "숙소 정보"/);
  assert.match(source, /href: "\/ticket\/", label: "체험 가이드"/);
  assert.doesNotMatch(source, /label: "숙소·예약"|label: "입장권·투어"/);

  const footer = await readFile("src/components/Footer.astro", "utf8");
  assert.match(footer, /href="\/stay\/">숙소 정보<\/a>/);
  assert.match(footer, /href="\/ticket\/">체험 가이드<\/a>/);
  if (!existsSync("dist/index.html")) return;
  const index = await readFile("dist/index.html", "utf8");
  assert.match(index, /href="\/stay\/"[^>]*>숙소 정보<\/a>/);
  assert.match(index, /href="\/ticket\/"[^>]*>체험 가이드<\/a>/);
  assert.doesNotMatch(index, /href="\/stay\/"[^>]*>숙소·예약<\/a>/);
});
