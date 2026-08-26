import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  imageFamilyKey,
  isRelevantPhotoGalleryItem,
  mergePostImages,
  photoGalleryImageUrl,
  photoGalleryKeywordsForPost,
  sampleImageBackfillPosts,
  summarizeImageSampleResults,
  summarizePhotoGallerySampleResults,
} from "../scripts/backfill-tour-api-details.mjs";
import {
  formatPhotoCoverage,
  summarizePhotoCoverage,
} from "../scripts/report-photo-coverage.mjs";

test("TourAPI image backfill merges gallery images without duplicating the cover", () => {
  const cover = "https://tong.visitkorea.or.kr/cms/resource/66/4096566_image2_1.jpg";
  const post = {
    image: cover,
    images: [
      cover,
      "https://tong.visitkorea.or.kr/cms/resource/67/4096567_image2_1.jpg",
    ],
  };
  const merged = mergePostImages(post, [
    { originimgurl: "https://tong.visitkorea.or.kr/cms/resource/88/4096566_image3_1.jpg" },
    { originimgurl: "https://tong.visitkorea.or.kr/cms/resource/89/4096568_image2_1.jpg" },
    { smallimageurl: "https://tong.visitkorea.or.kr/cms/resource/90/4096569_image2_1.jpg" },
  ], 4);

  assert.equal(imageFamilyKey(cover), "4096566");
  assert.deepEqual(merged, [
    cover,
    "https://tong.visitkorea.or.kr/cms/resource/67/4096567_image2_1.jpg",
    "https://tong.visitkorea.or.kr/cms/resource/89/4096568_image2_1.jpg",
    "https://tong.visitkorea.or.kr/cms/resource/90/4096569_image2_1.jpg",
  ]);
});

test("TourAPI image sample uses a content-type spread and reports 3+ image coverage", () => {
  const posts = [
    { slug: "travel-1", contentid: "1", tourApi: { contentTypeId: "12" } },
    { slug: "travel-2", contentid: "2", tourApi: { contentTypeId: "12" } },
    { slug: "festival-1", contentid: "3", tourApi: { contentTypeId: "15" } },
    { slug: "lodging-1", contentid: "4", tourApi: { contentTypeId: "32" } },
    { slug: "food-1", contentid: "5", tourApi: { contentTypeId: "39" } },
  ];
  const sample = sampleImageBackfillPosts(posts, 4);
  assert.deepEqual(sample.map((post) => post.slug), ["travel-1", "festival-1", "lodging-1", "food-1"]);

  const summary = summarizeImageSampleResults([
    { typeId: "12", detailCount: 0, mergedCount: 1 },
    { typeId: "15", detailCount: 2, mergedCount: 3 },
    { typeId: "32", detailCount: 4, mergedCount: 5 },
  ]);
  assert.equal(summary.checked, 3);
  assert.equal(summary.atLeast3, 2);
  assert.deepEqual(summary.detailImageDistribution, { 0: 1, 2: 1, 4: 1 });
  assert.deepEqual(summary.mergedImageDistribution, { 1: 1, 3: 1, 5: 1 });
  assert.deepEqual(summary.byType["15"], { checked: 1, atLeast3: 1 });
});

test("PhotoGalleryService1 sample helpers use keyword search results without exposing keys", () => {
  const post = {
    title: "제주 협재해수욕장 방문 전 확인할 운영 정보",
    region: "제주",
    image: "https://example.com/cover.jpg",
  };
  const item = {
    galTitle: "협재해수욕장",
    galPhotographyLocation: "제주특별자치도 제주시",
    galSearchKeyword: "제주도, 협재해수욕장, 해변",
    galWebImageUrl: "http://tong.visitkorea.or.kr/cms2/website/92/2859292.jpg",
  };

  const keywords = photoGalleryKeywordsForPost(post);
  assert.ok(keywords.includes("제주 협재해수욕장 방문 전 확인할 운영 정보"));
  assert.ok(keywords.includes("제주"));
  assert.equal(photoGalleryImageUrl(item), "http://tong.visitkorea.or.kr/cms2/website/92/2859292.jpg");
  assert.equal(isRelevantPhotoGalleryItem(post, item), true);

  const summary = summarizePhotoGallerySampleResults([
    { typeId: "12", rawCount: 4, matchedCount: 2, mergedCount: 3 },
    { typeId: "15", rawCount: 0, matchedCount: 0, mergedCount: 1, error: "sample error" },
  ]);
  assert.equal(summary.checked, 2);
  assert.equal(summary.success, 1);
  assert.equal(summary.anyMatched, 1);
  assert.equal(summary.atLeast3, 1);
  assert.deepEqual(summary.rawImageDistribution, { 0: 1, 4: 1 });
  assert.deepEqual(summary.matchedImageDistribution, { 0: 1, 2: 1 });
});

test("backfill workflow runs detailImage2 sample before any full image merge", async () => {
  const [script, dailyScript, workflow] = await Promise.all([
    readFile("scripts/backfill-tour-api-details.mjs", "utf8"),
    readFile("scripts/daily-tour-posts.mjs", "utf8"),
    readFile(".github/workflows/backfill-tour-api-details.yml", "utf8"),
  ]);
  assert.match(script, /detailImage2/);
  assert.doesNotMatch(script, /subImageYN/);
  assert.match(dailyScript, /detailImage2/);
  assert.doesNotMatch(dailyScript, /subImageYN/);
  assert.match(script, /BACKFILL_IMAGE_SAMPLE/);
  assert.match(script, /BACKFILL_IMAGE_SAMPLE_CONCURRENCY/);
  assert.match(script, /BACKFILL_INCLUDE_IMAGES/);
  assert.match(script, /originimgurl/);
  assert.match(workflow, /image_mode/);
  assert.match(workflow, /image_sample_size \|\| '20'/);
  assert.match(workflow, /BACKFILL_IMAGE_SAMPLE=1/);
  assert.match(workflow, /BACKFILL_INCLUDE_IMAGES=1/);
  assert.match(workflow, /github.event_name == 'push'/);
  assert.match(workflow, /github.event.inputs.image_mode == 'full' \|\| github.event.inputs.image_mode == 'off'/);
  assert.ok(workflow.indexOf("BACKFILL_IMAGE_SAMPLE=1") < workflow.indexOf("BACKFILL_INCLUDE_IMAGES=1"));
  assert.ok(workflow.indexOf("Sample TourAPI gallery images") < workflow.indexOf("Backfill Tour API details"));
});

test("backfill workflow keeps PhotoGalleryService1 behind an explicit sample mode", async () => {
  const [script, workflow, docs] = await Promise.all([
    readFile("scripts/backfill-tour-api-details.mjs", "utf8"),
    readFile(".github/workflows/backfill-tour-api-details.yml", "utf8"),
    readFile("docs/api-secrets.md", "utf8"),
  ]);
  assert.match(script, /PhotoGalleryService1/);
  assert.match(script, /gallerySearchList1/);
  assert.match(script, /galWebImageUrl/);
  assert.match(script, /PHOTO_GALLERY_API_KEY/);
  assert.match(script, /--photo-gallery-sample/);
  assert.match(workflow, /photo_gallery_mode/);
  assert.match(workflow, /PHOTO_GALLERY_API_KEY: \$\{\{ secrets\.PHOTO_GALLERY_API_KEY \}\}/);
  assert.match(workflow, /BACKFILL_PHOTO_GALLERY_SAMPLE=1/);
  assert.match(workflow, /github.event_name == 'workflow_dispatch' && github.event.inputs.photo_gallery_mode == 'sample'/);
  assert.match(docs, /PHOTO_GALLERY_API_KEY/);
  assert.ok(workflow.indexOf("Sample PhotoGalleryService1 images") < workflow.indexOf("Backfill Tour API details"));
});

test("full image backfill can merge PhotoGallery images in bounded batches", async () => {
  const [script, workflow, report] = await Promise.all([
    readFile("scripts/backfill-tour-api-details.mjs", "utf8"),
    readFile(".github/workflows/backfill-tour-api-details.yml", "utf8"),
    readFile("scripts/report-photo-coverage.mjs", "utf8"),
  ]);
  assert.match(script, /BACKFILL_REQUEST_RETRIES/);
  assert.match(script, /attempt < API_REQUEST_RETRIES/);
  assert.match(script, /requestItemsWithKeyFallback/);
  assert.match(script, /BACKFILL_INCLUDE_PHOTO_GALLERY/);
  assert.match(script, /PhotoGallery image backfill skipped because PHOTO_GALLERY_API_KEY is not set/);
  assert.match(script, /combinedImages\.push\(\.\.\.photoGalleryDetailImages\(matchedItems\)\)/);
  assert.match(script, /BACKFILL_OFFSET/);
  assert.match(script, /Posts with 3\+ images after merge/);
  assert.match(workflow, /default: "120"/);
  assert.match(workflow, /offset:/);
  assert.match(workflow, /Install Pillow for image processing/);
  assert.match(workflow, /pip install --quiet Pillow/);
  assert.match(workflow, /BACKFILL_INCLUDE_PHOTO_GALLERY=1/);
  assert.match(workflow, /PHOTO_GALLERY_API_KEY: \$\{\{ secrets\.PHOTO_GALLERY_API_KEY \}\}/);
  assert.match(workflow, /Report article photo coverage/);
  assert.match(workflow, /node scripts\/report-photo-coverage\.mjs/);
  assert.match(report, /postImageCount/);
  assert.match(report, /post\.images/);
  assert.match(report, /section\\\\s\+class/);
  assert.match(report, /match\(\/<img/);
  assert.match(report, /imgCount >= 3/);
  assert.doesNotMatch(workflow, /includes\('article-photo-grid'\)/);
});

test("contextual copy renders only the cover image before photo grid processing", async () => {
  const script = await readFile("scripts/polish-contextual-copy.mjs", "utf8");
  assert.match(script, /const gallery = post\.image/);
  assert.match(script, /대표 이미지/);
  assert.match(script, /article-photo-grid \/ article-inline-figure/);
  assert.doesNotMatch(script, /const gallery = \(post\.images \|\| \[post\.image\]\)/);
  assert.doesNotMatch(script, /index === 0 \? "cover-figure" : "inline-figure"/);
});

test("photo coverage report counts data images and ignores CSS-only class names", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "tripview-photo-coverage-"));
  try {
    const posts = [
      { slug: "travel-css-only", images: ["a.jpg", "b.jpg", "c.jpg"] },
      { slug: "travel-grid", images: ["a.jpg", "b.jpg", "c.jpg"] },
      { slug: "travel-two-images", images: ["a.jpg", "b.jpg"] },
    ];
    for (const post of posts) {
      await mkdir(path.join(root, post.slug), { recursive: true });
    }
    await writeFile(
      path.join(root, "travel-css-only", "index.html"),
      "<style>.article-photo-grid{margin:0}</style><article>No photo section</article>",
    );
    await writeFile(
      path.join(root, "travel-grid", "index.html"),
      '<section class="article-photo-grid"><img src="1.jpg"><img src="2.jpg"><img src="3.jpg"></section>',
    );
    await writeFile(
      path.join(root, "travel-two-images", "index.html"),
      '<section class="article-photo-grid"><img src="1.jpg"><img src="2.jpg"></section>',
    );

    const summary = summarizePhotoCoverage(posts, root);
    assert.equal(summary.totalPosts, 3);
    assert.equal(summary.postsWithThreeImages, 2);
    assert.equal(summary.articleGridPages, 1);
    assert.equal(summary.renderedThreeImagePages, 1);
    assert.equal(summary.missingHtml, 0);
    assert.match(formatPhotoCoverage(summary), /Posts with post\.images\.length >= 3: 2\/3/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
