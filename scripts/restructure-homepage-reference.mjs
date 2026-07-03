import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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

function decode(value = '') {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(value = '') {
  return decode(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function meta(content, name) {
  const pattern = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i');
  return decode(content.match(pattern)?.[1] || '');
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

function localPathForUrl(url) {
  const parsed = new URL(url);
  const pathname = decodeURIComponent(parsed.pathname);
  if (pathname === '/' || pathname === '/privacy.html' || pathname === '/about.html' || pathname === '/contact.html') return null;
  if (pathname.endsWith('/')) return path.join(ROOT, pathname.slice(1), 'index.html');
  return path.join(ROOT, pathname.slice(1));
}

async function urlsFromSitemap() {
  const sitemap = await fs.readFile(path.join(ROOT, 'sitemap.xml'), 'utf8');
  return [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

function categoryFromHtml(content) {
  const small = content.match(/<small>\s*(국내여행|공연\/축제)\s*<\/small>/i);
  if (small) return small[1];
  const text = stripHtml(content);
  if (text.includes('공연/축제') || categoryFromTitle(titleFromHtml(content))) return '공연/축제';
  return '국내여행';
}

function regionFromHtml(content) {
  const spans = [...content.matchAll(/<span>([^<]+)<\/span>/g)].map((match) => stripHtml(match[1]));
  return spans.find((item) => /시|군|구|도|서울|부산|인천|제주|경기|강원|충청|전라|경상/.test(item)) || '';
}

function dateFromHtml(content) {
  const spans = [...content.matchAll(/<span>([^<]+)<\/span>/g)].map((match) => stripHtml(match[1]));
  return spans.find((item) => /\d{4}년|\d{1,2}월\s*\d{1,2}일/.test(item)) || '최근 업데이트';
}

function readFromHtml(content) {
  const spans = [...content.matchAll(/<span>([^<]+)<\/span>/g)].map((match) => stripHtml(match[1]));
  return spans.find((item) => /분/.test(item)) || '약 7분 읽기';
}

function compactRegion(value = '') {
  const cleaned = stripHtml(value).replace(/\([^)]*\)/g, '').trim();
  if (!cleaned) return '';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const first = (parts[0] || '').replace(/특별시|광역시|특별자치시|특별자치도|도$/g, '');
  if (['서울', '부산', '인천', '대구', '대전', '광주', '울산', '세종', '제주'].includes(first)) return first;
  return (parts[1] || first).replace(/시|군|구$/g, '') || first;
}

async function postFromUrl(url) {
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
  return {
    title,
    path: parsed.pathname,
    url,
    image: meta(html, 'og:image'),
    excerpt: meta(html, 'description') || meta(html, 'og:description') || stripHtml(html).slice(0, 150),
    category: categoryFromHtml(html),
    region: regionFromHtml(html),
    date: dateFromHtml(html),
    read: readFromHtml(html),
  };
}

function countCategories(posts) {
  const categories = Object.fromEntries(CATEGORIES.map((category) => [category, 0]));
  for (const post of posts) categories[post.category] = (categories[post.category] || 0) + 1;
  return { total: posts.length, categories };
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
  const dynamic = uniqueBy(posts, (post) => compactRegion(post.region))
    .slice(0, 8)
    .map((post) => `<a href="${esc(post.path)}">${esc(compactRegion(post.region))}</a>`);
  const fallback = ['제주', '서울', '부산', '강원', '여름 축제', '세종', '여수', '강릉']
    .slice(0, Math.max(0, 8 - dynamic.length))
    .map((label) => `<a href="#routes">${esc(label)}</a>`);
  return [...dynamic, ...fallback].join('');
}

function card(post, className = 'card', heading = 'h3', withExcerpt = true) {
  const image = post.image ? `<img src="${esc(post.image)}" alt="${esc(post.title)}" loading="lazy" />` : '';
  const excerpt = withExcerpt ? `<p>${esc(post.excerpt)}</p>` : '';
  return `<a class="${esc(className)}" href="${esc(post.path)}">${image}<small>${esc(post.category)}</small><${heading}>${esc(post.title)}</${heading}>${excerpt}<div class="meta"><span>${esc(post.date)}</span><span>${esc(post.read)}</span>${post.region ? `<span>${esc(post.region)}</span>` : ''}</div></a>`;
}

function sectionLead(kicker, title, href = '') {
  return `<div class="section-head"><div><small>${esc(kicker)}</small><h2>${esc(title)}</h2></div>${href ? `<a href="${href}">더보기</a>` : ''}</div>`;
}

function miniCard(post) {
  const image = post.image ? `<span class="thumb mini-thumb"><img src="${esc(post.image)}" alt="${esc(post.title)}" loading="lazy" /></span>` : '';
  return `<a class="mini-card" href="${esc(post.path)}">${image}<span class="mini-copy"><small>${esc(post.category)}</small><strong>${esc(post.title)}</strong><span>${esc(post.date)} · ${esc(post.read)}</span></span></a>`;
}

async function postsFromGeneratedData() {
  const parsed = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'generated-posts.json'), 'utf8'));
  return parsed
    .filter((post) => post?.slug && post?.title)
    .map((post) => ({
      title: post.title,
      path: `/${post.slug}/`,
      url: `${SITE_URL}/${post.slug}/`,
      image: post.image || post.images?.[0] || '',
      excerpt: post.excerpt || post.description || '',
      category: post.category || CATEGORIES[0],
      region: post.region || '',
      date: post.date || '',
      read: post.read || '약 7분',
    }));
}

function renderIndex(posts) {
  const primary = posts[0];
  if (!primary) throw new Error('No posts found for homepage.');

  const counts = countCategories(posts);
  const domestic = posts.filter((post) => post.category === '국내여행');
  const festival = posts.filter((post) => post.category === '공연/축제');
  const places = domestic.slice(0, 9).map((post) => card(post)).join('');
  const curation = [...posts.slice(9, 12), ...festival.slice(3, 6)].filter(Boolean).slice(0, 6).map((post) => card(post, 'card', 'h3')).join('');
  const latestSide = posts.slice(1, 5).map(miniCard).join('');
  const allGrid = posts.slice(0, 12).map((post) => card(post, 'card', 'h3')).join('');
  const chips = todayChips(posts);

  return `<!doctype html>
<html lang="ko">
  <head>
    ${ADSENSE}
    ${NAVER_META}
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="트립뷰는 국내여행과 공연/축제 정보를 한 흐름으로 정리하는 여행 매거진입니다." />
    <meta name="theme-color" content="#ffffff" />
    <meta property="og:title" content="트립뷰 - 국내여행과 공연/축제 매거진" />
    <meta property="og:description" content="가볼 만한 곳, 축제 일정, 방문 전 체크 정보를 한 화면에서 정리합니다." />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="${esc(primary.image)}" />
    <meta property="og:image:secure_url" content="${esc(primary.image)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="트립뷰 - 국내여행과 공연/축제 매거진" />
    <meta name="twitter:description" content="가볼 만한 곳, 축제 일정, 방문 전 체크 정보를 한 화면에서 정리합니다." />
    <meta name="twitter:image" content="${esc(primary.image)}" />
    <link rel="image_src" href="${esc(primary.image)}" />
    <link rel="alternate" type="application/rss+xml" title="트립뷰 RSS" href="${SITE_URL}/rss.xml" />
    <title>트립뷰 - 국내여행과 공연/축제 매거진</title>
    <style>
      :root{--ink:#111;--muted:#666;--line:#dedede;--soft:#f6f6f6;--paper:#fff;--paper-strong:rgba(255,255,255,.9)}*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:106px}body{margin:0;background:#fff;color:var(--ink);font-family:Arial,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;line-height:1.65;letter-spacing:0}a{color:inherit;text-decoration:none}img{display:block;width:100%;object-fit:cover;background:var(--soft)}.wrap{width:min(1120px,calc(100% - 32px));margin:0 auto}.top{position:fixed;inset:0 0 auto;z-index:30;background:transparent;transition:background .18s ease,backdrop-filter .18s ease}.top.is-scrolled{background:var(--paper-strong);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px)}.nav{min-height:74px;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand{font-size:23px;font-weight:900}.links{display:flex;align-items:center;gap:24px;color:#222;font-size:14px;font-weight:800}.links span{font-size:12px;color:var(--muted);font-weight:900}.today{padding:106px 0 0}.today-row{display:flex;gap:12px;align-items:center;overflow:auto;padding-bottom:20px}.today b{font-size:12px;letter-spacing:.08em}.today a{flex:0 0 auto;font-size:14px;font-weight:800;color:#333}.hero{padding:18px 0 58px;border-bottom:1px solid var(--line)}.hero-title{margin:0 0 24px;font-size:clamp(38px,6vw,72px);line-height:1;letter-spacing:0}.lead-layout{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(320px,.75fr);gap:34px}.latest-primary{display:grid;gap:14px}.latest-primary img{aspect-ratio:1.42/1}.latest-primary h2{margin:0;font-size:clamp(28px,4vw,42px);line-height:1.16}.latest-primary p,.card p{margin:0;color:#333}.latest-list{display:grid;gap:14px;align-content:start}.mini-card{display:grid;gap:5px;padding-bottom:14px;border-bottom:1px solid var(--line)}.mini-card strong{font-size:18px;line-height:1.35}.mini-card span,.meta{color:var(--muted);font-size:14px}.section{padding:56px 0;border-bottom:1px solid var(--line)}.section-head{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:24px}.section-head h2{margin:4px 0 0;font-size:30px;line-height:1.2}.section-head a{color:var(--muted);font-size:14px;font-weight:900}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:30px}.card{display:grid;gap:11px;align-content:start}.card img{aspect-ratio:1.45/1}.card h3{margin:0;font-size:19px;line-height:1.35}.compact p{display:none}small{color:var(--muted);font-size:13px;font-weight:900}.meta{display:flex;flex-wrap:wrap;gap:10px}.booking{display:grid;grid-template-columns:.9fr 1.1fr;gap:30px;align-items:start}.booking-copy p{margin:8px 0 0;color:#444}.check-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.check-card{border-top:1px solid #111;padding-top:14px}.check-card h3{margin:0 0 8px;font-size:17px}.check-card p{margin:0;color:#444}.bundle-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.bundle{border:1px solid var(--line);padding:20px;background:#fff}.bundle h3{margin:0 0 8px;font-size:19px}.bundle p{margin:0 0 14px;color:#444}.bundle-links{display:flex;flex-wrap:wrap;gap:8px}.bundle-links a{font-size:13px;font-weight:800;color:#333}.guide-list{display:grid;gap:18px}.guide-item{border-top:1px solid var(--line);padding-top:18px}.guide-item h3{margin:0 0 8px;font-size:19px}.guide-item p{margin:0;color:#444}footer{padding:40px 0 54px;color:var(--muted)}.foot{display:grid;grid-template-columns:1.4fr .8fr .8fr .8fr .8fr;gap:24px}.foot h3{margin:0 0 8px;color:#111;font-size:15px}.foot div{display:grid;align-content:start;gap:7px}.legal{margin-top:26px;padding-top:18px;border-top:1px solid var(--line);font-size:13px}@media(max-width:920px){.nav{align-items:flex-start;flex-direction:column;justify-content:center;gap:8px;min-height:94px;padding:14px 0}.links{flex-wrap:wrap;gap:14px}.today{padding-top:122px}.lead-layout,.grid,.booking,.check-cards,.bundle-grid,.foot{grid-template-columns:1fr}.section-head{align-items:start;flex-direction:column}.hero{padding-bottom:42px}.hero-title{font-size:42px}.latest-primary p,.card p{font-size:15px}}
    </style>
  </head>
  <body>
    <header class="top"><div class="wrap nav"><a class="brand" href="#top">트립뷰</a><nav class="links" aria-label="주요 메뉴"><a href="#category-domestic">가볼 만한 곳</a><a href="#booking">예약</a><a href="#guide">여행 정보</a></nav></div></header>
    <main id="top">
      <section class="wrap today" aria-label="오늘의 여행 키워드"><div class="today-row"><b>TODAY</b>${chips}</div></section>
      <section class="wrap hero" id="latest"><div class="lead-layout">${card(primary, 'latest-primary', 'h2')}<div class="latest-list">${latestSide}</div></div></section>
      <section class="wrap section" id="category-domestic">${sectionLead('PLACES', '가볼만한 곳', '#routes')}<div class="grid">${places}</div></section>
      <section class="wrap section" id="booking"><div class="booking"><div class="booking-copy"><small>BOOKING CHECK</small><h2>예약 전 체크는 별도 기준으로 빠르게</h2><p>메인은 여행 정보를 읽는 곳이고, 예약 전에는 위치, 취소 조건, 이동 시간, 현장 운영 여부를 따로 확인하는 흐름으로 정리합니다.</p></div><div class="check-cards"><article class="check-card"><h3>숙소는 위치부터</h3><p>방문지와 숙소 사이 이동 시간, 주차, 늦은 체크인 가능 여부를 먼저 봅니다.</p></article><article class="check-card"><h3>교통은 귀가 기준</h3><p>출발보다 돌아오는 시간표와 막차, 주차장 출차 시간을 먼저 확인합니다.</p></article><article class="check-card"><h3>투어·체험은 운영 시간</h3><p>예약 가능 시간, 포함 사항, 우천 시 운영 여부를 같이 확인합니다.</p></article></div></div></section>
      <section class="wrap section" id="curation">${sectionLead('CURATION', '지금 함께 보면 좋은 여행 큐레이션', '#routes')}<div class="grid">${curation}</div></section>
      <section class="wrap section" id="routes">${sectionLead('ALL POSTS', `전체 글 ${counts.total}`)}<div class="grid">${allGrid}</div></section>
      <section class="wrap section" id="category-bundle">${sectionLead('CATEGORY', '여행 정보 카테고리 묶음')}<div class="bundle-grid"><article class="bundle"><h3>가볼만한 곳</h3><p>국내 여행지, 계절 코스, 주말 일정</p><div class="bundle-links"><a href="#category-domestic">국내 여행지</a><a href="#routes">최신 글</a><a href="#curation">큐레이션</a></div></article><article class="bundle"><h3>공연/축제</h3><p>기간, 장소, 프로그램, 현장 체크</p><div class="bundle-links"><a href="#category-festival">축제·행사</a><a href="#booking">방문 전 체크</a><a href="#guide">이용 가이드</a></div></article><article class="bundle"><h3>여행 정보</h3><p>준비물, 교통, 일정, 지도 확인</p><div class="bundle-links"><a href="#guide">여행 가이드</a><a href="/about.html">소개</a><a href="/contact.html">문의</a></div></article></div></section>
      <section class="wrap section" id="guide">${sectionLead('GUIDE', '트립뷰 이용 가이드')}<div class="guide-list"><article class="guide-item"><h3>트립뷰 메인에서는 무엇을 먼저 보면 좋나요?</h3><p>목적지가 정해지지 않았다면 가볼만한 곳과 축제 정보를 먼저 보고, 목적지가 정해졌다면 글 안의 위치, 지도, 주차, 운영 체크를 확인하면 좋습니다.</p></article><article class="guide-item"><h3>방문 전 체크는 어떻게 연결되나요?</h3><p>메인에서는 여행지를 고르고, 글 상세에서는 체류 시간, 동선, 주차, 문의처처럼 실제 방문 전에 필요한 정보를 확인하는 구조입니다.</p></article><article class="guide-item"><h3>검색과 AI 답변에 잘 잡히는 구조인가요?</h3><p>여행지, 일정, 축제, 운영정보 같은 검색 의도를 카테고리와 내부 링크로 묶어 사람이 읽기 쉽고 검색엔진이 해석하기 쉬운 구조를 목표로 합니다.</p></article></div></section>
    </main>
    <footer><div class="wrap foot"><div><strong>트립뷰</strong><p>여행지 선택, 일정 확인, 방문 전 체크를 한 흐름으로 연결하는 여행 정보 매거진입니다.</p></div><div><h3>예약</h3><a href="#booking">예약 전 체크</a><a href="#guide">여행 준비</a></div><div><h3>여행 허브</h3><a href="#category-domestic">가볼만한 곳</a><a href="#category-festival">축제·행사</a><a href="#routes">전체 글</a></div><div><h3>카테고리</h3><a href="#category-domestic">국내여행 <span>${counts.categories['국내여행'] || 0}</span></a><a href="#category-festival">공연/축제 <span>${counts.categories['공연/축제'] || 0}</span></a></div><div><h3>운영</h3><a href="/about.html">소개</a><a href="/contact.html">문의</a><a href="/privacy.html">개인정보처리방침</a></div></div><div class="wrap legal">Copyright 2026 Tripview. All Rights Reserved.</div></footer>
    <script>const header=document.querySelector('.top');const syncHeader=()=>header.classList.toggle('is-scrolled',window.scrollY>8);window.addEventListener('scroll',syncHeader,{passive:true});syncHeader();</script>
  </body>
</html>`;
}

const urls = await urlsFromSitemap();
const posts = [];
const seen = new Set();

for (const url of urls) {
  if (seen.has(url)) continue;
  seen.add(url);
  const post = await postFromUrl(url);
  if (post) posts.push(post);
}

if (!posts.length) posts.push(...await postsFromGeneratedData());

await fs.writeFile(path.join(ROOT, 'index.html'), renderIndex(posts), 'utf8');
console.log(`Restructured homepage with ${posts.length} post(s).`);
