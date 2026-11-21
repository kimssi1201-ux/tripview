import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isIndexablePost } from "./lib/content-quality.mjs";
import { isUsableImageSource } from "../src/lib/image-sources.mjs";

function json(path, fallback) {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (error) {
    console.warn("[images] could not read " + path + ": " + error.message);
    return fallback;
  }
}

const root = process.cwd();
const posts = json(join(root, "data/generated-posts.json"), []);
const tour = json(join(root, "data/processed-tour-images.json"), { items: {} });
const pexels = json(join(root, "data/pexels-images.json"), { items: {} });
const report = {
  generatedAt: new Date().toISOString(),
  totalPosts: posts.length,
  reviewedPosts: 0,
  validLocalCovers: 0,
  remoteOnlyCoverPosts: [],
  noImageSourcePosts: [],
  staleProcessedAssets: [],
};
const rawSrc = (item) => typeof item === "string" ? item : String(item?.src || "");

for (const post of posts) {
  if (!isIndexablePost(post)) continue;
  report.reviewedPosts += 1;
  const entry = tour.items?.[post.slug] || {};
  const assets = [entry.cover, entry.hero, entry.banner, ...(entry.images || [])].filter((item) => item?.src);
  for (const asset of assets) {
    if (!isUsableImageSource(asset.src, root)) {
      report.staleProcessedAssets.push({ slug: post.slug, path: asset.src });
    }
  }
  const localCover = [entry.cover, entry.hero].some((asset) => (
    asset?.src?.startsWith("/") && isUsableImageSource(asset.src, root)
  ));
  if (localCover) {
    report.validLocalCovers += 1;
    continue;
  }

  const remoteOptions = [
    pexels.items?.[post.slug]?.cover?.src,
    ...(pexels.items?.[post.slug]?.images || []).map((asset) => asset?.src),
    rawSrc(post.image),
    ...(post.images || []).map(rawSrc),
  ].filter((source) => isUsableImageSource(source, root));

  if (remoteOptions.some((src) => /^https?:\/\//i.test(src))) {
    report.remoteOnlyCoverPosts.push({ slug: post.slug, title: post.title });
  } else if (!remoteOptions.length) {
    report.noImageSourcePosts.push({ slug: post.slug, title: post.title });
  }
}

mkdirSync(join(root, "reports"), { recursive: true });
writeFileSync(join(root, "reports/post-image-audit.json"), JSON.stringify(report, null, 2) + "\n");
console.log("[images] reviewed posts: " + report.reviewedPosts);
console.log("[images] valid local covers: " + report.validLocalCovers);
console.log("[images] external images without local cover: " + report.remoteOnlyCoverPosts.length);
console.log("[images] no image source: " + report.noImageSourcePosts.length);
console.log("[images] nonexistent files in processed image manifest: " + report.staleProcessedAssets.length);
console.log("[images] full report: reports/post-image-audit.json");
// This is a diagnostic. Remote-only posts require source verification,
// and the script must not invent a replacement image or block a safe deploy.
