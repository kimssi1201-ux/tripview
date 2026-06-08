import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const PROGRAM_LABELS = new Set(['주요 프로그램', '방문 포인트']);
const PROGRAM_STYLE = '.program-list{margin:0;padding:0;list-style:none;display:grid;gap:10px}.program-list li{padding:0 0 10px;border-bottom:1px solid var(--line)}.program-list li:last-child{padding-bottom:0;border-bottom:0}.program-list strong{display:block;margin-bottom:3px;color:var(--ink);font-size:15px}.program-list span{display:block;color:#333;line-height:1.65}';

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, (match) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[match]));
}

function strip(value = '') {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanText(value = '') {
  return strip(value)
    .replace(/\s*([,:：])\s*/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[,.，。]+$/g, '');
}

function splitProgramText(value = '') {
  return cleanText(value)
    .split(/\s*,\s*|\s*[·ㆍ]\s*|\s*;\s*/u)
    .map(cleanText)
    .filter((item) => item.length > 1)
    .slice(0, 12);
}

function parseProgramGroups(raw = '') {
  const text = cleanText(raw);
  const re = /(?:^|\s)(\d+)\.\s*([^:：]+?)\s*[:：]\s*/g;
  const starts = [];
  let match;

  while ((match = re.exec(text))) {
    starts.push({ index: match.index, end: re.lastIndex, label: cleanText(match[2]) });
  }

  if (!starts.length) {
    return splitProgramText(text).map((body) => ({ label: '', body }));
  }

  return starts
    .map((start, index) => ({
      label: start.label,
      body: cleanText(text.slice(start.end, starts[index + 1]?.index ?? text.length)),
    }))
    .filter((item) => item.body);
}

function infoValue(post) {
  const row = (post.info || []).find(([key]) => PROGRAM_LABELS.has(key));
  return row ? cleanText(row[1]) : '';
}

function sourceTitle(post) {
  return cleanText(post.sourceTitle || post.title || '방문지').replace(/\s*\|\s*트립뷰$/, '');
}

function buildProgramList(raw) {
  const groups = parseProgramGroups(raw);
  if (!groups.length) return '';

  const items = groups.map(({ label, body }) => {
    if (label) {
      const lines = splitProgramText(body);
      const detail = (lines.length ? lines : [body]).map(esc).join('<br />');
      return `<li><strong>${esc(label)}</strong><span>${detail}</span></li>`;
    }
    return `<li><span>${esc(body)}</span></li>`;
  }).join('');

  return `<ul class="program-list">${items}</ul>`;
}

function programSummary(post, raw) {
  const groups = parseProgramGroups(raw);
  const labels = [...new Set(groups.map((item) => item.label || item.body).map(cleanText).filter(Boolean))].slice(0, 5);
  if (!labels.length) {
    return `${sourceTitle(post)}의 주요 프로그램은 현장 시간표와 접수 방식을 먼저 확인한 뒤 일정에 맞춰 고르는 편이 좋습니다.`;
  }
  return `${sourceTitle(post)}의 주요 프로그램은 ${labels.join(', ')} 중심으로 나뉩니다. 운영 시간과 접수 방식이 다를 수 있으니, 도착하면 전체 시간표와 대기 가능 시간을 먼저 확인하고 우선순위를 정하는 편이 좋습니다.`;
}

function injectProgramStyle(html) {
  if (html.includes('.program-list')) return html;
  const marker = '.info-table tr:last-child th,.info-table tr:last-child td{border-bottom:0}';
  if (!html.includes(marker)) return html;
  return html.replace(marker, `${marker}${PROGRAM_STYLE}`);
}

function replaceInfoCell(html, programHtml) {
  let replaced = false;
  const next = html.replace(/(<tr><th>(?:주요 프로그램|방문 포인트)<\/th><td>)[\s\S]*?(<\/td><\/tr>)/, (_match, start, end) => {
    replaced = true;
    return `${start}${programHtml}${end}`;
  });
  return { html: next, replaced };
}

function replaceProgramParagraph(html, post, raw) {
  const summary = esc(programSummary(post, raw));
  return html
    .replace(/(<h2>프로그램을 고르는 법<\/h2><p>)[\s\S]*?(<\/p><p>)/, (_match, start, end) => `${start}${summary}${end}`)
    .replace(/(<h2>관람 포인트<\/h2><p>)[\s\S]*?(<\/p><p>)/, (_match, start, end) => `${start}${summary}${end}`);
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(path.join(ROOT, file), 'utf8'));
  } catch {
    return fallback;
  }
}

async function main() {
  const posts = await readJson('data/generated-posts.json', []);
  let changed = 0;

  for (const post of posts) {
    const raw = infoValue(post);
    if (!raw) continue;

    const file = path.join(ROOT, post.slug, 'index.html');
    let html;
    try {
      html = await fs.readFile(file, 'utf8');
    } catch {
      continue;
    }

    const programHtml = buildProgramList(raw);
    if (!programHtml) continue;

    let next = injectProgramStyle(html);
    const result = replaceInfoCell(next, programHtml);
    if (!result.replaced) continue;
    next = replaceProgramParagraph(result.html, post, raw);

    if (next !== html) {
      await fs.writeFile(file, next, 'utf8');
      changed += 1;
    }
  }

  console.log(`Formatted program sections in ${changed} post(s).`);
}

await main();
