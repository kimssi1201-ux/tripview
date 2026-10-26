import { MIN_INDEXABLE_BODY_LENGTH, postBodyLength } from "./content-quality.mjs";

export const PUBLICATION_TIMEZONE = "Asia/Seoul";
export const MAX_SCHEDULED_PUBLICATIONS_PER_DAY = 1;

export function publicationDateInKorea(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PUBLICATION_TIMEZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.filter(({type}) => type !== "literal").map(({type, value}) => [type, value]));
  return [values.year, values.month, values.day].join("-");
}

export function normalizedPostTitle(post = {}) {
  return String(post.sourceTitle || post.title || "").replace(/\s+/g, "").toLowerCase();
}

export function validateQueuedPost(entry = {}) {
  const post = entry.post || {};
  if (entry.approved !== true) return "편집 승인 전";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(entry.publishDate || ""))) return "발행 날짜 형식 오류";
  if (!/^[a-z0-9][a-z0-9-]*$/.test(String(post.slug || ""))) return "글 주소(slug) 오류";
  if (!String(post.title || "").trim()) return "제목 누락";
  if (!String(post.category || "").trim() || !String(post.region || "").trim()) return "분류·지역 누락";
  if (!String(post.image || "").trim()) return "대표 썸네일 누락";
  if (post.editorialStatus !== "reviewed" || !String(post.editorialReviewer || "").trim()) return "편집 검수 정보 누락";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(post.editorialReviewedAt || ""))) return "검수 날짜 누락";
  if (postBodyLength(post) < MIN_INDEXABLE_BODY_LENGTH) return "본문 분량 부족";
  if (!Array.isArray(post.sections) || !post.sections.length) return "본문 구성 누락";
  return "";
}

export function selectScheduledPost({ queue = [], archive = [], published = [], existing = [], date }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) throw new Error("A valid Korea publication date is required");
  if (published.some((item) => item.date === date)) return { entry: null, reason: "오늘 이미 예약 글 1개 발행됨" };
  const occupiedSlugs = new Set([...archive, ...existing].map((post) => String(post.slug || "")).filter(Boolean));
  const occupiedTitles = new Set([...archive, ...existing].map(normalizedPostTitle).filter(Boolean));
  const candidates = queue.map((entry, index) => ({entry, index}))
    .filter(({entry}) => entry.status !== "published" && entry.publishDate <= date)
    .sort((a, b) => a.entry.publishDate.localeCompare(b.entry.publishDate) || a.index - b.index);
  for (const {entry, index} of candidates) {
    const error = validateQueuedPost(entry);
    if (error) continue;
    const post = entry.post;
    if (occupiedSlugs.has(post.slug) || occupiedTitles.has(normalizedPostTitle(post))) continue;
    return { entry, index, reason: "" };
  }
  return { entry: null, reason: "오늘 발행 가능한 검수 완료 예약 글 없음" };
}

export function publicationPost(entry, date) {
  const p = entry.post;
  return {
    ...p,
    image: String(p.image).trim(),
    images: Array.isArray(p.images) && p.images.length ? p.images : [String(p.image).trim()],
    date: date.replace(/^(\d{4})-(\d{2})-(\d{2})$/, (_,y,m,d) => y + "년 " + Number(m) + "월 " + Number(d) + "일"),
    sortDate: date,
    updatedAt: date,
    editorialStatus: "reviewed",
    editorialAuthorProfile: p.editorialAuthorProfile || "/editorial-team",
    renderManualPage: true,
  };
}
