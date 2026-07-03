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

function bookingSection(config) {
  const cards = (config.bookingCards || []).map((item) => `<a class="check-card" href="${esc(item.href || '#')}" aria-label="${esc(item.title)}"><h3>${esc(item.title)}</h3><p>${esc(item.description)}</p></a>`).join('');
  return `<section class="wrap section" id="booking"><div class="booking"><div class="booking-copy"><small>BOOKING CHECK</small><h2>예약 전 체크는 별도 페이지에서 빠르게</h2><p>메인은 여행 정보를 읽는 곳이고, 예약 전 체크는 위치, 가격, 취소 조건, 운영 시간을 비교하는 데 집중합니다.</p></div><div class="check-cards">${cards}</div></div></section>`;
}

function categoryBundle(config) {
  const groups = (config.categoryGroups || []).map((group) => `<article class="bundle"><h3>${esc(group.title)}</h3><p>${esc(group.description)}</p><div class="bundle-links">${(group.links || []).map(link).join('')}</div></article>`).join('');
  return `<section class="wrap section" id="category-bundle">${sectionLead('CATEGORY', '여행 정보 카테고리 묶음')}<div class="bundle-grid">${groups}</div></section>`;
}

function faqSection(config) {
  const faqs = (config.faqs || []).map((item, index) => `<details class="faq-item" ${index === 0 ? 'open' : ''}><summary>${esc(item.question)}</summary><p>${esc(item.answer)}</p></details>`).join('');
  return `<section class="wrap section" id="guide">${sectionLead('GUIDE', '트립뷰 이용 가이드')}<div class="faq-list">${faqs}</div></section>`;
}

function footer(config, counts) {
  const footerData = config.footer || {};
  return `<footer><div class="wrap foot"><div><strong>트립뷰</strong><p>${esc(footerData.intro || '')}</p></div><div><h3>예약</h3>${(footerData.reservation || []).map(link).join('')}</div><div><h3>여행 허브</h3>${(footerData.hub || []).map(link).join('')}</div><div><h3>카테고리</h3><a href="#category-domestic">국내여행 <span>${counts.domestic}</span></a><a href="#curation">공연/축제 <span>${counts.festival}</span></a></div><div><h3>인기 여행지</h3>${(footerData.popular || []).map(link).join('')}</div><div><h3>Language</h3>${(footerData.languages || []).map(link).join('')}</div></div><div class="wrap legal">Copyright 2026 Tripview. All Rights Reserved.</div></footer>`;
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
  if (html.includes('.faq-list{')) return html;
  const css = `.check-card{display:block;color:inherit}.faq-list{display:grid;gap:12px}.faq-item{border-top:1px solid var(--line);padding:16px 0}.faq-item:last-child{border-bottom:1px solid var(--line)}.faq-item summary{cursor:pointer;font-weight:900;font-size:18px}.faq-item p{margin:10px 0 0;color:#444}.foot{grid-template-columns:1.3fr repeat(5,.75fr)}@media(max-width:1100px){.foot{grid-template-columns:repeat(3,1fr)}}@media(max-width:720px){.foot{grid-template-columns:1fr}}`;
  return html.replace('</style>', `${css}</style>`);
}

const config = JSON.parse(await fs.readFile(CONFIG, 'utf8'));
const posts = JSON.parse(await fs.readFile(POSTS, 'utf8'));
const counts = {
  domestic: posts.filter((post) => post.category === '국내여행').length,
  festival: posts.filter((post) => post.category === '공연/축제').length,
};

let html = await fs.readFile(INDEX, 'utf8');
const today = `<section class="wrap today" aria-label="오늘의 여행 키워드"><div class="today-row"><b>TODAY</b>${(config.todayKeywords || []).map(link).join('')}</div></section>`;
html = html.replace(/<section class="wrap today"[\s\S]*?<\/section>/, today);
html = html.replace(/<section class="wrap section" id="booking">[\s\S]*?<\/section>\s*<section class="wrap section" id="curation">/, `${bookingSection(config)}\n      <section class="wrap section" id="curation">`);
html = replaceBetween(html, /<section class="wrap section" id="category-bundle">/, /<section class="wrap section" id="guide">/, `${categoryBundle(config)}\n      `);
html = replaceBetween(html, /<section class="wrap section" id="guide">/, /\s*<\/main>/, faqSection(config));
html = html.replace(/<footer>[\s\S]*?<\/footer>/, footer(config, counts));
html = injectCss(html);
await fs.writeFile(INDEX, html, 'utf8');
console.log('Homepage content configuration applied.');
