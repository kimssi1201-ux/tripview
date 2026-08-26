import fs from "node:fs";
import path from "node:path";

const POSTS_PATH = "data/generated-posts.json";

export function postImageCount(post = {}) {
  return Array.isArray(post.images) ? post.images.filter(Boolean).length : 0;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function countSectionImages(html, className) {
  const sectionRe = new RegExp(`<section\\s+class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>[\\s\\S]*?<\\/section>`, "gi");
  let count = 0;
  for (const match of html.matchAll(sectionRe)) {
    const imgCount = (match[0].match(/<img\b/gi) || []).length;
    if (imgCount >= 3) count += 1;
  }
  return count;
}

export function summarizePhotoCoverage(posts, rootDir = ".") {
  const existingPosts = posts.filter((post) => post?.slug);
  const postsWithThreeImages = existingPosts.filter((post) => postImageCount(post) >= 3);
  let htmlChecked = 0;
  let missingHtml = 0;
  let articleGridPages = 0;
  let lodgingGuidePages = 0;
  let renderedThreeImagePages = 0;

  for (const post of existingPosts) {
    const htmlPath = path.join(rootDir, post.slug, "index.html");
    if (!fs.existsSync(htmlPath)) {
      missingHtml += 1;
      continue;
    }
    htmlChecked += 1;
    const html = fs.readFileSync(htmlPath, "utf8");
    const articleGrids = countSectionImages(html, "article-photo-grid");
    const lodgingGuides = countSectionImages(html, "lodging-photo-guide");
    if (articleGrids > 0) articleGridPages += 1;
    if (lodgingGuides > 0) lodgingGuidePages += 1;
    if (articleGrids > 0 || lodgingGuides > 0) renderedThreeImagePages += 1;
  }

  return {
    totalPosts: existingPosts.length,
    postsWithThreeImages: postsWithThreeImages.length,
    htmlChecked,
    missingHtml,
    articleGridPages,
    lodgingGuidePages,
    renderedThreeImagePages,
  };
}

export function formatPhotoCoverage(summary) {
  const percent = summary.totalPosts
    ? Math.round((summary.postsWithThreeImages / summary.totalPosts) * 1000) / 10
    : 0;
  const renderedPercent = summary.htmlChecked
    ? Math.round((summary.renderedThreeImagePages / summary.htmlChecked) * 1000) / 10
    : 0;
  return [
    `Posts with post.images.length >= 3: ${summary.postsWithThreeImages}/${summary.totalPosts} (${percent}%).`,
    `Rendered photo sections with 3+ img tags: ${summary.renderedThreeImagePages}/${summary.htmlChecked} (${renderedPercent}%).`,
    `Article photo grid pages with real images: ${summary.articleGridPages}.`,
    `Lodging photo guide pages with 3+ real images: ${summary.lodgingGuidePages}.`,
    `Missing generated HTML pages: ${summary.missingHtml}.`,
  ].join("\n");
}

async function main() {
  const posts = readJson(POSTS_PATH);
  console.log(formatPhotoCoverage(summarizePhotoCoverage(posts)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
