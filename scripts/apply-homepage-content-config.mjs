import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = path.join(ROOT, 'index.html');
const CONFIG = path.join(ROOT, 'data', 'homepage-content.json');
const POSTS = path.join(ROOT, 'data', 'generated-posts.json');
const REGION_ORDER = ['서울', '경기·인천', '충청', '강원', '전라', '경상', '제주', '기타'];
const REGION_IDS = {
  '서울': 'region-seoul',
  '경기·인천': 'region-gyeonggi-incheon',
  '충청': 'region-chungcheong',
  '강원': 'region-gangwon',
  '전라': 'region-jeolla',
  '경상': 'region-gyeongsang',
  '제주': 'region-jeju',
  '기타': 'region-etc',
};

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, (match) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[match]));
}

function link(item) {
  return `<a href="${esc(item.href || '#')}">${esc(item.label || '')}</a>`;
}

function sectionLead(kicker, title, href = '') {
  return `<div class="section-head"><div><small>${esc(kicker)}</small><h2>${esc(title)}</h2></div>${href ? `<a href="${esc(href)}">더보기</a>` : ''}</div>`;
}

function postHref(post) {
  return post?.slug ? `/${post.slug}/` : '#routes';
}

function regionHref(label) {
  return `#${REGION_IDS[label] || 'region-etc'}`;
}

function compactRegion(value = '') {
  const cleaned = String(value).replace(/\([^)]*\)/g, '').trim();
  if (!cleaned) return '';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const first = (parts[0] || '').replace(/특별시|광역시|특별자치시|특별자치도|도$/g, '');
  if (['서울', '부산', '인천', '대구', '대전', '광주', '울산', '세종', '제주'].includes(first)) return first;
  return (parts[1] || first).replace(/[시군구]$/g, '') || first;
}

function broadRegion(value = '') {
  const text = String(value);
  if (/서울/.test(text)) return '서울';
  if (/경기|인천/.test(text)) return '경기·인천';
  if (/충청|충북|충남|대전|세종/.test(text)) return '충청';
  if (/강원/.test(text)) return '강원';
  if (/전라|전북|전남|광주/.test(text)) return '전라';
  if (/경상|경북|경남|부산|대구|울산/.test(text)) return '경상';
  if (/제주/.test(text)) return '제주';
  return compactRegion(value) || '기타';
}

function regionGroups(posts) {
  const groups = new Map(REGION_ORDER.map((label) => [label, []]));
  for (const post of posts) {
    const label = broadRegion(post.region);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(post);
  }
  return [...groups.entries()].filter(([, groupPosts]) => groupPosts.length > 0);
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function shorten(value = '', max = 14) {
  const text = String(value).replace(/\s*2026\s*/g, ' ').replace(/,.*$/, '').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function prettyDate(post) {
  if (post.date) return post.date;
  if (post.sortDate) {
    const [year, month, day] = String(post.sortDate).split('-');
    if (year && month && day) return `${Number(month)}월 ${Number(day)}일`;
  }
  return '최근 업데이트';
}

function card(post, className = 'card', heading = 'h3') {
  const image = post.image ? `<span class="thumb"><img src="${esc(post.image)}" alt="${esc(post.alt || post.title)}" loading="lazy" /></span>` : '';
  const excerpt = post.excerpt || post.description || '';
  const read = post.read || '약 7분';
  return `<a class="${esc(className)}" href="${esc(postHref(post))}">${image}<small>${esc(post.category || '여행 정보')}</small><${heading}>${esc(post.title)}</${heading}><p>${esc(excerpt)}</p><div class="meta"><span>${esc(prettyDate(post))}</span><span>${esc(read)}</span>${post.region ? `<span>${esc(post.region)}</span>` : ''}</div></a>`;
}

function miniCard(post) {
  const image = post.image ? `<span class="thumb mini-thumb"><img src="${esc(post.image)}" alt="${esc(post.alt || post.title)}" loading="lazy" /></span>` : '';
  return `<a class="mini-card" href="${esc(postHref(post))}">${image}<span class="mini-copy"><small>${esc(post.category || '여행 정보')}</small><strong>${esc(post.title)}</strong><span>${esc(prettyDate(post))} · ${esc(post.read || '약 7분')}</span></span></a>`;
}

function headerNav() {
  return `<header class="top"><div class="wrap nav"><a class="brand" href="#top">트립뷰</a><nav class="links" aria-label="주요 메뉴"><a href="#region-guide">지역별</a><a href="#curation">지역축제 정보</a><a href="#category-domestic">가볼만한 곳</a><a href="#booking">방문 전 체크</a><a href="#guide">여행 정보</a></nav></div></header>`;
}

function regionCategorySection(posts) {
  const tabs = regionGroups(posts).map(([label, groupPosts]) => `<a class="region-tab" href="${esc(regionHref(label))}"><strong>${esc(label)}</strong><span>${Math.min(groupPosts.length, 30)}건 보기</span></a>`).join('');
  return `<section class="wrap region-top" id="region-guide" aria-label="지역 카테고리"><div class="region-top-head"><small>REGION</small><h2>지역 카테고리</h2></div><div class="region-tabs">${tabs}</div></section>`;
}

function directoryItem(title, meta, href = '#routes') {
  return `<a class="region-tab directory-tab" href="${esc(href)}"><strong>${esc(title)}</strong><span>${esc(meta)}</span></a>`;
}

function postDirectoryItem(post) {
  return directoryItem(
    post.sourceTitle || post.title,
    `${post.category || '여행 정보'} · ${prettyDate(post)} · ${compactRegion(post.region)}`,
    postHref(post),
  );
}

function directorySection(id, kicker, title, items, moreHref = '') {
  return `<section class="wrap section directory-section" id="${esc(id)}">${sectionLead(kicker, title, moreHref)}<div class="region-tabs directory-tabs">${items.join('')}</div></section>`;
}

function deriveTodayKeywords(posts, config) {
  const regionLinks = regionGroups(posts)
    .slice(0, 5)
    .map(([label]) => ({ label: `${label} 여행`, href: regionHref(label) }));
  const festivalLinks = posts
    .filter((post) => post.category === '공연/축제')
    .slice(0, 3)
    .map((post) => ({ label: shorten(post.sourceTitle || post.title || '축제 일정'), href: postHref(post) }));
  const fallback = config.todayKeywords || [];
  return uniqueBy([...regionLinks, ...festivalLinks, ...fallback], (item) => item.label).slice(0, 8);
}

function todaySection(posts, config) {
  const todayItems = deriveTodayKeywords(posts, config);
  return `<section class="wrap today" aria-label="오늘의 여행 키워드"><div class="today-row"><b>TODAY</b>${todayItems.map(link).join('')}</div></section>`;
}

function heroSection(posts) {
  const primary = posts[0];
  if (!primary) return '';
  const latestSide = posts.slice(1, 5).map(miniCard).join('');
  return `<section class="wrap hero" id="latest"><div class="lead-layout">${card(primary, 'latest-primary', 'h2')}<div class="latest-list">${latestSide}</div></div></section>`;
}

function festivalSection(posts) {
  const festivalPosts = posts.filter((post) => post.category === '공연/축제').slice(0, 6);
  return directorySection('curation', 'EVENT', '지역축제 정보', festivalPosts.map(postDirectoryItem), '#routes');
}

function placesSection(posts) {
  const domesticPosts = posts.filter((post) => post.category === '국내여행').slice(0, 9);
  return directorySection('category-domestic', 'PLACES', '가볼만한 곳', domesticPosts.map(postDirectoryItem), '#routes');
}

function regionThirtySection(posts) {
  const groups = regionGroups(posts).map(([label, groupPosts]) => {
    const rows = groupPosts.slice(0, 30).map((post) => `<a class="region-row" href="${esc(postHref(post))}"><strong>${esc(post.sourceTitle || post.title)}</strong><span>${esc(post.category || '여행 정보')} · ${esc(prettyDate(post))} · ${esc(compactRegion(post.region))}</span></a>`).join('');
    return `<article class="region-block" id="${esc(REGION_IDS[label] || 'region-etc')}"><div class="region-block-head"><h3>${esc(label)}</h3><span>${Math.min(groupPosts.length, 30)} / ${groupPosts.length}건</span></div><div class="region-rows">${rows}</div></article>`;
  }).join('');
  return `<section class="wrap section" id="region-lists">${sectionLead('REGION LIST', '지역별 최신 글 30건씩', '#region-guide')}<div class="region-blocks">${groups}</div></section>`;
}

function allPostsSection(posts) {
  return directorySection('routes', 'ALL POSTS', `전체 글 ${posts.length}`, posts.slice(0, 12).map(postDirectoryItem));
}

function defaultBookingCards(config) {
  return config.bookingCards || [];
}

function bookingSection(config) {
  const cards = defaultBookingCards(config).map((item) => directoryItem(item.title, item.description, item.href || '#routes'));
  return directorySection('booking', 'VISIT CHECK', '방문 전 체크', cards);
}

function dynamicCategoryGroups(config, counts, posts) {
  const regionLinks = regionGroups(posts)
    .slice(0, 4)
    .map(([label]) => ({ label: `${label} 여행`, href: regionHref(label) }));
  const festival = posts.find((post) => post.category === '공연/축제');
  return [
    {
      title: '지역별',
      description: '서울, 경기·인천, 충청, 강원, 전라, 경상, 제주 권역별로 최대 30건씩 봅니다.',
      links: [{ label: '지역 카테고리', href: '#region-guide' }, ...regionLinks.slice(0, 3)],
    },
    {
      title: '지역축제 정보',
      description: `공연/축제 글 ${counts.festival}건을 일정, 장소, 프로그램 중심으로 봅니다.`,
      links: [{ label: '축제 일정', href: '#curation' }, { label: '전체 축제 글', href: '#routes' }, ...(festival ? [{ label: shorten(festival.sourceTitle || festival.title), href: postHref(festival) }] : [])],
    },
    {
      title: '가볼만한 곳',
      description: `국내여행 글 ${counts.domestic}건을 위치와 동선 중심으로 정리합니다.`,
      links: [{ label: '국내 여행지', href: '#category-domestic' }, { label: '지도 확인', href: '#routes' }, { label: '방문 전 체크', href: '#booking' }],
    },
  ];
}

function categoryBundle(config, counts, posts) {
  const groups = dynamicCategoryGroups(config, counts, posts).map((group) => directoryItem(group.title, group.description, group.links?.[0]?.href || '#routes'));
  return directorySection('category-bundle', 'CATEGORY', '여행 정보 카테고리 묶음', groups);
}

function faqSection(config) {
  const faqs = (config.faqs || []).map((item, index) => `<details class="faq-item" ${index === 0 ? 'open' : ''}><summary>${esc(item.question)}</summary><p>${esc(item.answer)}</p></details>`).join('');
  return `<section class="wrap section" id="guide">${sectionLead('GUIDE', '트립뷰 이용 가이드')}<div class="faq-list">${faqs}</div></section>`;
}

function popularLinks(config, posts) {
  const fromPosts = regionGroups(posts)
    .slice(0, 4)
    .map(([label]) => ({ label: `${label} 여행`, href: regionHref(label) }));
  return fromPosts.length ? fromPosts : (config.footer?.popular || []);
}

function footer(config, counts, posts) {
  const footerData = config.footer || {};
  return `<footer><div class="wrap foot"><div><strong>트립뷰</strong><p>${esc(footerData.intro || '')}</p></div><div><h3>방문 전 체크</h3>${(footerData.reservation || []).map(link).join('')}</div><div><h3>여행 허브</h3><a href="#region-guide">지역별</a><a href="#curation">지역축제 정보</a><a href="#category-domestic">가볼만한 곳</a><a href="#guide">여행 정보</a></div><div><h3>카테고리</h3><a href="#category-domestic">국내여행 <span>${counts.domestic}</span></a><a href="#curation">공연/축제 <span>${counts.festival}</span></a></div><div><h3>인기 지역</h3>${popularLinks(config, posts).map(link).join('')}</div><div><h3>Language</h3>${(footerData.languages || []).map(link).join('')}</div></div><div class="wrap legal">Copyright 2026 Tripview. All Rights Reserved.</div></footer>`;
}

function injectCss(html) {
  let next = html;
  if (!next.includes('.faq-list{')) {
    const css = `.check-card{display:block;color:inherit}.faq-list{display:grid;gap:12px}.faq-item{border-top:1px solid var(--line);padding:16px 0}.faq-item:last-child{border-bottom:1px solid var(--line)}.faq-item summary{cursor:pointer;font-weight:900;font-size:18px}.faq-item p{margin:10px 0 0;color:#444}.foot{grid-template-columns:1.3fr repeat(5,.75fr)}@media(max-width:1100px){.foot{grid-template-columns:repeat(3,1fr)}}@media(max-width:720px){.foot{grid-template-columns:1fr}}`;
    next = next.replace('</style>', `${css}</style>`);
  }
  if (!next.includes('.region-tabs{')) {
    const css = `.region-top{padding:106px 0 18px;border-bottom:1px solid var(--line)}.region-top-head{display:flex;align-items:baseline;gap:12px;margin-bottom:14px}.region-top-head h2{margin:0;font-size:22px;line-height:1.2}.region-tabs{display:flex;gap:10px;overflow:auto;padding-bottom:4px}.region-tab{flex:0 0 auto;min-width:118px;border-top:1px solid #111;padding:10px 0 6px;display:grid;gap:2px}.region-tab strong{font-size:18px;line-height:1.2}.region-tab span{font-size:12px;color:var(--muted);font-weight:900}.region-top + .today{padding-top:18px}@media(max-width:920px){.region-top{padding-top:128px}.region-tab{min-width:100px}}`;
    next = next.replace('</style>', `${css}</style>`);
  }
  if (!next.includes('.region-blocks{')) {
    const css = `.region-blocks{display:grid;gap:30px}.region-block{display:grid;gap:14px;scroll-margin-top:106px}.region-block-head{display:flex;align-items:baseline;justify-content:space-between;gap:16px;border-top:1px solid #111;padding-top:14px}.region-block-head h3{margin:0;font-size:26px;line-height:1.2}.region-block-head span{font-size:13px;color:var(--muted);font-weight:900}.region-rows{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 22px}.region-row{display:grid;gap:2px;border-bottom:1px solid var(--line);padding:0 0 10px}.region-row strong{font-size:15px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.region-row span{font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}@media(max-width:920px){.region-rows{grid-template-columns:1fr}.region-block{scroll-margin-top:130px}}`;
    next = next.replace('</style>', `${css}</style>`);
  }
  if (!next.includes('.mini-thumb{')) {
    const css = `.latest-list .mini-card{grid-template-columns:104px minmax(0,1fr);gap:12px;align-items:start}.mini-thumb{aspect-ratio:1.28/1}.mini-thumb img{height:100%}.mini-copy{display:grid;gap:5px;min-width:0}.mini-copy span{color:var(--muted);font-size:14px}@media(max-width:520px){.latest-list .mini-card{grid-template-columns:96px minmax(0,1fr)}}`;
    next = next.replace('</style>', `${css}</style>`);
  }
  if (!next.includes('.directory-tabs{')) {
    const css = `.directory-section{padding-top:42px}.directory-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px 18px;overflow:visible}.directory-tab{min-width:0;padding-top:12px}.directory-tab strong{font-size:18px;white-space:normal}.directory-tab span{line-height:1.45;white-space:normal}@media(max-width:920px){.directory-tabs{display:flex;overflow:auto}.directory-tab{flex:0 0 72%;min-width:210px}}`;
    next = next.replace('</style>', `${css}</style>`);
  }
  if (!next.includes('/* nav-readable */')) {
    const css = `/* nav-readable */.top{background:rgba(255,255,255,.94)!important;-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border-bottom:1px solid rgba(0,0,0,.08);box-shadow:0 6px 22px rgba(0,0,0,.04)}.top.is-scrolled{background:rgba(255,255,255,.98)!important;border-bottom-color:rgba(0,0,0,.1)}.brand,.links a{color:#111;text-shadow:none}`;
    next = next.replace('</style>', `${css}</style>`);
  }
  return next;
}

function homepageBody(config, counts, posts) {
  return `<body>
    ${headerNav()}
    <main id="top">
      ${regionCategorySection(posts)}
      ${heroSection(posts)}
      ${festivalSection(posts)}
      ${placesSection(posts)}
      ${regionThirtySection(posts)}
      ${bookingSection(config)}
      ${allPostsSection(posts)}
      ${categoryBundle(config, counts, posts)}
      ${faqSection(config)}
    </main>
    ${footer(config, counts, posts)}
  </body>`;
}

const config = JSON.parse(await fs.readFile(CONFIG, 'utf8'));
const posts = JSON.parse(await fs.readFile(POSTS, 'utf8'));
const counts = {
  domestic: posts.filter((post) => post.category === '국내여행').length,
  festival: posts.filter((post) => post.category === '공연/축제').length,
};

let html = await fs.readFile(INDEX, 'utf8');
html = html.replace(/<body[\s\S]*?<\/body>/, homepageBody(config, counts, posts));
html = injectCss(html);
await fs.writeFile(INDEX, html, 'utf8');
console.log('Homepage content configuration applied from existing post data.');
