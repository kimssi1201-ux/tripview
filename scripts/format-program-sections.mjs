import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const PROGRAM_LABELS = new Set(['주요 프로그램', '방문 포인트']);
const PROGRAM_STYLE = '.program-overview{margin:0 0 36px;padding:24px;border:1px solid var(--line);background:#f7f7f7}.program-overview h2{margin:0 0 8px;font-size:26px;letter-spacing:0}.program-lead{margin:0 0 18px!important;color:#444}.program-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.program-card{padding:16px;border:1px solid var(--line);background:#fff}.program-card h3{margin:0 0 10px;font-size:17px;line-height:1.35;letter-spacing:0}.program-card ul{margin:0;padding-left:18px;display:grid;gap:6px;color:#333}.program-card li{margin:0;line-height:1.62}.program-card li::marker{color:#777}.program-tip{margin:18px 0 0!important;padding-top:14px;border-top:1px solid var(--line);color:#444}@media(max-width:820px){.program-overview{padding:18px}.program-grid{grid-template-columns:1fr}.program-card{padding:14px}}';

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
    .replace(/<br\s*\/?\s*>/gi, ', ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
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

function cleanLabel(value = '') {
  return cleanText(value)
    .replace(/메인프로그램/g, '메인 프로그램')
    .replace(/부대프로그램/g, '부대 프로그램')
    .replace(/소비자참여/g, '소비자 참여')
    .replace(/방문프로그램/g, '방문 프로그램')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasFinalConsonant(value = '') {
  for (const char of [...cleanText(value)].reverse()) {
    const code = char.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  }
  return false;
}

function topicParticle(value) {
  return hasFinalConsonant(value) ? '은' : '는';
}

function objectParticle(value) {
  return hasFinalConsonant(value) ? '을' : '를';
}

function splitProgramText(value = '') {
  return cleanText(value)
    .split(/\s*,\s*|\s*[·ㆍ]\s*|\s*;\s*/u)
    .map(cleanText)
    .map((item) => item.replace(/^[-•]\s*/, '').trim())
    .filter((item) => item.length > 1)
    .slice(0, 14);
}

function parseProgramGroups(raw = '') {
  const text = cleanText(raw);
  const starts = [];
  const numbered = /(?:^|\s)(\d+)\.\s*([^:：]+?)\s*[:：]\s*/g;
  let match;

  while ((match = numbered.exec(text))) {
    starts.push({ index: match.index, end: numbered.lastIndex, label: cleanLabel(match[2]) });
  }

  if (starts.length) {
    return starts
      .map((start, index) => ({
        label: start.label || `프로그램 ${index + 1}`,
        body: cleanText(text.slice(start.end, starts[index + 1]?.index ?? text.length)),
      }))
      .filter((item) => item.body);
  }

  const labeled = text.match(/^([^:：]{2,24})\s*[:：]\s*(.+)$/);
  if (labeled) return [{ label: cleanLabel(labeled[1]), body: cleanText(labeled[2]) }];

  return [{ label: '대표 프로그램', body: text }].filter((item) => item.body);
}

function infoValue(post) {
  const row = (post.info || []).find(([key]) => PROGRAM_LABELS.has(key));
  return row ? cleanText(row[1]) : '';
}

function sourceTitle(post) {
  return cleanText(post.sourceTitle || post.title || '방문지').replace(/\s*\|\s*트립뷰$/, '');
}

function buildProgramOverview(post, raw) {
  const groups = parseProgramGroups(raw);
  if (!groups.length) return '';

  const cards = groups.map(({ label, body }, index) => {
    const items = splitProgramText(body);
    const listItems = (items.length ? items : [body]).map((item) => `<li>${esc(item)}</li>`).join('');
    return `<div class="program-card"><h3>${esc(label || `프로그램 ${index + 1}`)}</h3><ul>${listItems}</ul></div>`;
  }).join('');

  return `<section class="program-overview" aria-labelledby="programTitle"><h2 id="programTitle">주요 프로그램</h2><p class="program-lead">${esc(sourceTitle(post))}에서 볼 수 있는 프로그램을 성격별로 나눠 정리했습니다. 먼저 볼 프로그램을 정한 뒤 도착 시간과 식사 시간을 맞추면 현장에서 이동 순서를 정하기 쉽습니다.</p><div class="program-grid">${cards}</div><p class="program-tip">인기 프로그램은 현장 접수나 선착순으로 운영될 수 있습니다. 도착하면 안내 부스에서 시간표, 접수 위치, 대기 시간을 먼저 확인하세요.</p></section>`;
}

function programSummary(post, raw) {
  const labels = parseProgramGroups(raw)
    .map((item) => cleanLabel(item.label))
    .filter(Boolean)
    .slice(0, 5);

  if (!labels.length) {
    return `${sourceTitle(post)}의 주요 프로그램은 현장 시간표와 접수 방식을 먼저 확인한 뒤 일정에 맞춰 고르는 편이 좋습니다.`;
  }

  return `${sourceTitle(post)}의 주요 프로그램은 ${labels.join(', ')}로 나뉩니다. 위 프로그램 목록에서 꼭 볼 항목을 먼저 정하고, 현장에서는 시간표와 접수 위치를 확인한 뒤 동선을 잡는 편이 좋습니다.`;
}

function fixTitleParticles(html, post) {
  const title = sourceTitle(post);
  if (!title) return html;

  let next = html;
  for (const variant of [...new Set([title, esc(title)])]) {
    next = next.split(`${variant}은`).join(`${variant}${topicParticle(title)}`);
    next = next.split(`${variant}을`).join(`${variant}${objectParticle(title)}`);
  }
  return next;
}

function injectProgramStyle(html) {
  if (html.includes('.program-overview{')) return html;
  const marker = '.info-table tr:last-child th,.info-table tr:last-child td{border-bottom:0}';
  if (!html.includes(marker)) return html;
  return html.replace(marker, `${marker}${PROGRAM_STYLE}`);
}

function removeExistingProgramOverview(html) {
  return html.replace(/<section class="program-overview"[\s\S]*?<\/section>\s*/g, '');
}

function removeProgramRow(html) {
  let removed = false;
  const next = html.replace(/<tr><th>(?:주요 프로그램|방문 포인트)<\/th><td(?:\s+class="[^"]*")?>[\s\S]*?<\/td><\/tr>/g, () => {
    removed = true;
    return '';
  });
  return { html: next, removed };
}

function insertProgramOverview(html, overview) {
  const marker = '</tbody></table>';
  if (!html.includes(marker)) return html;
  return html.replace(marker, `${marker}${overview}`);
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

    const overview = buildProgramOverview(post, raw);
    if (!overview) continue;

    let next = injectProgramStyle(html);
    next = removeExistingProgramOverview(next);
    const result = removeProgramRow(next);
    if (!result.removed && !html.includes('program-overview')) continue;
    next = insertProgramOverview(result.html, overview);
    next = replaceProgramParagraph(next, post, raw);
    next = fixTitleParticles(next, post);

    if (next !== html) {
      await fs.writeFile(file, next, 'utf8');
      changed += 1;
    }
  }

  console.log(`Formatted program sections in ${changed} post(s).`);
}

await main();
