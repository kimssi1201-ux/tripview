import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SITE_URL = 'https://tripview.kr';
const API_BASE = 'https://apis.data.go.kr/B551011/KorService2';
const POST_LIMIT = Math.max(1, Number.parseInt(process.env.POST_LIMIT || '10', 10) || 10);
const MAX_IMAGES_PER_POST = Math.max(1, Math.min(3, Number.parseInt(process.env.MAX_IMAGES_PER_POST || '3', 10) || 3));
const SERVICE_KEY = process.env.TRIPVIEW_API_KEY || process.env.TRIPVIEW_API_KEY_PARAM || '';

if (!SERVICE_KEY) {
  throw new Error('TRIPVIEW_API_KEY is required. Add it as a GitHub Actions secret.');
}

const SEED_POSTS = [
  { slug: 'gochang-tidal-flat-festival-2026', title: '고창갯벌축제 2026, 이번 주말 방문 전 알아둘 운영정보', category: '공연/축제', region: '전북 고창', date: '2026년 6월 6일', read: '약 5분', image: 'https://tong.visitkorea.or.kr/cms/resource/62/4066762_image2_1.jpg', alt: '2026 고창갯벌축제 포스터', excerpt: '고창갯벌축제의 체험 시간, 입장료, 프로그램, 준비물을 주말 방문 기준으로 정리했습니다.' },
  { slug: 'geoje-okpo-victory-festival-2026', title: '거제 옥포대첩 축제 2026, 6월 둘째 주말 운영정보와 관람 포인트', category: '공연/축제', region: '경남 거제', date: '2026년 6월 6일', read: '약 5분', image: 'https://tong.visitkorea.or.kr/cms/resource/48/4066648_image2_1.jpg', alt: '거제 옥포대첩 축제', excerpt: '옥포수변공원 일원에서 열리는 역사 축제의 야간 공연과 이동 동선을 정리했습니다.' },
  { slug: 'gangju-sunflower-festival-2026', title: '강주해바라기 축제 2026, 초여름 꽃길 일정과 입장 정보', category: '국내여행', region: '경남 함안', date: '2026년 6월 6일', read: '약 5분', image: 'https://tong.visitkorea.or.kr/cms/resource/03/4069903_image2_1.JPG', alt: '강주해바라기 축제', excerpt: '강주마을 해바라기 꽃길과 입장료, 포토존 관람 팁을 정리했습니다.' },
  { slug: 'goyang-haengju-cultural-festival-2026', title: '고양행주문화제 2026, 행주산성 역사문화축제 운영정보', category: '공연/축제', region: '경기 고양', date: '2026년 6월 6일', read: '약 5분', image: 'https://tong.visitkorea.or.kr/cms/resource/34/4057034_image2_1.jpg', alt: '고양행주문화제', excerpt: '행주산성 일원에서 열리는 역사문화 축제의 관람 동선을 정리했습니다.' },
  { slug: 'gwangalli-eobang-festival-2026', title: '광안리어방축제 2026, 광안리 해변 야간 동선과 관람 정보', category: '공연/축제', region: '부산 수영', date: '2026년 6월 6일', read: '약 5분', image: 'https://tong.visitkorea.or.kr/cms/resource/10/4066810_image2_1.JPG', alt: '광안리어방축제', excerpt: '광안리해변에서 즐기는 어방 문화축제와 해변 이동 팁을 정리했습니다.' },
  { slug: 'gyeonggi-rice-gimbap-festa-2026', title: '경기미 김밥페스타 2026, 수원 광교 먹거리 축제 방문 정보', category: '공연/축제', region: '경기 수원', date: '2026년 6월 6일', read: '약 5분', image: 'https://tong.visitkorea.or.kr/cms/resource/42/4058642_image2_1.jpg', alt: '경기미 김밥페스타', excerpt: '김밥 경연과 체험, 판매 부스를 중심으로 보는 수원 광교 먹거리 축제 글감입니다.' },
  { slug: 'gyeongsan-jain-danoje-2026', title: '경산자인단오제 2026, 계정숲에서 즐기는 전통문화 축제 정보', category: '공연/축제', region: '경북 경산', date: '2026년 6월 6일', read: '약 5분', image: 'https://tong.visitkorea.or.kr/cms/resource/93/4063893_image2_1.JPG', alt: '경산자인단오제', excerpt: '계정숲에서 이어지는 전통문화 공연과 체험 동선을 정리했습니다.' },
  { slug: 'gangjin-hydrangea-road-festival-2026', title: '강진수국길축제 2026, 보은산 V랜드 수국길 방문 정보', category: '국내여행', region: '전남 강진', date: '2026년 6월 6일', read: '약 5분', image: 'https://tong.visitkorea.or.kr/cms/resource/28/4071228_image2_1.jpg', alt: '강진수국길축제', excerpt: '보은산 V랜드와 수국길을 둘러보는 초여름 꽃길 여행 정보입니다.' },
  { slug: 'gongju-yugu-hydrangea-garden-festival-2026', title: '공주 유구색동수국정원 축제 2026, 수국 개화와 야간 관람 정보', category: '국내여행', region: '충남 공주', date: '2026년 6월 6일', read: '약 5분', image: 'https://tong.visitkorea.or.kr/cms/resource/06/4069606_image2_1.jpg', alt: '공주 유구색동수국정원 축제', excerpt: '유구색동수국정원의 수국 관람, 야간 조명, 주차 혼잡 체크를 정리했습니다.' }
];

const stripHtml = (value = '') => String(value).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const esc = (value = '') => String(value).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const norm = (value = '') => stripHtml(value).replace(/\s+/g, '').toLowerCase();

function kstNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function hyphenDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function koreanDate(date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function formatTourDate(raw) {
  const value = String(raw || '');
  if (!/^\d{8}$/.test(value)) return '';
  return `${value.slice(0, 4)}년 ${Number(value.slice(4, 6))}월 ${Number(value.slice(6, 8))}일`;
}

function formatTourDateShort(raw) {
  const value = String(raw || '');
  if (!/^\d{8}$/.test(value)) return '';
  return `${value.slice(0, 4)}.${value.slice(4, 6)}.${value.slice(6, 8)}`;
}

function dateRange(start, end) {
  const s = formatTourDate(start);
  const e = formatTourDate(end);
  if (s && e && s !== e) return `${s}~${e}`;
  return s || e || '방문 전 확인 필요';
}

function dateRangeShort(start, end) {
  const s = formatTourDateShort(start);
  const e = formatTourDateShort(end);
  if (s && e && s !== e) return `${s}~${e}`;
  return s || e || '확인 필요';
}

function buildUrl(endpoint, extra, encodedKey) {
  const params = new URLSearchParams({ MobileOS: 'ETC', MobileApp: 'TripView', _type: 'json', ...extra });
  const key = encodedKey ? encodeURIComponent(SERVICE_KEY) : SERVICE_KEY;
  return `${API_BASE}/${endpoint}?serviceKey=${key}&${params.toString()}`;
}

async function tourGet(endpoint, extra = {}) {
  let lastError = '';
  for (const encodedKey of [false, true]) {
    const res = await fetch(buildUrl(endpoint, extra, encodedKey));
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      const header = json.response?.header;
      if (header && header.resultCode && header.resultCode !== '0000') {
        lastError = `${header.resultCode} ${header.resultMsg || ''}`.trim();
        continue;
      }
      const item = json.response?.body?.items?.item;
      return Array.isArray(item) ? item : item ? [item] : [];
    } catch {
      lastError = text.slice(0, 120);
    }
  }
  throw new Error(`Tour data request failed: ${lastError}`);
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(path.join(ROOT, file), 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(path.join(ROOT, file)), { recursive: true });
  await fs.writeFile(path.join(ROOT, file), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function existingTitles() {
  const titles = new Set();
  const entries = await fs.readdir(ROOT, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const htmlPath = path.join(ROOT, entry.name, 'index.html');
    try {
      const html = await fs.readFile(htmlPath, 'utf8');
      const title = html.match(/<title>([^<]+)/i)?.[1] || html.match(/<h1[^>]*>([^<]+)/i)?.[1];
      if (title) titles.add(norm(title.replace(/\s*\|\s*트립뷰$/, '')));
    } catch {}
  }
  try {
    titles.add(norm(await fs.readFile(path.join(ROOT, 'index.html'), 'utf8')));
  } catch {}
  return titles;
}

function hasExistingTitle(existing, candidateTitle) {
  const title = norm(candidateTitle);
  for (const existingTitle of existing) {
    if (existingTitle.includes(title) || title.includes(existingTitle)) return true;
  }
  return false;
}

function imageFamilyKey(src) {
  const clean = String(src || '').split('?')[0];
  const resource = clean.match(/\/resource\/\d+\/([^/_]+)_image\d+_\d+/i);
  if (resource) return resource[1];
  return clean.toLowerCase();
}

function addImage(images, seen, src) {
  if (!src || images.length >= MAX_IMAGES_PER_POST) return;
  const key = imageFamilyKey(src);
  if (seen.has(key)) return;
  seen.add(key);
  images.push(src);
}

async function collectImages(contentId, seedImages = []) {
  const images = [];
  const seen = new Set();
  const detailImages = await tourGet('detailImage2', { contentId, imageYN: 'Y', subImageYN: 'Y', numOfRows: '50' }).catch(() => []);
  for (const image of detailImages) {
    addImage(images, seen, image.originimgurl || image.smallimageurl);
    if (images.length >= MAX_IMAGES_PER_POST) break;
  }
  for (const src of seedImages) {
    addImage(images, seen, src);
    if (images.length >= MAX_IMAGES_PER_POST) break;
  }
  return images.slice(0, MAX_IMAGES_PER_POST);
}

function regionFromAddr(addr = '') {
  const parts = String(addr).trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
  return parts[0] || '국내';
}

function slugFor(candidate, category) {
  const prefix = category === '공연/축제' ? 'festival' : 'travel';
  return `${prefix}-${candidate.contentid}`;
}

function safeText(value, fallback) {
  const text = stripHtml(value);
  return text || fallback;
}

function buildDescription(title, category, region) {
  if (category === '공연/축제') return `${title} 일정, 장소, 운영정보, 요금, 방문 전 체크포인트를 정리했습니다.`;
  return `${title} 위치, 관람 포인트, 이동 동선, 방문 전 체크포인트를 정리했습니다.`;
}

function pickIntroFields(intro = {}) {
  const keys = [
    'eventstartdate',
    'eventenddate',
    'eventplace',
    'playtime',
    'program',
    'subevent',
    'usetimefestival',
    'sponsor1',
    'sponsor1tel',
    'sponsor2',
    'sponsor2tel',
    'parking',
    'parkingculture',
    'parkingfestival',
    'parkingleports',
    'restdate',
    'restdateculture',
    'usetime',
    'usetimeculture',
    'usetimeleports',
    'usefee',
    'expguide',
    'expagerange',
    'chkpet',
    'infocenter',
    'infocenterculture',
    'infocenterleports'
  ];
  return Object.fromEntries(keys.map((key) => [key, stripHtml(intro[key])]).filter(([, value]) => value));
}

function makeArticle(candidate, common, intro, images, category, today) {
  const title = safeText(candidate.title || common.title, '국내 여행지');
  const region = regionFromAddr(common.addr1 || candidate.addr1 || '');
  const isFestival = category === '공연/축제';
  const slug = slugFor(candidate, category);
  const start = candidate.eventstartdate || intro.eventstartdate || '';
  const end = candidate.eventenddate || intro.eventenddate || '';
  const addr = [common.addr1 || candidate.addr1 || '', common.addr2 || ''].filter(Boolean).join(' ');
  const place = intro.eventplace || addr || '방문 전 위치 확인 필요';
  const tel = common.tel || candidate.tel || intro.sponsor1tel || '방문 전 확인 필요';
  const fee = stripHtml(intro.usetimefestival) || (isFestival ? '현장 프로그램별 상이' : '시설별 상이');
  const playtime = stripHtml(intro.playtime) || '방문 전 확인 필요';
  const program = stripHtml([intro.program, intro.subevent].filter(Boolean).join(', ')) || (isFestival ? '공연, 체험, 현장 프로그램' : '관람, 산책, 주변 여행 동선');
  const overview = stripHtml(common.overview) || `${title}은 ${region}에서 방문하기 좋은 ${isFestival ? '공연/축제' : '국내여행'} 글감입니다.`;
  const articleTitle = isFestival ? `${title} ${today.getFullYear()}, 방문 전 알아둘 일정과 운영정보` : `${title}, 방문 전 알아둘 위치와 여행 동선`;
  const info = isFestival
    ? [['기간', dateRange(start, end)], ['시간', playtime], ['장소', place], ['요금', fee], ['문의', tel], ['주요 프로그램', program]]
    : [['장소', place], ['주소', addr || place], ['문의', tel], ['요금', fee], ['운영 확인', playtime], ['방문 포인트', program]];
  const memo = isFestival
    ? [`기간: ${dateRangeShort(start, end)}`, `지역: ${region}`, `유형: ${category}`, `문의: ${tel}`, '핵심 체크: 운영 시간, 체험 접수, 주차와 귀가 동선']
    : [`지역: ${region}`, `유형: ${category}`, `문의: ${tel}`, '핵심 체크: 운영 여부, 이동 시간, 주변 식사 동선'];

  const sections = isFestival ? [
    ['이번 일정에서 먼저 볼 점', [
      `${overview} 축제 방문 전에는 일정과 운영 시간을 먼저 확인하는 것이 좋습니다. 같은 행사라도 공연, 체험, 판매 부스의 운영 시간이 다를 수 있어 도착 시간을 넉넉히 잡는 편이 안전합니다.`,
      `${title}을 제대로 보려면 대표 프로그램을 하나 정하고 그 앞뒤로 식사와 이동 시간을 붙이는 방식이 좋습니다. 특히 주말에는 입장 자체보다 주차, 대기, 귀가 시간이 더 길어질 수 있습니다.`
    ]],
    ['운영정보를 자세히 보면', [
      `장소는 ${place} 기준입니다. 요금은 ${fee}로 안내되지만, 체험이나 먹거리, 판매 부스는 별도 비용이 생길 수 있습니다. 문의처는 ${tel}이며 출발 전 당일 운영 여부를 확인하면 일정 실패를 줄일 수 있습니다.`,
      `주요 프로그램은 ${program}입니다. 인기 프로그램은 현장 상황에 따라 조기 마감될 수 있으므로 입장 후 가장 먼저 시간표와 접수 위치를 확인하는 것이 좋습니다.`
    ]],
    ['방문 팁과 동선', [
      `${region}으로 이동하는 주말 일정이라면 오전 도착 또는 늦은 오후 도착처럼 혼잡 시간을 피하는 전략이 필요합니다. 아이와 함께라면 화장실, 그늘, 휴식 지점을 먼저 확인하세요.`,
      `행사 일정은 날씨와 현장 사정에 따라 조정될 수 있습니다. 실외 프로그램이 많은 날에는 모자, 물, 편한 신발을 준비하고, 야간까지 머문다면 귀가 교통을 미리 정해두는 편이 좋습니다.`
    ]]
  ] : [
    ['어떤 곳인가', [
      `${overview} 여행지 글을 볼 때는 사진만 보고 이동하기보다 실제 위치, 운영 여부, 주변 동선을 함께 확인해야 만족도가 높습니다.`,
      `${title}은 ${region} 여행 중 한 코스로 넣기 좋습니다. 오래 머무는 일정인지, 주변 식사와 카페를 붙일 일정인지에 따라 체류 시간이 달라집니다.`
    ]],
    ['방문 전 확인할 정보', [
      `위치는 ${place} 기준입니다. 문의처는 ${tel}이며, 요금과 운영은 ${fee}로 정리됩니다. 시설별 휴무나 현장 상황이 달라질 수 있어 출발 전 확인이 필요합니다.`,
      `사진 촬영을 목적으로 간다면 오전이나 늦은 오후처럼 빛이 부드러운 시간대가 좋습니다. 이동 시간이 긴 지역이라면 가까운 관광지와 식사 동선을 함께 묶는 편이 효율적입니다.`
    ]],
    ['동선과 준비물', [
      `차량 이동 시에는 주차 위치를 먼저 정하고, 대중교통 이용 시에는 마지막 귀가 시간을 확인하세요. 주말에는 주변 도로와 식당 대기가 길어질 수 있습니다.`,
      `편한 신발, 물, 날씨에 맞는 겉옷을 준비하면 현장에서 덜 지칩니다. 비가 오거나 바람이 강한 날에는 일부 야외 관람 구간을 줄이고 실내 또는 짧은 동선 위주로 조정하세요.`
    ]]
  ];

  const faq = isFestival
    ? [['무료인가요?', `요금은 ${fee}로 안내됩니다. 일부 체험과 먹거리 이용 비용은 별도일 수 있습니다.`], ['언제 도착하면 좋나요?', '대표 프로그램을 보려면 시작 시간보다 여유 있게 도착해 접수 위치와 관람 구역을 먼저 확인하는 편이 좋습니다.'], ['아이와 함께 가도 괜찮나요?', '가능합니다. 다만 실외 대기 시간이 생길 수 있어 물, 모자, 편한 신발을 준비하세요.']]
    : [['입장 전에 무엇을 확인해야 하나요?', '운영 여부, 요금, 주차 또는 대중교통 동선을 먼저 확인하는 것이 좋습니다.'], ['사진 찍기 좋은 시간은 언제인가요?', '보통 오전이나 늦은 오후가 좋습니다. 한낮에는 빛이 강하고 사람이 몰릴 수 있습니다.'], ['주변 코스를 같이 잡아도 되나요?', `${region} 안에서 식사, 카페, 산책 코스를 함께 묶으면 이동 시간이 줄어듭니다.`]];

  return {
    contentid: String(candidate.contentid),
    slug,
    title: articleTitle,
    sourceTitle: title,
    description: buildDescription(title, category, region),
    category,
    region,
    date: koreanDate(today),
    sortDate: hyphenDate(today),
    read: '약 5분',
    image: images[0],
    images,
    alt: `${title} 이미지`,
    excerpt: isFestival ? `${title}의 일정, 장소, 요금, 프로그램, 방문 전 체크포인트를 정리했습니다.` : `${title}의 위치, 운영 확인 포인트, 주변 동선을 정리했습니다.`,
    info,
    memo,
    tourApi: {
      contentTypeId: String(candidate.contentTypeId || candidate.contenttypeid || ''),
      overview: stripHtml(common.overview),
      homepage: stripHtml(common.homepage),
      mapx: common.mapx || candidate.mapx || '',
      mapy: common.mapy || candidate.mapy || '',
      mlevel: common.mlevel || '',
      intro: pickIntroFields(intro)
    },
    sections,
    faq
  };
}

function renderArticle(post) {
  const rows = post.info.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');
  const gallery = post.images.map((src, index) => `<figure class="${index === 0 ? 'cover-figure' : 'inline-figure'}"><img class="${index === 0 ? 'cover' : ''}" src="${esc(src)}" alt="${esc(`${post.sourceTitle} 이미지 ${index + 1}`)}"${index === 0 ? '' : ' loading="lazy"'} /><figcaption>출처: 한국관광공사</figcaption></figure>`).join('\n');
  const sections = post.sections.map(([heading, paragraphs]) => `<h2>${esc(heading)}</h2>${paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}`).join('');
  const faqs = post.faq.map(([q, a]) => `<details open><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('');
  const memo = post.memo.map((m) => `<span>${esc(m)}</span>`).join('');
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta name="naver-site-verification" content="38616b4b4209994ed384d0d2439bddcbec2cc711" />
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8468106244002167"
     crossorigin="anonymous"></script>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${esc(post.description)}" />
    <meta property="og:title" content="${esc(post.title)} | 트립뷰" />
    <meta property="og:description" content="${esc(post.excerpt)}" />
    <meta property="og:image" content="${esc(post.image)}" />
    <title>${esc(post.title)} | 트립뷰</title>
    <style>
      :root{--ink:#111;--muted:#666;--line:#ddd;--soft:#f5f5f5;--paper:#fff}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;color:var(--ink);font-family:Arial,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;line-height:1.72;background:var(--paper)}a{color:inherit;text-decoration:none}img{display:block;max-width:100%;object-fit:cover}.wrap{width:min(1100px,calc(100% - 32px));margin:auto}.top{position:fixed;top:0;left:0;right:0;z-index:20;background:transparent;transition:background .2s ease,box-shadow .2s ease,backdrop-filter .2s ease}.top.is-scrolled{background:rgba(255,255,255,.86);backdrop-filter:blur(16px);box-shadow:0 1px 18px rgba(0,0,0,.08)}.nav{min-height:68px;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{font-size:22px;font-weight:900}.links{display:flex;flex-wrap:wrap;gap:18px;color:#222;font-size:14px;font-weight:800}.hero{padding:112px 0 28px}.hero h1{max-width:920px;margin:0 0 12px;font-size:clamp(32px,5vw,50px);line-height:1.18;letter-spacing:0}.meta{display:flex;flex-wrap:wrap;gap:12px;color:var(--muted);font-size:14px;font-weight:700}.cover-figure{margin:0 auto;width:min(1100px,calc(100% - 32px))}.cover{width:100%;max-height:540px}.layout{display:grid;grid-template-columns:minmax(0,1fr)290px;gap:46px;align-items:start;padding:36px 0 60px}.content{max-width:760px;font-size:18px}.content p{margin:0 0 20px}.content h2{margin:38px 0 13px;font-size:26px;letter-spacing:0}.info-table{width:100%;margin:0 0 34px;border-collapse:collapse;font-size:16px}.info-table th,.info-table td{padding:12px 0;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}.info-table th{width:140px;background:transparent;font-weight:900}.info-table tr:last-child th,.info-table tr:last-child td{border-bottom:0}.cover-figure figcaption,.inline-figure figcaption,.note{margin-top:9px;color:var(--muted);font-size:14px}.inline-figure{margin:26px 0}.inline-figure img{width:100%;max-height:520px}.note{padding:0;margin-top:22px;color:var(--muted);font-size:15px}.aside{position:sticky;top:90px;display:grid;gap:12px;padding:0 0 0 20px;border-left:1px solid var(--line);color:var(--muted);font-size:15px}.aside strong{color:var(--ink)}details{border-top:1px solid var(--line)}details:last-child{border-bottom:1px solid var(--line)}summary{cursor:pointer;padding:16px 0;font-weight:900}details p{color:var(--muted)}footer{border-top:1px solid var(--line);padding:28px 0 42px;color:var(--muted)}@media(max-width:820px){.layout{grid-template-columns:1fr}.aside{position:static;padding:18px 0 0;border-left:0;border-top:1px solid var(--line)}.nav{align-items:flex-start;flex-direction:column;justify-content:center;gap:8px;min-height:96px;padding:14px 0}.links{display:flex;flex-wrap:wrap;gap:14px}.hero{padding-top:126px}.content{font-size:17px}.info-table th{width:108px}}
    </style>
  </head>
  <body>
    <header class="top"><div class="wrap nav"><a class="brand" href="../">트립뷰</a><nav class="links" aria-label="주요 메뉴"><a href="../">홈</a><a href="../#popular">지금 많이 찾는 여행지</a><a href="../#weekend">이번 주말 가볼만한 곳</a><a href="../#festival">7~8월 축제/행사</a><a href="../#water">물놀이·계곡·해수욕장</a><a href="../#indoor">비 오는 날 실내 여행</a><a href="../#family">아이와 가기 좋은 곳</a><a href="../#booking">예약 전 체크</a></nav></div></header>
    <main>
      <section class="wrap hero"><h1>${esc(post.title)}</h1><div class="meta"><span>트립뷰 편집팀</span><span>${esc(post.date)}</span><span>${esc(post.read)}</span><span>${esc(post.region)}</span></div></section>
      ${gallery}
      <section class="wrap layout"><article class="content"><table class="info-table"><tbody>${rows}</tbody></table>${sections}<h2>자주 묻는 질문</h2>${faqs}<p class="note">일정, 세부 프로그램, 체험 접수, 요금은 현장 사정에 따라 달라질 수 있습니다. 출발 전 문의처와 당일 공지를 한 번 더 확인하면 이동 실패를 줄일 수 있습니다.</p></article><aside class="aside"><strong>운영 메모</strong>${memo}<a href="../">목록으로 돌아가기</a></aside></section>
    </main>
    <footer><div class="wrap"><strong>트립뷰</strong><p>오늘 바로 움직일 수 있는 여행 큐레이션.</p></div></footer>
    <script>const header=document.querySelector('.top');const syncHeader=()=>header.classList.toggle('is-scrolled',window.scrollY>24);syncHeader();window.addEventListener('scroll',syncHeader,{passive:true});</script>
  </body>
</html>
`;
}

function card(post, className = 'card', heading = 'h3') {
  return `<a class="${className}" href="/${esc(post.slug)}/"><img src="${esc(post.image)}" alt="${esc(post.alt || post.title)}" /><small>${esc(post.category)}</small><${heading}>${esc(post.title)}</${heading}><p>${esc(post.excerpt)}</p><div class="meta"><span>${esc(post.date)}</span><span>${esc(post.read)}</span><span>${esc(post.region)}</span></div></a>`;
}

function renderIndex(posts) {
  const list = posts.slice(0, 10);
  const primary = list[0] || SEED_POSTS[0];
  const side = list.slice(1, 3).map((post) => card(post, '', 'h3')).join('');
  const grid = list.slice(3, 10).map((post) => card(post, 'card', 'h3')).join('');
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta name="naver-site-verification" content="38616b4b4209994ed384d0d2439bddcbec2cc711" />
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8468106244002167"
     crossorigin="anonymous"></script>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="트립뷰는 지금 바로 움직일 수 있는 국내여행과 공연/축제 글감을 큐레이션합니다." />
    <meta name="theme-color" content="#ffffff" />
    <meta property="og:title" content="트립뷰 - 최신 여행 큐레이션" />
    <meta property="og:description" content="오늘 기준으로 다녀오기 좋은 국내여행과 공연/축제 글감을 정리합니다." />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="${esc(primary.image)}" />
    <title>트립뷰 - 최신 여행 큐레이션</title>
    <style>
      :root{--ink:#111;--muted:#666;--line:#ddd;--soft:#f5f5f5;--paper:#fff}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--paper);color:var(--ink);font-family:Arial,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;line-height:1.6}a{color:inherit;text-decoration:none}img{display:block;width:100%;object-fit:cover}.wrap{width:min(1080px,calc(100% - 32px));margin:0 auto}.top{position:fixed;inset:0 0 auto;z-index:30;background:transparent;transition:background 180ms ease,backdrop-filter 180ms ease,-webkit-backdrop-filter 180ms ease}.top.is-scrolled{background:rgba(255,255,255,.86);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px)}.nav{min-height:72px;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand{font-size:22px;font-weight:900}.links{display:flex;gap:24px;color:#333;font-size:14px;font-weight:700}.hero{padding:112px 0 52px;border-bottom:1px solid var(--line)}.hero-head{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:24px}.hero h1{margin:0;font-size:clamp(32px,5vw,54px);line-height:1.05;letter-spacing:0}.hero-head a{color:var(--muted);font-size:14px;font-weight:800}.latest-layout{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(300px,.75fr);gap:32px;align-items:stretch}.latest-primary,.latest-side a,.card{display:grid;gap:12px}.latest-primary img{aspect-ratio:1.35/1;background:var(--soft)}.latest-primary h2{margin:0;font-size:clamp(28px,4vw,42px);line-height:1.16;letter-spacing:0}.latest-primary p,.card p{margin:0;color:#444}.latest-side{display:grid;gap:24px;align-content:start}.latest-side img{aspect-ratio:1.65/1;background:var(--soft)}.latest-side h3,.card h3{margin:0;font-size:19px;line-height:1.35;letter-spacing:0}small{color:var(--muted);font-weight:800}.meta{display:flex;flex-wrap:wrap;gap:12px;color:var(--muted);font-size:14px}.section{padding:52px 0;border-bottom:1px solid var(--line)}.section h2{margin:0 0 24px;font-size:28px;letter-spacing:0}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:28px}.card img{aspect-ratio:1.45/1;background:var(--soft)}footer{padding:36px 0 48px;color:var(--muted)}.foot{display:grid;grid-template-columns:1.4fr .8fr .8fr;gap:24px}.foot h3{margin:0 0 8px;color:var(--ink);font-size:15px}.foot div{display:grid;align-content:start;gap:7px}@media(max-width:880px){.nav{align-items:flex-start;flex-direction:column;justify-content:center;gap:8px;min-height:86px;padding:14px 0}.links{flex-wrap:wrap;gap:14px}.hero{padding:120px 0 40px}.hero-head{align-items:start;flex-direction:column}.latest-layout,.grid,.foot{grid-template-columns:1fr}}
    </style>
  </head>
  <body>
    <header class="top"><div class="wrap nav"><a class="brand" href="#top" aria-label="트립뷰 홈">트립뷰</a><nav class="links" aria-label="주요 메뉴"><a href="#latest">최신글</a><a href="#routes">전체글</a><a href="#routes">국내여행</a><a href="#routes">공연/축제</a></nav></div></header>
    <main id="top"><section class="wrap hero" id="latest" aria-labelledby="latestTitle"><div class="hero-head"><h1 id="latestTitle">최신글</h1><a href="#routes">전체글 보기</a></div><div class="latest-layout">${card(primary, 'latest-primary', 'h2')}<div class="latest-side">${side}</div></div></section><section class="wrap section" id="routes"><h2>전체글</h2><div class="grid">${grid}</div></section></main>
    <footer><div class="wrap foot"><div><strong>트립뷰</strong><p>유명 관광지 소개보다 실제로 움직이기 쉬운 여행 루트를 큐레이션합니다.</p></div><div><h3>탐색</h3><a href="#latest">최신글</a><a href="#routes">전체글</a></div><div><h3>카테고리</h3><a href="#routes">국내여행</a><a href="#routes">공연/축제</a></div></div></footer>
    <script>const header=document.querySelector('.top');const syncHeader=()=>header.classList.toggle('is-scrolled',window.scrollY>8);window.addEventListener('scroll',syncHeader,{passive:true});syncHeader();</script>
  </body>
</html>
`;
}

function uniquePosts(posts) {
  const seenSlug = new Set();
  const seenTitle = new Set();
  const seenImage = new Set();
  const result = [];
  for (const post of posts) {
    if (!post || !post.slug || !post.title || !post.image) continue;
    const t = norm(post.title);
    const i = imageFamilyKey(post.image);
    if (seenSlug.has(post.slug) || seenTitle.has(t) || seenImage.has(i)) continue;
    seenSlug.add(post.slug);
    seenTitle.add(t);
    seenImage.add(i);
    result.push(post);
  }
  return result;
}

function renderSitemap(posts, today) {
  const urls = [
    '/',
    ...posts.map((post) => `/${post.slug}/`),
    '/sejong-culture-center-jochiwon/',
    '/privacy.html'
  ];
  const seen = new Set();
  const body = urls.filter((url) => {
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  }).map((url) => `  <url><loc>${SITE_URL}${url}</loc><lastmod>${today}</lastmod></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

async function fetchCandidates(today) {
  const buckets = [
    { items: [], category: '국내여행', contentTypeId: '12' },
    { items: [], category: '국내여행', contentTypeId: '14' },
    { items: [], category: '공연/축제', contentTypeId: '15' },
    { items: [], category: '국내여행', contentTypeId: '25' },
    { items: [], category: '국내여행', contentTypeId: '28' },
    { items: [], category: '숙소/예약', contentTypeId: '32' },
    { items: [], category: '생활정보', contentTypeId: '39' },
    { items: [], category: '생활정보', contentTypeId: '38' }
  ];
  const byId = new Set();
  const addToBucket = (bucket, item) => {
    if (!item?.contentid || byId.has(String(item.contentid))) return;
    byId.add(String(item.contentid));
    bucket.items.push({ ...item, category: bucket.category, contentTypeId: bucket.contentTypeId });
  };
  const targetPool = Math.max(POST_LIMIT * 8, 240);
  const bucketTarget = Math.max(POST_LIMIT * 3, 30);
  const festivalBucket = buckets.find((bucket) => bucket.contentTypeId === '15');
  for (const pageNo of ['1', '2', '3', '4', '5']) {
    const festivals = await tourGet('searchFestival2', {
      eventStartDate: ymd(today),
      eventEndDate: ymd(addDays(today, 180)),
      arrange: 'D',
      numOfRows: '100',
      pageNo
    });
    for (const item of festivals) addToBucket(festivalBucket, item);
    if (festivalBucket.items.length >= bucketTarget) break;
  }

  const contentPools = buckets.filter((bucket) => bucket.contentTypeId !== '15');
  for (const pool of contentPools) {
    for (const arrange of ['Q', 'R', 'D', 'P']) {
        for (const pageNo of ['1', '2', '3', '4', '5']) {
          const items = await tourGet('areaBasedList2', { contentTypeId: pool.contentTypeId, arrange, numOfRows: '100', pageNo });
          for (const item of items) addToBucket(pool, item);
          if (pool.items.length >= bucketTarget) break;
        }
        if (pool.items.length >= bucketTarget) break;
    }
  }

  const candidates = [];
  while (candidates.length < targetPool && buckets.some((bucket) => bucket.items.length)) {
    for (const bucket of buckets) {
      const item = bucket.items.shift();
      if (item) candidates.push(item);
      if (candidates.length >= targetPool) break;
    }
  }
  return candidates;
}

async function buildPosts() {
  const today = kstNow();
  const posted = await readJson('data/tour-posted.json', { items: [] });
  const generated = await readJson('data/generated-posts.json', []);
  const postedIds = new Set((posted.items || []).map((item) => String(item.contentid)).filter(Boolean));
  const titles = await existingTitles();
  const candidates = await fetchCandidates(today);
  const newPosts = [];

  for (const candidate of candidates) {
    if (newPosts.length >= POST_LIMIT) break;
    const contentid = String(candidate.contentid || '');
    if (!contentid || postedIds.has(contentid)) continue;
    if (hasExistingTitle(titles, candidate.title || '')) continue;
    const common = (await tourGet('detailCommon2', { contentId: contentid, contentTypeId: candidate.contentTypeId, defaultYN: 'Y', firstImageYN: 'Y', addrinfoYN: 'Y', overviewYN: 'Y', mapinfoYN: 'Y', areacodeYN: 'Y' }).catch(() => []))[0] || {};
    const intro = (await tourGet('detailIntro2', { contentId: contentid, contentTypeId: candidate.contentTypeId }).catch(() => []))[0] || {};
    const images = await collectImages(contentid, [candidate.firstimage, candidate.firstimage2, common.firstimage, common.firstimage2]);
    if (!images.length) continue;
    const post = makeArticle(candidate, common, intro, images, candidate.category, today);
    if (hasExistingTitle(titles, post.sourceTitle) || hasExistingTitle(titles, post.title)) continue;
    await fs.mkdir(path.join(ROOT, post.slug), { recursive: true });
    await fs.writeFile(path.join(ROOT, post.slug, 'index.html'), renderArticle(post), 'utf8');
    newPosts.push(post);
    postedIds.add(contentid);
    titles.add(norm(post.title));
  }

  const generatedPosts = uniquePosts([...newPosts, ...generated]);
  const homepagePosts = uniquePosts([...generatedPosts, ...SEED_POSTS]);
  await fs.writeFile(path.join(ROOT, 'index.html'), renderIndex(homepagePosts), 'utf8');
  await fs.writeFile(path.join(ROOT, 'sitemap.xml'), renderSitemap(homepagePosts, hyphenDate(today)), 'utf8');
  await writeJson('data/generated-posts.json', generatedPosts);
  await writeJson('data/tour-posted.json', {
    updatedAt: new Date().toISOString(),
    items: [...(posted.items || []), ...newPosts.map((post) => ({ contentid: post.contentid, slug: post.slug, title: post.sourceTitle, createdAt: new Date().toISOString() }))]
  });

  console.log(`Generated ${newPosts.length} post(s).`);
  for (const post of newPosts) console.log(`- ${post.title} (${post.images.length} image(s))`);
}

await buildPosts();
