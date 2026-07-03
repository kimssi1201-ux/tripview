import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SITE_URL = 'https://tripview.kr';
const FEED_URL = `${SITE_URL}/feed.xml`;
const MAX_ITEMS = 50;

function xmlEscape(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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

function attr(content, name) {
  const pattern = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i');
  return content.match(pattern)?.[1] || '';
}

function titleFromHtml(content) {
  return stripHtml(content.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '')
    .replace(/\s*\|\s*트립뷰$/, '')
    .replace(/\s*-\s*최신 여행 큐레이션$/, '')
    .trim();
}

function imageType(src = '') {
  const clean = src.split('?')[0].toLowerCase();
  if (clean.endsWith('.png')) return 'image/png';
  if (clean.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
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

async function itemFromUrl(url) {
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

  const description = attr(html, 'description') || attr(html, 'og:description') || stripHtml(html).slice(0, 180);
  const image = attr(html, 'og:image');
  const category = html.includes('공연/축제') ? '공연/축제' : html.includes('국내여행') ? '국내여행' : '';

  return { title, url, description, image, category };
}

function renderFeed(items) {
  const now = new Date().toUTCString();
  const body = items.map((item) => {
    const imageMime = imageType(item.image);
    const enclosure = item.image
      ? `\n      <enclosure url="${xmlEscape(item.image)}" type="${imageMime}" />`
      : '';
    const media = item.image
      ? `\n      <media:thumbnail url="${xmlEscape(item.image)}" />\n      <media:content url="${xmlEscape(item.image)}" medium="image" type="${imageMime}" />`
      : '';
    const category = item.category ? `\n      <category>${xmlEscape(item.category)}</category>` : '';
    return `    <item>\n      <title>${xmlEscape(item.title)}</title>\n      <link>${xmlEscape(item.url)}</link>\n      <guid isPermaLink="true">${xmlEscape(item.url)}</guid>\n      <description>${xmlEscape(item.description)}</description>${category}${enclosure}${media}\n      <pubDate>${now}</pubDate>\n    </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">\n  <channel>\n    <title>트립뷰</title>\n    <link>${SITE_URL}/</link>\n    <atom:link href="${FEED_URL}" rel="self" type="application/rss+xml" />\n    <description>국내여행과 공연/축제 방문 정보를 정리하는 트립뷰 최신 글 RSS입니다.</description>\n    <language>ko</language>\n    <lastBuildDate>${now}</lastBuildDate>\n${body}\n  </channel>\n</rss>\n`;
}

const urls = await urlsFromSitemap();
const items = [];
const seen = new Set();

for (const url of urls) {
  if (seen.has(url)) continue;
  seen.add(url);
  const item = await itemFromUrl(url);
  if (item) items.push(item);
  if (items.length >= MAX_ITEMS) break;
}

if (!items.length) {
  throw new Error('No RSS items found.');
}

const feed = renderFeed(items);
await fs.writeFile(path.join(ROOT, 'feed.xml'), feed, 'utf8');
await fs.writeFile(path.join(ROOT, 'rss.xml'), feed, 'utf8');
console.log(`Built RSS feed with ${items.length} item(s).`);
