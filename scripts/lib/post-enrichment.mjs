import { postBodyLength } from "./content-quality.mjs";

export const ENRICHMENT_VERSION = "verified-detail-v3-20260809";
export const MIN_ENRICHED_BODY_LENGTH = 2000;

const TYPE_META = {
  "12": { key: "attraction", label: "관광지" },
  "14": { key: "culture", label: "문화시설" },
  "25": { key: "course", label: "여행코스" },
  "28": { key: "leisure", label: "레포츠" },
  "32": { key: "lodging", label: "숙소" },
  "38": { key: "shopping", label: "쇼핑" },
  "39": { key: "food", label: "음식점" },
};

const PLACEHOLDER_PATTERN = /^(방문 전 (확인|문의|위치 확인) 필요|시설별 상이|현장 상황에 따라 상이|정보 없음|-|없음)$/;
const INTERNAL_COPY_PATTERN = /TourAPI|오픈\s*API|API\s*(검색|결과|정보)|자동 생성|본문을 보강/i;
const GENERATED_HEADINGS = new Set([
  "확인된 운영 정보",
  "주소와 도착 동선",
  "일정에 넣는 방법",
  "관람 순서와 체류 시간",
  "휴관일과 관람 준비",
  "구간별 이동 계획",
  "이용 전 예약과 안전 확인",
  "체크인 전 확인할 항목",
  "영업시간과 쇼핑 동선",
  "영업시간과 식사 계획",
  "동행자별 준비",
  "출발 전 마지막 확인",
]);

export function cleanText(value = "") {
  return String(value ?? "")
    .replace(/<br\s*\/?\s*>/gi, " · ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\bTourAPI\b/gi, "관광 안내")
    .replace(/오픈\s*API/gi, "공개 안내")
    .replace(/\s+/g, " ")
    .trim();
}

function firstUseful(...values) {
  return values.map(cleanText).find((value) => value && !PLACEHOLDER_PATTERN.test(value)) || "";
}

function infoValue(post, ...labels) {
  const names = labels.flat();
  const row = (Array.isArray(post.info) ? post.info : []).find(
    (item) => Array.isArray(item) && names.includes(cleanText(item[0])),
  );
  return cleanText(row?.[1]);
}

function introValue(post, ...keys) {
  const intro = post?.tourApi?.intro || {};
  return firstUseful(...keys.flat().map((key) => intro[key]));
}

function hasBatchim(value) {
  const char = [...cleanText(value)].at(-1);
  if (!char) return false;
  const code = char.charCodeAt(0);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
}

function withParticle(value, consonant, vowel) {
  const text = cleanText(value);
  return `${text}${hasBatchim(text) ? consonant : vowel}`;
}

function sourceTitle(post) {
  return firstUseful(post.sourceTitle, cleanText(post.title).split(",")[0], "여행지")
    .replace(/[.,!?。]+$/g, "")
    .trim();
}

function shortRegion(value) {
  return cleanText(value)
    .replace("서울특별시", "서울")
    .replace("부산광역시", "부산")
    .replace("인천광역시", "인천")
    .replace("대구광역시", "대구")
    .replace("광주광역시", "광주")
    .replace("대전광역시", "대전")
    .replace("울산광역시", "울산")
    .replace("세종특별자치시", "세종")
    .replace("강원특별자치도", "강원")
    .replace("전북특별자치도", "전북")
    .replace("제주특별자치도", "제주")
    .replace("경기도", "경기")
    .replace("충청북도", "충북")
    .replace("충청남도", "충남")
    .replace("전라남도", "전남")
    .replace("경상북도", "경북")
    .replace("경상남도", "경남");
}

export function postType(post = {}) {
  const name = sourceTitle(post);
  const text = `${name} ${post.title || ""} ${post.category || ""}`;
  if (/해수욕장|해변|비치/.test(text)) return { key: "beach", label: "해변" };
  if (/계곡|폭포|물놀이/.test(text)) return { key: "water", label: "물놀이 장소" };
  return TYPE_META[String(post?.tourApi?.contentTypeId || "")] || { key: "attraction", label: "관광지" };
}

export function verifiedFacts(post = {}) {
  const type = postType(post);
  const contact = firstUseful(
    introValue(post, "infocenter", "infocenterculture", "infocenterleports", "infocenterlodging", "infocentershopping", "infocenterfood", "infocentertourcourse"),
    infoValue(post, "문의", "전화"),
  );
  const hours = firstUseful(
    introValue(post, "usetime", "usetimeculture", "usetimeleports", "opentime", "opentimefood", "playtime"),
    infoValue(post, "운영시간", "시간", "운영 확인"),
  );
  const closed = firstUseful(
    introValue(post, "restdate", "restdateculture", "restdateleports", "restdateshopping", "restdatefood"),
    infoValue(post, "쉬는 날", "휴무일"),
  );
  const parking = firstUseful(
    introValue(post, "parking", "parkingculture", "parkingleports", "parkinglodging", "parkingshopping", "parkingfood"),
    infoValue(post, "주차"),
  );
  const fee = firstUseful(
    introValue(post, "usefee", "usefeeleports", "usetimefestival", "saleitemcost"),
    infoValue(post, "요금", "입장료"),
  );
  const address = firstUseful(infoValue(post, "주소", "장소"));

  return {
    type,
    name: sourceTitle(post),
    region: firstUseful(post.region, "국내"),
    address,
    contact,
    hours,
    closed,
    parking,
    fee,
    overview: cleanText(post?.tourApi?.overview || post.overview || post.apiOverview).slice(0, 1100),
    reservation: introValue(post, "reservation", "reservationlodging", "reservationfood"),
    checkin: introValue(post, "checkintime"),
    checkout: introValue(post, "checkouttime"),
    roomType: introValue(post, "roomtype", "roomcount"),
    menu: introValue(post, "firstmenu", "treatmenu"),
    packing: introValue(post, "packing"),
    saleItem: introValue(post, "saleitem", "shopguide"),
    courseTime: introValue(post, "taketime"),
    coursePlan: introValue(post, "schedule", "theme"),
    experience: introValue(post, "expguide", "expagerange", "expagerangeleports"),
    pet: introValue(post, "chkpet", "chkpetculture", "chkpetleports", "chkpetshopping"),
  };
}

function splitOverview(value) {
  const text = cleanText(value);
  if (!text) return [];
  const sentences = text.match(/[^.!?。]+[.!?。]?/g)?.map(cleanText).filter(Boolean) || [text];
  const paragraphs = [];
  let current = "";
  for (const sentence of sentences) {
    if (current && `${current} ${sentence}`.length > 430) {
      paragraphs.push(current);
      current = sentence;
    } else {
      current = [current, sentence].filter(Boolean).join(" ");
    }
  }
  if (current) paragraphs.push(current);
  return paragraphs.slice(0, 3);
}

function factEntries(facts) {
  const rows = [
    ["운영시간", facts.hours],
    ["쉬는 날", facts.closed],
    ["이용요금", facts.fee],
    ["주차", facts.parking],
    ["문의", facts.contact],
  ];
  if (facts.type.key === "lodging") {
    rows.unshift(["체크인", facts.checkin], ["체크아웃", facts.checkout]);
  }
  if (facts.type.key === "food") rows.unshift(["대표 메뉴", facts.menu]);
  if (facts.type.key === "shopping") rows.unshift(["판매 품목", facts.saleItem]);
  if (facts.type.key === "course") rows.unshift(["예상 시간", facts.courseTime], ["코스 안내", facts.coursePlan]);
  if (facts.reservation) rows.push(["예약", facts.reservation]);
  return rows.filter(([, value]) => cleanText(value));
}

function mergeInfo(post, facts) {
  const replacements = new Map([
    ["문의", facts.contact],
    ["운영 확인", facts.hours],
    ["시간", facts.hours],
    ["요금", facts.fee],
    ["주차", facts.parking],
    ["쉬는 날", facts.closed],
  ]);
  const rows = [];
  const seen = new Set();
  for (const row of Array.isArray(post.info) ? post.info : []) {
    if (!Array.isArray(row)) continue;
    const label = cleanText(row[0]);
    if (!label || seen.has(label)) continue;
    const current = cleanText(row[1]);
    const replacement = cleanText(replacements.get(label));
    const value = replacement && (!current || PLACEHOLDER_PATTERN.test(current)) ? replacement : current;
    if (!value || PLACEHOLDER_PATTERN.test(value)) continue;
    rows.push([label, value]);
    seen.add(label);
  }
  const add = (label, value) => {
    const clean = cleanText(value);
    if (!clean || seen.has(label)) return;
    rows.push([label, clean]);
    seen.add(label);
  };
  add("주차", facts.parking);
  add("쉬는 날", facts.closed);
  if (facts.type.key === "lodging") {
    add("체크인", facts.checkin);
    add("체크아웃", facts.checkout);
    add("객실 안내", facts.roomType);
  }
  if (facts.type.key === "food") {
    add("대표 메뉴", facts.menu);
    add("포장", facts.packing);
  }
  if (facts.type.key === "shopping") add("판매 품목", facts.saleItem);
  if (facts.type.key === "course") {
    add("예상 시간", facts.courseTime);
    add("코스 안내", facts.coursePlan);
  }
  add("예약", facts.reservation);
  add("체험 안내", facts.experience);
  add("반려동물", facts.pet);
  return rows;
}

function articleTitle(facts) {
  const region = shortRegion(facts.region);
  const prefix = region && region !== "국내" && !facts.name.includes(region.split(" ")[0]) ? `${region} ` : "";
  const labels = {
    attraction: "운영시간·주차와 관람 동선",
    culture: "휴관일·요금과 관람 동선",
    course: "구간별 이동시간과 준비물",
    leisure: "이용시간·예약과 준비물",
    lodging: "체크인 전 위치·주차 확인",
    shopping: "영업시간·휴무와 방문 동선",
    food: "영업시간·주차와 방문 팁",
    beach: "개장 여부·주차와 편의시설 확인",
    water: "수량·통제 여부와 안전한 동선",
  };
  return `${prefix}${facts.name}, ${labels[facts.type.key]}`;
}

function introSection(facts) {
  const subject = withParticle(facts.name, "은", "는");
  const object = withParticle(facts.name, "을", "를");
  const address = facts.address && !PLACEHOLDER_PATTERN.test(facts.address)
    ? `목적지는 ${facts.address} 기준으로 잡으면 됩니다.`
    : `출발 전 지도에서 정확한 입구 위치를 다시 확인해야 합니다.`;
  const typeCopy = {
    attraction: `${subject} ${facts.region} 일정에서 관람과 산책을 함께 묶어 보기 좋은 관광지입니다. ${object} 일정에 넣을 때는 대표 이미지만 보기보다 실제 입구, 운영시간, 돌아오는 동선까지 함께 확인해야 현장에서 시간을 덜 잃습니다.`,
    culture: `${subject} ${facts.region}의 문화시설입니다. 비 오는 날이나 더운 시간대의 실내 일정으로 검토하기 좋지만, 휴관일과 입장 마감이 관람 가능 시간을 좌우하므로 출발 전에 운영 정보를 먼저 확인하는 편이 정확합니다.`,
    course: `${subject} 한 지점만 보는 여행지가 아니라 이동 구간 전체를 계획해야 하는 여행코스입니다. 출발점과 종료 지점, 예상 소요시간, 식사와 휴식 지점을 나눠 잡아야 무리 없이 완주할 수 있습니다.`,
    leisure: `${subject} 관람보다 실제 이용 조건이 중요한 레포츠 시설입니다. 예약 여부, 이용 가능 연령, 장비 준비, 운영시간을 먼저 확인하고 동행자의 체력과 경험에 맞춰 일정을 잡는 것이 좋습니다.`,
    lodging: `${subject} ${facts.region} 숙박 일정에서 위치와 이동 편의를 함께 비교해야 하는 숙소입니다. 객실 사진만으로 결정하기보다 체크인·체크아웃, 주차, 주변 식사와 다음 날 이동 경로를 같이 보면 예약 판단이 쉬워집니다.`,
    shopping: `${subject} ${facts.region} 여행 중 들를 수 있는 쇼핑 장소입니다. 판매 품목뿐 아니라 영업시간, 정기 휴무, 주차와 대중교통 동선을 함께 확인해야 헛걸음을 줄일 수 있습니다.`,
    food: `${subject} ${facts.region} 식사 일정에 넣기 전 영업시간과 쉬는 날을 먼저 확인해야 하는 음식점입니다. 대표 메뉴, 대기 가능성, 주차 또는 도보 이동 시간을 함께 계산하면 앞뒤 여행 일정이 늦어지는 일을 줄일 수 있습니다.`,
    beach: `${subject} 물놀이 시간보다 개장 여부와 안전관리, 샤워장·화장실·주차 같은 편의시설을 먼저 확인해야 하는 해변입니다. 파고와 현장 통제에 따라 입수가 제한될 수 있으므로 산책 대체 일정도 함께 준비하는 편이 좋습니다.`,
    water: `${subject} 당일 날씨뿐 아니라 전날 강수량과 상류 수량, 탐방로 통제 여부까지 살펴야 하는 물놀이 장소입니다. 물색이 탁하거나 흐름이 빠르면 입수하지 말고 산책 중심으로 일정을 바꾸는 판단이 필요합니다.`,
  };
  return ["먼저 알아둘 점", [typeCopy[facts.type.key], address]];
}

function factsSection(facts) {
  const rows = factEntries(facts);
  const first = rows.length
    ? `방문 전에는 ${rows.map(([label]) => label).slice(0, 4).join(", ")} 순서로 먼저 살피면 일정 판단이 쉽습니다.`
    : `방문 날짜를 정했다면 운영 여부와 입장 가능 시간, 이동과 귀가 시간을 먼저 맞춰보세요.`;
  const second = rows.length
    ? `위 정보는 방문 날짜와 시설 사정에 따라 바뀔 수 있습니다. 특히 운영시간, 휴무, 예약 마감, 주차 가능 여부는 같은 장소라도 평일과 주말 또는 성수기에 달라질 수 있으므로 출발 당일 한 번 더 확인하세요.`
    : `지도에 표시된 공식 채널을 보고, 가까운 대체 코스를 함께 준비해두면 일정 변경에 대응하기 쉽습니다.`;
  return ["운영 정보", [first, second]];
}

function typeSections(facts) {
  const object = withParticle(facts.name, "을", "를");
  const sections = {
    attraction: [
      ["관람 순서와 체류 시간", [
        `${object} 처음 방문한다면 입구의 안내도에서 핵심 구간과 화장실, 휴식 지점을 먼저 확인하세요. 모든 구간을 빠르게 훑기보다 가장 보고 싶은 지점을 먼저 정하고, 사진을 찍는 시간과 실제로 걷는 시간을 분리하면 체류 시간을 예측하기 쉽습니다.`,
        `야외 구간이 많다면 오전이나 늦은 오후가 걷기 편합니다. 한낮 방문은 그늘과 실내 휴식 지점을 중간에 넣고, 비가 올 때 이용하기 어려운 구간이 있는지도 함께 확인하세요.`,
      ]],
    ],
    culture: [
      ["휴관일과 관람 준비", [
        `문화시설은 운영 종료 시각보다 입장 마감이 빠른 경우가 많습니다. 전시나 체험을 제대로 보려면 마지막 입장 직전에 도착하기보다 최소 한 시간 이상 여유를 두고, 사전 예약이 필요한 프로그램이 있는지 먼저 확인하세요.`,
        `우산과 큰 가방의 보관 장소, 촬영 가능 구역, 유모차와 휠체어 이동 가능 여부도 관람 만족도에 영향을 줍니다. 아이와 함께라면 체험 시간을 먼저 잡고 일반 전시는 남는 시간에 보는 순서가 효율적입니다.`,
      ]],
    ],
    course: [
      ["구간별 이동 계획", [
        `${object} 하루 일정에 넣을 때는 전체 구간을 한 번에 완주하려 하기보다 출발점, 중간 휴식점, 종료 지점으로 나눠 보세요. 왕복 교통편이 다르다면 돌아오는 버스나 택시 이용 가능 여부를 출발 전에 확인해야 합니다.`,
        `예상 소요시간에는 사진 촬영과 식사, 길을 찾는 시간을 추가해야 합니다. 해가 지기 전에 끝내야 하는 구간이라면 안내된 시간보다 일찍 출발하고, 비나 강풍 예보가 있을 때는 짧은 구간으로 줄이는 편이 좋습니다.`,
      ]],
    ],
    leisure: [
      ["이용 전 예약과 안전 확인", [
        `레포츠 시설은 현장에 도착해도 정원 마감이나 기상 문제로 이용하지 못할 수 있습니다. 예약 시간, 이용 가능 연령과 신장, 장비 대여 범위, 취소 기준을 한 번에 확인하고 도착해야 대기 시간을 줄일 수 있습니다.`,
        `활동에 맞는 신발과 여벌 옷을 준비하고, 음주 뒤 이용이나 통제 구역 진입은 피해야 합니다. 아이와 함께라면 보호자 동반 기준을, 초보자라면 교육 또는 안전 설명 시간을 전체 일정에 포함하세요.`,
      ]],
    ],
    lodging: [
      ["체크인 전 확인할 항목", [
        `숙소는 같은 건물이라도 객실 유형에 따라 전망, 침대 구성, 취사 가능 여부와 포함 서비스가 달라질 수 있습니다. 예약 화면에서 객실명과 투숙 인원, 조식 포함 여부, 취소 마감 시각을 확인한 뒤 결제하는 편이 안전합니다.`,
        `늦게 도착할 예정이라면 프런트 운영시간과 심야 체크인 방법을 미리 문의하세요. 차량 이용 시 주차 등록 방식과 추가 요금, 대중교통 이용 시 마지막 이동 구간의 경사나 도보 시간을 같이 확인하면 좋습니다.`,
      ]],
    ],
    shopping: [
      ["영업시간과 쇼핑 동선", [
        `쇼핑 장소는 매장별 영업시간과 쉬는 날이 전체 시설 안내와 다를 수 있습니다. 특정 상품이나 매장을 목적으로 간다면 재고와 실제 영업 여부를 먼저 확인하고, 식사 시간대와 주말에는 계산 대기 시간도 일정에 포함하세요.`,
        `구매한 짐을 들고 다음 장소로 이동해야 한다면 쇼핑을 일정 후반에 배치하는 편이 편합니다. 주차 할인 조건이 있다면 최소 구매 금액과 정산 장소를 확인하고 영수증을 이동 전까지 보관하세요.`,
      ]],
    ],
    food: [
      ["영업시간과 식사 계획", [
        `음식점은 재료 소진, 준비 시간, 단체 예약 때문에 표시된 영업시간 안에도 주문이 마감될 수 있습니다. 꼭 먹고 싶은 메뉴가 있다면 마지막 주문 시각과 당일 판매 여부를 확인하고, 혼잡한 시간보다 조금 일찍 도착하는 편이 좋습니다.`,
        `아이용 의자, 포장, 예약, 주차 지원 여부는 매장마다 다릅니다. 차량을 이용한다면 식사 시간뿐 아니라 주차 대기와 출차 시간까지 계산하고, 주변 공영주차장 위치도 함께 저장해두세요.`,
      ]],
    ],
    beach: [
      ["물놀이 전 안전과 편의시설 확인", [
        `해변에 도착하면 안전요원 배치 구간과 입수 가능 시간을 먼저 확인하세요. 파도가 높거나 이안류 안내가 있을 때는 얕은 곳이라도 들어가지 말고, 통제선과 방송 안내를 따라야 합니다.`,
        `샤워장, 탈의 공간, 화장실, 그늘 위치를 먼저 파악하면 젖은 짐을 들고 이동하는 시간을 줄일 수 있습니다. 아이와 함께라면 보호자 한 명이 물놀이보다 짐과 귀가 동선을 맡는 방식이 안전합니다.`,
      ]],
    ],
    water: [
      ["수량과 통제 여부 확인", [
        `계곡과 폭포는 비가 그친 뒤에도 수위가 늦게 오를 수 있습니다. 전날 강수량과 현장 출입 통제를 확인하고, 물이 탁하거나 낙엽과 나뭇가지가 빠르게 떠내려오면 즉시 물가에서 벗어나세요.`,
        `슬리퍼보다 접지력이 있는 운동화나 아쿠아슈즈가 적합합니다. 깊이를 알 수 없는 곳에서 뛰어들지 말고, 구조 장비와 관리 인력이 없는 구간에서는 발만 담그는 정도로 이용하는 편이 안전합니다.`,
      ]],
    ],
  };
  return sections[facts.type.key] || sections.attraction;
}

function commonSections(facts) {
  const subject = withParticle(facts.name, "은", "는");
  const nearbyPlace = facts.region === "국내" ? "가까운 대체 장소" : `${facts.region} 안의 가까운 대체 장소`;
  return [
    ["이동과 귀가", [
      facts.address && !PLACEHOLDER_PATTERN.test(facts.address)
        ? `${facts.name}의 주소는 ${facts.address}입니다. 내비게이션에는 장소명과 주소를 함께 대조해 입력하고, 도착 직전에는 실제 입구와 주차장 위치가 같은지 지도에서 다시 확인하세요.`
        : `${subject} 장소명만 입력해 출발하기보다 지도에서 도착 지점과 도보 진입로를 대조한 뒤 이동하세요.`,
      `대중교통을 이용한다면 갈 때보다 돌아오는 교통편을 먼저 확인하는 것이 좋습니다. 막차 시간과 배차 간격, 정류장까지의 도보 거리까지 저장해두면 현장에서 일정을 급하게 줄이는 일을 피할 수 있습니다.`,
    ]],
    ["비용과 준비물", [
      `아이와 함께라면 화장실과 휴식 장소, 유모차 이동 가능 구간을 먼저 확인하세요. 부모님과 함께라면 계단과 경사, 앉아 쉴 곳이 중요한 기준이고, 혼자 방문한다면 귀가 교통편과 휴대전화 배터리를 여유 있게 준비하는 편이 좋습니다.`,
      `계절과 날씨에 맞는 신발, 물, 보조 배터리는 기본 준비물입니다. 실외 일정은 햇빛과 소나기 대책을, 실내 일정은 냉방에 대비한 얇은 겉옷과 예약 확인 화면을 챙기면 좋습니다.`,
    ]],
    ["예약 전 확인 순서", [
      `${facts.name} 방문 당일에는 운영 여부, 입장 또는 주문 마감, 주차 가능 여부를 마지막으로 확인하세요. 안내된 정보가 실제 현장과 다르면 무리하게 기다리기보다 ${nearbyPlace}로 이동할 수 있도록 후보 한 곳을 준비해두는 편이 좋습니다.`,
      `일정은 목적지 체류 시간만 계산하지 말고 왕복 이동, 주차, 식사, 휴식 시간을 포함해 잡아야 합니다. 처음 방문하는 곳이라면 계획 사이에 20~30분의 여유를 두는 것이 실제 여행에서 가장 효과적인 변수 대응 방법입니다.`,
    ]],
  ];
}

function uniqueSections(sections) {
  const seen = new Set();
  return sections.filter(([heading, paragraphs]) => {
    const key = cleanText(heading);
    if (!key || seen.has(key) || !Array.isArray(paragraphs)) return false;
    seen.add(key);
    return paragraphs.some(cleanText);
  });
}

function buildFaq(facts) {
  const answer = (value, fallback) => cleanText(value) || fallback;
  return [
    ["운영시간은 어떻게 확인하나요?", answer(facts.hours, "방문 날짜의 운영 여부와 입장 마감 시간을 먼저 확인하세요.")],
    ["쉬는 날이 있나요?", answer(facts.closed, "임시 휴무가 있을 수 있으므로 출발 당일 공식 안내를 다시 확인하세요.")],
    ["주차할 수 있나요?", answer(facts.parking, "장소 주변 공영주차장과 도보 동선을 함께 확인하세요.")],
    ["요금은 얼마인가요?", answer(facts.fee, "이용 항목과 시기에 따라 달라질 수 있어 방문 또는 예약 전에 최종 금액을 확인해야 합니다.")],
    ["문의는 어디로 하나요?", answer(facts.contact, `${facts.name}의 공식 안내 채널이나 지도에 표시된 최신 연락처를 확인하세요.`)],
  ];
}

function buildMemo(facts) {
  return [
    `지역: ${facts.region}`,
    `유형: ${facts.type.label}`,
    facts.hours ? `운영: ${facts.hours}` : "운영: 방문 당일 확인",
    facts.contact ? `문의: ${facts.contact}` : "문의: 최신 연락처 확인",
  ];
}

function additionalSection(facts) {
  const nearbyArea = facts.region === "국내" ? "주변" : `${facts.region} 안`;
  return ["일정 구성", [
    `${facts.name} 하나만 보고 왕복하기보다 ${nearbyArea}에서 식사, 산책, 실내 대체 코스 중 한 곳을 이어 붙이면 이동 대비 만족도가 높아집니다. 오전에는 목적지를 먼저 보고 오후에 주변 장소로 이동하거나, 혼잡이 예상되면 순서를 바꿀 수 있도록 두 가지 동선을 준비하세요.`,
    `예약이나 이용시간이 정해진 장소라면 그 시간을 기준으로 나머지 일정을 배치하고, 자유 관람 장소라면 주차가 비교적 수월한 시간대를 먼저 선택하세요. 일정 사이의 이동시간은 지도 예상치보다 넉넉하게 잡는 편이 좋습니다.`,
  ]];
}

function bookingAndCostSection(facts) {
  return ["가격표를 읽는 방법", [
    `${facts.type.label} 이용 비용은 기본 입장이나 이용료 외에 주차, 체험, 장비 대여, 식사처럼 선택 항목에서 추가될 수 있습니다. 무료로 알려진 장소라도 특별 프로그램이나 성수기 운영에는 별도 비용이 생길 수 있으므로 방문 인원 전체의 예상 비용을 나눠 확인하세요.`,
    `온라인 예약을 이용한다면 날짜와 인원, 이용 항목, 취소 가능 시점을 결제 전에 다시 보세요. 현장 안내가 예약 화면과 다를 때를 대비해 예약 번호와 결제 내역을 준비하고, 환불이나 일정 변경이 필요한 경우 이용 전에 문의하는 편이 좋습니다.`,
  ]];
}

function verificationOrderSection(facts) {
  return ["최종 확인 순서", [
    `${facts.name} 방문 계획은 날짜를 정한 뒤 운영 여부와 예약 가능 시간을 보고, 그다음 교통과 주차, 마지막으로 주변 식사 순서를 확인하면 효율적입니다. 여러 안내가 서로 다르면 가장 최근에 게시된 공지와 현장 연락처 안내를 우선하세요.`,
    `출발 한두 시간 전에는 임시 휴무, 입장 제한, 기상에 따른 통제 공지가 없는지 다시 살펴보세요. 화면에 필요한 정보를 저장해두면 이동 중 통신이 원활하지 않거나 안내 페이지가 바뀌어도 주소와 연락처를 바로 확인할 수 있습니다.`,
  ]];
}

export function enrichPost(post = {}, updatedAt = new Date().toISOString().slice(0, 10)) {
  const facts = verifiedFacts(post);
  const overview = splitOverview(facts.overview);
  const sections = uniqueSections([
    introSection(facts),
    ...(overview.length ? [["장소 소개", overview]] : []),
    factsSection(facts),
    ...typeSections(facts),
    ...commonSections(facts),
  ]);
  const base = {
    ...post,
    title: articleTitle(facts),
    description: `${facts.name} 방문 전 필요한 운영시간, 휴무, 요금, 주차와 ${facts.type.label} 이용 동선을 확인된 정보 중심으로 정리했습니다.`,
    excerpt: `${facts.name}의 위치와 운영 정보부터 주차, 준비물, 주변 이동 순서까지 방문 전에 확인하세요.`,
    read: "약 9분",
    info: mergeInfo(post, facts),
    sections,
    faq: buildFaq(facts),
    memo: buildMemo(facts),
    contentDepthVersion: ENRICHMENT_VERSION,
    contentDepthUpdatedAt: updatedAt,
    updatedAt,
  };
  if (postBodyLength(base) < MIN_ENRICHED_BODY_LENGTH) {
    base.sections = uniqueSections([...base.sections, additionalSection(facts)]);
  }
  if (postBodyLength(base) < MIN_ENRICHED_BODY_LENGTH) {
    base.sections = uniqueSections([...base.sections, bookingAndCostSection(facts)]);
  }
  if (postBodyLength(base) < MIN_ENRICHED_BODY_LENGTH) {
    base.sections = uniqueSections([...base.sections, verificationOrderSection(facts)]);
  }
  return base;
}

export function repairEnrichedPost(post = {}, updatedAt = new Date().toISOString().slice(0, 10)) {
  if (!post.contentDepthVersion || postBodyLength(post) >= MIN_ENRICHED_BODY_LENGTH) return post;
  return enrichPost(post, updatedAt);
}

export function hasInternalProductionCopy(post = {}) {
  const values = [
    post.title,
    post.description,
    post.excerpt,
    ...(post.sections || []).flatMap(([, paragraphs]) => paragraphs || []),
    ...(post.memo || []),
  ];
  return values.some((value) => INTERNAL_COPY_PATTERN.test(cleanText(value)));
}

export function removeLegacyEnrichmentSections(sections = []) {
  return (Array.isArray(sections) ? sections : []).filter(([heading]) => !GENERATED_HEADINGS.has(cleanText(heading)));
}
