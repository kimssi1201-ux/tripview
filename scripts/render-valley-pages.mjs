import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_PATH = path.join(ROOT, "data", "generated-posts.json");
const STYLE_SOURCE = path.join(ROOT, "travel-125652", "index.html");
const TARGET_SLUGS = ["travel-125837", "travel-2787329", "travel-3042140"];

const esc = (value = "") => String(value).replace(/[&<>"']/g, (match) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[match]));

const text = (value = "") => String(value ?? "").trim();

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

function mapHtml(post) {
  const address = text((post.info || []).find(([key]) => key === "주소")?.[1]);
  if (!address) return "";
  const query = encodeURIComponent(address);
  return `<!-- map-preview:start -->
<section class="map-preview" aria-label="지도 미리보기">
  <h2>지도 미리보기</h2>
  <div class="map-frame"><iframe title="${esc(address)} 지도 미리보기" src="https://maps.google.com/maps?q=${query}&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>
  <p class="map-address">${esc(address)}</p>
  <div class="map-links">
    <a href="https://www.google.com/maps/search/?api=1&query=${query}" target="_blank" rel="noopener">Google 지도에서 보기</a>
    <a href="https://map.naver.com/p/search/${query}" target="_blank" rel="noopener">네이버 지도에서 보기</a>
  </div>
</section>
<!-- map-preview:end -->`;
}

function relatedHtml(post, posts) {
  const related = posts
    .filter((item) => item.slug !== post.slug && /계곡|폭포|물길|남대천/.test(`${item.title} ${item.sourceTitle} ${(item.keywords || []).join(" ")}`))
    .slice(0, 4);
  if (!related.length) return "";
  const cards = related.map((item) => `<a class="related-card" href="../${esc(item.slug)}/"><strong>${esc(item.title)}</strong><span>${esc([item.category, item.date, item.region].filter(Boolean).join(" · "))}</span></a>`).join("");
  return `<section class="related-posts" aria-labelledby="related-posts-title"><h2 id="related-posts-title">함께 보면 좋은 글</h2><div class="related-list">${cards}</div></section>`;
}

function render(post, posts, style) {
  const address = text((post.info || []).find(([key]) => key === "주소")?.[1]);
  const memo = (post.memo || []).map((item) => `<span>${esc(item)}</span>`).join("");
  const query = encodeURIComponent(address);
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta name="naver-site-verification" content="38616b4b4209994ed384d0d2439bddcbec2cc711" />
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5751319666030430" crossorigin="anonymous"></script>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${esc(post.description)}" />
    <meta property="og:title" content="${esc(post.title)} | 트립뷰" />
    <meta property="og:description" content="${esc(post.excerpt)}" />
    <meta property="og:type" content="article" />
    <meta property="og:image" content="${esc(post.image)}" />
    <title>${esc(post.title)} | 트립뷰</title>
    ${style}
  </head>
  <body>
    <header class="top"><div class="wrap nav"><a class="brand" href="../">트립뷰</a><nav class="links" aria-label="주요 메뉴"><a href="../">홈</a><a href="../#popular">지금 많이 찾는 여행지</a><a href="../#weekend">이번 주말 가볼만한 곳</a><a href="../#festival">7~8월 축제/행사</a><a href="../#water">물놀이·계곡·해수욕장</a><a href="../#indoor">비 오는 날 실내 여행</a><a href="../#family">아이와 가기 좋은 곳</a><a href="../#booking">예약 전 체크</a></nav><div class="language-switch notranslate" translate="no" aria-label="Language selector"><a href="?lang=ko" data-lang="ko" lang="ko">KO</a><a href="?lang=en" data-lang="en" lang="en">EN</a><a href="?lang=ja" data-lang="ja" lang="ja">JA</a><a href="?lang=zh" data-lang="zh" lang="zh-CN">ZH</a></div></div></header>
    <main>
      <section class="wrap hero"><h1>${esc(post.title)}</h1><div class="meta"><span>트립뷰 편집팀</span><span>${esc(post.date)}</span><span>${esc(post.read)}</span><span>${esc(post.region)}</span></div></section>
      <figure class="cover-figure"><img class="cover" src="${esc(post.image)}" alt="${esc(post.alt || `${post.sourceTitle} 이미지`)}" /><figcaption>출처: 한국관광공사</figcaption></figure>
      <section class="wrap layout"><article class="content"><table class="info-table"><tbody>${infoRows(post)}</tbody></table>${mapHtml(post)}${sectionsHtml(post)}<h2>자주 묻는 질문</h2>${faqHtml(post)}${relatedHtml(post, posts)}<p class="note">운영 시간, 요금, 출입 가능 여부와 주차 정보는 현장 사정에 따라 달라질 수 있습니다. 출발 전 당일 공지를 한 번 더 확인하세요.</p></article><aside class="aside"><strong>운영 메모</strong>${memo}<a href="../">목록으로 돌아가기</a></aside></section>
    </main>
    <footer><div class="wrap"><strong>트립뷰</strong><p>오늘 바로 움직일 수 있는 여행 큐레이션.</p></div></footer>
    <script>const header=document.querySelector('.top');const syncHeader=()=>header.classList.toggle('is-scrolled',window.scrollY>24);syncHeader();window.addEventListener('scroll',syncHeader,{passive:true});</script>
    <script src="/assets/i18n.js?v=i18n-link-fix-20260706" defer></script><script src="/assets/topic-filter.js?v=topic-filter-20260712-no-hero" defer></script>
  </body>
</html>
`;
}

const posts = JSON.parse(await readFile(DATA_PATH, "utf8"));
const styleSource = await readFile(STYLE_SOURCE, "utf8");
const style = styleSource.match(/<style>[\s\S]*?<\/style>/i)?.[0];
if (!style) throw new Error("Could not load the article style template.");

let rendered = 0;
for (const slug of TARGET_SLUGS) {
  const post = posts.find((item) => item.slug === slug);
  if (!post) throw new Error(`Missing post data: ${slug}`);
  const dir = path.join(ROOT, slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "index.html"), render(post, posts, style), "utf8");
  rendered += 1;
}

console.log(`Rendered ${rendered} valley article page(s).`);
