import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MIN_INDEXABLE_BODY_LENGTH, postBodyLength } from "./lib/content-quality.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const postsPath = join(root, "data", "generated-posts.json");
const reviewPath = join(root, "data", "editorial-review.json");
const allowedTopics = new Set(["popular", "weekend", "festival", "water", "indoor", "family"]);
const editorialHeading = "편집팀이 먼저 본 핵심";
const replaceableLeadHeadings = new Set([
  editorialHeading,
  "먼저 알아둘 점",
  "장소 개요를 먼저 보면",
  "행사 개요를 먼저 보면",
]);

function clean(value = "") {
  return String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function compact(value = "", limit = 150) {
  const text = clean(value);
  return text.length > limit ? `${text.slice(0, limit - 1).trim()}…` : text;
}

function verifiedFacts(post) {
  const preferredLabels = [
    "기간",
    "시간",
    "장소",
    "주소",
    "운영 확인",
    "요금",
    "주차",
    "쉬는 날",
    "문의",
  ];
  const rows = Array.isArray(post.info) ? post.info : [];
  const facts = preferredLabels
    .map((label) => rows.find(([key]) => clean(key) === label))
    .filter(Boolean)
    .map(([label, value]) => `${label} ${compact(value, 100)}`)
    .filter((value, index, list) => list.indexOf(value) === index)
    .slice(0, 5);

  if (!facts.length) {
    return `${clean(post.sourceTitle || post.title)}의 운영 정보는 출발 전 공식 안내에서 다시 확인해야 합니다.`;
  }
  return `현재 확인된 핵심 정보는 ${facts.join(" · ")}입니다. 날짜와 운영 조건은 바뀔 수 있어 출발 당일 공식 안내를 다시 확인하는 것이 좋습니다.`;
}

function reviewedSections(post, angle) {
  const sections = (Array.isArray(post.sections) ? post.sections : [])
    .filter((section) => Array.isArray(section) && !replaceableLeadHeadings.has(clean(section[0])));
  return [[editorialHeading, [clean(angle), verifiedFacts(post)]], ...sections];
}

function readMinutes(post) {
  return `약 ${Math.max(4, Math.ceil(postBodyLength(post) / 430))}분`;
}

function clearReviewFields(post) {
  const next = { ...post, editorialStatus: "pending" };
  for (const key of [
    "editorialReviewedAt",
    "editorialReviewer",
    "editorialAuthorProfile",
    "editorialTopics",
    "editorialAngle",
  ]) {
    delete next[key];
  }
  return next;
}

function validateConfig(config, posts) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(config.reviewedAt || "")) {
    throw new Error("editorial-review.json requires reviewedAt in YYYY-MM-DD format");
  }
  if (!clean(config.reviewer) || !clean(config.authorProfile)) {
    throw new Error("editorial-review.json requires reviewer and authorProfile");
  }

  const postSlugs = new Set(posts.map((post) => post.slug));
  const seen = new Set();
  for (const item of config.posts || []) {
    if (!item.slug || seen.has(item.slug)) throw new Error(`Duplicate or empty reviewed slug: ${item.slug || "(empty)"}`);
    if (!postSlugs.has(item.slug)) throw new Error(`Reviewed slug does not exist: ${item.slug}`);
    if (!Array.isArray(item.topics) || !item.topics.length || item.topics.some((topic) => !allowedTopics.has(topic))) {
      throw new Error(`Invalid editorial topics for ${item.slug}`);
    }
    if (clean(item.angle).length < 40) throw new Error(`Editorial angle is too short for ${item.slug}`);
    seen.add(item.slug);
  }
}

const posts = JSON.parse(await readFile(postsPath, "utf8"));
const config = JSON.parse(await readFile(reviewPath, "utf8"));
validateConfig(config, posts);

const reviewBySlug = new Map(config.posts.map((item) => [item.slug, item]));
const nextPosts = posts.map((post) => {
  const review = reviewBySlug.get(post.slug);
  if (!review) return clearReviewFields(post);

  const reviewed = {
    ...post,
    title: clean(review.title || post.title),
    description: compact(`${clean(post.sourceTitle || post.title)} 방문 판단에 필요한 운영 정보와 편집팀 확인 사항을 정리했습니다. ${clean(review.angle)}`, 155),
    excerpt: compact(review.angle, 125),
    sections: reviewedSections(post, review.angle),
    editorialStatus: "reviewed",
    editorialReviewedAt: config.reviewedAt,
    editorialReviewer: clean(config.reviewer),
    editorialAuthorProfile: clean(config.authorProfile),
    editorialTopics: [...new Set(review.topics)],
    editorialAngle: clean(review.angle),
    updatedAt: config.reviewedAt,
  };
  reviewed.read = readMinutes(reviewed);

  if (postBodyLength(reviewed) < MIN_INDEXABLE_BODY_LENGTH) {
    throw new Error(`Reviewed post is still too short: ${post.slug}`);
  }
  return reviewed;
});

const current = `${JSON.stringify(posts, null, 2)}\n`;
const next = `${JSON.stringify(nextPosts, null, 2)}\n`;
if (next !== current) await writeFile(postsPath, next, "utf8");

const reviewedCount = nextPosts.filter((post) => post.editorialStatus === "reviewed").length;
console.log(`Applied editorial review: ${reviewedCount} reviewed, ${nextPosts.length - reviewedCount} pending.`);
