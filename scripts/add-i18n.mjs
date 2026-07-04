import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['.git', 'node_modules', '.venv']);

const LANGUAGE_SWITCH = '<div class="language-switch notranslate" translate="no" aria-label="Language selector"><a href="?lang=ko" data-lang="ko" lang="ko">KO</a><a href="?lang=en" data-lang="en" lang="en">EN</a><a href="?lang=ja" data-lang="ja" lang="ja">JA</a><a href="?lang=zh" data-lang="zh" lang="zh-CN">ZH</a></div>';
const LANGUAGE_FOOTER = '<div><h3>Language</h3><a href="?lang=ko" data-lang="ko" lang="ko">한국어</a><a href="?lang=en" data-lang="en" lang="en">English</a><a href="?lang=ja" data-lang="ja" lang="ja">日本語</a><a href="?lang=zh" data-lang="zh" lang="zh-CN">简体中文</a></div>';
const I18N_SCRIPT = '<script src="/assets/i18n.js" defer></script>';
const TOPIC_FILTER_SCRIPT = '<script src="/assets/topic-filter.js" defer></script>';
const I18N_CSS = '.language-switch{display:flex;align-items:center;gap:8px;white-space:nowrap}.language-switch a{font-size:12px;font-weight:900;color:#555;border-bottom:1px solid transparent;padding:2px 0}.language-switch a.is-active{color:#111;border-bottom-color:#111}@media(max-width:920px){.language-switch{gap:10px}.language-switch a{font-size:12px}}';

async function listHtmlFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await listHtmlFiles(fullPath));
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(fullPath);
  }

  return files;
}

function ensureHeadCss(html) {
  if (html.includes('.language-switch{')) return html;
  if (html.includes('</style>')) return html.replace('</style>', `${I18N_CSS}</style>`);
  return html.replace('</head>', `<style>${I18N_CSS}</style></head>`);
}

function ensureHeaderSwitch(html) {
  if (html.includes('class="language-switch"')) return html;
  if (html.includes('</nav></div></header>')) {
    return html.replace('</nav></div></header>', `</nav>${LANGUAGE_SWITCH}</div></header>`);
  }
  return html;
}

function ensureFooterLanguage(html) {
  if (/<div><h3>Language<\/h3>[\s\S]*?<\/div>/.test(html)) {
    return html.replace(/<div><h3>Language<\/h3>[\s\S]*?<\/div>/, LANGUAGE_FOOTER);
  }
  return html;
}

function ensureScript(html) {
  const withoutOld = html
    .replace(/<script src="\/assets\/i18n\.js" defer><\/script>\s*/g, '')
    .replace(/<script src="\/assets\/topic-filter\.js" defer><\/script>\s*/g, '');
  return withoutOld.replace('</body>', `${I18N_SCRIPT}${TOPIC_FILTER_SCRIPT}</body>`);
}

async function patchFile(file) {
  const before = await fs.readFile(file, 'utf8');
  let after = before;
  after = ensureHeadCss(after);
  after = ensureHeaderSwitch(after);
  after = ensureFooterLanguage(after);
  after = ensureScript(after);

  if (after !== before) {
    await fs.writeFile(file, after, 'utf8');
    return true;
  }
  return false;
}

const files = await listHtmlFiles(ROOT);
let patched = 0;
for (const file of files) {
  if (await patchFile(file)) patched += 1;
}

console.log(`Internationalization applied. pages patched: ${patched}, pages checked: ${files.length}`);
