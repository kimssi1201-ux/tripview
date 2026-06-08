import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const NEW_DOMAIN = 'https://tripview.kr';
const OLD_DOMAINS = [
  'https://tripview' + '.pages.dev',
  'https://tripview.kr',
];
const TARGET_EXTENSIONS = new Set(['.html', '.xml', '.mjs', '.json', '.yml', '.yaml', '.md', '.txt']);

async function walk(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath, files);
    } else if (entry.isFile() && TARGET_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

let changed = 0;
const files = await walk(ROOT);

for (const file of files) {
  let text = await readFile(file, 'utf8');
  let next = text;
  for (const oldDomain of OLD_DOMAINS) {
    next = next.replaceAll(oldDomain, NEW_DOMAIN);
  }

  if (next !== text) {
    await writeFile(file, next, 'utf8');
    changed += 1;
  }
}

const remaining = [];
for (const file of files) {
  const text = await readFile(file, 'utf8');
  for (const oldDomain of OLD_DOMAINS) {
    if (text.includes(oldDomain)) {
      remaining.push(path.relative(ROOT, file));
      break;
    }
  }
}

if (remaining.length) {
  throw new Error(`Old domain still exists in: ${remaining.join(', ')}`);
}

console.log(`Site domain set to ${NEW_DOMAIN}. Files changed: ${changed}.`);
