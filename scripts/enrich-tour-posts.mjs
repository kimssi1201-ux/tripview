import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SITE_URL = 'https://tripview.kr';
const TODAY = '2026-06-06';
const OPENAI_API_URL = 'https://api.openai.com/v1/responses';
const AI_PROMPT_VERSION = 1;
const RAW_OPENAI_TIMEOUT_MS = Number.parseInt(process.env.OPENAI_TIMEOUT_MS ?? '90000', 10);
const OPENAI_TIMEOUT_MS = Math.max(15000, Number.isFinite(RAW_OPENAI_TIMEOUT_MS) ? RAW_OPENAI_TIMEOUT_MS : 90000);

const MANUAL_POSTS = [
  'gochang-tidal-flat-festival-2026',
  'geoje-okpo-victory-festival-2026',
  'gangju-sunflower-festival-2026',
  'goyang-haengju-cultural-festival-2026',
  'gwangalli-eobang-festival-2026',
  'gyeonggi-rice-gimbap-festa-2026',
  'gyeongsan-jain-danoje-2026',
  'gangjin-hydrangea-road-festival-2026',
  'gongju-yugu-hydrangea-garden-festival-2026',
  'sejong-culture-center-jochiwon'
];

const esc = (value = '') => String(value).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const strip = (value = '') => String(value).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

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

async function loadLocalEnv() {
  const file = path.join(ROOT, '.env');
  let text = '';
  try {
    text = await fs.readFile(file, 'utf8');
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (!process.env[key]) {
      process.env[key] = rest.join('=').replace(/^["']|["']$/g, '');
    }
  }
}

function infoValue(post, label) {
  const row = (post.info || []).find(([key]) => key === label);
  return strip(row?.[1] || '');
}

function programItems(post) {
  const raw = infoValue(post, '주요 프로그램') || infoValue(post, '방문 포인트') || '현장 프로그램, 관람, 주변 동선 확인';
  return raw
    .replace(/\d+\.\s*/g, ' ')
    .replace(/주요 프로그램\s*:/g, '')
    .replace(/공연 프로그램\s*:/g, '')
    .replace(/부대행사\s*:/g, '')
    .split(/[,·ㆍ/]| 등\s*/)
    .map((item) => strip(item))
    .filter((item) => item.length >= 2)
    .slice(0, 8);
}

function programSentence(post) {
  const items = programItems(post);
  if (!items.length) return '현장 프로그램과 관람 동선을 함께 확인하는 것이 좋습니다.';
  if (items.length === 1) return `${items[0]}을 중심으로 일정을 잡으면 좋습니다.`;
  return `${items.slice(0, -1).join(', ')}와 ${items.at(-1)}을 중심으로 볼 수 있습니다.`;
}

function sourceTitle(post) {
  return strip(post.sourceTitle || post.title || '국내 여행지').replace(/\s*\|\s*트립뷰$/, '');
}

function titleWithYear(post) {
  const base = sourceTitle(post);
  if (post.category === '공연/축제') {
    return /20\d{2}/.test(base) ? `${base}, 방문 전 알아둘 일정과 운영정보` : `${base} 2026, 방문 전 알아둘 일정과 운영정보`;
  }
  return `${base}, 방문 전 알아둘 위치와 여행 동선`;
}

function buildFestivalSections(post) {
  const title = sourceTitle(post);
  const region = strip(post.region || '국내');
  const period = infoValue(post, '기간') || '방문 전 확인 필요';
  const time = infoValue(post, '시간') || '방문 전 확인 필요';
  const place = infoValue(post, '장소') || '방문 전 위치 확인 필요';
  const fee = infoValue(post, '요금') || '현장 프로그램별 상이';
  const tel = infoValue(post, '문의') || '방문 전 확인 필요';
  const programs = programSentence(post);

  return [
    ['한눈에 보는 방문 포인트', [
      `${title}은 ${region}에서 일정과 체험을 함께 챙겨볼 수 있는 공연/축제 방문 안내입니다. 처음 방문하는 사람에게 중요한 건 이름보다 실제로 언제 가야 하는지, 어디에서 열리는지, 비용이 어떻게 나뉘는지입니다. 이 글은 그 부분을 먼저 볼 수 있게 정리했습니다.`,
      `축제는 현장 분위기가 좋아도 동선이 꼬이면 만족도가 금방 떨어집니다. 대표 프로그램을 하나 정하고, 그 앞뒤로 도착 시간, 식사 시간, 귀가 시간을 붙여두면 짧은 일정에서도 훨씬 여유 있게 움직일 수 있습니다.`
    ]],
    ['일정과 운영 흐름', [
      `기간은 ${period}이며 운영 시간은 ${time} 기준입니다. 같은 행사 안에서도 공연, 체험, 판매 부스의 시작 시간이 다를 수 있으니 도착 후에는 전체 시간표부터 확인하는 편이 좋습니다.`,
      `장소는 ${place}입니다. 처음 방문한다면 행사장 입구, 안내 부스, 화장실, 주차 또는 대중교통 귀가 지점을 먼저 잡아두세요. 특히 야간까지 머무는 일정이라면 돌아가는 길을 미리 정해두는 것이 중요합니다.`
    ]],
    ['프로그램을 고르는 법', [
      `주요 구성은 ${programs} 단순히 많이 보는 것보다 내 일정에 맞는 프로그램을 고르는 게 낫습니다. 아이와 함께라면 체험형 프로그램을, 늦은 오후 방문이라면 공연과 야간 분위기를 우선으로 잡는 방식이 좋습니다.`,
      `인기 프로그램은 현장 접수나 선착순 운영일 수 있습니다. 입장 직후 접수 위치를 확인하고, 대기 시간이 길어질 경우를 대비해 다음으로 볼 프로그램을 하나 더 정해두면 일정이 덜 흔들립니다.`
    ]],
    ['비용과 준비물', [
      `요금은 ${fee}로 안내됩니다. 다만 무료 행사라도 체험, 먹거리, 판매 부스는 별도 비용이 생길 수 있으니 현금과 카드 결제 가능 여부를 함께 생각해두는 것이 좋습니다.`,
      `야외 축제라면 편한 신발, 물, 모자, 얇은 겉옷을 기본으로 챙기세요. 물놀이 또는 체험형 프로그램이 있는 행사라면 수건과 여벌 옷까지 준비하면 현장에서 훨씬 편합니다.`
    ]],
    ['교통과 현장 동선', [
      `${region} 주말 일정은 도착보다 귀가가 더 오래 걸리는 경우가 많습니다. 차량 이동이라면 행사장 바로 앞 주차만 고집하지 말고, 조금 떨어진 주차 후 도보 이동까지 선택지에 넣어두세요.`,
      `대중교통을 이용한다면 마지막 열차나 버스 시간을 먼저 확인하세요. 축제 종료 직후에는 사람이 한 번에 빠져나가므로, 근처 카페나 식당에서 20~30분 정도 쉬었다가 이동하는 것도 현실적인 방법입니다.`
    ]],
    ['방문 전 마지막 확인', [
      `문의처는 ${tel}입니다. 날씨, 안전 관리, 현장 혼잡에 따라 세부 프로그램이 조정될 수 있으니 출발 전 당일 공지를 확인하면 불필요한 이동을 줄일 수 있습니다.`,
      `이 글의 핵심은 하나입니다. ${title}을 보러 간다면 기간과 장소만 확인하고 출발하지 말고, 보고 싶은 프로그램, 대기 가능 시간, 귀가 동선까지 같이 잡아야 실제 방문 만족도가 올라갑니다.`
    ]]
  ];
}

function buildTravelSections(post) {
  const title = sourceTitle(post);
  const region = strip(post.region || '국내');
  const place = infoValue(post, '장소') || infoValue(post, '주소') || '방문 전 위치 확인 필요';
  const fee = infoValue(post, '요금') || '시설별 상이';
  const tel = infoValue(post, '문의') || '방문 전 확인 필요';
  const point = programSentence(post);

  return [
    ['어떤 일정에 넣기 좋은 곳인가', [
      `${title}은 ${region} 여행 중 한 코스로 넣기 좋은 국내여행 일정 안내입니다. 사진만 보고 정하기보다 실제 위치, 이동 시간, 주변 식사 동선을 함께 보면 훨씬 안정적인 일정이 됩니다.`,
      `오래 머무는 목적지인지, 다른 장소와 묶어 짧게 들를 곳인지에 따라 만족도가 달라집니다. 처음 방문한다면 무리하게 여러 곳을 넣기보다 핵심 구간을 하나 정하고 주변 코스를 붙이는 편이 좋습니다.`
    ]],
    ['위치와 운영 확인', [
      `위치는 ${place} 기준입니다. 문의처는 ${tel}이며, 요금은 ${fee}로 정리됩니다. 현장 운영이나 휴무, 입장 가능 여부는 계절과 요일에 따라 달라질 수 있습니다.`,
      `출발 전 지도에서 주차장, 입구, 가까운 정류장을 같이 확인하세요. 목적지 이름만 검색해서 이동하면 입구와 먼 지점에 도착하는 경우가 있어 실제 동선이 길어질 수 있습니다.`
    ]],
    ['관람 포인트', [
      `방문 포인트는 ${point} 사진 촬영을 목적으로 간다면 오전이나 늦은 오후처럼 빛이 부드러운 시간대가 좋고, 한낮에는 그늘과 휴식 지점을 먼저 생각해야 합니다.`,
      `아이 또는 어르신과 함께라면 이동 거리를 줄이는 것이 중요합니다. 걷는 구간이 길어지는 코스는 중간에 쉬어갈 카페나 식당을 미리 정해두면 일정이 훨씬 부드러워집니다.`
    ]],
    ['주변 동선 만들기', [
      `${region} 안에서 식사, 카페, 산책 코스를 함께 묶으면 이동 시간이 줄어듭니다. 한 장소에 너무 오래 머물기보다 점심 전후로 나눠 움직이면 피로가 덜합니다.`,
      `차량 이동이라면 주차 위치를 사진으로 남겨두세요. 대중교통 이동이라면 돌아오는 시간표를 먼저 확인하고, 막차나 배차 간격이 긴 노선은 여유를 두는 것이 좋습니다.`
    ]],
    ['준비물과 체크포인트', [
      `편한 신발, 물, 날씨에 맞는 겉옷은 기본입니다. 비가 오거나 바람이 강한 날에는 야외 구간을 줄이고 실내 또는 짧은 동선 위주로 바꾸는 편이 안전합니다.`,
      `방문 직전에는 운영 여부와 요금을 한 번 더 확인하세요. 작은 차이처럼 보여도 휴무, 공사, 현장 통제 여부에 따라 실제 일정은 크게 달라질 수 있습니다.`
    ]]
  ];
}

function buildFaq(post) {
  const title = sourceTitle(post);
  const fee = infoValue(post, '요금') || '현장 상황에 따라 달라질 수 있습니다';
  const time = infoValue(post, '시간') || infoValue(post, '운영 확인') || '방문 전 확인 필요';
  const tel = infoValue(post, '문의') || '방문 전 확인 필요';
  if (post.category === '공연/축제') {
    return [
      ['입장료가 있나요?', `요금은 ${fee}로 안내됩니다. 먹거리, 체험, 판매 부스 이용 비용은 별도로 발생할 수 있습니다.`],
      ['언제 도착하면 좋나요?', `운영 시간은 ${time} 기준입니다. 대표 프로그램을 보려면 시작 시간보다 여유 있게 도착해 안내 부스와 접수 위치를 먼저 확인하세요.`],
      ['아이와 함께 가도 괜찮나요?', '가능합니다. 다만 대기 시간이 길어질 수 있어 물, 모자, 간단한 간식, 편한 신발을 준비하는 편이 좋습니다.'],
      ['비가 오면 어떻게 하나요?', '실외 프로그램은 날씨에 따라 조정될 수 있습니다. 출발 전 당일 공지와 문의처를 확인하세요.'],
      ['문의는 어디로 하나요?', `${title} 관련 문의는 ${tel}로 확인하는 것이 가장 빠릅니다.`]
    ];
  }
  return [
    ['방문 전에 무엇을 확인해야 하나요?', '운영 여부, 요금, 주차 또는 대중교통 동선을 먼저 확인하는 것이 좋습니다.'],
    ['사진 찍기 좋은 시간은 언제인가요?', '보통 오전이나 늦은 오후가 좋습니다. 한낮에는 빛이 강하고 사람이 몰릴 수 있습니다.'],
    ['주변 코스를 같이 잡아도 되나요?', '식사, 카페, 산책 코스를 함께 묶으면 이동 시간이 줄고 일정 만족도가 올라갑니다.'],
    ['아이와 함께 가도 괜찮나요?', '가능하지만 걷는 구간과 휴식 지점을 먼저 확인하세요.'],
    ['문의는 어디로 하나요?', `${title} 관련 문의는 ${tel}로 확인하세요.`]
  ];
}

function enrichPost(post) {
  if (post.manualWaterPostVersion && Array.isArray(post.sections) && post.sections.length >= 4) {
    return post;
  }

  const title = titleWithYear(post);
  const base = sourceTitle(post);
  const isFestival = post.category === '공연/축제';
  const fallback = {
    description: isFestival
      ? `${base} 일정, 장소, 운영시간, 비용, 프로그램 선택법, 교통과 방문 준비물을 자세히 정리했습니다.`
      : `${base} 위치, 운영 확인, 관람 포인트, 주변 동선과 준비물을 자세히 정리했습니다.`,
    excerpt: isFestival
      ? `${base} 방문 전 필요한 일정, 운영정보, 프로그램 고르는 법, 준비물과 귀가 동선까지 한 번에 정리했습니다.`
      : `${base} 방문 전 필요한 위치, 운영 확인, 관람 포인트와 주변 동선을 한 번에 정리했습니다.`,
    sections: isFestival ? buildFestivalSections(post) : buildTravelSections(post),
    faq: buildFaq(post)
  };

  if (post.aiEnrichedVersion === AI_PROMPT_VERSION && Array.isArray(post.sections) && post.sections.length >= 4) {
    return {
      ...post,
      title: post.title || title,
      read: post.read || '약 9분',
      description: post.description || fallback.description,
      excerpt: post.excerpt || fallback.excerpt,
      sections: post.sections,
      faq: Array.isArray(post.faq) && post.faq.length ? post.faq : fallback.faq
    };
  }

  return {
    ...post,
    title,
    read: '약 7분',
    ...fallback
  };
}

function outputText(response) {
  if (typeof response.output_text === 'string') return response.output_text;
  return (response.output || [])
    .flatMap((item) => item.content || [])
    .map((content) => content.text || content.output_text || '')
    .filter(Boolean)
    .join('\n');
}

function parseAiJson(text) {
  const cleaned = String(text || '').replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('AI response did not contain JSON.');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function cleanAiText(value, limit = 1200) {
  return strip(value)
    .replace(/\bTourAPI\b/gi, '')
    .replace(/\bOpenAI\b/gi, '')
    .replace(/\bAPI\b/g, '')
    .replace(/한국관광공사\s*(제공|검색 결과|데이터|정보)?/g, '공식 관광 정보')
    .replace(/\s+/g, ' ')
    .slice(0, limit)
    .trim();
}

function normalizeAiSections(sections) {
  return (Array.isArray(sections) ? sections : [])
    .map((section) => {
      const heading = cleanAiText(section.heading || section[0] || '', 80);
      const paragraphs = Array.isArray(section.paragraphs) ? section.paragraphs : section[1];
      return [
        heading,
        (Array.isArray(paragraphs) ? paragraphs : [])
          .map((paragraph) => cleanAiText(paragraph, 700))
          .filter((paragraph) => paragraph.length >= 40)
          .slice(0, 3)
      ];
    })
    .filter(([heading, paragraphs]) => heading && paragraphs.length >= 2)
    .slice(0, 7);
}

function normalizeAiFaq(faq) {
  return (Array.isArray(faq) ? faq : [])
    .map((item) => [
      cleanAiText(item.question || item.q || item[0] || '', 100),
      cleanAiText(item.answer || item.a || item[1] || '', 500)
    ])
    .filter(([question, answer]) => question && answer.length >= 20)
    .slice(0, 6);
}

function aiPrompt(post) {
  const context = {
    title: sourceTitle(post),
    currentTitle: post.title,
    category: post.category,
    region: post.region,
    date: post.date,
    info: Object.fromEntries((post.info || []).map(([key, value]) => [key, value])),
    memo: post.memo || [],
    imageCount: (post.images || []).filter(Boolean).length
  };
  return `트립뷰 여행 매거진 글을 한국어로 보강해줘.

조건:
- 독자가 방문 전 궁금해할 운영 정보, 동선, 준비물, 혼잡 회피, 가족/커플/혼자 방문 팁을 구체적으로 쓴다.
- 입력 데이터에 없는 확정 일정, 가격, 주차 가능 여부를 지어내지 않는다. 모르면 "방문 전 공식 공지 확인"처럼 쓴다.
- TourAPI, API, OpenAI, 자동 생성, 검색 결과 같은 내부 제작 과정은 절대 쓰지 않는다.
- 이미지 설명이나 출처 안내 문장은 쓰지 않는다.
- 광고성 과장 문구보다 실제 방문 판단에 도움되는 문장으로 쓴다.
- 전체 본문은 공백 포함 약 1800~2200자 분량이 되게 한다.
- JSON만 반환한다.

JSON 형식:
{
  "title": "현재 제목과 같은 의미의 자연스러운 제목",
  "description": "검색 결과용 120~160자 설명",
  "excerpt": "카드용 80~120자 요약",
  "read": "약 8분",
  "sections": [
    {"heading": "소제목", "paragraphs": ["문단", "문단"]}
  ],
  "faq": [
    {"question": "질문", "answer": "답변"}
  ]
}

섹션은 5~6개, 각 섹션 문단은 2개씩 작성한다. FAQ는 4~5개 작성한다.

입력 데이터:
${JSON.stringify(context, null, 2)}`;
}

async function openAiEnrichPost(post) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return post;

  const model = process.env.OPENAI_MODEL || 'gpt-5.5';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        input: [
          {
            role: 'developer',
            content: [{ type: 'input_text', text: 'You write practical Korean travel magazine articles. Return valid JSON only.' }]
          },
          {
            role: 'user',
            content: [{ type: 'input_text', text: aiPrompt(post) }]
          }
        ],
        max_output_tokens: 2200
      })
    });
  } catch (error) {
    if (error.name === 'AbortError') throw new Error(`OpenAI request timed out after ${Math.round(OPENAI_TIMEOUT_MS / 1000)}s`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.error?.message || `${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  const parsed = parseAiJson(outputText(payload));
  const sections = normalizeAiSections(parsed.sections);
  const faq = normalizeAiFaq(parsed.faq);
  if (sections.length < 4 || faq.length < 3) throw new Error('AI response did not meet article shape requirements.');

  return {
    ...post,
    title: cleanAiText(parsed.title, 90) || post.title,
    description: cleanAiText(parsed.description, 170) || post.description,
    excerpt: cleanAiText(parsed.excerpt, 130) || post.excerpt,
    read: cleanAiText(parsed.read, 20) || '약 8분',
    sections,
    faq,
    aiEnrichedVersion: AI_PROMPT_VERSION,
    aiEnrichedAt: new Date().toISOString()
  };
}

async function applyOpenAiEnrichment(posts) {
  await loadLocalEnv();
  if (!process.env.OPENAI_API_KEY) {
    console.log('OPENAI_API_KEY is not set. Skipping AI enrichment.');
    return posts;
  }

  const rawLimit = Number.parseInt(process.env.OPENAI_ENRICH_LIMIT ?? '10', 10);
  const limit = Math.max(0, Number.isFinite(rawLimit) ? rawLimit : 10);
  if (limit === 0) {
    console.log('OPENAI_ENRICH_LIMIT is 0. Skipping AI enrichment.');
    return posts;
  }
  let changed = 0;
  let attempted = 0;
  const next = [];
  for (const post of posts) {
    if (post.manualWaterPostVersion || attempted >= limit || post.aiEnrichedVersion === AI_PROMPT_VERSION) {
      next.push(post);
      continue;
    }
    attempted += 1;
    try {
      const enriched = await openAiEnrichPost(post);
      next.push(enriched);
      if (enriched !== post && enriched.aiEnrichedVersion === AI_PROMPT_VERSION) changed += 1;
      console.log(`AI enriched: ${post.slug}`);
    } catch (error) {
      console.warn(`AI enrichment skipped for ${post.slug}: ${error.message}`);
      next.push(post);
    }
  }
  console.log(`AI enrichment complete. Attempted ${attempted}, updated ${changed} post(s).`);
  return next;
}

function renderArticle(post, counts = { total: 0, categories: {} }) {
  const rows = (post.info || []).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');
  const gallery = (post.images || [post.image]).filter(Boolean).map((src, index) => `<figure class="${index === 0 ? 'cover-figure' : 'inline-figure'}"><img class="${index === 0 ? 'cover' : ''}" src="${esc(src)}" alt="${esc(`${sourceTitle(post)} 이미지 ${index + 1}`)}"${index === 0 ? '' : ' loading="lazy"'} /><figcaption>출처: 한국관광공사</figcaption></figure>`).join('\n');
  const sections = (post.sections || []).map(([heading, paragraphs]) => `<h2>${esc(heading)}</h2>${paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}`).join('');
  const faqs = (post.faq || []).map(([q, a]) => `<details open><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('');
  const memo = (post.memo || []).map((m) => `<span>${esc(m)}</span>`).join('');
  const categoryNav = categoryCountLinks(counts, '../#routes');
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
    <meta property="og:type" content="article" />
    <meta property="og:image" content="${esc(post.image)}" />
    <meta property="og:image:secure_url" content="${esc(post.image)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(post.title)} | 트립뷰" />
    <meta name="twitter:description" content="${esc(post.excerpt)}" />
    <meta name="twitter:image" content="${esc(post.image)}" />
    <link rel="image_src" href="${esc(post.image)}" />
    <title>${esc(post.title)} | 트립뷰</title>
    <style>
      :root{--ink:#111;--muted:#666;--line:#ddd;--soft:#f5f5f5;--paper:#fff}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;color:var(--ink);font-family:Arial,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;line-height:1.72;background:var(--paper)}a{color:inherit;text-decoration:none}img{display:block;max-width:100%;object-fit:cover}.wrap{width:min(1100px,calc(100% - 32px));margin:auto}.top{position:fixed;top:0;left:0;right:0;z-index:20;background:transparent;transition:background .2s ease,box-shadow .2s ease,backdrop-filter .2s ease}.top.is-scrolled{background:rgba(255,255,255,.86);backdrop-filter:blur(16px);box-shadow:0 1px 18px rgba(0,0,0,.08)}.nav{min-height:68px;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{font-size:22px;font-weight:900}.links{display:flex;flex-wrap:wrap;gap:18px;color:#222;font-size:14px;font-weight:800}.links span{font-size:12px;color:var(--muted);font-weight:900}.hero{padding:112px 0 28px}.hero h1{max-width:920px;margin:0 0 12px;font-size:clamp(32px,5vw,50px);line-height:1.18;letter-spacing:0}.meta{display:flex;flex-wrap:wrap;gap:12px;color:var(--muted);font-size:14px;font-weight:700}.cover-figure{margin:0 auto;width:min(1100px,calc(100% - 32px))}.cover{width:100%;max-height:540px}.layout{display:grid;grid-template-columns:minmax(0,1fr)290px;gap:46px;align-items:start;padding:36px 0 60px}.content{max-width:760px;font-size:18px}.content p{margin:0 0 20px}.content h2{margin:38px 0 13px;font-size:26px;letter-spacing:0}.info-table{width:100%;margin:0 0 34px;border-collapse:collapse;border:1px solid var(--line);font-size:16px}.info-table th,.info-table td{padding:13px 15px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}.info-table th{width:140px;background:var(--soft);font-weight:900}.info-table tr:last-child th,.info-table tr:last-child td{border-bottom:0}.cover-figure figcaption,.inline-figure figcaption,.note{margin-top:9px;color:var(--muted);font-size:14px}.inline-figure{margin:26px 0}.inline-figure img{width:100%;max-height:520px}.note{padding:16px 18px;border:1px solid var(--line);background:var(--soft)}.aside{position:sticky;top:90px;display:grid;gap:12px;padding:18px;border:1px solid var(--line);background:#fff;color:var(--muted);font-size:15px}.aside strong{color:var(--ink)}details{border-top:1px solid var(--line)}details:last-child{border-bottom:1px solid var(--line)}summary{cursor:pointer;padding:16px 0;font-weight:900}details p{color:var(--muted)}footer{border-top:1px solid var(--line);padding:28px 0 42px;color:var(--muted)}@media(max-width:820px){.top{background:rgba(255,255,255,.96);backdrop-filter:blur(14px)}.layout{grid-template-columns:1fr}.aside{position:static}.nav{align-items:flex-start;flex-direction:column;justify-content:center;gap:8px;min-height:96px;padding:14px 0}.links{display:flex;flex-wrap:nowrap;gap:16px;width:100%;max-width:100%;overflow-x:auto;white-space:nowrap;-webkit-overflow-scrolling:touch;scrollbar-width:none}.links::-webkit-scrollbar{display:none}.links a{flex:0 0 auto}.hero{padding-top:138px}.content{font-size:17px}.info-table th{width:108px}}
    </style>
  </head>
  <body>
    <header class="top"><div class="wrap nav"><a class="brand" href="../">트립뷰</a><nav class="links" aria-label="주요 메뉴"><a href="../">홈</a><a href="../#popular">지금 많이 찾는 여행지</a><a href="../#weekend">이번 주말 가볼만한 곳</a><a href="../#festival">7~8월 축제/행사</a><a href="../#water">물놀이·계곡·해수욕장</a><a href="../#indoor">비 오는 날 실내 여행</a><a href="../#family">아이와 가기 좋은 곳</a><a href="../#booking">예약 전 체크</a></nav></div></header>
    <main><section class="wrap hero"><h1>${esc(post.title)}</h1><div class="meta"><span>트립뷰 편집팀</span><span>${esc(post.date)}</span><span>${esc(post.read)}</span><span>${esc(post.region)}</span></div></section>${gallery}<section class="wrap layout"><article class="content"><table class="info-table"><tbody>${rows}</tbody></table>${sections}<h2>자주 묻는 질문</h2>${faqs}<p class="note">일정, 세부 프로그램, 체험 접수, 요금은 현장 사정에 따라 달라질 수 있습니다. 출발 전 문의처와 당일 공지를 한 번 더 확인하면 이동 실패를 줄일 수 있습니다.</p></article><aside class="aside"><strong>운영 메모</strong>${memo}<a href="../">목록으로 돌아가기</a></aside></section></main>
    <footer><div class="wrap"><strong>트립뷰</strong><p>오늘 바로 움직일 수 있는 여행 큐레이션.</p></div></footer>
    <script>const header=document.querySelector('.top');const syncHeader=()=>header.classList.toggle('is-scrolled',window.scrollY>24);syncHeader();window.addEventListener('scroll',syncHeader,{passive:true});</script>
  </body>
</html>
`;
}

function card(post, className = 'card', heading = 'h3') {
  return `<a class="${className}" href="/${esc(post.slug)}/"><img src="${esc(post.image)}" alt="${esc(post.alt || post.title)}" /><small>${esc(post.category)}</small><${heading}>${esc(post.title)}</${heading}><p>${esc(post.excerpt)}</p><div class="meta"><span>${esc(post.date)}</span><span>${esc(post.read)}</span><span>${esc(post.region)}</span></div></a>`;
}


const COUNT_CATEGORIES = ['국내여행', '공연/축제'];

function countCategories(posts) {
  const counts = Object.fromEntries(COUNT_CATEGORIES.map((category) => [category, 0]));
  for (const post of posts) {
    const category = COUNT_CATEGORIES.includes(post.category) ? post.category : '국내여행';
    counts[category] += 1;
  }
  return { total: posts.length, categories: counts };
}

function categoryCountLinks(counts, href = '#routes') {
  return COUNT_CATEGORIES.map((category) => `<a href="${href}" data-category="${esc(category)}">${esc(category)} <span>${counts.categories[category] || 0}</span></a>`).join('');
}

function renderCategorySummary(counts) {
  const cards = COUNT_CATEGORIES.map((category) => `<a href="#routes" data-category="${esc(category)}"><b>${esc(category)}</b><span>${counts.categories[category] || 0}</span></a>`).join('');
  return `<section class="wrap category-counts" aria-label="카테고리별 글 수"><a href="#routes"><b>전체글</b><span>${counts.total}</span></a>${cards}</section>`;
}

function renderIndex(posts) {
  const list = posts.slice(0, 10);
  const primary = list[0];
  if (!primary) return '';
  const counts = countCategories(posts);
  const categoryNav = categoryCountLinks(counts);
  const categoryFooter = categoryCountLinks(counts);
  const categorySummary = renderCategorySummary(counts);
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
    <meta name="description" content="트립뷰는 지금 바로 움직일 수 있는 국내여행과 공연/축제 소식을 정리합니다." />
    <meta name="theme-color" content="#ffffff" />
    <meta property="og:title" content="트립뷰 - 최신 여행 큐레이션" />
    <meta property="og:description" content="오늘 기준으로 확인하기 좋은 국내여행과 공연/축제 소식을 정리합니다." />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="${esc(primary.image)}" />
    <meta property="og:image:secure_url" content="${esc(primary.image)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="트립뷰 - 최신 여행 큐레이션" />
    <meta name="twitter:description" content="오늘 기준으로 확인하기 좋은 국내여행과 공연/축제 소식을 정리합니다." />
    <meta name="twitter:image" content="${esc(primary.image)}" />
    <link rel="image_src" href="${esc(primary.image)}" />
    <title>트립뷰 - 최신 여행 큐레이션</title>
    <style>
      :root{--ink:#111;--muted:#666;--line:#ddd;--soft:#f5f5f5;--paper:#fff}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--paper);color:var(--ink);font-family:Arial,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;line-height:1.6}a{color:inherit;text-decoration:none}img{display:block;width:100%;object-fit:cover}.wrap{width:min(1080px,calc(100% - 32px));margin:0 auto}.top{position:fixed;inset:0 0 auto;z-index:30;background:transparent;transition:background 180ms ease,backdrop-filter 180ms ease,-webkit-backdrop-filter 180ms ease}.top.is-scrolled{background:rgba(255,255,255,.86);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px)}.nav{min-height:72px;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand{font-size:22px;font-weight:900}.links{display:flex;gap:24px;color:#333;font-size:14px;font-weight:700}.links span{font-size:12px;color:var(--muted);font-weight:900}.hero{padding:112px 0 52px;border-bottom:1px solid var(--line)}.hero-head{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:24px}.hero h1{margin:0;font-size:clamp(32px,5vw,54px);line-height:1.05;letter-spacing:0}.hero-head a{color:var(--muted);font-size:14px;font-weight:800}.latest-layout{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(300px,.75fr);gap:32px;align-items:stretch}.latest-primary,.latest-side a,.card{display:grid;gap:12px}.latest-primary img{aspect-ratio:1.35/1;background:var(--soft)}.latest-primary h2{margin:0;font-size:clamp(28px,4vw,42px);line-height:1.16;letter-spacing:0}.latest-primary p,.card p{margin:0;color:#444}.latest-side{display:grid;gap:24px;align-content:start}.latest-side img{aspect-ratio:1.65/1;background:var(--soft)}.latest-side h3,.card h3{margin:0;font-size:19px;line-height:1.35;letter-spacing:0}small{color:var(--muted);font-weight:800}.meta{display:flex;flex-wrap:wrap;gap:12px;color:var(--muted);font-size:14px}.section{padding:52px 0;border-bottom:1px solid var(--line)}.section h2{margin:0 0 24px;font-size:28px;letter-spacing:0}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:28px}.card img{aspect-ratio:1.45/1;background:var(--soft)}.section h2 span{color:var(--muted);font-size:.72em}.category-counts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;padding:28px 0;border-bottom:1px solid var(--line)}.category-counts a{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border:1px solid var(--line);background:#fff}.category-counts b{font-size:15px}.category-counts span{font-size:24px;font-weight:900}@media(max-width:880px){.category-counts{grid-template-columns:1fr}}footer{padding:36px 0 48px;color:var(--muted)}.foot{display:grid;grid-template-columns:1.4fr .8fr .8fr;gap:24px}.foot h3{margin:0 0 8px;color:var(--ink);font-size:15px}.foot div{display:grid;align-content:start;gap:7px}@media(max-width:880px){.nav{align-items:flex-start;flex-direction:column;justify-content:center;gap:8px;min-height:86px;padding:14px 0}.links{flex-wrap:wrap;gap:14px}.hero{padding:120px 0 40px}.hero-head{align-items:start;flex-direction:column}.latest-layout,.grid,.foot{grid-template-columns:1fr}}
    </style>
  </head>
  <body>
    <header class="top"><div class="wrap nav"><a class="brand" href="#top" aria-label="트립뷰 홈">트립뷰</a><nav class="links" aria-label="주요 메뉴"><a href="#latest">최신글</a><a href="#routes">전체글 <span>${counts.total}</span></a>${categoryNav}</nav></div></header>
    <main id="top"><section class="wrap hero" id="latest" aria-labelledby="latestTitle"><div class="hero-head"><h1 id="latestTitle">최신글</h1><a href="#routes">전체글 보기</a></div><div class="latest-layout">${card(primary, 'latest-primary', 'h2')}<div class="latest-side">${side}</div></div></section>${categorySummary}<section class="wrap section" id="routes"><h2>전체글 <span>${counts.total}</span></h2><div class="grid">${grid}</div></section></main>
    <footer><div class="wrap foot"><div><strong>트립뷰</strong><p>유명 관광지 소개보다 실제로 움직이기 쉬운 여행 루트를 큐레이션합니다.</p></div><div><h3>탐색</h3><a href="#latest">최신글</a><a href="#routes">전체글</a></div><div><h3>카테고리</h3>${categoryFooter}</div></div></footer>
    <script>const header=document.querySelector('.top');const syncHeader=()=>header.classList.toggle('is-scrolled',window.scrollY>8);window.addEventListener('scroll',syncHeader,{passive:true});syncHeader();</script>
  </body>
</html>
`;
}

function renderSitemap(posts) {
  const urls = ['/', ...posts.map((post) => `/${post.slug}/`), ...MANUAL_POSTS.map((slug) => `/${slug}/`), '/privacy.html'];
  const seen = new Set();
  const body = urls.filter((url) => {
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  }).map((url) => `  <url><loc>${SITE_URL}${url}</loc><lastmod>${TODAY}</lastmod></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

const posts = await applyOpenAiEnrichment((await readJson('data/generated-posts.json', [])).map(enrichPost));
if (!posts.length) {
  console.log('No generated posts to enrich.');
  process.exit(0);
}

const counts = countCategories(posts);

for (const post of posts) {
  await fs.mkdir(path.join(ROOT, post.slug), { recursive: true });
  await fs.writeFile(path.join(ROOT, post.slug, 'index.html'), renderArticle(post, counts), 'utf8');
}

await writeJson('data/generated-posts.json', posts);
await fs.writeFile(path.join(ROOT, 'index.html'), renderIndex(posts), 'utf8');
await fs.writeFile(path.join(ROOT, 'sitemap.xml'), renderSitemap(posts), 'utf8');
console.log(`Enriched ${posts.length} generated post(s).`);
