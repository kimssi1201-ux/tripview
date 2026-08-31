import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MIN_INDEXABLE_BODY_LENGTH, postBodyLength } from "./lib/content-quality.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const postsPath = join(root, "data", "generated-posts.json");
const reviewPath = join(root, "data", "editorial-review.json");
const allowedTopics = new Set(["popular", "weekend", "festival", "water", "indoor", "family"]);
const reviewedManualSlugs = new Set(["data-stay-ticket-seoul"]);
const editorialHeading = "관람 포인트";
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
  const rows = Array.isArray(post.info) ? post.info : [];
  const labels = ["운영 확인", "시간", "요금", "주차", "문의"];
  const facts = labels
    .map((label) => rows.find(([key]) => clean(key) === label))
    .filter(Boolean)
    .map(([label]) => clean(label))
    .filter((value, index, list) => list.indexOf(value) === index)
    .slice(0, 4);

  if (!facts.length) {
    return "방문 날짜를 정했다면 운영 시간과 입장 가능 시간을 먼저 보고, 이동과 귀가 시간을 함께 잡는 편이 좋습니다.";
  }
  return `방문 전에는 ${facts.join(", ")} 순서로 살피면 일정 판단이 쉽습니다. 날짜와 운영 조건은 바뀔 수 있으니 출발 당일 공식 안내를 한 번 더 확인하세요.`;
}

function normalizeSections(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((section) => Array.isArray(section) && clean(section[0]) && Array.isArray(section[1]))
    .map(([heading, paragraphs]) => [clean(heading), paragraphs.map(clean).filter(Boolean)])
    .filter(([, paragraphs]) => paragraphs.length);
}

function normalizeFaq(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => Array.isArray(entry) && clean(entry[0]) && clean(entry[1]))
    .map(([question, answer]) => [clean(question), clean(answer)]);
}

function reviewedSections(post, review) {
  const lead = [
    clean(review.angle),
    verifiedFacts(post),
    "한 장소를 고를 때는 이름과 대표 사진보다 실제 방문 날짜, 운영 시간, 이동 거리, 귀가 방법을 함께 보는 편이 좋습니다. 같은 지역 안에서도 입구와 주차 위치가 다르면 체류 시간이 달라질 수 있으므로, 출발 전에 지도와 공식 안내를 같이 열어 두세요.",
  ];
  const support = [
    ["일정 구성", [
      "방문 시간을 정할 때는 목적지에서 보내는 시간만 따로 보지 말고 왕복 이동, 주차, 식사, 휴식 시간을 함께 넣어야 합니다. 처음 가는 곳이라면 계획 사이에 20~30분 정도 여유를 두면 현장에서 일정을 줄이거나 순서를 바꿀 때 부담이 덜합니다.",
      "아이와 함께라면 화장실과 휴식 지점, 어르신과 함께라면 경사와 계단, 혼자 방문한다면 귀가 교통편을 먼저 확인하세요. 동행자에 따라 같은 장소도 적절한 체류 시간과 이동 순서가 달라질 수 있습니다.",
    ]],
    ["예약 전 확인 순서", [
      "출발 전에는 운영 여부, 입장 또는 주문 마감, 주차 가능 여부를 마지막으로 확인하세요. 안내가 바뀌었을 때 바로 이동할 수 있도록 같은 지역 안의 대체 장소를 한 곳 정도 같이 저장해두면 좋습니다.",
      "예약이나 예매가 필요한 일정이라면 날짜, 인원, 이용 항목, 취소 가능 시점을 결제 전에 다시 보세요. 현장 안내가 예약 화면과 다를 때를 대비해 예약 번호와 결제 내역을 바로 열 수 있게 준비하면 이동 중에도 대응하기 쉽습니다.",
    ]],
  ];
  const withSupport = (sections) => {
    const seen = new Set(sections.map(([heading]) => clean(heading)));
    return [...sections, ...support.filter(([heading]) => !seen.has(heading))];
  };
  const customSections = normalizeSections(review.sections);
  if (customSections.length) {
    return withSupport([[editorialHeading, lead], ...customSections]);
  }
  const sections = (Array.isArray(post.sections) ? post.sections : [])
    .filter((section) => Array.isArray(section) && !replaceableLeadHeadings.has(clean(section[0])));
  return withSupport([[editorialHeading, lead], ...sections]);
}

function koreanDate(value) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  return `${match[1]}년 ${Number(match[2])}월 ${Number(match[3])}일`;
}

function safeHttpsUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function readMinutes(post) {
  return `약 ${Math.max(4, Math.ceil(postBodyLength(post) / 430))}분`;
}

function clearReviewFields(post) {
  if (post?.dataPipeline?.generated) {
    return {
      ...post,
      editorialStatus: "reviewed",
      editorialReviewedAt: post.editorialReviewedAt || post.dataPipeline.updatedAt || post.sortDate || "",
      editorialReviewer: post.editorialReviewer || "트립뷰 데이터 편집팀",
      editorialAuthorProfile: post.editorialAuthorProfile || "/editorial-team",
    };
  }
  if (reviewedManualSlugs.has(post?.slug) || (post?.renderManualPage && post?.editorialStatus === "reviewed")) {
    return {
      ...post,
      editorialStatus: "reviewed",
      editorialReviewedAt: post.editorialReviewedAt || post.updatedAt || post.sortDate || "",
      editorialReviewer: post.editorialReviewer || "트립뷰 편집팀",
      editorialAuthorProfile: post.editorialAuthorProfile || "/editorial-team",
    };
  }

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
    const reviewedAt = item.reviewedAt || config.reviewedAt;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewedAt)) throw new Error(`Invalid review date for ${item.slug}`);
    if (item.publishedAt && !/^\d{4}-\d{2}-\d{2}$/.test(item.publishedAt)) {
      throw new Error(`Invalid publication date for ${item.slug}`);
    }
    if (item.officialUrl && !safeHttpsUrl(item.officialUrl)) {
      throw new Error(`Invalid official URL for ${item.slug}`);
    }
    if (item.sections && normalizeSections(item.sections).length < 4) {
      throw new Error(`Custom editorial sections are incomplete for ${item.slug}`);
    }
    if (item.faq && normalizeFaq(item.faq).length < 3) {
      throw new Error(`Custom editorial FAQ is incomplete for ${item.slug}`);
    }
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

  const reviewedAt = review.reviewedAt || config.reviewedAt;
  const publishedAt = review.publishedAt || "";
  const officialUrl = safeHttpsUrl(review.officialUrl);
  const customFaq = normalizeFaq(review.faq);
  const reviewed = {
    ...post,
    title: clean(review.title || post.title),
    description: compact(`${clean(post.sourceTitle || post.title)} 방문 판단에 필요한 운영 정보와 편집팀 확인 사항을 정리했습니다. ${clean(review.angle)}`, 155),
    excerpt: compact(review.angle, 125),
    sections: reviewedSections(post, review),
    faq: customFaq.length ? customFaq : post.faq,
    editorialStatus: "reviewed",
    editorialReviewedAt: reviewedAt,
    editorialReviewer: clean(config.reviewer),
    editorialAuthorProfile: clean(config.authorProfile),
    editorialTopics: [...new Set(review.topics)],
    editorialAngle: clean(review.angle),
    updatedAt: reviewedAt,
    ...(officialUrl ? { tourApi: { ...(post.tourApi || {}), homepage: officialUrl } } : {}),
    ...(publishedAt ? { date: koreanDate(publishedAt), sortDate: publishedAt } : {}),
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
