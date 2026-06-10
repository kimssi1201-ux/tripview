import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SITE_URL = 'https://tripview.kr';
const NAVER_META = '<meta name="naver-site-verification" content="38616b4b4209994ed384d0d2439bddcbec2cc711" />';
const ADSENSE = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8468106244002167"\n     crossorigin="anonymous"></script>';
const CATEGORIES = ['국내여행', '공연/축제'];

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, (match) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[match]));
}

function stripHtml(value = '') {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function meta(content, name) {
  const pattern = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i');
  return content.match(pattern)?.[1] || '';
}

function titleFromHtml(content) {
  return stripHtml(content.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '')
    .replace(/\s*\|\s*트립뷰$/, '')
    .replace(/\s*-\s*최신 여행 큐레이션$/, '')
    .trim();
}

function categoryFromTitle(title = '') {
  return /축제|페스티벌|공연|문화제|행사|단오제|불꽃|콘서트|마켓|박람회/i.test(title) ? '공연/축제' : '';
}

function normalizePath(value = '') {
  let pathname = String(value || '').trim();
  if (!pathname) return '';

  try {
    if (/^https?:\/\//i.test(pathname)) pathname = new URL(pathname).pathname;
  } catch {
    return '';
  }

  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    // Keep the original string if it is already a plain slug/path.
  }

  if (!pathname.startsWith('/')) pathname = `/${pathname}`;
  if (!pathname.endsWith('/')) pathname = `${pathname}/`;
  return pathname;
}

function slugFromPath(value = '') {
  return normalizePath(value).replace(/^\/|\/$/g, '');
}

function localPathForUrl(url) {
  const parsed = new URL(url);
  const pathname = decodeURIComponent(parsed.pathname);
  if (pathname === '/' || pathname === '/privacy.html') return null;
  if (pathname.endsWith('/')) return path.join(ROOT, pathname.slice(1), 'index.html');
  return path.join(ROOT, pathname.slice(1));
}

async function urlsFromSitemap() {
  const sitemap = await fs.readFile(path.join(ROOT, 'sitemap.xml'), 'utf8');
  return [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

async function readJsonArray(filePath) {
  try {
    const parsed = JSON.parse(await fs.readFile(filePath, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function addCategoryLookup(lookup, post) {
  if (!post || !CATEGORIES.includes(post.category)) return;

  const keys = [post.slug, post.path, post.url]
    .filter(Boolean)
    .flatMap((value) => {
      const normalized = normalizePath(value);
      const slug = slugFromPath(value);
      return [normalized, slug].filter(Boolean);
    });

  for (const key of keys) lookup.set(key, post.category);
}

async function categoryLookupFromData() {
  const dataDir = path.join(ROOT, 'data');
  const files = [
    path.join(dataDir, 'posts.json'),
    path.join(dataDir, 'generated-posts.json'),
  ];

  try {
    const entries = await fs.readdir(dataDir);
    for (const entry of entries) {
      if (/^manual-posts-.*\.json$/.test(entry)) files.push(path.join(dataDir, entry));
    }
  } catch {
    // Data files are optional for local previews.
  }

  const lookup = new Map();
  const seenFiles = new Set();
  for (const file of files) {
    if (seenFiles.has(file)) continue;
    seenFiles.add(file);
    const posts = await readJsonArray(file);
    for (const post of posts) addCategoryLookup(lookup, post);
  }
  return lookup;
}

function categoryFromHtml(content) {
  const small = content.match(/<small>\s*(국내여행|공연\/축제)\s*<\/small>/i);
  if (small) return small[1];

  const text = stripHtml(content);
  const type = text.match(/유형:\s*(국내여행|공연\/축제)/);
  if (type) return type[1];

  const titleCategory = categoryFromTitle(titleFromHtml(content));
  if (titleCategory) return titleCategory;

  const hasDomestic = text.includes('국내여행');
  const hasFestival = text.includes('공연/축제');
  if (hasDomestic && !hasFestival) return '국내여행';
  if (hasFestival && !hasDomestic) return '공연/축제';
  return '국내여행';
}

function regionFromHtml(content) {
  const spans = [...content.matchAll(/<span>([^<]+)<\/span>/g)].map((match) => stripHtml(match[1]));
  return spans.find((item) => /시|군|구|도|서울|부산|인천|제주|경기|강원|충청|전라|경상/.test(item)) || '';
}

async function postFromUrl(url, categoryLookup) {
  const file = localPathForUrl(url);
  if (!file) return null;

  let html = '';
  try {
    html = await fs.readFile(file, 'utf8');
  } catch {
    return null;
  }

  const title = titleFromHtml(html);
  if (!title) return null;

  const parsed = new URL(url);
  const category = categoryFromTitle(title)
    || categoryLookup.get(normalizePath(parsed.pathname))
    || categoryLookup.get(slugFromPath(parsed.pathname))
    || categoryFromHtml(html);

  return {
    title,
    path: parsed.pathname,
    url,
    image: meta(html, 'og:image'),
    excerpt: meta(html, 'description') || meta(html, 'og:description') || stripHtml(html).slice(0, 150),
    category,
    region: regionFromHtml(html),
  };
}

function countCategories(posts) {
  const categories = Object.fromEntries(CATEGORIES.map((category) => [category, 0]));
  for (const post of posts) {
    categories[post.category] = (categories[post.category] || 0) + 1;
  }
  return { total: posts.length, categories };
}

function categoryId(category) {
  return category === '국내여행' ? 'category-domestic' : 'category-festival';
}

function categoryCountLinks(counts) {
  return CATEGORIES.map((category) => `<a href="#${categoryId(category)}" data-category="${esc(category)}">${esc(category)} <span>${counts.categories[category] || 0}</span></a>`).join('');
}

function card(post, className = 'card', heading = 'h3') {
  const region = post.region ? `<span>${esc(post.region)}</span>` : '';
  const image = post.image ? `<img src="${esc(post.image)}" alt="${esc(post.title)}" loading="lazy" />` : '';
  return `<a class="${className}" href="${esc(post.path)}">${image}<small>${esc(post.category)}</small><${heading}>${esc(post.title)}</${heading}><p>${esc(post.excerpt)}</p><div class="meta">${region}</div></a>`;
}

function renderCategorySection(category, posts) {
  const filtered = posts.filter((post) => post.category === category);
  if (!filtered.length) return '';
  const cards = filtered.map((post) => card(post, 'card', 'h3')).join('');
  return `<section class="wrap section" id="${categoryId(category)}"><h2>${esc(category)} <span>${filtered.length}</span></h2><div class="grid">${cards}</div></section>`;
}

function renderIndex(posts) {
  const primary = posts[0];
  if (!primary) throw new Error('No posts found for homepage.');

  const counts = countCategories(posts);
  const categoryNav = categoryCountLinks(counts);
  const categoryFooter = categoryCountLinks(counts);
  const side = posts.slice(1, 3).map((post) => card(post, '', 'h3')).join('');
  const grid = posts.map((post) => card(post, 'card', 'h3')).join('');
  const categorySections = CATEGORIES.map((category) => renderCategorySection(category, posts)).join('');

  return `<!doctype html>
<html lang="ko">
  <head>
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8468106244002167"
     crossorigin="anonymous"></script>
    <meta name="naver-site-verification" content="38616b4b4209994ed384d0d2439bddcbec2cc711" />
    ${NAVER_META}
    ${ADSENSE}
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="트립뷰는 지금 바로 움직일 수 있는 국내여행과 공연/축제 소식을 정리합니다." />
    <meta name="theme-color" content="#ffffff" />
    <meta property="og:title" content="트립뷰 - 최신 여행 큐레이션" />
    <meta property="og:description" content="오늘 기준으로 확인하기 좋은 국내여행과 공연/축제 소식을 정리합니다." />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="${esc(primary.image)}" />
    <link rel="alternate" type="application/rss+xml" title="트립뷰 RSS" href="${SITE_URL}/rss.xml" />
    <title>트립뷰 - 최신 여행 큐레이션</title>
    <style>
      :root{--ink:#111;--muted:#666;--line:#ddd;--soft:#f5f5f5;--paper:#fff}*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:96px}body{margin:0;background:var(--paper);color:var(--ink);font-family:Arial,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;line-height:1.6}a{color:inherit;text-decoration:none}img{display:block;width:100%;object-fit:cover}.wrap{width:min(1080px,calc(100% - 32px));margin:0 auto}.top{position:fixed;inset:0 0 auto;z-index:30;background:transparent;transition:background 180ms ease,backdrop-filter 180ms ease,-webkit-backdrop-filter 180ms ease}.top.is-scrolled{background:rgba(255,255,255,.86);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px)}.nav{min-height:72px;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand{font-size:22px;font-weight:900}.links{display:flex;gap:24px;color:#333;font-size:14px;font-weight:700}.links span{font-size:12px;color:var(--muted);font-weight:900}.hero{padding:112px 0 52px;border-bottom:1px solid var(--line)}.hero-head{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:24px}.hero h1{margin:0;font-size:clamp(32px,5vw,54px);line-height:1.05;letter-spacing:0}.hero-head a{color:var(--muted);font-size:14px;font-weight:800}.latest-layout{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(300px,.75fr);gap:32px;align-items:stretch}.latest-primary,.latest-side a,.card{display:grid;gap:12px}.latest-primary img{aspect-ratio:1.35/1;background:var(--soft)}.latest-primary h2{margin:0;font-size:clamp(28px,4vw,42px);line-height:1.16;letter-spacing:0}.latest-primary p,.card p{margin:0;color:#444}.latest-side{display:grid;gap:24px;align-content:start}.latest-side img{aspect-ratio:1.65/1;background:var(--soft)}.latest-side h3,.card h3{margin:0;font-size:19px;line-height:1.35;letter-spacing:0}small{color:var(--muted);font-weight:800}.meta{display:flex;flex-wrap:wrap;gap:12px;color:var(--muted);font-size:14px}.section{padding:52px 0;border-bottom:1px solid var(--line)}.section h2{margin:0 0 24px;font-size:28px;letter-spacing:0}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:28px}.card img{aspect-ratio:1.45/1;background:var(--soft)}.section h2 span{color:var(--muted);font-size:.72em}footer{padding:36px 0 48px;color:var(--muted)}.foot{display:grid;grid-template-columns:1.4fr .8fr .8fr;gap:24px}.foot h3{margin:0 0 8px;color:var(--ink);font-size:15px}.foot div{display:grid;align-content:start;gap:7px}@media(max-width:880px){.nav{align-items:flex-start;flex-direction:column;justify-content:center;gap:8px;min-height:86px;padding:14px 0}.links{flex-wrap:wrap;gap:14px}.hero{padding:120px 0 40px}.hero-head{align-items:start;flex-direction:column}.latest-layout,.grid,.foot{grid-template-columns:1fr}}
    </style>
  </head>
  <body>
    <header class="top"><div class="wrap nav"><a class="brand" href="#top" aria-label="트립뷰 홈">트립뷰</a><nav class="links" aria-label="주요 메뉴"><a href="#latest">최신글</a><a href="#routes">전체글 <span>${counts.total}</span></a>${categoryNav}</nav></div></header>
    <main id="top"><section class="wrap hero" id="latest" aria-labelledby="latestTitle"><div class="hero-head"><h1 id="latestTitle">최신글</h1><a href="#routes">전체글 보기</a></div><div class="latest-layout">${card(primary, 'latest-primary', 'h2')}<div class="latest-side">${side}</div></div></section><section class="wrap section" id="routes"><h2>전체글 <span>${counts.total}</span></h2><div class="grid">${grid}</div></section>${categorySections}</main>
    <footer><div class="wrap foot"><div><strong>트립뷰</strong><p>유명 관광지 소개보다 실제로 움직이기 쉬운 여행 루트를 큐레이션합니다.</p></div><div><h3>탐색</h3><a href="#latest">최신글</a><a href="#routes">전체글</a></div><div><h3>카테고리</h3>${categoryFooter}</div></div></footer>
    <script>const header=document.querySelector('.top');const syncHeader=()=>header.classList.toggle('is-scrolled',window.scrollY>8);window.addEventListener('scroll',syncHeader,{passive:true});syncHeader();</script>
  </body>
</html>
`;
}

const urls = await urlsFromSitemap();
const categoryLookup = await categoryLookupFromData();
const posts = [];
const seen = new Set();

for (const url of urls) {
  if (seen.has(url)) continue;
  seen.add(url);
  const post = await postFromUrl(url, categoryLookup);
  if (post) posts.push(post);
}

await fs.writeFile(path.join(ROOT, 'index.html'), renderIndex(posts), 'utf8');
console.log(`Built homepage with ${posts.length} post(s).`);
