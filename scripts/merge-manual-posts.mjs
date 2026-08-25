import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function postKey(post) {
  return String(post?.contentid || post?.slug || post?.title || '').trim();
}

function titleKey(post) {
  return String(post?.sourceTitle || post?.title || '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function imageKey(post) {
  return String(post?.image || '')
    .split('?')[0]
    .replace(/_image\d+_\d+\.[^.]+$/i, '')
    .toLowerCase();
}

function usesStrictImageDedupe(post) {
  const slug = String(post?.slug || '');
  const image = String(post?.image || '');
  return !slug.startsWith('data-') && /\/\/tong\.visitkorea\.or\.kr\//i.test(image);
}

async function manualPosts() {
  const entries = await fs.readdir(DATA_DIR, { withFileTypes: true }).catch(() => []);
  const files = entries
    .filter((entry) => entry.isFile() && /^manual-posts-.*\.json$/.test(entry.name))
    .map((entry) => path.join(DATA_DIR, entry.name))
    .sort()
    .reverse();

  const posts = [];
  for (const file of files) {
    const data = await readJson(file, []);
    if (Array.isArray(data)) posts.push(...data);
  }
  return posts;
}

const generatedPath = path.join(DATA_DIR, 'generated-posts.json');
const generated = await readJson(generatedPath, []);
const manual = await manualPosts();

const seenKeys = new Set();
const seenTitles = new Set();
const seenImages = new Set();
const merged = [];

for (const post of [...manual, ...generated]) {
  if (!post?.slug || !post?.title || !post?.image) continue;
  const key = postKey(post);
  const title = titleKey(post);
  const image = usesStrictImageDedupe(post) ? imageKey(post) : '';
  if (seenKeys.has(key) || seenTitles.has(title) || seenImages.has(image)) continue;
  seenKeys.add(key);
  seenTitles.add(title);
  if (image) seenImages.add(image);
  merged.push(post);
}

await fs.writeFile(generatedPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
console.log(`Merged ${manual.length} manual post(s). Total generated posts: ${merged.length}.`);
