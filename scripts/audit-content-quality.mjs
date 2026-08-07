import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MIN_INDEXABLE_BODY_LENGTH, postBodyLength } from "./lib/content-quality.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const postsPath = join(root, "data", "generated-posts.json");
const reportsDir = join(root, "reports");
const jsonPath = join(reportsDir, "content-quality-report.json");
const mdPath = join(reportsDir, "content-quality-report.md");

function text(value) {
  return String(value ?? "").trim();
}

function normalize(value) {
  return text(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{Letter}\p{Number}\s]/gu, "")
    .trim();
}

function imagesOf(post) {
  return [post.image, ...(Array.isArray(post.images) ? post.images : [])]
    .map(text)
    .filter(Boolean);
}

function hasInfo(post) {
  return Array.isArray(post.info) && post.info.some((row) => Array.isArray(row) && text(row[1]));
}

function hasFaqAnswers(post) {
  if (!Array.isArray(post.faqs)) return true;
  return post.faqs.every((row) => Array.isArray(row) && text(row[0]) && text(row[1]));
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return [...map.entries()].filter(([, group]) => group.length > 1);
}

const posts = JSON.parse(await readFile(postsPath, "utf8"));
const checkedAt = new Date().toISOString().slice(0, 10);

const titleGroups = groupBy(posts, (post) => normalize(post.title));
const imageGroups = groupBy(posts, (post) => normalize(imagesOf(post)[0] || ""));
const duplicateTitleSlugs = new Set(titleGroups.flatMap(([, group]) => group.map((post) => post.slug)));
const duplicateImageSlugs = new Set(imageGroups.flatMap(([, group]) => group.map((post) => post.slug)));

const audited = posts.map((post) => {
  const issues = [];
  const length = postBodyLength(post);
  const images = imagesOf(post);

  if (!text(post.title)) issues.push("missing_title");
  if (!images.length) issues.push("missing_image");
  if (!hasInfo(post)) issues.push("missing_info");
  if (!text(post.region)) issues.push("missing_region");
  if (length < MIN_INDEXABLE_BODY_LENGTH) issues.push("short_body_under_1500_chars");
  if (duplicateTitleSlugs.has(post.slug)) issues.push("duplicate_title");
  if (duplicateImageSlugs.has(post.slug)) issues.push("duplicate_primary_image");
  if (!hasFaqAnswers(post)) issues.push("empty_faq_answer");

  return {
    slug: post.slug,
    title: post.title,
    category: post.category,
    region: post.region,
    bodyLength: length,
    imageCount: images.length,
    issues,
  };
});

const issueCounts = audited.reduce((acc, item) => {
  for (const issue of item.issues) acc[issue] = (acc[issue] || 0) + 1;
  return acc;
}, {});

const highPriority = audited
  .filter((item) => item.issues.length)
  .sort((a, b) => b.issues.length - a.issues.length || a.bodyLength - b.bodyLength)
  .slice(0, 80);

const report = {
  checkedAt,
  totalPosts: posts.length,
  issueCounts,
  duplicateTitleGroups: titleGroups.map(([, group]) => group.map((post) => ({ slug: post.slug, title: post.title }))),
  duplicateImageGroups: imageGroups.map(([, group]) => group.map((post) => ({ slug: post.slug, title: post.title, image: imagesOf(post)[0] }))),
  highPriority,
};

const md = [
  "# 트립뷰 콘텐츠 품질 점검 리포트",
  "",
  `- 점검일: ${checkedAt}`,
  `- 전체 글: ${posts.length}건`,
  "",
  "## 이슈 요약",
  ...Object.entries(issueCounts).map(([issue, count]) => `- ${issue}: ${count}건`),
  "",
  "## 우선 보강 대상",
  ...highPriority.slice(0, 30).map((item) => `- ${item.slug}: ${item.issues.join(", ")} / ${item.title}`),
  "",
  "## 운영 기준",
  "- missing_image, missing_info, short_body_under_1500_chars가 같이 있는 글은 먼저 보강합니다.",
  "- duplicate_title 또는 duplicate_primary_image는 통합, 제목 수정, 이미지 교체를 검토합니다.",
  "- empty_faq_answer는 즉시 수정합니다.",
  "",
].join("\n");

await mkdir(reportsDir, { recursive: true });
await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(mdPath, md, "utf8");

console.log(`Audited ${posts.length} posts`);
console.log(`Wrote ${jsonPath}`);
