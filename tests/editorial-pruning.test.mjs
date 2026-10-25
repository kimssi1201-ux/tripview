import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { isIndexablePost, requiresFreshEditorialReview } from "../scripts/lib/content-quality.mjs";
import { allPosts, indexablePosts, searchIndex, sitemapUrls } from "../src/lib/content.mjs";

const snapshots = [
  "data-stay-price-busan",
  "data-stay-price-jeju",
  "data-stay-price-seoul",
  "data-ticket-price-busan",
  "data-ticket-price-seoul",
  "data-stay-ticket-seoul",
  "data-festival-schedule-seoul",
];

test("dated snapshot articles are held for review even when their word count is high", () => {
  const qualityPost = {
    slug: "travel-personally-reviewed-guide-2026",
    title: "현장 여행 가이드",
    editorialStatus: "reviewed",
    description: "방문 정보를 확인한 여행 안내. ".repeat(90),
  };
  assert.ok(isIndexablePost(qualityPost), "normal reviewed guide must remain eligible");
  for (const slug of snapshots) {
    const p = {...qualityPost, slug};
    assert.equal(requiresFreshEditorialReview(p), true, slug);
    assert.equal(isIndexablePost(p), false, slug);
  }
  assert.equal(requiresFreshEditorialReview({slug:"travel-real-place-guide"}), false);
});

test("known snapshot slugs stay out of sitemap, search suggestions, and editorial discovery", () => {
  const urls = sitemapUrls().map(item=>item.loc);
  const suggestions = new Set(searchIndex().map(post=>post.slug));
  const eligible = new Set(indexablePosts.map(post=>post.slug));
  const slugs = new Set(allPosts.map(post=>post.slug));
  for (const slug of snapshots) {
    if (!slugs.has(slug)) continue;
    assert.ok(!eligible.has(slug), slug+" still indexable");
    assert.ok(!urls.includes("https://tripview.kr/"+slug+"/"), slug+" still in sitemap");
    assert.ok(!suggestions.has(slug), slug+" still in search");
  }
});

test("previous snapshot URLs remain available but explicitly noindex and without AdSense", async () => {
  if (!existsSync("dist/index.html")) return;
  for (const slug of snapshots) {
    const path="dist/"+slug+"/index.html";
    if (!existsSync(path)) continue;
    const html=await readFile(path,"utf8");
    assert.match(html, /<meta name="robots" content="noindex, follow"/,path);
    assert.doesNotMatch(html,/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle/,path);
  }
});

test("lodging index is a concise guide, not a huge product-and-photo gallery", async () => {
  const source = await readFile("src/pages/stay/index.astro","utf8");
  assert.match(source,/lodgingPosts\.map/);
  assert.match(source,/\.slice\(0, 6\)/);
  assert.match(source,/stay-selection-list/);
  assert.doesNotMatch(source,/lodgingPosts\.slice\(0, 24\)/);
  const ticket = await readFile("src/pages/ticket/index.astro","utf8");
  assert.doesNotMatch(ticket,/relatedPosts\.length > 0 \? relatedPosts : data\.travelPosts/);
  if(!existsSync("dist/stay/index.html"))return;
  const html = await readFile("dist/stay/index.html","utf8");
  const links=(html.match(/class="stay-selection-item"/g)||[]).length;
  assert.ok(links <= 6, "no more than six lodging links");
  assert.doesNotMatch(html,/class="story-list"/);
});
