import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE_URL = 'https://tripview.kr';
const ADS = `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8468106244002167"\n     crossorigin="anonymous"></script>`;
const NAVER = '<meta name="naver-site-verification" content="38616b4b4209994ed384d0d2439bddcbec2cc711" />';

const esc = (value = '') => String(value).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const text = (html = '') => String(html).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function sourceTitle(html) {
  return text(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '')
    .replace(/\s*\|\s*트립뷰$/, '')
    .replace(/,\s*방문 전[\s\S]*$/, '')
    .trim();
}

function hasBatchim(value) {
  const char = [...String(value || '').trim()].reverse().find((item) => /[가-힣]/.test(item));
  if (!char) return false;
  const code = char.charCodeAt(0) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0;
}

function trustFooter(prefix = '/') {
  return `<footer><div class="wrap foot"><div><strong>트립뷰</strong><p>방문 전 필요한 일정, 위치, 운영 정보를 간결하게 정리합니다.</p></div><div><h3>탐색</h3><a href="${prefix}#latest">최신글</a><a href="${prefix}#routes">전체글</a></div><div><h3>사이트</h3><a href="${prefix}about.html">트립뷰 소개</a><a href="${prefix}contact.html">문의</a><a href="${prefix}privacy.html">개인정보처리방침</a></div></div></footer>`;
}

function shell(title, description, main) {
  return `<!doctype html>
<html lang="ko"><head>${ADS}${NAVER}<meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="theme-color" content="#ffffff" /><meta name="description" content="${esc(description)}" /><title>${esc(title)} | 트립뷰</title><style>
:root{--ink:#111;--muted:#666;--line:#ddd;--paper:#fff}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:Arial,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;line-height:1.75}.wrap{width:min(920px,calc(100% - 32px));margin:0 auto}a{color:inherit}.top{border-bottom:1px solid var(--line)}.nav{min-height:72px;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{font-size:22px;font-weight:900;text-decoration:none}.links{display:flex;gap:18px;font-size:14px;font-weight:800}.hero{padding:54px 0 26px;border-bottom:1px solid var(--line)}h1{margin:0 0 12px;font-size:38px;line-height:1.2}main{padding:34px 0 56px}section{padding:22px 0;border-bottom:1px solid var(--line)}h2{margin:0 0 10px;font-size:22px}p,li{color:#333}.muted,footer{color:var(--muted)}footer{padding:28px 0 42px}.foot{display:grid;grid-template-columns:1.4fr .8fr .8fr;gap:24px}.foot h3{margin:0 0 8px;color:var(--ink);font-size:15px}.foot div{display:grid;align-content:start;gap:7px}@media(max-width:720px){.nav{align-items:flex-start;flex-direction:column;justify-content:center;padding:14px 0}.links{flex-wrap:wrap}.foot{grid-template-columns:1fr}h1{font-size:31px}}
</style></head><body><header class="top"><div class="wrap nav"><a class="brand" href="/">트립뷰</a><nav class="links" aria-label="주요 메뉴"><a href="/">홈</a><a href="/#latest">최신글</a><a href="/#routes">전체글</a></nav></div></header>${main}${trustFooter('/')}</body></html>
`;
}

async function writeTrustPages() {
  await fs.writeFile(path.join(ROOT, 'about.html'), shell('트립뷰 소개', '트립뷰 소개와 운영 기준', `<div class="wrap hero"><h1>트립뷰 소개</h1><p class="muted">트립뷰는 국내여행과 공연/축제 정보를 방문 전 확인하기 쉽게 정리하는 여행 큐레이션 사이트입니다.</p></div><main class="wrap"><section><h2>운영 방향</h2><p>장소의 분위기만 소개하지 않고, 실제 방문 전에 필요한 위치, 일정, 운영 시간, 요금, 문의처, 이동 동선을 함께 정리합니다.</p><p>글은 표, 본문 설명, 자주 묻는 질문, 지도 미리보기 구조로 구성해 출발 전 확인할 내용을 빠르게 찾을 수 있게 합니다.</p></section><section><h2>콘텐츠 기준</h2><p>관광지와 축제 정보는 공개된 운영 정보와 방문 전에 확인해야 할 요소를 중심으로 정리합니다. 일정, 요금, 프로그램은 변경될 수 있어 각 글에는 확인이 필요한 항목을 함께 안내합니다.</p></section><section><h2>광고와 독립성</h2><p>사이트 운영을 위해 광고를 게재할 수 있지만, 본문은 방문자가 필요한 정보를 찾기 쉽도록 구성하는 것을 우선합니다.</p></section></main>`), 'utf8');
  await fs.writeFile(path.join(ROOT, 'contact.html'), shell('문의', '트립뷰 문의 안내', `<div class="wrap hero"><h1>문의</h1><p class="muted">콘텐츠, 개인정보, 광고 관련 문의는 아래 연락처로 보내주세요.</p></div><main class="wrap"><section><h2>연락처</h2><p>이메일: <a href="mailto:contact@tripview.kr">contact@tripview.kr</a></p><p>문의 시 페이지 주소와 확인이 필요한 내용을 함께 보내주시면 더 정확히 검토할 수 있습니다.</p></section><section><h2>수정 요청</h2><p>축제 일정, 운영 시간, 요금, 장소 정보가 변경된 경우 해당 글 주소와 변경 내용을 알려주세요. 확인 후 필요한 부분을 반영합니다.</p></section></main>`), 'utf8');
  await fs.writeFile(path.join(ROOT, 'privacy.html'), shell('개인정보처리방침', '트립뷰 개인정보처리방침', `<div class="wrap hero"><h1>개인정보처리방침</h1><p class="muted">트립뷰는 국내여행과 공연/축제 정보를 제공하며, 이용자의 개인정보 보호를 중요하게 생각합니다.</p></div><main class="wrap"><section><h2>수집하는 정보</h2><p>트립뷰는 회원가입, 댓글, 결제 기능을 운영하지 않습니다. 일반 방문 과정에서 이름, 주민등록번호, 결제정보와 같은 직접 식별 정보를 요구하지 않습니다.</p><p>서비스 품질 개선과 보안, 광고 운영을 위해 접속 로그, 브라우저 정보, 쿠키, 기기 정보, 방문 페이지 정보가 자동으로 처리될 수 있습니다.</p></section><section><h2>쿠키와 광고</h2><p>트립뷰는 Google AdSense를 사용할 수 있습니다. Google 및 서드 파티 공급업체는 쿠키를 사용해 이용자가 이 사이트 또는 다른 사이트를 방문한 기록을 바탕으로 광고를 게재할 수 있습니다.</p><p>Google의 광고 쿠키 사용으로 Google과 파트너는 이용자의 트립뷰 방문 및 인터넷상의 다른 사이트 방문 기록을 기반으로 광고를 게재할 수 있습니다.</p><p>이용자는 <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener">Google 광고 설정</a>에서 개인 맞춤 광고를 거부할 수 있으며, <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener">AboutAds</a>에서도 일부 서드 파티 공급업체의 맞춤 광고 쿠키 사용을 거부할 수 있습니다.</p></section><section><h2>외부 서비스</h2><p>일부 글에는 지도, 이미지, 광고, 외부 참고 링크가 포함될 수 있습니다. 외부 사이트로 이동한 뒤에는 해당 서비스의 개인정보처리방침과 이용약관이 적용됩니다.</p></section><section><h2>문의</h2><p>개인정보 관련 문의는 <a href="mailto:contact@tripview.kr">contact@tripview.kr</a>로 보낼 수 있습니다.</p></section><p class="muted">시행일: 2026년 6월 23일</p></main>`), 'utf8');
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (['.git', 'node_modules', 'site', 'www'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (entry.isFile() && entry.name === 'index.html') files.push(full);
  }
  return files;
}

function polishHtml(html, file) {
  const prefix = path.dirname(file) === ROOT ? '/' : '../';
  let next = html
    .replaceAll('국내여행 글감입니다', '국내여행 일정입니다')
    .replaceAll('공연/축제 글감입니다', '공연/축제 행사입니다')
    .replaceAll('실제로 움직이기 쉬운 여행 루트를 큐레이션합니다.', '방문 전 필요한 일정, 위치, 운영 정보를 간결하게 정리합니다.');
  const title = sourceTitle(next);
  if (title) {
    const particle = hasBatchim(title) ? '은' : '는';
    next = next.replaceAll(`${title}은`, `${title}${particle}`).replaceAll(`${title}는`, `${title}${particle}`);
  }
  if (!next.includes('href="/privacy.html"') && !next.includes('href="../privacy.html"')) {
    next = next
      .replace('footer{border-top:1px solid var(--line);padding:28px 0 42px;color:var(--muted)}', 'footer{border-top:1px solid var(--line);padding:28px 0 42px;color:var(--muted)}.foot{display:grid;grid-template-columns:1.4fr .8fr .8fr;gap:24px}.foot h3{margin:0 0 8px;color:var(--ink);font-size:15px}.foot div{display:grid;align-content:start;gap:7px}')
      .replace(/<footer>[\s\S]*?<\/footer>/i, trustFooter(prefix));
  }
  return next;
}

async function updateSitemap() {
  const file = path.join(ROOT, 'sitemap.xml');
  let xml = await fs.readFile(file, 'utf8').catch(() => '');
  if (!xml) return;
  const today = new Date().toISOString().slice(0, 10);
  for (const url of ['/about.html', '/contact.html', '/privacy.html']) {
    const loc = `${SITE_URL}${url}`;
    if (!xml.includes(`<loc>${loc}</loc>`)) xml = xml.replace('</urlset>', `  <url><loc>${loc}</loc><lastmod>${today}</lastmod></url>\n</urlset>`);
  }
  await fs.writeFile(file, xml, 'utf8');
}

await writeTrustPages();
let changed = 0;
for (const file of new Set([path.join(ROOT, 'index.html'), ...(await walk(ROOT))])) {
  const html = await fs.readFile(file, 'utf8').catch(() => '');
  if (!html) continue;
  const next = polishHtml(html, file);
  if (next !== html) {
    await fs.writeFile(file, next, 'utf8');
    changed += 1;
  }
}
await updateSitemap();
console.log(`Adsense readiness polish complete. HTML files updated: ${changed}.`);
