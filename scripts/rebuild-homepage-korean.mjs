import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POSTS_PATH = path.join(ROOT, 'data', 'generated-posts.json');
const INDEX_PATH = path.join(ROOT, 'index.html');

const esc = (value = '') => String(value).replace(/[&<>"']/g, (match) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[match]));

function compactRegion(value = '') {
  const text = String(value).replace(/\([^)]*\)/g, '').trim();
  if (!text) return '기타';
  if (text.includes('서울')) return '서울';
  if (text.includes('경기') || text.includes('인천')) return '경기·인천';
  if (text.includes('충청') || text.includes('충북') || text.includes('충남') || text.includes('대전') || text.includes('세종')) return '충청';
  if (text.includes('강원')) return '강원';
  if (text.includes('전라') || text.includes('전북') || text.includes('전남') || text.includes('광주')) return '전라';
  if (text.includes('경상') || text.includes('경북') || text.includes('경남') || text.includes('부산') || text.includes('대구') || text.includes('울산')) return '경상';
  if (text.includes('제주')) return '제주';
  return text.split(/\s+/).filter(Boolean).slice(-1)[0] || '기타';
}

function postHref(post) {
  return post?.slug ? `/${post.slug}/` : '#routes';
}

function imageOf(post) {
  return post.image || post.images?.[0] || '';
}

function meta(post) {
  return [post.date, post.read || '약 5분', compactRegion(post.region)].filter(Boolean).join(' · ');
}

function card(post, className = 'card', heading = 'h3') {
  const image = imageOf(post);
  return `<a class="${esc(className)}" href="${esc(postHref(post))}">
    ${image ? `<span class="thumb"><img src="${esc(image)}" alt="${esc(post.alt || post.title)}" loading="lazy" /></span>` : ''}
    <small>${esc(post.category || '여행 정보')}</small>
    <${heading}>${esc(post.title)}</${heading}>
    <p>${esc(post.excerpt || post.description || '')}</p>
    <div class="meta"><span>${esc(meta(post))}</span></div>
  </a>`;
}

function miniCard(post) {
  const image = imageOf(post);
  return `<a class="mini-card" href="${esc(postHref(post))}">
    ${image ? `<span class="thumb mini-thumb"><img src="${esc(image)}" alt="${esc(post.alt || post.title)}" loading="lazy" /></span>` : ''}
    <span class="mini-copy"><small>${esc(post.category || '여행 정보')}</small><strong>${esc(post.title)}</strong><span>${esc(meta(post))}</span></span>
  </a>`;
}

function directoryItem(post) {
  const image = imageOf(post);
  return `<a class="directory-tab" href="${esc(postHref(post))}">
    ${image ? `<span class="directory-thumb"><img src="${esc(image)}" alt="${esc(post.alt || post.title)}" loading="lazy" /></span>` : ''}
    <span class="directory-copy"><strong>${esc(post.sourceTitle || post.title)}</strong><span>${esc(post.category || '여행 정보')} · ${esc(meta(post))}</span></span>
  </a>`;
}

function sectionHead(kicker, title, href = '#routes') {
  return `<div class="section-head"><div><small>${esc(kicker)}</small><h2>${esc(title)}</h2></div>${href ? `<a href="${esc(href)}">더보기</a>` : ''}</div>`;
}

function regionGroups(posts) {
  const order = ['서울', '경기·인천', '충청', '강원', '전라', '경상', '제주', '기타'];
  const groups = new Map(order.map((label) => [label, []]));
  for (const post of posts) {
    const region = compactRegion(post.region);
    if (!groups.has(region)) groups.set(region, []);
    groups.get(region).push(post);
  }
  return [...groups.entries()].filter(([, items]) => items.length);
}

function regionSection(posts) {
  const tabs = regionGroups(posts).map(([label, items]) => (
    `<a class="region-tab" href="#routes" data-region="${esc(label)}"><strong>${esc(label)}</strong><span>${Math.min(items.length, 30)}건 보기</span></a>`
  )).join('');
  return `<section class="wrap region-top" id="region-guide" aria-label="지역 카테고리"><div class="region-top-head"><small>REGION</small><h2>지역 카테고리</h2></div><div class="region-tabs">${tabs}</div></section>`;
}

function directorySection(id, kicker, title, posts) {
  return `<section class="wrap section directory-section" id="${esc(id)}">${sectionHead(kicker, title)}<div class="directory-tabs">${posts.map(directoryItem).join('')}</div></section>`;
}

function bookingSection() {
  const items = [
    ['운영시간 먼저 확인', '방문 전 공식 안내, 휴무일, 입장 마감 시간, 우천 시 운영 여부를 먼저 확인합니다.', '#routes'],
    ['주차와 대중교통 체크', '주차장 위치, 혼잡 시간, 가장 가까운 정류장과 귀가 동선을 함께 확인합니다.', '#routes'],
    ['축제는 일정과 장소 확인', '축제 글은 기간, 장소, 주요 프로그램, 현장 이동 동선을 중심으로 다시 살펴봅니다.', '#curation'],
    ['지도와 주변 동선 확인', '본문의 위치 정보와 주변 코스를 같이 보고 이동 시간을 현실적으로 잡습니다.', '#routes'],
  ];
  const cards = items.map(([title, desc, href]) => `<a class="directory-tab text-tab" href="${href}"><span class="directory-copy"><strong>${title}</strong><span>${desc}</span></span></a>`).join('');
  return `<section class="wrap section directory-section" id="booking">${sectionHead('VISIT CHECK', '방문 전 체크', '')}<div class="directory-tabs">${cards}</div></section>`;
}

function faqSection() {
  const faqs = [
    ['메인에서는 무엇을 먼저 보면 좋나요?', '목적지가 정해지지 않았다면 지역 카테고리와 최신 축제 글을 먼저 보고, 목적지가 정해졌다면 본문 안의 위치, 일정, 운영 체크를 확인하면 좋습니다.'],
    ['축제 글은 어떤 기준으로 보면 좋나요?', '기간, 장소, 주요 프로그램, 주차와 귀가 동선을 먼저 확인하세요. 같은 행사라도 날짜와 시간대에 따라 혼잡도가 달라질 수 있습니다.'],
    ['검색엔진이 이해하기 쉬운 구조인가요?', '최신 글, 지역, 카테고리, 전체 글 목록이 내부 링크로 연결되도록 구성해 검색엔진과 방문자가 글을 찾기 쉽게 만들었습니다.'],
  ];
  return `<section class="wrap section" id="guide">${sectionHead('GUIDE', '트립뷰 이용 가이드', '')}<div class="faq-list">${faqs.map(([q, a]) => `<details class="faq-item" open><summary>${q}</summary><p>${a}</p></details>`).join('')}</div></section>`;
}

function footer(posts) {
  const domestic = posts.filter((post) => post.category === '국내여행').length;
  const festival = posts.filter((post) => post.category === '공연/축제').length;
  return `<footer><div class="wrap foot">
    <div><strong>트립뷰</strong><p>국내 여행지와 공연·축제 정보를 위치, 일정, 운영 체크 중심으로 정리하는 여행 정보 매거진입니다.</p></div>
    <div><h3>방문 전 체크</h3><a href="#booking">운영시간 확인</a><a href="#booking">주차 확인</a><a href="#routes">지도 확인</a><a href="#curation">축제 일정</a></div>
    <div><h3>여행 허브</h3><a href="#region-guide">지역별</a><a href="#curation">지역축제 정보</a><a href="#category-domestic">가볼만한 곳</a><a href="#guide">여행 정보</a></div>
    <div><h3>카테고리</h3><a href="#category-domestic" data-category="국내여행">국내여행 <span>${domestic}</span></a><a href="#curation" data-category="공연/축제">공연/축제 <span>${festival}</span></a></div>
    <div><h3>인기 지역</h3><a href="#routes" data-region="서울">서울 여행</a><a href="#routes" data-region="경기·인천">경기·인천 여행</a><a href="#routes" data-region="충청">충청 여행</a><a href="#routes" data-region="강원">강원 여행</a></div>
    <div><h3>Language</h3><a href="?lang=ko" data-lang="ko" lang="ko">한국어</a><a href="?lang=en" data-lang="en" lang="en">English</a><a href="?lang=ja" data-lang="ja" lang="ja">日本語</a><a href="?lang=zh" data-lang="zh" lang="zh-CN">简体中文</a></div>
  </div><div class="wrap legal">Copyright 2026 Tripview. All Rights Reserved.</div></footer>`;
}

function html(posts) {
  const primary = posts[0];
  const side = posts.slice(1, 5);
  const festivals = posts.filter((post) => post.category === '공연/축제').slice(0, 8);
  const domestic = posts.filter((post) => post.category === '국내여행').slice(0, 8);
  const all = posts.slice(0, 16);
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta name="naver-site-verification" content="38616b4b4209994ed384d0d2439bddcbec2cc711" />
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8468106244002167" crossorigin="anonymous"></script>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="트립뷰는 국내여행과 공연/축제 정보를 위치, 일정, 운영 체크 중심으로 정리하는 여행 매거진입니다." />
    <meta name="theme-color" content="#ffffff" />
    <meta property="og:title" content="트립뷰 - 국내여행과 공연/축제 매거진" />
    <meta property="og:description" content="가볼 만한 곳, 축제 일정, 방문 전 체크 정보를 한 화면에서 정리합니다." />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="${esc(imageOf(primary))}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="트립뷰 - 국내여행과 공연/축제 매거진" />
    <meta name="twitter:description" content="가볼 만한 곳, 축제 일정, 방문 전 체크 정보를 한 화면에서 정리합니다." />
    <meta name="twitter:image" content="${esc(imageOf(primary))}" />
    <link rel="alternate" type="application/rss+xml" title="트립뷰 RSS" href="https://tripview.kr/rss.xml" />
    <title>트립뷰 - 국내여행과 공연/축제 매거진</title>
    <style>
      :root{--ink:#111;--muted:#666;--line:#dedede;--soft:#f6f6f6;--paper:#fff;--paper-strong:rgba(255,255,255,.96)}*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:108px}body{margin:0;background:#fff;color:var(--ink);font-family:Arial,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;line-height:1.65;letter-spacing:0}a{color:inherit;text-decoration:none}img{display:block;width:100%;object-fit:cover;background:var(--soft)}.wrap{width:min(1120px,calc(100% - 32px));margin:0 auto}.top{position:fixed;inset:0 0 auto;z-index:30;background:var(--paper-strong);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border-bottom:1px solid rgba(0,0,0,.08);box-shadow:0 6px 22px rgba(0,0,0,.04)}.nav{min-height:74px;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand{font-size:23px;font-weight:900}.links{display:flex;align-items:center;gap:24px;color:#111;font-size:14px;font-weight:800}.language-switch{display:flex;align-items:center;gap:8px;white-space:nowrap}.language-switch a{font-size:12px;font-weight:900;color:#555;border-bottom:1px solid transparent;padding:2px 0}.language-switch a.is-active{color:#111;border-bottom-color:#111}.region-top{padding:106px 0 18px;border-bottom:1px solid var(--line)}.region-top-head{display:flex;align-items:baseline;gap:12px;margin-bottom:14px}.region-top-head h2{margin:0;font-size:22px;line-height:1.2}.region-tabs{display:flex;gap:10px;overflow:auto;padding-bottom:4px}.region-tab{flex:0 0 auto;min-width:118px;border-top:1px solid #111;padding:10px 0 6px;display:grid;gap:2px}.region-tab strong{font-size:18px;line-height:1.2}.region-tab span{font-size:12px;color:var(--muted);font-weight:900}.hero{padding:42px 0 58px;border-bottom:1px solid var(--line)}.lead-layout{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(320px,.75fr);gap:34px}.thumb{display:block;overflow:hidden;background:var(--soft)}.latest-primary,.card{display:grid;gap:12px}.latest-primary .thumb{aspect-ratio:1.34/1}.card .thumb{aspect-ratio:1.45/1}.thumb img{height:100%;aspect-ratio:inherit;transition:transform .42s ease}.latest-primary:hover .thumb img,.card:hover .thumb img,.mini-card:hover img,.directory-tab:hover img{transform:scale(1.035)}.latest-primary h2{margin:0;font-size:clamp(28px,4vw,42px);line-height:1.16}.latest-primary p,.card p{margin:0;color:#333}.latest-list{display:grid;gap:14px;align-content:start}.mini-card{display:grid;grid-template-columns:104px minmax(0,1fr);gap:12px;align-items:start;padding-bottom:14px;border-bottom:1px solid var(--line)}.mini-thumb{aspect-ratio:1.28/1}.mini-thumb img{height:100%}.mini-copy{display:grid;gap:5px;min-width:0}.mini-copy strong{font-size:18px;line-height:1.35}.mini-copy span,.meta{color:var(--muted);font-size:14px}small{color:var(--muted);font-size:13px;font-weight:900}.section{padding:56px 0;border-bottom:1px solid var(--line)}.section-head{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:24px}.section-head h2{margin:4px 0 0;font-size:30px;line-height:1.2}.section-head a{color:var(--muted);font-size:14px;font-weight:900}.directory-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px 18px;overflow:visible}.directory-tab{min-width:0;border-top:1px solid #111;padding-top:12px;display:grid;color:inherit}.directory-tab strong{font-size:18px;line-height:1.35;white-space:normal}.directory-tab span{line-height:1.45;white-space:normal}.directory-thumb{display:block;overflow:hidden;background:var(--soft);aspect-ratio:1.35/1;margin-bottom:9px}.directory-thumb img{display:block;width:100%;height:100%;object-fit:cover}.directory-copy{display:grid;gap:3px;min-width:0}.text-tab{min-height:132px}.faq-list{display:grid;gap:12px}.faq-item{border-top:1px solid var(--line);padding:16px 0}.faq-item:last-child{border-bottom:1px solid var(--line)}.faq-item summary{cursor:pointer;font-weight:900;font-size:18px}.faq-item p{margin:10px 0 0;color:#444}footer{padding:40px 0 54px;color:var(--muted)}.foot{display:grid;grid-template-columns:1.3fr repeat(5,.75fr);gap:24px}.foot h3{margin:0 0 8px;color:#111;font-size:15px}.foot div{display:grid;align-content:start;gap:7px}.legal{margin-top:26px;padding-top:18px;border-top:1px solid var(--line);font-size:13px}@media(max-width:1100px){.foot{grid-template-columns:repeat(3,1fr)}}@media(max-width:920px){.nav{align-items:flex-start;flex-direction:column;justify-content:center;gap:8px;min-height:96px;padding:14px 0}.links{flex-wrap:wrap;gap:14px}.language-switch{gap:10px}.region-top{padding-top:128px}.lead-layout,.foot{grid-template-columns:1fr}.section-head{align-items:start;flex-direction:column}.directory-tabs{display:flex;overflow:auto}.directory-tab{flex:0 0 72%;min-width:210px}.hero{padding-bottom:42px}.latest-primary p,.card p{font-size:15px}}@media(max-width:720px){.foot{grid-template-columns:1fr}}@media(max-width:520px){.mini-card{grid-template-columns:96px minmax(0,1fr)}}
    </style>
  </head>
  <body>
    <header class="top"><div class="wrap nav"><a class="brand" href="#top">트립뷰</a><nav class="links" aria-label="주요 메뉴"><a href="#region-guide">지역별</a><a href="#curation">지역축제 정보</a><a href="#category-domestic">가볼만한 곳</a><a href="#booking">방문 전 체크</a><a href="#guide">여행 정보</a></nav><div class="language-switch notranslate" translate="no" aria-label="Language selector"><a href="?lang=ko" data-lang="ko" lang="ko">KO</a><a href="?lang=en" data-lang="en" lang="en">EN</a><a href="?lang=ja" data-lang="ja" lang="ja">JA</a><a href="?lang=zh" data-lang="zh" lang="zh-CN">ZH</a></div></div></header>
    <main id="top">
      ${regionSection(posts)}
      <section class="wrap hero" id="latest"><div class="lead-layout">${card(primary, 'latest-primary', 'h2')}<div class="latest-list">${side.map(miniCard).join('')}</div></div></section>
      ${directorySection('curation', 'EVENT', '지역축제 정보', festivals)}
      ${directorySection('category-domestic', 'PLACES', '가볼만한 곳', domestic)}
      ${bookingSection()}
      ${directorySection('routes', 'ALL POSTS', `전체 글 ${posts.length}`, all)}
      ${faqSection()}
    </main>
    ${footer(posts)}
    <script src="/assets/i18n.js" defer></script><script src="/assets/topic-filter.js?v=post-click-20260704" defer></script>
  </body>
</html>`;
}

const posts = JSON.parse(await fs.readFile(POSTS_PATH, 'utf8'))
  .filter((post) => post?.slug && post?.title)
  .sort((a, b) => String(b.sortDate || '').localeCompare(String(a.sortDate || '')));

await fs.writeFile(INDEX_PATH, html(posts), 'utf8');
console.log(`Homepage rebuilt with ${posts.length} post(s).`);
