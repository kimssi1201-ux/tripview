import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SITE_URL = 'https://tripview.kr';
const NAVER_META = '';
const ADSENSE = '';
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

async function postsFromGeneratedData() {
  const dataPosts = await readJsonArray(path.join(ROOT, 'data', 'generated-posts.json'));
  return dataPosts
    .filter((post) => post?.slug && post?.title)
    .map((post) => ({
      title: post.title,
      path: `/${post.slug}/`,
      url: `${SITE_URL}/${post.slug}/`,
      image: post.image || post.images?.[0] || '',
      excerpt: post.excerpt || post.description || '',
      category: post.category || CATEGORIES[0],
      region: post.region || '',
    }));
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

function compactRegion(value = '') {
  const cleaned = stripHtml(value).replace(/\([^)]*\)/g, '').trim();
  if (!cleaned) return '';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  const first = parts[0].replace(/특별시|광역시|특별자치시|특별자치도|도$/g, '');
  if (['서울', '부산', '인천', '대구', '대전', '광주', '울산', '세종', '제주'].includes(first)) return first;
  return parts[1]?.replace(/시|군|구$/g, '') || first;
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

function uniqueBy(posts, key) {
  const seen = new Set();
  return posts.filter((post) => {
    const value = key(post);
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function todayChips(posts) {
  const regionItems = uniqueBy(posts, (post) => compactRegion(post.region))
    .slice(0, 7)
    .map((post) => `<a href="${esc(post.path)}">${esc(compactRegion(post.region))}</a>`);
  const fallback = ['서울', '제주', '부산', '강원', '세종', '전주', '여수']
    .slice(0, Math.max(0, 7 - regionItems.length))
    .map((label) => `<a href="#routes">${esc(label)}</a>`);
  return [...regionItems, ...fallback].join('');
}

function card(post, className = 'card', heading = 'h3') {
  const classAttr = className ? ` class="${esc(className)}"` : '';
  const region = post.region ? `<span>${esc(post.region)}</span>` : '';
  const image = post.image ? `<img src="${esc(post.image)}" alt="${esc(post.title)}" loading="lazy" />` : '';
  return `<a${classAttr} href="${esc(post.path)}">${image}<small>${esc(post.category)}</small><${heading}>${esc(post.title)}</${heading}><p>${esc(post.excerpt)}</p><div class="meta">${region}</div></a>`;
}

function sectionLead(kicker, title, href = '') {
  const more = href ? `<a href="${href}">더보기</a>` : '';
  return `<div class="section-head"><div><small>${esc(kicker)}</small><h2>${esc(title)}</h2></div>${more}</div>`;
}

function renderCategorySection(category, posts) {
  const filtered = posts.filter((post) => post.category === category);
  if (!filtered.length) return '';
  const cards = filtered.slice(0, 9).map((post) => card(post, 'card', 'h3')).join('');
  const kicker = category === '국내여행' ? 'PLACES' : 'FESTIVAL';
  return `<section class="wrap section" id="${categoryId(category)}">${sectionLead(kicker, `${category} 글`, '#routes')}<div class="grid">${cards}</div></section>`;
}

function renderIndex(posts) {
  const primary = posts[0];
  if (!primary) throw new Error('No posts found for homepage.');

  const counts = countCategories(posts);
  const categoryNav = categoryCountLinks(counts);
  const side = posts.slice(1, 4).map((post) => card(post, 'side-card', 'h3')).join('');
  const latestGrid = posts.slice(0, 12).map((post) => card(post, 'card', 'h3')).join('');
  const curationGrid = posts.slice(12, 18).map((post) => card(post, 'card compact-card', 'h3')).join('');
  const categorySections = CATEGORIES.map((category) => renderCategorySection(category, posts)).join('');
  const chips = todayChips(posts);

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta name="naver-site-verification" content="38616b4b4209994ed384d0d2439bddcbec2cc711" />
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8468106244002167"
     crossorigin="anonymous"></script>
    ${ADSENSE}
    ${NAVER_META}
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="트립뷰는 지금 확인하기 좋은 국내여행과 공연/축제 소식을 정리합니다." />
    <meta name="theme-color" content="#ffffff" />
    <meta property="og:title" content="트립뷰 - 최신 여행 큐레이션" />
    <meta property="og:description" content="오늘 기준으로 확인하기 좋은 국내여행과 공연/축제 소식을 정리합니다." />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="${esc(primary.image)}" />
    <meta property="og:image:secure_url" content="${esc(primary.image)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="트립뷰 - 최신 여행 큐레이션" />
    <meta name="twitter:description" content="오늘 기준으로 확인하기 좋은 국내여행과 공연/축제 소식을 정리합니다." />
    <meta name="twitter:image" content="${esc(primary.image)}" />
    <link rel="image_src" href="${esc(primary.image)}" />
    <link rel="alternate" type="application/rss+xml" title="트립뷰 RSS" href="${SITE_URL}/rss.xml" />
    <title>트립뷰 - 최신 여행 큐레이션</title>
    <style>
      :root{--ink:#111;--muted:#666;--line:#dedede;--soft:#f6f6f6;--paper:#fff;--paper-strong:rgba(255,255,255,.9)}*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:104px}body{margin:0;background:var(--paper);color:var(--ink);font-family:Arial,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;line-height:1.65;letter-spacing:0}a{color:inherit;text-decoration:none}img{display:block;width:100%;object-fit:cover;background:var(--soft)}.wrap{width:min(1120px,calc(100% - 32px));margin:0 auto}.top{position:fixed;inset:0 0 auto;z-index:30;background:transparent;transition:background 180ms ease,backdrop-filter 180ms ease,-webkit-backdrop-filter 180ms ease}.top.is-scrolled{background:var(--paper-strong);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px)}.nav{min-height:74px;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand{font-size:23px;font-weight:900}.links{display:flex;align-items:center;gap:22px;color:#222;font-size:14px;font-weight:800;white-space:nowrap}.links span{font-size:12px;color:var(--muted);font-weight:900}.today{padding:106px 0 0}.today-row{display:flex;align-items:center;gap:12px;overflow:auto;padding:0 0 18px}.today b{font-size:12px;letter-spacing:.08em}.today a{flex:0 0 auto;color:#333;font-size:14px;font-weight:800}.hero{padding:18px 0 56px;border-bottom:1px solid var(--line)}.hero-head{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:24px}.hero h1{margin:0;font-size:clamp(34px,5vw,60px);line-height:1.02;letter-spacing:0}.hero-head a,.section-head a{color:var(--muted);font-size:14px;font-weight:900}.latest-layout{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(320px,.75fr);gap:34px;align-items:start}.latest-primary{display:grid;gap:14px}.latest-primary img{aspect-ratio:1.34/1}.latest-primary h2{margin:0;font-size:clamp(28px,4vw,43px);line-height:1.16;letter-spacing:0}.latest-primary p{margin:0;color:#333;font-size:17px}.latest-side{display:grid;gap:22px}.side-card{display:grid;grid-template-columns:132px minmax(0,1fr);gap:14px;align-items:start}.side-card img{aspect-ratio:1.25/1}.side-card h3{margin:0;font-size:18px;line-height:1.35}.side-card p{display:none}.section{padding:56px 0;border-bottom:1px solid var(--line)}.section-head{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:24px}.section-head h2{margin:4px 0 0;font-size:30px;line-height:1.2;letter-spacing:0}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:30px}.card{display:grid;gap:11px;align-content:start}.card img{aspect-ratio:1.45/1}.card h3{margin:0;font-size:19px;line-height:1.35;letter-spacing:0}.card p{margin:0;color:#444}.compact-card p{display:none}small{color:var(--muted);font-size:13px;font-weight:900}.meta{display:flex;flex-wrap:wrap;gap:12px;color:var(--muted);font-size:14px}.check-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}.check-grid article{border-top:1px solid var(--ink);padding-top:14px}.check-grid h3{margin:0 0 8px;font-size:17px}.check-grid p{margin:0;color:#444}.guide{display:grid;grid-template-columns:.8fr 1.2fr;gap:32px}.guide-list{display:grid;gap:16px}.guide-list a{display:grid;gap:5px;padding-bottom:16px;border-bottom:1px solid var(--line)}.guide-list strong{font-size:18px}.guide-list span{color:var(--muted)}footer{padding:38px 0 50px;color:var(--muted)}.foot{display:grid;grid-template-columns:1.4fr .8fr .8fr .8fr;gap:24px}.foot h3{margin:0 0 8px;color:var(--ink);font-size:15px}.foot div{display:grid;align-content:start;gap:7px}@media(max-width:920px){.nav{align-items:flex-start;flex-direction:column;justify-content:center;gap:8px;min-height:90px;padding:14px 0}.links{flex-wrap:wrap;gap:14px;white-space:normal}.today{padding-top:118px}.latest-layout,.grid,.check-grid,.guide,.foot{grid-template-columns:1fr}.side-card{grid-template-columns:116px minmax(0,1fr)}.hero{padding-bottom:40px}.section{padding:42px 0}.section-head{align-items:start;flex-direction:column}.latest-primary p,.card p{font-size:15px}}@media(max-width:520px){.wrap{width:min(100% - 24px,1120px)}.side-card{grid-template-columns:1fr}.side-card img{aspect-ratio:1.55/1}.hero h1{font-size:38px}.latest-primary h2{font-size:28px}}
    </style>
  </head>
  <body>
    <header class="top">
      <div class="wrap nav">
        <a class="brand" href="#top" aria-label="트립뷰 홈">트립뷰</a>
        <nav class="links" aria-label="주요 메뉴">
          <a href="#latest">최신글</a>
          <a href="#category-domestic">국내여행 <span>${counts.categories['국내여행'] || 0}</span></a>
          <a href="#category-festival">공연·축제 <span>${counts.categories['공연/축제'] || 0}</span></a>
          <a href="#guide">여행정보</a>
          <a href="/contact.html">문의</a>
        </nav>
      </div>
    </header>
    <main id="top">
      <section class="wrap today" aria-label="오늘의 여행 키워드">
        <div class="today-row"><b>TODAY</b>${chips}</div>
      </section>
      <section class="wrap hero" id="latest" aria-labelledby="latestTitle">
        <div class="hero-head">
          <h1 id="latestTitle">최신글</h1>
          <a href="#routes">전체글 보기</a>
        </div>
        <div class="latest-layout">
          ${card(primary, 'latest-primary', 'h2')}
          <div class="latest-side">${side}</div>
        </div>
      </section>
      <section class="wrap section" id="routes">
        ${sectionLead('NEW', `전체글 ${counts.total}`, '#category-domestic')}
        <div class="grid">${latestGrid}</div>
      </section>
      ${categorySections}
      <section class="wrap section" id="check">
        ${sectionLead('CHECK', '방문 전 체크')}
        <div class="check-grid">
          <article><h3>일정</h3><p>행사 기간과 휴무일은 출발 전 한 번 더 확인하는 것이 좋습니다.</p></article>
          <article><h3>운영 시간</h3><p>계절, 기상, 현장 사정에 따라 입장 시간이 달라질 수 있습니다.</p></article>
          <article><h3>이동</h3><p>주소, 주차, 대중교통 동선을 함께 보고 이동 시간을 잡아두세요.</p></article>
          <article><h3>현장 문의</h3><p>요금, 프로그램, 예약 여부는 방문 직전 문의처 확인이 가장 정확합니다.</p></article>
        </div>
      </section>
      <section class="wrap section" id="guide">
        <div class="guide">
          <div>${sectionLead('GUIDE', '여행정보')}</div>
          <div class="guide-list">
            <a href="#category-domestic"><strong>가볼 만한 곳</strong><span>주말에 바로 다녀오기 좋은 국내 여행지를 모아봅니다.</span></a>
            <a href="#category-festival"><strong>공연·축제</strong><span>기간, 장소, 프로그램 확인이 필요한 행사를 따로 묶었습니다.</span></a>
            <a href="#check"><strong>방문 전 체크</strong><span>일정, 운영 시간, 지도, 문의처를 먼저 확인할 수 있게 정리합니다.</span></a>
          </div>
        </div>
      </section>
      ${curationGrid ? `<section class="wrap section" id="curation">${sectionLead('CURATION', '함께 보면 좋은 글', '#routes')}<div class="grid">${curationGrid}</div></section>` : ''}
    </main>
    <footer>
      <div class="wrap foot">
        <div><strong>트립뷰</strong><p>방문 전 필요한 일정, 위치, 운영 정보를 간결하게 정리합니다.</p></div>
        <div><h3>탐색</h3><a href="#latest">최신글</a><a href="#routes">전체글</a><a href="#guide">여행정보</a></div>
        <div><h3>카테고리</h3>${categoryNav}</div>
        <div><h3>사이트</h3><a href="/about.html">트립뷰 소개</a><a href="/contact.html">문의</a><a href="/privacy.html">개인정보처리방침</a></div>
      </div>
    </footer>
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

if (!posts.length) posts.push(...await postsFromGeneratedData());

await fs.writeFile(path.join(ROOT, 'index.html'), renderIndex(posts), 'utf8');
console.log(`Built homepage with ${posts.length} post(s).`);
