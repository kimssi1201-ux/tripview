import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POSTS_PATH = path.join(ROOT, "data", "generated-posts.json");
const INDEX_PATH = path.join(ROOT, "index.html");

const BRAND = "\uD2B8\uB9BD\uBDF0";
const CAT_DOMESTIC = "\uAD6D\uB0B4\uC5EC\uD589";
const CAT_FESTIVAL = "\uACF5\uC5F0/\uCD95\uC81C";
const REGION_OTHER = "\uAE30\uD0C0";
const REGIONS = [
  { id: "seoul", title: "\uC11C\uC6B8" },
  { id: "gyeonggi", title: "\uACBD\uAE30" },
  { id: "incheon", title: "\uC778\uCC9C" },
  { id: "gangwon", title: "\uAC15\uC6D0" },
  { id: "daejeon", title: "\uB300\uC804" },
  { id: "sejong", title: "\uC138\uC885" },
  { id: "chungbuk", title: "\uCDA9\uBD81" },
  { id: "chungnam", title: "\uCDA9\uB0A8" },
  { id: "gwangju", title: "\uAD11\uC8FC" },
  { id: "jeonbuk", title: "\uC804\uBD81" },
  { id: "jeonnam", title: "\uC804\uB0A8" },
  { id: "daegu", title: "\uB300\uAD6C" },
  { id: "busan", title: "\uBD80\uC0B0" },
  { id: "ulsan", title: "\uC6B8\uC0B0" },
  { id: "gyeongbuk", title: "\uACBD\uBD81" },
  { id: "gyeongnam", title: "\uACBD\uB0A8" },
  { id: "jeju", title: "\uC81C\uC8FC" },
];

const TEXT = {
  articleFallback: "\uC5EC\uD589 \uAE30\uC0AC",
  infoFallback: "\uC5EC\uD589 \uC815\uBCF4",
  description: `${BRAND}\uB294 \uAD6D\uB0B4 \uC5EC\uD589\uC9C0\uC640 \uC9C0\uC5ED \uCD95\uC81C \uC815\uBCF4\uB97C \uBAA8\uBC14\uC77C \uB274\uC2A4 \uD53C\uB4DC\uCC98\uB7FC \uBE60\uB974\uAC8C \uD655\uC778\uD560 \uC218 \uC788\uB294 \uC5EC\uD589 \uC815\uBCF4 \uB9E4\uAC70\uC9C4\uC785\uB2C8\uB2E4.`,
  ogTitle: `${BRAND} - \uC5EC\uD589 \uB274\uC2A4 \uD53C\uB4DC`,
  ogDescription: "\uAC00\uBCFC \uB9CC\uD55C \uACF3, \uC9C0\uC5ED \uCD95\uC81C, \uBC29\uBB38 \uC804 \uCCB4\uD06C \uC815\uBCF4\uB97C \uCE74\uD14C\uACE0\uB9AC\uBCC4 \uB274\uC2A4 \uC139\uC158\uC73C\uB85C \uC815\uB9AC\uD569\uB2C8\uB2E4.",
  rssTitle: `${BRAND} RSS`,
  navLabel: "\uCE74\uD14C\uACE0\uB9AC",
  navAll: "\uC804\uCCB4",
  navTravel: "\uAC00\uBCFC\uB9CC\uD55C \uACF3",
  navFestival: "\uC9C0\uC5ED\uCD95\uC81C \uC815\uBCF4",
  feedAll: "\uC804\uCCB4 \uAE00",
  feedShowing: "\uBCF4\uAE30",
  feedSelected: "\uC120\uD0DD\uB428",
  footer: "\uAD6D\uB0B4 \uC5EC\uD589\uC9C0\uC640 \uC9C0\uC5ED \uCD95\uC81C \uC815\uBCF4\uB97C \uCE74\uD14C\uACE0\uB9AC\uBCC4\uB85C \uBE60\uB974\uAC8C \uD655\uC778\uD558\uB294 \uC5EC\uD589 \uB274\uC2A4 \uD53C\uB4DC\uC785\uB2C8\uB2E4.",
};

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
const titleOf = (post) => normalize(post?.sourceTitle || post?.title || TEXT.articleFallback);
const dateOf = (post) => normalize(post?.date || post?.sortDate || "");
const categoryOf = (post) => normalize(post?.category || TEXT.infoFallback);
const regionOf = (post) => normalize(post?.region || "");

function compactRegion(value = "") {
  const text = normalize(value).replace(/\([^)]*\)/g, "");
  if (!text) return REGION_OTHER;
  if (text.includes("\uC11C\uC6B8")) return "\uC11C\uC6B8";
  if (text.includes("\uACBD\uAE30")) return "\uACBD\uAE30";
  if (text.includes("\uC778\uCC9C")) return "\uC778\uCC9C";
  if (text.includes("\uAC15\uC6D0")) return "\uAC15\uC6D0";
  if (text.includes("\uB300\uC804")) return "\uB300\uC804";
  if (text.includes("\uC138\uC885")) return "\uC138\uC885";
  if (text.includes("\uCDA9\uBD81") || text.includes("\uCDA9\uCCAD\uBD81")) return "\uCDA9\uBD81";
  if (text.includes("\uCDA9\uB0A8") || text.includes("\uCDA9\uCCAD\uB0A8")) return "\uCDA9\uB0A8";
  if (text.includes("\uAD11\uC8FC")) return "\uAD11\uC8FC";
  if (text.includes("\uC804\uBD81") || text.includes("\uC804\uB77C\uBD81")) return "\uC804\uBD81";
  if (text.includes("\uC804\uB0A8") || text.includes("\uC804\uB77C\uB0A8")) return "\uC804\uB0A8";
  if (text.includes("\uB300\uAD6C")) return "\uB300\uAD6C";
  if (text.includes("\uBD80\uC0B0")) return "\uBD80\uC0B0";
  if (text.includes("\uC6B8\uC0B0")) return "\uC6B8\uC0B0";
  if (text.includes("\uACBD\uBD81") || text.includes("\uACBD\uC0C1\uBD81")) return "\uACBD\uBD81";
  if (text.includes("\uACBD\uB0A8") || text.includes("\uACBD\uC0C1\uB0A8")) return "\uACBD\uB0A8";
  if (text.includes("\uC81C\uC8FC")) return "\uC81C\uC8FC";
  return text.split(/\s+/).filter(Boolean)[0] || REGION_OTHER;
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
  return [categoryOf(post), dateOf(post), compactRegion(regionOf(post))].filter(Boolean).join(" \u00B7 ");
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

function searchableText(post) {
  return [
    titleOf(post),
    post?.sourceTitle,
    post?.description,
    post?.excerpt,
    ...(Array.isArray(post?.memo) ? post.memo : []),
    ...(Array.isArray(post?.info) ? post.info.flat() : []),
  ].filter(Boolean).join(" ");
}

function summerHeadline(title, posts, fallback = false) {
  if (["travel", "festival"].includes(String(title).toLowerCase())) return title;
  const text = posts.map(searchableText).join(" ");
  const topics = [
    { label: "\uC218\uC601\uC7A5", pattern: /\uC218\uC601\uC7A5|\uD480\uC7A5|\uC6CC\uD130\uD30C\uD06C|\uC544\uCFE0\uC544|\uBB3C\uB180\uC774|\uC378\uBA38\uBE44\uCE58/ },
    { label: "\uACC4\uACE1", pattern: /\uACC4\uACE1|\uD3ED\uD3EC|\uC720\uC6D0\uC9C0/ },
    { label: "\uD574\uC218\uC695\uC7A5", pattern: /\uD574\uC218\uC695\uC7A5|\uD574\uBCC0|\uD574\uC548|\uBC14\uB2E4/ },
  ].filter((topic) => topic.pattern.test(text)).map((topic) => topic.label);
  const suffix = topics.length ? `${topics.join("\u00B7")} \uAC00\uBCFC\uB9CC\uD55C \uACF3` : "\uAC00\uBCFC\uB9CC\uD55C \uACF3";
  return fallback ? `\uC9C0\uC5ED\uBCC4 7\uC6D4 ${suffix}` : `${title} 7\uC6D4 ${suffix}`;
}

function newsSection({ id, title, posts, headline }) {
  const items = uniquePosts(posts).slice(0, 10);
  if (!items.length) return "";
  const lead = items[0];
  const picks = items.slice(1, 4);
  const list = items.slice(4, 10);
  const heading = headline || title;
  return `<section class="news-section" id="${esc(id)}" aria-labelledby="${esc(id)}-title" data-headline="${esc(heading)}">
    <h2 id="${esc(id)}-title">${esc(heading)}</h2>
    ${leadArticle(lead)}
    <div class="pick-grid">${picks.map(pickCard).join("")}</div>
    <div class="news-list">${list.map(listItem).join("")}</div>
  </section>`;
}

function buildSections(posts) {
  const domestic = posts.filter((post) => categoryOf(post) === CAT_DOMESTIC);
  const festivals = posts.filter((post) => categoryOf(post) === CAT_FESTIVAL);
  const byRegion = (region) => posts.filter((post) => compactRegion(regionOf(post)) === region);
  const regionSections = REGIONS.map((region) => ({
    id: region.id,
    title: region.title,
    posts: fillSection(posts, byRegion(region.title)),
  })).map((section) => ({
    ...section,
    headline: summerHeadline(section.title, section.posts),
  }));

  return [
    { id: "travel", title: TEXT.navTravel, posts: fillSection(posts, domestic), headline: summerHeadline(TEXT.navTravel, domestic, true) },
    { id: "festival", title: TEXT.navFestival, posts: fillSection(posts, festivals), headline: TEXT.navFestival },
    ...regionSections,
  ];
}

function categoryNav(sections) {
  const regionSections = sections.filter((section) => !["travel", "festival"].includes(section.id));
  return [
    `<a class="is-active" href="#all" data-filter="all">${esc(TEXT.navAll)}</a>`,
    ...regionSections.map((section) => `<a href="#${esc(section.id)}" data-filter="${esc(section.id)}">${esc(section.title)}</a>`),
  ].join("");
}

function html(posts) {
  const sections = buildSections(posts).filter((section) => section.posts.length);
  const hero = posts[0];
  const ogImage = imageOf(hero);
  const defaultHeadline = summerHeadline("", posts, true);

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta name="naver-site-verification" content="38616b4b4209994ed384d0d2439bddcbec2cc711">
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8468106244002167" crossorigin="anonymous"></script>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${esc(TEXT.description)}">
    <meta name="theme-color" content="#ffffff">
    <meta property="og:title" content="${esc(TEXT.ogTitle)}">
    <meta property="og:description" content="${esc(TEXT.ogDescription)}">
    <meta property="og:type" content="website">
    ${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : ""}
    <meta name="twitter:card" content="summary_large_image">
    <link rel="alternate" type="application/rss+xml" title="${esc(TEXT.rssTitle)}" href="https://tripview.kr/rss.xml">
    <title>${esc(TEXT.ogTitle)}</title>
    <style>
      :root{--ink:#111;--muted:#777;--line:#e2e2e2;--paper:#fff;--soft:#f5f5f5}*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:112px}body{margin:0;background:var(--paper);color:var(--ink);font-family:Arial,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;letter-spacing:0;line-height:1.45}a{color:inherit;text-decoration:none}img{display:block;width:100%;height:100%;object-fit:cover;background:var(--soft)}.site-header{position:sticky;top:0;z-index:10;background:rgba(255,255,255,.96);border-bottom:1px solid var(--line);backdrop-filter:blur(12px)}.header-inner{max-width:720px;margin:0 auto;padding:15px 16px 10px}.brand{display:block;margin-bottom:12px;font-size:28px;font-weight:900;line-height:1}.nav-scroll{display:flex;gap:18px;overflow-x:auto;padding-bottom:4px;white-space:nowrap;font-size:15px;font-weight:800}.nav-scroll a{display:block;padding:2px 0;border-bottom:2px solid transparent}.nav-scroll a.is-active{border-bottom-color:#111}.nav-scroll::-webkit-scrollbar,.pick-grid::-webkit-scrollbar{display:none}.page{max-width:720px;margin:0 auto;padding:10px 16px 40px}.top-line{display:flex;align-items:center;justify-content:space-between;padding:10px 0 18px;color:var(--muted);font-size:13px;border-bottom:1px solid var(--line)}.top-line b{color:var(--ink)}.news-section{padding:28px 0 34px;border-bottom:8px solid #f2f2f2;scroll-margin-top:112px}.news-section.is-hidden{display:none}.news-section h2{margin:0 0 16px;font-size:31px;line-height:1.05;font-weight:900;letter-spacing:-.01em}.news-lead{display:block}.lead-thumb{display:block;width:100%;aspect-ratio:1.78/1;overflow:hidden;background:var(--soft)}.news-lead strong{display:block;margin-top:12px;font-size:24px;line-height:1.22;font-weight:900}.news-lead span{display:block;margin-top:7px;color:var(--muted);font-size:13px}.pick-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:20px}.pick-card{min-width:0}.pick-thumb{display:block;aspect-ratio:1.2/1;overflow:hidden;background:var(--soft)}.pick-card strong{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-top:7px;font-size:13px;line-height:1.34;font-weight:800}.news-list{margin-top:22px;border-top:1px solid var(--line)}.news-row{display:grid;grid-template-columns:92px minmax(0,1fr);gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line)}.row-thumb{display:block;aspect-ratio:1.28/1;overflow:hidden;background:var(--soft)}.news-row strong{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:17px;line-height:1.35;font-weight:900}.news-row em{display:block;margin-top:5px;color:var(--muted);font-size:12px;font-style:normal}.no-image{background:linear-gradient(135deg,#f1f1f1,#dedede)}.site-footer{max-width:720px;margin:0 auto;padding:28px 16px 44px;color:var(--muted);font-size:13px}.site-footer strong{display:block;color:var(--ink);font-size:20px;margin-bottom:6px}@media(min-width:760px){.header-inner,.page,.site-footer{max-width:1040px}.page{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 36px}.top-line{grid-column:1/-1}.news-section{border-bottom:1px solid var(--line)}.news-section h2{font-size:34px}}@media(max-width:360px){.news-section h2{font-size:28px}.news-lead strong{font-size:21px}.news-row{grid-template-columns:82px minmax(0,1fr)}.pick-grid{gap:7px}.pick-card strong{font-size:12px}}
    </style>
  </head>
  <body>
    <header class="site-header">
      <div class="header-inner">
        <a class="brand" href="/">${esc(BRAND)}</a>
        <nav class="nav-scroll" aria-label="${esc(TEXT.navLabel)}">${categoryNav(sections)}</nav>
      </div>
    </header>
    <main class="page">
      <div class="top-line"><span data-feed-label>${esc(defaultHeadline)}</span><span>${esc(new Date().toISOString().slice(0, 10))}</span></div>
      ${sections.map(newsSection).join("\n")}
    </main>
    <footer class="site-footer">
      <strong>${esc(BRAND)}</strong>
      <span>${esc(TEXT.footer)}</span>
    </footer>
    <script>
      const links = [...document.querySelectorAll('.nav-scroll a')];
      const sections = [...document.querySelectorAll('.news-section')];
      const label = document.querySelector('[data-feed-label]');
      links.forEach((link) => {
        link.addEventListener('click', (event) => {
          event.preventDefault();
          const id = link.dataset.filter || link.getAttribute('href').replace('#', '');
          const title = link.textContent.trim();
          const showAll = id === 'all';
          const selectedSection = document.getElementById(id);
          const headline = showAll ? '${esc(defaultHeadline)}' : (selectedSection?.dataset.headline || title);
          links.forEach((item) => item.classList.remove('is-active'));
          link.classList.add('is-active');
          sections.forEach((section) => section.classList.toggle('is-hidden', !showAll && section.id !== id));
          if (label) label.textContent = headline;
          document.querySelector('.page').scrollIntoView({ block: 'start' });
        });
      });
    </script>
  </body>
</html>`;
}

const posts = JSON.parse(await fs.readFile(POSTS_PATH, "utf8"))
  .filter((post) => post?.slug && post?.title)
  .sort((a, b) => String(b.sortDate || "").localeCompare(String(a.sortDate || "")));

await fs.writeFile(INDEX_PATH, html(posts), "utf8");
console.log(`Homepage rebuilt as mobile regional news feed with ${posts.length} post(s).`);
