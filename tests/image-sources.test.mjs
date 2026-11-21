import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { imageAlternativeSources, isUsableImageSource, isUsableImageAsset } from "../src/lib/image-sources.mjs";

test("public local photos must exist before they are published", () => {
  assert.equal(isUsableImageSource("/assets/tripview-thumbnail-fallback.svg"), true);
  assert.equal(isUsableImageSource("/assets/processed/definitely-missing-image.webp"), false);
  assert.equal(isUsableImageSource("/assets/../secret.png"), false);
  assert.equal(isUsableImageSource("assets/processed/relative-image.webp"), false);
  assert.equal(isUsableImageSource("https://images.pexels.com/photos/1234/example.jpg"), true);
  assert.equal(isUsableImageSource("javascript:alert(1)"), false);
  assert.equal(isUsableImageAsset({ src: "/assets/processed/missing.webp" }), false);
});

test("image retries contain only other images from the same post", () => {
  const asset = {
    src: "/assets/tripview-thumbnail-fallback.svg",
    original: "https://tong.visitkorea.or.kr/a.jpg",
  };
  const alternatives = imageAlternativeSources(asset, {
    image: "https://tong.visitkorea.or.kr/a.jpg",
    images: ["https://tong.visitkorea.or.kr/b.jpg", "https://tong.visitkorea.or.kr/a.jpg", "/assets/processed/missing.webp"],
  });
  assert.deepEqual(alternatives, [
    "https://tong.visitkorea.or.kr/a.jpg",
    "https://tong.visitkorea.or.kr/b.jpg",
  ]);
});

test("article presentation retries photos and hides broken optional inline photos", () => {
  const frame = readFileSync("src/components/MediaFrame.astro", "utf8");
  const layout = readFileSync("src/layouts/BaseLayout.astro", "utf8");
  assert.match(frame, /data-tripview-alternates/);
  assert.match(frame, /imageAlternativeSources/);
  assert.match(layout, /optionalFigure\.hidden = true/);
  assert.match(layout, /setProperty\("--media-bg"/);
});
