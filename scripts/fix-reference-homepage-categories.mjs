import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = path.join(ROOT, 'index.html');
const DATA = path.join(ROOT, 'data', 'generated-posts.json');
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

function categoryId(category) {
  return category === '국내여행' ? 'category-domestic' : 'category-festival';
}

function countCategories(posts) {
  const categories = Object.fromEntries(CATEGORIES.map((category) => [category, 0]));
  for (const post of posts) {
    if (CATEGORIES.includes(post.category)) categories[post.category] += 1;
  }
  return { total: posts.length, categories };
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
  const href = `/${post.slug}/`;
  const image = post.image ? `<img src="${esc(post.image)}" alt="${esc(post.alt || post.title)}" loading="lazy" />` : '';
  const excerpt = post.excerpt || post.description || '';
  const read = post.read || '약 7분';
  return `<a class="${className}" href="${esc(href)}">${image}<small>${esc(post.category)}</small><${heading}>${esc(post.title)}</${heading}><p>${esc(excerpt)}</p><div class="meta"><span>${esc(prettyDate(post))}</span><span>${esc(read)}</span>${post.region ? `<span>${esc(post.region)}</span>` : ''}</div></a>`;
}

function replaceDomesticSection(html, domestic) {
  const replacement = `<section class="wrap section" id="category-domestic"><div class="section-head"><div><small>PLACES</small><h2>가볼만한 곳</h2></div><a href="#routes">더보기</a></div><div class="grid">${domestic.slice(0, 9).map((post) => card(post)).join('')}</div></section>`;
  return html.replace(/<section class="wrap section" id="category-domestic">[\s\S]*?<\/section>\s*<section class="wrap section" id="booking">/, `${replacement}\n      <section class="wrap section" id="booking">`);
}

function fixCardLabels(html, postsBySlug) {
  return html.replace(/(<a class="(?:latest-primary|card|mini-card)" href="\/([^\/]+)\/">[\s\S]*?<small>)([^<]*)(<\/small>)/g, (match, before, slug, _old, after) => {
    const post = postsBySlug.get(slug);
    if (!post?.category) return match;
    return `${before}${esc(post.category)}${after}`;
  });
}

function fixFooterCounts(html, counts) {
  return html
    .replace(/국내여행 <span>\d+<\/span>/g, `국내여행 <span>${counts.categories['국내여행'] || 0}</span>`)
    .replace(/공연\/축제 <span>\d+<\/span>/g, `공연/축제 <span>${counts.categories['공연/축제'] || 0}</span>`)
    .replace(/전체 글 \d+/g, `전체 글 ${counts.total}`);
}

const posts = JSON.parse(await fs.readFile(DATA, 'utf8'));
const postsBySlug = new Map(posts.map((post) => [post.slug, post]));
const domestic = posts.filter((post) => post.category === '국내여행');
const counts = countCategories(posts);
let html = await fs.readFile(INDEX, 'utf8');
html = replaceDomesticSection(html, domestic);
html = fixCardLabels(html, postsBySlug);
html = fixFooterCounts(html, counts);
await fs.writeFile(INDEX, html, 'utf8');
console.log(`Reference homepage categories fixed. domestic: ${counts.categories['국내여행'] || 0}, festival: ${counts.categories['공연/축제'] || 0}.`);
