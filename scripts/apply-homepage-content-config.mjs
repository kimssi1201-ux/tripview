import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POSTS_PATH = path.join(ROOT, "data", "generated-posts.json");
const INDEX_PATH = path.join(ROOT, "index.html");

const esc = (value = "") =>
  String(value).replace(/[&<>"']/g, (match) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[match]));

const normalize = (value = "") => String(value).trim();
const hrefOf = (post) => (post?.slug ? `/${post.slug}/` : "#");
const imageOf = (post) => post?.image || post?.images?.[0] || "";
const titleOf = (post) => normalize(post?.sourceTitle || post?.title || "여행 기사");
const dateOf = (post) => normalize(post?.date || post?.sortDate || "");
const categoryOf = (post) => normalize(post?.category || "여행 정보");
const regionOf = (post) => normalize(post?.region || "");

function compactRegion(value = "") {
  const text = normalize(value).replace(/\([^)]*\)/g, "");
  if (!text) return "기타";
  if (text.includes("서울")) return "서울";
  if (text.includes("경기") || text.includes("인천")) return "경기·인천";
  if (text.includes("충청") || text.includes("충북") || text.includes("충남") || text.includes("대전") || text.includes("세종")) return "충청";
  if (text.includes("강원")) return "강원";
  if (text.includes("전라") || text.includes("전북") || text.includes("전남") || text.includes("광주")) return "전라";
  if (text.includes("경상") || text.includes("경북") || text.includes("경남") || text.includes("부산") || text.includes("대구") || text.includes("울산")) return "경상";
  if (text.includes("제주")) return "제주";
  return text.split(/\s+/).filter(Boolean)[0] || "기타";
}

function uniquePosts(posts) {
  const seen = new Set();
  return posts.filter((post) => {
    const key = post?.slug || post?.title;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function fillSection(posts, preferred, count = 10) {
  return uniquePosts([...preferred, ...posts]).slice(0, count);
}

function articleImage(post, className) {
  const image = imageOf(post);
  if (!image) return `<span class="${className} no-image"></span>`;
  return `<span class="${className}"><img src="${esc(image)}" alt="${esc(titleOf(post))}" loading="lazy"></span>`;
}

function metaLine(post) {
  return [categoryOf(post), dateOf(post), compactRegion(regionOf(post))].filter(Boolean).join(" · ");
}

function leadArticle(post) {
  if (!post) return "";
  return `<a class="news-lead" href="${esc(hrefOf(post))}">
    ${articleImage(post, "lead-thumb")}
    <strong>${esc(titleOf(post))}</strong>
    <span>${esc(metaLine(post))}</span>
  </a>`;
}

function pickCard(post) {
  return `<a class="pick-card" href="${esc(hrefOf(post))}">
    ${articleImage(post, "pick-thumb")}
    <strong>${esc(titleOf(post))}</strong>
  </a>`;
}

function listItem(post) {
  return `<a class="news-row" href="${esc(hrefOf(post))}">
    ${articleImage(post, "row-thumb")}
    <span><strong>${esc(titleOf(post))}</strong><em>${esc(metaLine(post))}</em></span>
  </a>`;
}

function newsSection({ id, title, posts }) {
  const items = uniquePosts(posts).slice(0, 10);
  if (!items.length) return "";
  const lead = items[0];
  const picks = items.slice(1, 4);
  const list = items.slice(4, 10);
  return `<section class="news-section" id="${esc(id)}" aria-labelledby="${esc(id)}-title">
    <h2 id="${esc(id)}-title">${esc(title)}</h2>
    ${leadArticle(lead)}
    <div class="pick-grid">${picks.map(pickCard).join("")}</div>
    <div class="news-list">${list.map(listItem).join("")}</div>
  </section>`;
}

function buildSections(posts) {
  const domestic = posts.filter((post) => categoryOf(post) === "국내여행");
  const festivals = posts.filter((post) => categoryOf(post) === "공연/축제");
  const byRegion = (region) => posts.filter((post) => compactRegion(regionOf(post)) === region);

  return [
    { id: "travel", title: "Travel", posts: fillSection(posts, domestic) },
    { id: "festival", title: "Festival", posts: fillSection(posts, festivals) },
    { id: "seoul", title: "Seoul", posts: fillSection(posts, byRegion("서울")) },
    { id: "gyeonggi", title: "Gyeonggi/Incheon", posts: fillSection(posts, byRegion("경기·인천")) },
    { id: "jeju", title: "Jeju", posts: fillSection(posts, byRegion("제주")) },
  ];
}

function categoryNav(sections) {
  return sections.map((section) => `<a href="#${esc(section.id)}">${esc(section.title)}</a>`).join("");
}

function html(posts) {
  const sections = buildSections(posts).filter((section) => section.posts.length);
  const hero = posts[0];
  const ogImage = imageOf(hero);

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta name="naver-site-verification" content="38616b4b4209994ed384d0d2439bddcbec2cc711">
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8468106244002167" crossorigin="anonymous"></script>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="트립뷰는 국내 여행지와 지역 축제 정보를 모바일 뉴스 피드처럼 빠르게 확인할 수 있는 여행 정보 매거진입니다.">
    <meta name="theme-color" content="#ffffff">
    <meta property="og:title" content="트립뷰 - 여행 뉴스 피드">
    <meta property="og:description" content="가볼 만한 곳, 지역 축제, 방문 전 체크 정보를 카테고리별 뉴스 섹션으로 정리합니다.">
    <meta property="og:type" content="website">
    ${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : ""}
    <meta name="twitter:card" content="summary_large_image">
    <link rel="alternate" type="application/rss+xml" title="트립뷰 RSS" href="https://tripview.kr/rss.xml">
    <title>트립뷰 - 여행 뉴스 피드</title>
    <style>
      :root{--ink:#111;--muted:#777;--line:#e2e2e2;--paper:#fff;--soft:#f5f5f5}*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:112px}body{margin:0;background:var(--paper);color:var(--ink);font-family:Arial,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;letter-spacing:0;line-height:1.45}a{color:inherit;text-decoration:none}img{display:block;width:100%;height:100%;object-fit:cover;background:var(--soft)}.site-header{position:sticky;top:0;z-index:10;background:rgba(255,255,255,.96);border-bottom:1px solid var(--line);backdrop-filter:blur(12px)}.header-inner{max-width:720px;margin:0 auto;padding:15px 16px 10px}.brand{display:block;margin-bottom:12px;font-size:28px;font-weight:900;line-height:1}.nav-scroll{display:flex;gap:18px;overflow-x:auto;padding-bottom:4px;white-space:nowrap;font-size:15px;font-weight:800}.nav-scroll::-webkit-scrollbar,.pick-grid::-webkit-scrollbar{display:none}.page{max-width:720px;margin:0 auto;padding:10px 16px 40px}.top-line{display:flex;align-items:center;justify-content:space-between;padding:10px 0 18px;color:var(--muted);font-size:13px;border-bottom:1px solid var(--line)}.news-section{padding:28px 0 34px;border-bottom:8px solid #f2f2f2;scroll-margin-top:112px}.news-section h2{margin:0 0 16px;font-size:31px;line-height:1.05;font-weight:900;letter-spacing:-.01em}.news-lead{display:block}.lead-thumb{display:block;width:100%;aspect-ratio:1.78/1;overflow:hidden;background:var(--soft)}.news-lead strong{display:block;margin-top:12px;font-size:24px;line-height:1.22;font-weight:900}.news-lead span{display:block;margin-top:7px;color:var(--muted);font-size:13px}.pick-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:20px}.pick-card{min-width:0}.pick-thumb{display:block;aspect-ratio:1.2/1;overflow:hidden;background:var(--soft)}.pick-card strong{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-top:7px;font-size:13px;line-height:1.34;font-weight:800}.news-list{margin-top:22px;border-top:1px solid var(--line)}.news-row{display:grid;grid-template-columns:92px minmax(0,1fr);gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line)}.row-thumb{display:block;aspect-ratio:1.28/1;overflow:hidden;background:var(--soft)}.news-row strong{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:17px;line-height:1.35;font-weight:900}.news-row em{display:block;margin-top:5px;color:var(--muted);font-size:12px;font-style:normal}.no-image{background:linear-gradient(135deg,#f1f1f1,#dedede)}.site-footer{max-width:720px;margin:0 auto;padding:28px 16px 44px;color:var(--muted);font-size:13px}.site-footer strong{display:block;color:var(--ink);font-size:20px;margin-bottom:6px}@media(min-width:760px){.header-inner,.page,.site-footer{max-width:1040px}.page{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 36px}.top-line{grid-column:1/-1}.news-section{border-bottom:1px solid var(--line)}.news-section h2{font-size:34px}}@media(max-width:360px){.news-section h2{font-size:28px}.news-lead strong{font-size:21px}.news-row{grid-template-columns:82px minmax(0,1fr)}.pick-grid{gap:7px}.pick-card strong{font-size:12px}}
    </style>
  </head>
  <body>
    <header class="site-header">
      <div class="header-inner">
        <a class="brand" href="/">트립뷰</a>
        <nav class="nav-scroll" aria-label="카테고리">${categoryNav(sections)}</nav>
      </div>
    </header>
    <main class="page">
      <div class="top-line"><span>Travel News Feed</span><span>${esc(new Date().toISOString().slice(0, 10))}</span></div>
      ${sections.map(newsSection).join("\n")}
    </main>
    <footer class="site-footer">
      <strong>트립뷰</strong>
      <span>국내 여행지와 지역 축제 정보를 카테고리별로 빠르게 확인하는 여행 뉴스 피드입니다.</span>
    </footer>
  </body>
</html>`;
}

const posts = JSON.parse(await fs.readFile(POSTS_PATH, "utf8"))
  .filter((post) => post?.slug && post?.title)
  .sort((a, b) => String(b.sortDate || "").localeCompare(String(a.sortDate || "")));

await fs.writeFile(INDEX_PATH, html(posts), "utf8");
console.log(`Homepage rebuilt as mobile news feed with ${posts.length} post(s).`);
