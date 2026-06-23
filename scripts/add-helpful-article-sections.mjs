import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_PATH = path.join(ROOT, 'data', 'generated-posts.json');
const START = '<!-- helpful-sections:start -->';
const END = '<!-- helpful-sections:end -->';

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, (match) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[match]));
}

function clean(value = '') {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function infoValue(post, labels) {
  const labelSet = new Set(Array.isArray(labels) ? labels : [labels]);
  const row = (post.info || []).find(([key]) => labelSet.has(key));
  return clean(row?.[1] || '');
}

function sourceTitle(post) {
  return clean(post.sourceTitle || post.title || '방문지')
    .replace(/\s*\|\s*트립뷰$/, '')
    .replace(/,\s*방문 전[\s\S]*$/, '');
}

function isUnknown(value = '') {
  return !value || /방문 전 확인|확인 필요|미정|없음|시설별 상이|현장 상황/i.test(value);
}

function compactAddress(address = '') {
  if (isUnknown(address)) return '목적지 주변';
  return address.length > 46 ? `${address.slice(0, 46)}...` : address;
}

function programText(post) {
  const raw = infoValue(post, ['주요 프로그램', '방문 포인트']);
  if (isUnknown(raw)) return post.category === '공연/축제' ? '대표 공연과 체험 부스' : '관람과 산책 동선';
  return raw
    .replace(/\d+\.\s*/g, ' ')
    .split(/[,·ㆍ/]| 등\s*/)
    .map(clean)
    .filter(Boolean)
    .slice(0, 4)
    .join(', ') || raw;
}

function section(heading, paragraphs) {
  return `<h2>${esc(heading)}</h2>${paragraphs.map((paragraph) => `<p>${esc(paragraph)}</p>`).join('')}`;
}

function buildFestivalSections(post) {
  const title = sourceTitle(post);
  const region = clean(post.region || '해당 지역');
  const period = infoValue(post, '기간');
  const time = infoValue(post, '시간');
  const place = compactAddress(infoValue(post, ['장소', '주소']));
  const fee = infoValue(post, '요금');
  const programs = programText(post);

  return [
    section('추천 체류 시간과 방문 순서', [
      `${title}은 보통 핵심 프로그램만 보면 1~2시간, 식사와 체험까지 함께 넣으면 반나절 일정으로 잡는 편이 좋습니다. ${isUnknown(period) ? '기간은 방문 전 다시 확인해야 하므로' : `기간은 ${period}로 안내되므로`} 먼저 방문 가능한 날짜를 정하고, 그다음 보고 싶은 프로그램 시간을 맞추는 순서가 좋습니다.`,
      `${isUnknown(time) ? '운영 시간은 현장 공지에 따라 달라질 수 있으니' : `운영 시간은 ${time} 기준이므로`} 도착 직후 안내 부스, 화장실, 귀가 동선을 먼저 확인하세요. 그 다음 ${programs} 중 하나를 중심으로 일정을 잡으면 현장에서 헤매는 시간이 줄어듭니다.`
    ]),
    section('주차와 대중교통 체크', [
      `행사장은 ${place} 기준으로 이동하면 됩니다. 주말이나 저녁 시간대에는 행사장 바로 앞보다 주변 임시 주차장이나 대중교통 하차 지점에서 걷는 시간이 더 중요할 수 있습니다.`,
      `${region} 일정으로 움직인다면 귀가 시간을 먼저 정해두세요. 축제가 끝나는 시간에는 차량과 사람이 한 번에 몰리므로, 마지막 공연 직후 바로 이동할지 근처에서 잠시 쉬었다 갈지 미리 정해두면 좋습니다.`
    ]),
    section('누구에게 잘 맞는 행사인가', [
      `${title}은 공연만 빠르게 보고 나오는 일정이라기보다 현장 분위기, 먹거리, 체험을 함께 즐기는 사람에게 잘 맞습니다. 가족 단위라면 체험 부스와 휴식 공간을 먼저 확인하고, 친구나 커플 일정이라면 사진 찍기 좋은 시간대를 중심으로 움직이면 만족도가 높습니다.`,
      `아이와 함께라면 대기 시간이 긴 프로그램을 무리하게 넣기보다 짧게 참여할 수 있는 코스를 고르는 편이 좋습니다. 어르신과 함께라면 의자, 그늘, 실내 대기 공간이 있는지 먼저 보는 것이 중요합니다.`
    ]),
    section('피하면 좋은 상황과 대안', [
      `비가 많이 오거나 바람이 강한 날에는 야외 부스와 공연 일정이 바뀔 수 있습니다. 이럴 때는 체류 시간을 줄이고, 실내 식사 장소나 주변 카페를 대안으로 잡아두는 것이 안전합니다.`,
      `사람이 많은 시간대를 피하고 싶다면 개장 직후나 대표 공연이 끝난 뒤보다 그 사이 시간대를 노려보세요. 단, 인기 체험은 조기 마감될 수 있으니 꼭 하고 싶은 프로그램은 먼저 확인하는 편이 좋습니다.`
    ]),
    section('방문 전 최종 체크리스트', [
      `${isUnknown(fee) ? '요금은 현장 프로그램별로 달라질 수 있습니다.' : `요금은 ${fee}로 안내됩니다.`} 무료 입장 행사라도 체험, 먹거리, 굿즈 구매 비용은 별도일 수 있으니 카드와 소액 현금을 함께 준비하면 편합니다.`,
      `출발 전에는 날짜, 시간표, 우천 시 운영 여부, 주차 위치, 귀가 교통편을 확인하세요. 이 다섯 가지만 체크해도 현장에서 생기는 대부분의 불편을 줄일 수 있습니다.`
    ])
  ].join('');
}

function buildTravelSections(post) {
  const title = sourceTitle(post);
  const region = clean(post.region || '해당 지역');
  const address = compactAddress(infoValue(post, ['주소', '장소']));
  const fee = infoValue(post, '요금');
  const point = programText(post);

  return [
    section('추천 체류 시간과 코스 순서', [
      `${title}은 짧게는 40분~1시간, 사진 촬영과 주변 산책까지 넣으면 1시간 30분 이상 잡는 것이 좋습니다. ${region} 안에서 다른 장소와 묶는다면 점심 전후 한 구간으로 배치하면 이동 피로가 줄어듭니다.`,
      `처음 방문한다면 입구와 주차 위치를 먼저 확인하고, 그다음 ${point} 순서로 움직이는 편이 좋습니다. 한 장소에서 모든 것을 보려고 하기보다 핵심 포인트를 정하고 주변 코스를 붙이는 방식이 현실적입니다.`
    ]),
    section('주차와 대중교통 체크', [
      `주소는 ${address} 기준으로 보면 됩니다. 지도에서 목적지명만 검색하면 실제 입구와 다른 지점이 잡힐 수 있어, 출발 전에는 주차장, 입구, 가장 가까운 정류장을 함께 확인하세요.`,
      `차량 이동이라면 도착 후 주차 위치를 사진으로 남겨두는 것이 좋습니다. 대중교통 이동이라면 돌아오는 배차 간격과 막차 시간을 먼저 확인해야 일정이 흔들리지 않습니다.`
    ]),
    section('누구에게 잘 맞는 여행지인가', [
      `${title}은 ${region} 여행에서 큰 이동 없이 분위기를 바꾸고 싶을 때 넣기 좋은 코스입니다. 사진을 찍고 천천히 걷는 일정, 가족과 짧게 들르는 일정, 주변 식사 장소와 묶는 일정에 특히 잘 맞습니다.`,
      `다만 이동 거리가 길거나 계단, 야외 구간이 많은 장소라면 아이나 어르신과 함께 갈 때 쉬는 지점을 미리 정해두는 것이 좋습니다. 날씨가 좋지 않은 날에는 체류 시간을 짧게 잡는 편이 안전합니다.`
    ]),
    section('피하면 좋은 상황과 대안', [
      `한낮에는 빛이 강하고 사람이 몰릴 수 있어 사진 촬영 목적이라면 오전이나 늦은 오후가 낫습니다. 비가 오는 날에는 미끄러운 구간이나 흙길이 있을 수 있으니 신발과 이동 동선을 더 신경 써야 합니다.`,
      `주차가 어렵거나 대중교통 배차가 긴 지역이라면 목적지 하나만 보고 움직이기보다 식사, 카페, 산책 코스를 한 번에 묶어 이동 효율을 높이는 편이 좋습니다.`
    ]),
    section('방문 전 최종 체크리스트', [
      `${isUnknown(fee) ? '요금은 시설이나 체험별로 달라질 수 있습니다.' : `요금은 ${fee}로 안내됩니다.`} 무료로 보이는 장소라도 주차비, 체험비, 내부 시설 이용료가 별도일 수 있으니 현장 안내를 확인하세요.`,
      `출발 전에는 운영 여부, 주차 가능 여부, 날씨, 주변 식사 장소, 귀가 시간을 확인하세요. 특히 처음 가는 지역이라면 내비게이션 도착지만 믿지 말고 실제 입구 사진이나 지도 후기를 함께 보는 것이 좋습니다.`
    ])
  ].join('');
}

function removeExisting(html) {
  return html.replace(new RegExp(`${START}[\\s\\S]*?${END}\\s*`, 'g'), '');
}

function insertHelpfulSections(html, post) {
  if (!html.includes('<article class="content">')) return html;
  const block = `${START}${post.category === '공연/축제' ? buildFestivalSections(post) : buildTravelSections(post)}${END}`;
  const withoutOld = removeExisting(html);
  if (withoutOld.includes('<h2>자주 묻는 질문</h2>')) {
    return withoutOld.replace('<h2>자주 묻는 질문</h2>', `${block}<h2>자주 묻는 질문</h2>`);
  }
  return withoutOld.replace('</article>', `${block}</article>`);
}

const posts = JSON.parse(await fs.readFile(DATA_PATH, 'utf8'));
let changed = 0;

for (const post of posts) {
  if (!post?.slug) continue;
  const file = path.join(ROOT, post.slug, 'index.html');
  let html = '';
  try {
    html = await fs.readFile(file, 'utf8');
  } catch {
    continue;
  }

  const next = insertHelpfulSections(html, post);
  if (next !== html) {
    await fs.writeFile(file, next, 'utf8');
    changed += 1;
  }
}

console.log(`Added helpful article sections to ${changed} post(s).`);
