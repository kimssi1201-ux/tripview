import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = path.join(ROOT, 'index.html');
const CONFIG = path.join(ROOT, 'data', 'homepage-content.json');
const POSTS = path.join(ROOT, 'data', 'generated-posts.json');

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

function compactRegion(value = '') {
  const cleaned = String(value).replace(/\([^)]*\)/g, '').trim();
  if (!cleaned) return '';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const first = (parts[0] || '').replace(/특별시|광역시|특별자치시|특별자치도|도$/g, '');
  if (['서울', '부산', '인천', '대구', '대전', '광주', '울산', '세종', '제주'].includes(first)) return first;
  return (parts[1] || first).replace(/[시군구]$/g, '') || first;
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

function headerNav() {
  return `<header class="top"><div class="wrap nav"><a class="brand" href="#top">트립뷰</a><nav class="links" aria-label="주요 메뉴"><a href="#category-bundle">카테고리</a><a href="#region-guide">지역별</a><a href="#curation">행사정보</a><a href="#booking">방문 전 체크</a><a href="#guide">여행 정보</a></nav></div></header>`;
}

function deriveTodayKeywords(posts, config) {
  const regionLinks = uniqueBy(posts, (post) => compactRegion(post.region))
    .slice(0, 5)
    .map((post) => ({ label: `${compactRegion(post.region)} 여행`, href: postHref(post) }));
  const festivalLinks = posts
    .filter((post) => post.category === '공연/축제')
    .slice(0, 3)
    .map((post) => ({ label: shorten(post.sourceTitle || post.title || '축제 일정'), href: postHref(post) }));
  const fallback = config.todayKeywords || [];
  return uniqueBy([...regionLinks, ...festivalLinks, ...fallback], (item) => item.label).slice(0, 8);
}

function defaultBookingCards(config) {
  return config.bookingCards || [];
}

function bookingSection(config) {
  const cards = defaultBookingCards(config).map((item) => `<a class="check-card" href="${esc(item.href || '#')}" aria-label="${esc(item.title)}"><h3>${esc(item.title)}</h3><p>${esc(item.description)}</p></a>`).join('');
  return `<section class="wrap section" id="booking"><div class="booking"><div class="booking-copy"><small>VISIT CHECK</small><h2>방문 전 체크는 실제 동선 기준으로</h2><p>보유한 여행 글의 위치, 일정, 운영 정보, 주차와 대중교통 확인 포인트를 기준으로 방문 전 필요한 내용을 다시 묶었습니다.</p></div><div class="check-cards">${cards}</div></div></section>`;
}

function regionSection(posts) {
  const regions = uniqueBy(posts, (post) => compactRegion(post.region)).slice(0, 12);
  const cards = regions.map((post) => `<a class="region-chip" href="${esc(postHref(post))}"><strong>${esc(compactRegion(post.region))}</strong><span>${esc(shorten(post.sourceTitle || post.title || '여행 정보', 18))}</span><small>${esc(post.category || '여행 정보')}</small></a>`).join('');
  return `<section class="wrap section" id="region-guide">${sectionLead('REGION', '지역별 여행 보기', '#routes')}<div class="region-list">${cards}</div></section>`;
}

function dynamicCategoryGroups(config, counts, posts) {
  const regionLinks = uniqueBy(posts, (post) => compactRegion(post.region))
    .slice(0, 4)
    .map((post) => ({ label: `${compactRegion(post.region)} 여행`, href: postHref(post) }));
  const festival = posts.find((post) => post.category === '공연/축제');
  return [
    {
      title: '가볼만한 곳',
      description: `국내여행 글 ${counts.domestic}건을 지역과 동선 중심으로 정리합니다.`,
      links: [{ label: '국내 여행지', href: '#category-domestic' }, ...regionLinks.slice(0, 3)],
    },
    {
      title: '공연/축제',
      description: `공연/축제 글 ${counts.festival}건을 일정, 장소, 프로그램 중심으로 봅니다.`,
      links: [{ label: '축제 일정', href: '#curation' }, { label: '전체 축제 글', href: '#routes' }, ...(festival ? [{ label: shorten(festival.sourceTitle || festival.title), href: postHref(festival) }] : [])],
    },
    {
      title: '여행 정보',
      description: '운영시간, 주차, 대중교통, 지도와 주변 동선을 확인합니다.',
      links: (config.categoryGroups?.[2]?.links || []).slice(0, 4),
    },
  ];
}

function categoryBundle(config, counts, posts) {
  const groups = dynamicCategoryGroups(config, counts, posts).map((group) => `<article class="bundle"><h3>${esc(group.title)}</h3><p>${esc(group.description)}</p><div class="bundle-links">${(group.links || []).map(link).join('')}</div></article>`).join('');
  return `<section class="wrap section" id="category-bundle">${sectionLead('CATEGORY', '여행 정보 카테고리 묶음')}<div class="bundle-grid">${groups}</div></section>`;
}

function faqSection(config) {
  const faqs = (config.faqs || []).map((item, index) => `<details class="faq-item" ${index === 0 ? 'open' : ''}><summary>${esc(item.question)}</summary><p>${esc(item.answer)}</p></details>`).join('');
  return `<section class="wrap section" id="guide">${sectionLead('GUIDE', '트립뷰 이용 가이드')}<div class="faq-list">${faqs}</div></section>`;
}

function popularLinks(config, posts) {
  const fromPosts = uniqueBy(posts, (post) => compactRegion(post.region))
    .slice(0, 4)
    .map((post) => ({ label: `${compactRegion(post.region)} 여행`, href: postHref(post) }));
  return fromPosts.length ? fromPosts : (config.footer?.popular || []);
}

function footer(config, counts, posts) {
  const footerData = config.footer || {};
  return `<footer><div class="wrap foot"><div><strong>트립뷰</strong><p>${esc(footerData.intro || '')}</p></div><div><h3>방문 전 체크</h3>${(footerData.reservation || []).map(link).join('')}</div><div><h3>여행 허브</h3>${(footerData.hub || []).map(link).join('')}</div><div><h3>카테고리</h3><a href="#category-domestic">국내여행 <span>${counts.domestic}</span></a><a href="#curation">공연/축제 <span>${counts.festival}</span></a></div><div><h3>인기 지역</h3>${popularLinks(config, posts).map(link).join('')}</div><div><h3>Language</h3>${(footerData.languages || []).map(link).join('')}</div></div><div class="wrap legal">Copyright 2026 Tripview. All Rights Reserved.</div></footer>`;
}

function replaceBetween(html, startRegex, endRegex, replacement) {
  const start = html.search(startRegex);
  if (start < 0) return html;
  const tail = html.slice(start);
  const endMatch = tail.match(endRegex);
  if (!endMatch?.index && endMatch?.index !== 0) return html;
  const end = start + endMatch.index;
  return html.slice(0, start) + replacement + html.slice(end);
}

function injectCss(html) {
  let next = html;
  if (!next.includes('.faq-list{')) {
    const css = `.check-card{display:block;color:inherit}.faq-list{display:grid;gap:12px}.faq-item{border-top:1px solid var(--line);padding:16px 0}.faq-item:last-child{border-bottom:1px solid var(--line)}.faq-item summary{cursor:pointer;font-weight:900;font-size:18px}.faq-item p{margin:10px 0 0;color:#444}.foot{grid-template-columns:1.3fr repeat(5,.75fr)}@media(max-width:1100px){.foot{grid-template-columns:repeat(3,1fr)}}@media(max-width:720px){.foot{grid-template-columns:1fr}}`;
    next = next.replace('</style>', `${css}</style>`);
  }
  if (!next.includes('.region-list{')) {
    const css = `.region-list{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.region-chip{display:grid;gap:4px;border-top:1px solid var(--line);padding:14px 0 12px}.region-chip strong{font-size:20px;line-height:1.2}.region-chip span{font-size:14px;color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.region-chip small{font-size:12px}@media(max-width:920px){.region-list{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:520px){.region-list{grid-template-columns:1fr}}`;
    next = next.replace('</style>', `${css}</style>`);
  }
  return next;
}

const config = JSON.parse(await fs.readFile(CONFIG, 'utf8'));
const posts = JSON.parse(await fs.readFile(POSTS, 'utf8'));
const counts = {
  domestic: posts.filter((post) => post.category === '국내여행').length,
  festival: posts.filter((post) => post.category === '공연/축제').length,
};

let html = await fs.readFile(INDEX, 'utf8');
const todayItems = deriveTodayKeywords(posts, config);
const today = `<section class="wrap today" aria-label="오늘의 여행 키워드"><div class="today-row"><b>TODAY</b>${todayItems.map(link).join('')}</div></section>`;
html = html.replace(/<header class="top">[\s\S]*?<\/header>/, headerNav());
html = html.replace(/<section class="wrap today"[\s\S]*?<\/section>/, today);
html = html.replace(/<section class="wrap section" id="booking">[\s\S]*?<\/section>\s*<section class="wrap section" id="curation">/, `${bookingSection(config)}\n      <section class="wrap section" id="curation">`);
html = html.replace(/\s*<section class="wrap section" id="region-guide">[\s\S]*?<\/section>\s*/g, '\n      ');
html = html.replace(/(<section class="wrap section" id="curation">[\s\S]*?<\/section>)\s*<section class="wrap section" id="routes">/, `$1\n      ${regionSection(posts)}\n      <section class="wrap section" id="routes">`);
html = replaceBetween(html, /<section class="wrap section" id="category-bundle">/, /<section class="wrap section" id="guide">/, `${categoryBundle(config, counts, posts)}\n      `);
html = replaceBetween(html, /<section class="wrap section" id="guide">/, /\s*<\/main>/, faqSection(config));
html = html.replace(/<footer>[\s\S]*?<\/footer>/, footer(config, counts, posts));
html = injectCss(html);
await fs.writeFile(INDEX, html, 'utf8');
console.log('Homepage content configuration applied from existing post data.');
