import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isIndexablePost } from "./lib/content-quality.mjs";
import { pexelsCoverAssetForPost, pexelsImageCaption, readPexelsImageManifest } from "./lib/pexels-image-assets.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POSTS_PATH = path.join(ROOT, "data", "generated-posts.json");
const STYLE_SOURCE = path.join(ROOT, "travel-125652", "index.html");

const esc = (value = "") => String(value).replace(/[&<>"']/g, (match) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[match]));

const text = (value = "") => String(value ?? "").trim();

function shouldRenderManualPage(post = {}) {
  return Boolean(post.renderManualPage && isIndexablePost(post));
}

function infoRows(post) {
  return (Array.isArray(post.info) ? post.info : [])
    .map(([key, value]) => `<tr><th>${esc(key)}</th><td>${esc(value)}</td></tr>`)
    .join("");
}

function sectionsHtml(post) {
  return (Array.isArray(post.sections) ? post.sections : [])
    .map(([heading, paragraphs]) => `<h2>${esc(heading)}</h2>${(paragraphs || []).map((paragraph) => `<p>${esc(paragraph)}</p>`).join("")}`)
    .join("");
}

function faqHtml(post) {
  return (Array.isArray(post.faq) ? post.faq : [])
    .map(([question, answer]) => `<details open><summary>${esc(question)}</summary><p>${esc(answer)}</p></details>`)
    .join("");
}

function canonicalUrl(post) {
  return `https://tripview.kr/${encodeURIComponent(post.slug)}/`;
}

function coverMeta(post, pexelsImages) {
  const pexelsCover = pexelsCoverAssetForPost(pexelsImages, post);
  if (pexelsCover?.src) {
    return {
      src: pexelsCover.src,
      alt: pexelsCover.alt || post.alt || post.title,
      caption: pexelsImageCaption(pexelsCover),
    };
  }
  const image = text(post.image);
  return image ? { src: image, alt: post.alt || post.title, caption: "출처: 본문 표기 이미지 또는 공개 자료" } : null;
}

function coverFigure(post, pexelsImages) {
  const cover = coverMeta(post, pexelsImages);
  if (!cover?.src) return "";
  return `<figure class="cover-figure"><img class="cover" src="${esc(cover.src)}" alt="${esc(cover.alt)}" loading="lazy" /><figcaption>${esc(cover.caption)}</figcaption></figure>`;
}

function relatedHtml(post, posts) {
  const related = posts
    .filter((item) => item.slug !== post.slug && item.category === post.category && shouldRenderManualPage(item))
    .slice(0, 4);
  if (!related.length) return "";
  const cards = related.map((item) => `<a class="related-card" href="../${esc(item.slug)}/"><strong>${esc(item.title)}</strong><span>${esc([item.category, item.date, item.region].filter(Boolean).join(" · "))}</span></a>`).join("");
  return `<section class="related-posts" aria-labelledby="related-posts-title"><h2 id="related-posts-title">함께 보면 좋은 글</h2><div class="related-list">${cards}</div></section>`;
}

function render(post, posts, style, pexelsImages) {
  const cover = coverMeta(post, pexelsImages);
  const memo = (post.memo || []).map((item) => `<span>${esc(item)}</span>`).join("");
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta name="naver-site-verification" content="38616b4b4209994ed384d0d2439bddcbec2cc711" />
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5751319666030430" crossorigin="anonymous"></script>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${esc(post.description)}" />
    <meta property="og:title" content="${esc(post.title)} | 트립뷰" />
    <meta property="og:description" content="${esc(post.excerpt || post.description)}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${esc(canonicalUrl(post))}" />
    ${cover?.src ? `<meta property="og:image" content="${esc(cover.src)}" />` : ""}
    <title>${esc(post.title)} | 트립뷰</title>
    ${style}
  </head>
  <body>
    <header class="top"><div class="wrap nav"><a class="brand" href="../">트립뷰</a><nav class="links" aria-label="주요 메뉴"><a href="../">홈</a><a href="../travel/">여행지</a><a href="../festival/">축제</a><a href="../stay/">숙소</a><a href="../ticket/">입장권·투어</a></nav></div></header>
    <main>
      <section class="wrap hero"><h1>${esc(post.title)}</h1><div class="meta"><span>트립뷰 편집팀</span><span>${esc(post.date)}</span><span>${esc(post.read)}</span><span>${esc(post.region)}</span></div></section>
      ${coverFigure(post, pexelsImages)}
      <section class="wrap layout"><article class="content"><table class="info-table"><tbody>${infoRows(post)}</tbody></table>${sectionsHtml(post)}<h2>자주 묻는 질문</h2>${faqHtml(post)}${relatedHtml(post, posts)}<p class="note">항공, 입국, 운영 시간, 요금, 휴무, 현지 교통은 현장 사정과 정책에 따라 바뀔 수 있습니다. 항공권과 숙소를 결제하기 전 공식 안내를 한 번 더 확인하세요.</p></article><aside class="aside"><strong>운영 메모</strong>${memo}<a href="../">목록으로 돌아가기</a></aside></section>
    </main>
    <footer><div class="wrap"><strong>트립뷰</strong><p>오늘 바로 움직일 수 있는 여행 큐레이션.</p></div></footer>
    <script>const header=document.querySelector('.top');const syncHeader=()=>header.classList.toggle('is-scrolled',window.scrollY>24);syncHeader();window.addEventListener('scroll',syncHeader,{passive:true});</script>
    <script src="/assets/topic-filter.js?v=topic-filter-20260712-no-hero" defer></script>
  </body>
</html>
`;
}

const posts = JSON.parse(await readFile(POSTS_PATH, "utf8"));
const pexelsImages = await readPexelsImageManifest(ROOT);
const styleSource = await readFile(STYLE_SOURCE, "utf8");
const style = styleSource.match(/<style>[\s\S]*?<\/style>/i)?.[0];
if (!style) throw new Error("Could not load the article style template.");

let rendered = 0;
for (const post of posts.filter(shouldRenderManualPage)) {
  const dir = path.join(ROOT, post.slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "index.html"), render(post, posts, style, pexelsImages), "utf8");
  rendered += 1;
}

console.log(`Rendered ${rendered} manual article page(s).`);
