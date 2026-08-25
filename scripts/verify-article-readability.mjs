import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POSTS_PATH = path.join(ROOT, "data", "generated-posts.json");

const FORBIDDEN_VISIBLE_TERMS = [
  "API",
  "TourAPI",
  "한국관광공사 API",
  "마이리얼트립 API",
  "캐시",
  "캐시에 저장된",
  "JSON",
  "데이터",
  "데이터베이스",
  "응답",
  "필드",
  "파라미터",
  "조회",
  "크롤링",
  "파싱",
  "로컬",
  "엔드포인트",
  "스키마",
  "렌더링",
  "렌더링 시점",
  "빌드",
  "자동 생성",
  "스크립트",
  "저장되어 있습니다",
  "표에 넣었습니다",
  "본문에 넣지 않았습니다",
  "만들지 않았습니다",
  "생성하지 않았습니다",
  "검증할 수 없어",
  "확인할 수 없어",
  "대조할 수 있는 항목",
  "수동 검수 콘텐츠",
  "항목만 사용했습니다",
  "남겼습니다",
  "기준으로 작성했으며",
];

const REMOVED_SECTION_TERMS = [
  "자료 기준",
  "본문에서 제외한 내용",
  "운영 메모",
];

const OLD_HEADINGS = [
  "이 축제를 어떻게 보면 좋을까",
  "운영 정보에서 놓치기 쉬운 부분",
  "출발 전 마지막 확인",
  "프로그램 고르는 법",
  "이동과 귀가 팁",
  "어떤 일정에 어울릴까",
  "주변 동선 잡기",
  "준비물과 방문 팁",
];

function decodeEntities(value = "") {
  return String(value)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)));
}

function stripHtml(value = "") {
  return decodeEntities(String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function articleBody(document = "") {
  return String(document).match(/<article\b[^>]*\bclass=["'][^"']*\bcontent\b[^"']*["'][^>]*>([\s\S]*?)<\/article>/i)?.[1] || "";
}

function classSections(document = "", className = "") {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...String(document).matchAll(new RegExp(`<section\\b[^>]*\\bclass=["'][^"']*\\b${escaped}\\b[^"']*["'][^>]*>[\\s\\S]*?<\\/section>`, "gi"))]
    .map((match) => match[0]);
}

function visibleArticleText(document = "") {
  return stripHtml(articleBody(document));
}

function fail(failures, slug, reason, detail = "") {
  failures.push({ slug, reason, detail });
}

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasForbiddenVisibleTerm(text = "", term = "") {
  if (term === "필드") return /(^|[^0-9A-Za-z가-힣])필드($|[^0-9A-Za-z가-힣])/.test(text);
  if (/^[A-Za-z0-9]+$/.test(term)) {
    return new RegExp(`(^|[^0-9A-Za-z가-힣])${escapeRegExp(term)}($|[^0-9A-Za-z가-힣])`).test(text);
  }
  return text.includes(term);
}

async function main() {
  const posts = JSON.parse(await fs.readFile(POSTS_PATH, "utf8"));
  const failures = [];
  let inspected = 0;
  let accommodationSections = 0;
  let inlineFigures = 0;
  let articleImages = 0;
  let longParagraphWarnings = 0;

  for (const post of posts) {
    if (!post?.slug) continue;
    const file = path.join(ROOT, post.slug, "index.html");
    let document = "";
    try {
      document = await fs.readFile(file, "utf8");
    } catch {
      continue;
    }
    const body = articleBody(document);
    if (!body) continue;
    inspected += 1;
    const text = visibleArticleText(document);

    for (const term of FORBIDDEN_VISIBLE_TERMS) {
      if (hasForbiddenVisibleTerm(text, term)) fail(failures, post.slug, "forbidden_visible_term", term);
    }

    for (const term of REMOVED_SECTION_TERMS) {
      if (text.includes(term)) fail(failures, post.slug, "removed_section_remaining", term);
    }

    for (const term of OLD_HEADINGS) {
      if (text.includes(term)) fail(failures, post.slug, "old_heading_remaining", term);
    }

    if (/https?:\/\//i.test(text)) fail(failures, post.slug, "visible_raw_url");

    for (const paragraph of body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
      const paragraphText = stripHtml(paragraph[1]);
      if (paragraphText.length > 260) {
        longParagraphWarnings += 1;
        fail(failures, post.slug, "paragraph_too_long", paragraphText.slice(0, 120));
      }
    }

    for (const img of body.matchAll(/<img\b([^>]*)>/gi)) {
      articleImages += 1;
      const attrs = img[1];
      if (!/\bloading=["']lazy["']/i.test(attrs)) fail(failures, post.slug, "image_lazy_missing");
      const alt = attrs.match(/\balt=["']([^"']*)["']/i)?.[1] || "";
      if (!stripHtml(alt)) fail(failures, post.slug, "image_alt_missing");
    }

    inlineFigures += (body.match(/\barticle-inline-figure\b/g) || []).length;

    const productSections = [
      ...classSections(body, "article-product-section"),
      ...classSections(body, "mrt-accommodation-block"),
    ].filter((section) => /accommodation|숙소/.test(section));
    accommodationSections += productSections.length;
    for (const section of productSections) {
      const sectionText = stripHtml(section);
      if (/숙소\s*카드/.test(sectionText)) fail(failures, post.slug, "accommodation_card_wording_remaining");
      if (/렌더링|다음\s*금요일|일요일\s*체크아웃/.test(sectionText)) fail(failures, post.slug, "accommodation_system_wording_remaining");
      if (!sectionText.includes("성인 2명 기준 주말 1박 요금입니다")) fail(failures, post.slug, "accommodation_note_not_updated");
      if (/\d{4}-\d{2}-\d{2}\s*체크인/.test(sectionText)) fail(failures, post.slug, "accommodation_iso_checkin_remaining");
      if (/\bmrt-accommodation-grid\b/.test(section) && !/data-count=["']\d+["']/.test(section)) fail(failures, post.slug, "accommodation_grid_count_missing");
    }
  }

  if (failures.length) {
    console.error(JSON.stringify({
      inspected,
      failures: failures.slice(0, 80),
      failureCount: failures.length,
      accommodationSections,
      inlineFigures,
      articleImages,
      longParagraphWarnings,
    }, null, 2));
    throw new Error(`Article readability verification failed: ${failures.length}`);
  }

  console.log(JSON.stringify({
    inspected,
    failureCount: 0,
    accommodationSections,
    inlineFigures,
    articleImages,
    longParagraphWarnings,
  }, null, 2));
}

await main();
