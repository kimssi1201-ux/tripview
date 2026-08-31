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

function hasDeferredImage(post) {
  return Boolean(String(post?.pexelsQuery || post?.freeImageQuery || post?.imageQuery || '').trim());
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

const generatedBySlug = new Map();
const generatedByContentId = new Map();
const generatedByTitle = new Map();
for (const post of generated) {
  if (post?.slug) generatedBySlug.set(String(post.slug), post);
  if (post?.contentid) generatedByContentId.set(String(post.contentid), post);
  const title = titleKey(post);
  if (title) generatedByTitle.set(title, post);
}

function mergedInfoRows(current = [], incoming = []) {
  if (!Array.isArray(current) || !current.length) return Array.isArray(incoming) ? incoming : [];
  if (!Array.isArray(incoming) || !incoming.length) return current;
  const seen = new Set(current.map((item) => String(item?.label || '').trim()).filter(Boolean));
  return [...current, ...incoming.filter((item) => item?.label && !seen.has(String(item.label).trim()))];
}

function preserveGeneratedBackfill(manualPost) {
  const existing = generatedBySlug.get(String(manualPost?.slug || ''))
    || generatedByContentId.get(String(manualPost?.contentid || ''))
    || generatedByTitle.get(titleKey(manualPost));
  if (!existing) return manualPost;
  const existingImages = Array.isArray(existing.images) ? existing.images : [];
  const manualImages = Array.isArray(manualPost.images) ? manualPost.images : [];
  return {
    ...manualPost,
    images: existingImages.length > manualImages.length ? existingImages : manualImages,
    info: mergedInfoRows(manualPost.info, existing.info),
    tourApi: existing.tourApi ? { ...existing.tourApi, ...(manualPost.tourApi || {}) } : manualPost.tourApi
  };
}

const seenKeys = new Set();
const seenTitles = new Set();
const seenImages = new Set();
const merged = [];

for (const post of [...manual, ...generated]) {
  if (!post?.slug || !post?.title || (!post?.image && !hasDeferredImage(post))) continue;
  const candidate = manual.includes(post) ? preserveGeneratedBackfill(post) : post;
  const key = postKey(post);
  const title = titleKey(post);
  const image = usesStrictImageDedupe(post) ? imageKey(post) : '';
  if (seenKeys.has(key) || seenTitles.has(title) || seenImages.has(image)) continue;
  seenKeys.add(key);
  seenTitles.add(title);
  if (image) seenImages.add(image);
  merged.push(candidate);
}

await fs.writeFile(generatedPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
console.log(`Merged ${manual.length} manual post(s). Total generated posts: ${merged.length}.`);
