import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { repairEnrichedPost } from "./lib/post-enrichment.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const VERSION = 2;
const esc = (value = "") =>
  String(value).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

const strip = (value = "") =>
  String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(path.join(ROOT, file), "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await fs.writeFile(path.join(ROOT, file), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function infoValue(post, labels) {
  const names = Array.isArray(labels) ? labels : [labels];
  const row = (post.info || []).find(([key]) => names.includes(key));
  return strip(row?.[1] || "");
}

function compactText(value = "", limit = 700) {
  return strip(value)
    .replace(/\bTourAPI\b/gi, "")
    .replace(/\bAPI\b/g, "")
    .replace(/한국관광공사\s*(검색 결과|API|TourAPI)?/g, "공식 관광 정보")
    .replace(/\s+/g, " ")
    .slice(0, limit)
    .trim();
}

function apiOverview(post) {
  return compactText(post.tourApi?.overview || post.apiOverview || post.overview || "");
}

function apiFacts(post) {
  const intro = post.tourApi?.intro || {};
  const rows = [
    ["홈페이지", post.tourApi?.homepage],
    ["주차", intro.parking || intro.parkingculture || intro.parkingfestival || intro.parkingleports],
    ["쉬는 날", intro.restdate || intro.restdateculture],
    ["이용 시간", intro.usetime || intro.usetimeculture || intro.usetimeleports || intro.playtime],
    ["체험 안내", intro.expguide || intro.expagerange],
    ["행사 장소", intro.eventplace],
    ["행사 기간", intro.eventstartdate && intro.eventenddate ? `${intro.eventstartdate}~${intro.eventenddate}` : ""],
    ["프로그램", intro.program || intro.subevent],
    ["이용 요금", intro.usetimefestival || intro.usefee]
  ];
  return rows
    .map(([label, value]) => [label, compactText(value, 260)])
    .filter(([, value]) => value && !/방문 전 확인 필요|시설별 상이|현장 프로그램별 상이/.test(value));
}

function withApiSections(post, sections, isFestival) {
  const title = sourceTitle(post);
  const overview = apiOverview(post);
  const facts = apiFacts(post);
  const next = [...sections];

  if (overview && !next.some(([, paragraphs]) => paragraphs.some((p) => p.includes(overview.slice(0, 40))))) {
    next.unshift([
      isFestival ? "행사 개요를 먼저 보면" : "장소 개요를 먼저 보면",
      [
        `${title}은 공식 관광 정보에 등록된 소개 내용을 기준으로 보면 다음처럼 이해하면 좋습니다. ${overview}`,
        isFestival
          ? "행사 소개만 보고 바로 이동하기보다 기간, 장소, 프로그램, 요금, 주차 가능 여부를 함께 확인해야 현장에서 기다리는 시간을 줄일 수 있습니다."
          : "장소 소개만 보고 바로 이동하기보다 실제 입구, 운영 여부, 주차 또는 대중교통 동선, 주변 식사 동선을 함께 잡아야 방문 만족도가 높아집니다."
      ]
    ]);
  }

  if (facts.length) {
    const factText = facts.map(([label, value]) => `${label}: ${value}`).join(" / ");
    next.splice(Math.min(2, next.length), 0, [
      "운영 정보에서 놓치기 쉬운 부분",
      [
        `${title} 방문 전 확인할 만한 세부 정보는 ${factText}입니다. 이 정보는 제목이나 대표 이미지보다 실제 일정에 더 직접적으로 영향을 줍니다.`,
        "특히 주차, 쉬는 날, 이용 시간, 체험 접수처럼 현장에서 바로 막히는 항목은 출발 전에 다시 확인하는 편이 좋습니다. 같은 지역 안에서도 입구와 주차 위치가 다르면 이동 시간이 크게 달라질 수 있습니다."
      ]
    ]);
  }

  return next;
}

function sourceTitle(post) {
  return strip(post.sourceTitle || post.title || "여행지").replace(/\s*\|\s*트립뷰$/, "");
}

function hasBatchim(word) {
  const char = [...String(word).trim()].pop();
  if (!char) return false;
  const code = char.charCodeAt(0);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
}

function destination(region) {
  const clean = strip(region || "해당 지역");
  return `${clean}${hasBatchim(clean) ? "으로" : "로"}`;
}

function splitProgram(raw) {
  const normalized = strip(raw)
    .replace(/\d+\.\s*/g, " ")
    .replace(/메인프로그램\s*:?/g, " ")
    .replace(/부대프로그램\s*:?/g, " ")
    .replace(/소비자 참여 프로그램\s*:?/g, " ")
    .replace(/기타 내용\s*:?/g, " ")
    .replace(/기타\s*:?/g, " ");
  return normalized
    .split(/[,·ㆍ]| 등\s*| 및\s*/)
    .map((item) => strip(item).replace(/^[:：-]+/, "").trim())
    .filter((item) => item.length >= 2)
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 7);
}

function joinKorean(items) {
  if (!items.length) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")}와 ${items.at(-1)}`;
}

function themeOf(post) {
  const text = `${sourceTitle(post)} ${infoValue(post, ["주요 프로그램", "방문 포인트"])} ${post.region || ""}`;
  if (/커피|한우|김밥|라면|푸드|치즈|사과|김치|장류|인삼|산삼|와인|먹거리|시식|음식/.test(text)) return "food";
  if (/정원|수국|해바라기|구절초|숲|산|강|갯벌|공원|편백|치유|휴양|꽃|자연/.test(text)) return "nature";
  if (/문화|역사|야행|산성|읍성|선사|세종|한글|정조|신라|강감찬|대첩|국가유산/.test(text)) return "history";
  if (/불빛|유등|록|버스킹|음악|국악|공연|콘서트|야간/.test(text)) return "music";
  if (/에어쇼|드론|영화|스마트폰|게임|e스포츠|테크/.test(text)) return "event";
  return "general";
}

function themeIntro(title, region, place, theme, isFestival) {
  if (!isFestival) {
    if (theme === "nature") {
      return `${title}은 ${region} 여행에서 걷는 시간과 쉬는 시간을 함께 잡기 좋은 코스입니다. 사진만 보고 들르는 곳이라기보다, 어느 지점에서 시작해 어디까지 걸을지 정하면 체류 시간이 훨씬 안정적으로 잡힙니다.`;
    }
    if (theme === "history") {
      return `${title}은 장소 자체의 이야기를 알고 가면 만족도가 달라지는 코스입니다. 짧게 둘러보더라도 배경을 조금 알고 걷는 편이 좋고, 주변 동선까지 붙이면 이동 시간이 아깝지 않습니다.`;
    }
    return `${title}은 ${region} 일정에 한 코스로 넣기 좋은 여행지입니다. 핵심은 많이 보는 것이 아니라 위치, 운영 여부, 주변 동선을 미리 정리해 실제 이동에서 헤매는 시간을 줄이는 데 있습니다.`;
  }

  if (theme === "food") {
    return `${title}은 먹거리와 체험을 한 번에 묶어 보기 좋은 축제입니다. ${place} 주변으로 시식, 판매, 체험, 공연이 이어지는 구조라면 처음부터 줄을 서기보다 전체 부스 위치를 한 바퀴 확인한 뒤 마음에 드는 프로그램을 고르는 편이 낫습니다.`;
  }
  if (theme === "nature") {
    return `${title}은 계절감이 분명한 행사라 날씨와 이동 동선이 만족도를 크게 좌우합니다. 꽃, 강변, 숲길처럼 야외 구간이 중심이라면 사진을 찍는 시간과 쉬는 시간을 따로 잡아야 일정이 빡빡해지지 않습니다.`;
  }
  if (theme === "history") {
    return `${title}은 공연만 보는 축제라기보다 지역의 역사와 장소감을 함께 보는 일정에 가깝습니다. 해설, 전시, 재현 행사, 야간 프로그램이 섞여 있다면 단순 관람보다 머무는 순서를 정해두는 것이 좋습니다.`;
  }
  if (theme === "music") {
    return `${title}은 현장 분위기를 즐기는 시간이 중요한 행사입니다. 공연이나 야간 프로그램이 중심이라면 낮에는 가볍게 둘러보고, 사람이 모이는 시간대에는 관람 위치와 귀가 동선을 먼저 확보하는 편이 좋습니다.`;
  }
  return `${title}은 ${region}에서 일정과 현장 프로그램을 함께 확인하고 가면 좋은 축제입니다. 처음 방문한다면 행사장 위치, 운영 시간, 대표 프로그램, 귀가 동선 네 가지를 먼저 정리해두는 것이 가장 실용적입니다.`;
}

function programParagraph(post, theme) {
  const title = sourceTitle(post);
  const raw = infoValue(post, ["주요 프로그램", "방문 포인트"]);
  const items = splitProgram(raw);
  if (!items.length) {
    return `${title}의 세부 프로그램은 현장 공지에 따라 달라질 수 있습니다. 그래서 방문 전에는 대표 프로그램 하나만 보고 움직이기보다, 당일 운영표를 보고 대기 시간이 짧은 순서로 동선을 다시 잡는 편이 좋습니다.`;
  }
  const joined = joinKorean(items);
  if (theme === "food") {
    return `프로그램은 ${joined} 중심으로 볼 수 있습니다. 먹거리 축제는 인기 부스에 사람이 몰리기 쉬우니, 먼저 전체 판매·체험 위치를 확인하고 줄이 긴 곳은 식사 시간대를 살짝 비켜 다시 찾는 방식이 편합니다.`;
  }
  if (theme === "history") {
    return `프로그램은 ${joined} 흐름으로 이어집니다. 역사문화형 행사는 눈으로만 보는 것보다 해설, 재현, 공연 시간을 맞춰 보면 이해가 쉬워지므로 입장 직후 시간표를 먼저 확인하는 것이 좋습니다.`;
  }
  if (theme === "nature") {
    return `주요 볼거리는 ${joined} 쪽에 맞춰져 있습니다. 야외 구간이 많다면 한 번에 전부 보려고 하기보다 빛이 좋은 시간대와 휴식 지점을 함께 생각해 코스를 나누는 편이 좋습니다.`;
  }
  return `주요 프로그램은 ${joined}입니다. 인기 프로그램은 현장 상황에 따라 대기가 길어질 수 있으니, 가장 보고 싶은 순서를 정하고 나머지는 여유 시간에 붙이는 방식이 현실적입니다.`;
}

function buildFestivalSections(post) {
  const title = sourceTitle(post);
  const region = strip(post.region || "해당 지역");
  const place = infoValue(post, "장소") || "행사장 일원";
  const period = infoValue(post, "기간") || "방문 전 확인 필요";
  const time = infoValue(post, "시간") || "방문 전 확인 필요";
  const fee = infoValue(post, "요금") || "현장 프로그램별 상이";
  const tel = infoValue(post, "문의") || "방문 전 확인 필요";
  const theme = themeOf(post);

  return [
    [
      "이 축제를 어떻게 보면 좋을까",
      [
        themeIntro(title, region, place, theme, true),
        `${title}을 일정에 넣을 때는 “도착해서 무엇을 먼저 볼지”를 정해두는 편이 좋습니다. 행사장은 생각보다 넓거나 사람이 몰릴 수 있어, 대표 프로그램 하나와 식사·휴식 시간을 먼저 고정해두면 현장에서 선택지가 훨씬 편해집니다.`
      ]
    ],
    [
      "일정과 운영 흐름",
      [
        `운영 기간은 ${period}, 시간은 ${time} 기준입니다. 같은 축제 안에서도 공연, 체험, 판매 부스의 시작 시간이 다를 수 있으니 도착 직후 전체 시간표부터 확인하는 것이 좋습니다.`,
        `장소는 ${place}입니다. 처음 간다면 입구, 안내 부스, 화장실, 쉼터, 귀가 방향을 먼저 확인하세요. 이 순서만 잡아도 사람이 많은 시간대에 불필요하게 되돌아가는 일을 줄일 수 있습니다.`
      ]
    ],
    [
      "프로그램 고르는 법",
      [
        programParagraph(post, theme),
        `가족 방문이라면 체험과 휴식 지점을 가까이 묶고, 커플이나 친구끼리라면 공연·먹거리·사진 찍기 좋은 구간을 이어 붙이는 식으로 보는 순서를 잡아보세요. 혼자 방문한다면 대기 시간이 긴 프로그램보다 짧게 여러 구간을 둘러보는 방식이 더 만족스러울 수 있습니다.`
      ]
    ],
    [
      "비용과 준비물",
      [
        `요금은 ${fee}로 안내됩니다. 무료 행사라도 먹거리, 체험, 판매 부스는 별도 비용이 생길 수 있으니 현금과 카드 결제 가능 여부를 함께 생각해두면 좋습니다.`,
        theme === "food"
          ? "먹거리 행사는 식사 시간대에 줄이 길어지기 쉽습니다. 너무 배고픈 상태로 가기보다 가볍게 간식을 챙기고, 인기 부스는 식사 피크를 피해 다시 찾는 편이 편합니다."
          : "야외 시간이 길어질 수 있으니 편한 신발, 물, 날씨에 맞는 겉옷을 챙기세요. 비나 강한 햇빛이 예보된 날에는 실내 대피 장소나 쉬어갈 카페를 미리 정해두는 것이 좋습니다."
      ]
    ],
    [
      "이동과 귀가 팁",
      [
        `${destination(region)} 이동하는 주말 일정이라면 주차보다 귀가 동선이 더 중요할 때가 많습니다. 행사장 바로 앞 주차만 고집하기보다 조금 떨어진 주차장이나 대중교통 환승 지점을 함께 보는 편이 현실적입니다.`,
        `축제 종료 직후에는 한 번에 사람이 빠져나가므로 이동이 느려질 수 있습니다. 마지막 프로그램까지 볼 계획이라면 막차 시간, 택시 승차 위치, 도보 이동 시간을 미리 확인해두세요.`
      ]
    ],
    [
      "출발 전 마지막 확인",
      [
        `문의처는 ${tel}입니다. 날씨, 안전 관리, 현장 혼잡도에 따라 세부 프로그램과 운영 시간이 조정될 수 있으므로 출발 전 당일 공지를 한 번 더 확인하는 편이 안전합니다.`,
        `${title}은 현장 분위기를 따라 움직이는 재미가 있지만, 아무 계획 없이 가면 대기와 이동에 시간을 많이 쓰기 쉽습니다. 일정, 대표 프로그램, 결제 수단, 귀가 방법만 정리해도 훨씬 편하게 즐길 수 있습니다.`
      ]
    ]
  ];
}

function buildTravelSections(post) {
  const title = sourceTitle(post);
  const region = strip(post.region || "해당 지역");
  const place = infoValue(post, ["장소", "주소"]) || "방문 전 위치 확인 필요";
  const fee = infoValue(post, "요금") || "시설별 상이";
  const tel = infoValue(post, "문의") || "방문 전 확인 필요";
  const operation = infoValue(post, "운영 확인") || "방문 전 확인 필요";
  const theme = themeOf(post);

  return [
    [
      "어떤 일정에 어울릴까",
      [
        themeIntro(title, region, place, theme, false),
        `${title}을 방문할 때는 체류 시간을 먼저 정하는 것이 좋습니다. 짧게 들를 코스인지, 산책과 식사까지 붙일 코스인지에 따라 이동 동선과 준비물이 달라집니다.`
      ]
    ],
    [
      "위치와 운영 확인",
      [
        `위치는 ${place} 기준입니다. 운영 관련 안내는 ${operation}, 요금은 ${fee}로 정리됩니다. 다만 현장 운영은 계절, 날씨, 시설 사정에 따라 달라질 수 있습니다.`,
        `문의처는 ${tel}입니다. 출발 전에는 지도 앱에서 실제 입구와 주차 지점, 가까운 정류장을 함께 확인하세요. 목적지 이름만 보고 이동하면 입구가 먼 지점에 도착할 수 있습니다.`
      ]
    ],
    [
      "현장에서 볼 포인트",
      [
        programParagraph(post, theme),
        theme === "nature"
          ? "자연형 코스는 빠르게 둘러보는 것보다 걷는 속도를 늦추는 쪽이 좋습니다. 사진을 찍을 시간, 그늘에서 쉬는 시간, 다시 돌아오는 시간을 따로 생각하면 전체 일정이 덜 빡빡합니다."
          : "관람형 코스는 도착하자마자 전체를 훑고, 마음에 드는 지점을 다시 보는 방식이 좋습니다. 처음부터 한 곳에 오래 머물면 주변 코스를 놓치기 쉽습니다."
      ]
    ],
    [
      "주변 동선 잡기",
      [
        `${region} 안에서 식사, 카페, 산책 코스를 함께 묶으면 이동 시간이 줄어듭니다. 특히 오후 일정이라면 먼저 목적지를 보고, 해가 지기 전 식사나 카페로 이동하는 순서가 편합니다.`,
        `차량 이동이라면 주차 위치를 사진으로 남겨두고, 대중교통이라면 돌아오는 정류장 위치를 먼저 확인하세요. 여행지에서는 들어갈 때보다 나올 때 길을 찾는 시간이 더 오래 걸릴 수 있습니다.`
      ]
    ],
    [
      "준비물과 방문 팁",
      [
        `편한 신발, 물, 날씨에 맞는 겉옷은 기본입니다. 걷는 구간이 길거나 야외 시간이 많은 곳이라면 보조 배터리와 간단한 간식도 챙기는 편이 좋습니다.`,
        `아이와 함께라면 화장실과 휴식 지점을 먼저 확인하고, 어르신과 함께라면 계단이나 경사 구간이 있는지 확인하세요. 동행자에 따라 같은 장소도 적절한 동선이 달라집니다.`
      ]
    ]
  ];
}

function buildFaq(post) {
  const title = sourceTitle(post);
  const isFestival = post.category === "공연/축제";
  const fee = infoValue(post, "요금") || "현장 상황에 따라 달라질 수 있습니다";
  const time = infoValue(post, ["시간", "운영 확인"]) || "방문 전 확인 필요";
  const tel = infoValue(post, "문의") || "방문 전 확인 필요";

  if (isFestival) {
    return [
      ["입장료가 있나요?", `요금은 ${fee}로 안내됩니다. 다만 체험, 먹거리, 판매 부스 이용 비용은 별도로 발생할 수 있습니다.`],
      ["언제 도착하면 좋나요?", `운영 시간은 ${time} 기준입니다. 대표 프로그램을 보려면 시작 시간보다 여유 있게 도착해 시간표와 관람 위치를 먼저 확인하는 편이 좋습니다.`],
      ["아이와 함께 가도 괜찮나요?", "가능합니다. 다만 대기 시간이 생길 수 있어 물, 간식, 편한 신발, 날씨에 맞는 겉옷을 챙기면 좋습니다."],
      ["비가 오면 어떻게 하나요?", "야외 프로그램은 날씨에 따라 조정될 수 있습니다. 출발 전 당일 공지와 현장 안내를 확인하세요."],
      ["문의는 어디로 하나요?", `${title} 관련 문의는 ${tel}로 확인하는 것이 가장 빠릅니다.`]
    ];
  }

  return [
    ["방문 전에 무엇을 확인해야 하나요?", "운영 여부, 요금, 주차 또는 대중교통 동선을 먼저 확인하는 것이 좋습니다."],
    ["사진 찍기 좋은 시간은 언제인가요?", "보통 오전이나 늦은 오후가 좋습니다. 한낮에는 빛이 강하고 사람이 몰릴 수 있습니다."],
    ["주변 코스를 같이 잡아도 되나요?", `${strip(post.region || "해당 지역")} 안에서 식사, 카페, 산책 코스를 함께 묶으면 이동 시간이 줄어듭니다.`],
    ["아이와 함께 가도 괜찮나요?", "가능하지만 걷는 거리와 화장실 위치를 먼저 확인하는 편이 좋습니다."],
    ["문의는 어디로 하나요?", `${title} 관련 문의는 ${tel}로 확인하세요.`]
  ];
}

function polishPost(post) {
  if (post.contentDepthVersion) {
    return { ...repairEnrichedPost(post), copyPolishedVersion: VERSION };
  }
  if (post.manualWaterPostVersion || post.manualIndoorPostVersion) {
    return { ...post, copyPolishedVersion: VERSION };
  }

  const base = sourceTitle(post);
  const isFestival = post.category === "공연/축제";
  const sections = withApiSections(post, isFestival ? buildFestivalSections(post) : buildTravelSections(post), isFestival);
  return {
    ...post,
    read: sections.length >= 6 ? "약 8분" : "약 7분",
    description: isFestival
      ? `${base} 방문 전 필요한 일정, 운영 시간, 프로그램 고르는 법, 비용, 준비물과 귀가 동선을 자연스럽게 정리했습니다.`
      : `${base} 방문 전 필요한 위치, 운영 확인, 관람 포인트, 주변 동선과 준비물을 자연스럽게 정리했습니다.`,
    excerpt: isFestival
      ? `${base}을 방문하기 전 일정, 운영 흐름, 프로그램 선택법, 준비물과 귀가 동선까지 한 번에 확인해보세요.`
      : `${base} 방문 전 위치, 운영 확인, 현장 포인트와 주변 동선을 한 번에 확인해보세요.`,
    sections,
    faq: buildFaq(post),
    copyPolishedVersion: VERSION
  };
}

function countCategories(posts) {
  const categories = {};
  for (const post of posts) categories[post.category] = (categories[post.category] || 0) + 1;
  return { total: posts.length, categories };
}

function categoryCountLinks(counts, href = "../#routes") {
  return Object.entries(counts.categories)
    .map(([category, count]) => `<a href="${href}" data-category="${esc(category)}">${esc(category)} <span>${count}</span></a>`)
    .join("");
}

function regionTokens(value = "") {
  return strip(value)
    .replace(/[()]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3);
}

function titleKeywords(value = "") {
  return strip(value)
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 2)
    .slice(0, 8);
}

function relatedPostsFor(post, posts, limit = 4) {
  const currentRegion = regionTokens(post.region);
  const currentKeywords = new Set(titleKeywords(`${sourceTitle(post)} ${post.category || ""}`));
  const currentCategory = strip(post.category);

  return posts
    .filter((candidate) => candidate?.slug && candidate.slug !== post.slug)
    .map((candidate) => {
      const candidateRegion = regionTokens(candidate.region);
      const candidateKeywords = titleKeywords(`${sourceTitle(candidate)} ${candidate.category || ""}`);
      let score = 0;
      if (strip(candidate.category) === currentCategory) score += 8;
      if (currentRegion[0] && candidateRegion[0] === currentRegion[0]) score += 7;
      if (currentRegion[1] && candidateRegion[1] === currentRegion[1]) score += 4;
      score += candidateKeywords.filter((word) => currentKeywords.has(word)).length * 2;
      return { candidate, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || String(b.candidate.sortDate || b.candidate.date || "").localeCompare(String(a.candidate.sortDate || a.candidate.date || "")))
    .slice(0, limit)
    .map((item) => item.candidate);
}

function renderRelatedPosts(post, posts) {
  const related = relatedPostsFor(post, posts);
  if (!related.length) return "";
  return `<section class="related-posts" aria-labelledby="related-posts-title">
    <h2 id="related-posts-title">함께 보면 좋은 글</h2>
    <div class="related-list">
      ${related.map((item) => `<a class="related-card" href="../${esc(item.slug)}/"><strong>${esc(item.title)}</strong><span>${esc([item.category, item.date, item.region].filter(Boolean).join(" · "))}</span></a>`).join("")}
    </div>
  </section>`;
}

function renderArticle(post, counts, allPosts) {
  const rows = (post.info || []).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("");
  const gallery = (post.images || [post.image])
    .filter(Boolean)
    .map(
      (src, index) =>
        `<figure class="${index === 0 ? "cover-figure" : "inline-figure"}"><img class="${index === 0 ? "cover" : ""}" src="${esc(src)}" alt="${esc(`${sourceTitle(post)} 이미지 ${index + 1}`)}"${index === 0 ? "" : ' loading="lazy"'} /><figcaption>출처: 한국관광공사</figcaption></figure>`
    )
    .join("\n");
  const sectionBlocks = (post.sections || []).map(([heading, paragraphs]) => `<h2>${esc(heading)}</h2>${paragraphs.map((p) => `<p>${esc(p)}</p>`).join("")}`);
  const sections = sectionBlocks.join("");
  const faqs = (post.faq || []).map(([q, a]) => `<details open><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("");
  const related = renderRelatedPosts(post, allPosts);
  const memo = (post.memo || []).map((m) => `<span>${esc(m)}</span>`).join("");
  const articleNav = `<nav class="links" aria-label="주요 메뉴"><a href="../">홈</a><a href="../#popular">8월 가볼만한 곳</a><a href="../#water">물놀이·계곡</a><a href="../#weekend">이번 주말</a><a href="../#festival">8월 축제</a><a href="../#indoor">실내여행</a><a href="../#family">아이와</a><a href="../#booking">예약 전 체크</a><a href="../#flight-deals">항공권</a></nav>`;
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta name="naver-site-verification" content="38616b4b4209994ed384d0d2439bddcbec2cc711" />
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5751319666030430"
     crossorigin="anonymous"></script>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${esc(post.description)}" />
    <meta property="og:title" content="${esc(post.title)} | 트립뷰" />
    <meta property="og:description" content="${esc(post.excerpt)}" />
    <meta property="og:image" content="${esc(post.image)}" />
    <title>${esc(post.title)} | 트립뷰</title>
    <style>
      :root{--ink:#111;--muted:#666;--line:#ddd;--soft:#f5f5f5;--paper:#fff}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;color:var(--ink);font-family:Arial,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;line-height:1.72;background:var(--paper)}a{color:inherit;text-decoration:none}img{display:block;max-width:100%;object-fit:cover}.wrap{width:min(1100px,calc(100% - 32px));margin:auto}.top{position:fixed;top:0;left:0;right:0;z-index:20;background:transparent;transition:background .2s ease,box-shadow .2s ease,backdrop-filter .2s ease}.top.is-scrolled{background:rgba(255,255,255,.86);backdrop-filter:blur(16px);box-shadow:0 1px 18px rgba(0,0,0,.08)}.nav{min-height:68px;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{font-size:22px;font-weight:900}.links{display:flex;flex-wrap:wrap;gap:18px;color:#222;font-size:14px;font-weight:800}.links span{font-size:12px;color:var(--muted);font-weight:900}.hero{padding:112px 0 28px}.hero h1{max-width:920px;margin:0 0 12px;font-size:clamp(32px,5vw,50px);line-height:1.18;letter-spacing:0}.meta{display:flex;flex-wrap:wrap;gap:12px;color:var(--muted);font-size:14px;font-weight:700}.cover-figure{margin:0 auto;width:min(1100px,calc(100% - 32px))}.cover{width:100%;max-height:540px}.layout{display:grid;grid-template-columns:minmax(0,1fr)290px;gap:46px;align-items:start;padding:36px 0 60px}.content{max-width:760px;font-size:18px}.content p{margin:0 0 20px}.content h2{margin:42px 0 14px;font-size:26px;letter-spacing:0}.info-table{width:100%;margin:0 0 34px;border-collapse:collapse;font-size:16px}.info-table th,.info-table td{padding:12px 0;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}.info-table th{width:140px;background:transparent;font-weight:900}.info-table tr:last-child th,.info-table tr:last-child td{border-bottom:0}.cover-figure figcaption,.inline-figure figcaption{margin-top:9px;color:var(--muted);font-size:14px}.inline-figure{margin:26px 0}.inline-figure img{width:100%;max-height:520px}.related-posts{margin:42px 0 0;padding-top:18px;border-top:2px solid var(--ink)}.related-posts h2{margin-top:0}.related-list{display:grid;gap:0;border-top:1px solid var(--line)}.related-card{display:block;padding:14px 0;border-bottom:1px solid var(--line)}.related-card strong{display:block;font-size:18px;line-height:1.36}.related-card span{display:block;margin-top:5px;color:var(--muted);font-size:13px;line-height:1.5}.note{padding:0;margin-top:22px;color:var(--muted);font-size:15px}.aside{position:sticky;top:90px;display:grid;gap:12px;padding:0 0 0 20px;border-left:1px solid var(--line);color:var(--muted);font-size:15px}.aside strong{color:var(--ink)}details{border-top:1px solid var(--line)}details:last-child{border-bottom:1px solid var(--line)}summary{cursor:pointer;padding:16px 0;font-weight:900}details p{color:var(--muted)}footer{border-top:1px solid var(--line);padding:28px 0 42px;color:var(--muted)}.language-switch{display:flex;align-items:center;gap:8px;white-space:nowrap}.language-switch a{font-size:12px;font-weight:900;color:#555;border-bottom:1px solid transparent;padding:2px 0}.language-switch a.is-active{color:#111;border-bottom-color:#111}@media(max-width:820px){.top{background:rgba(255,255,255,.96);backdrop-filter:blur(14px)}.layout{grid-template-columns:1fr}.aside{position:static;padding:18px 0 0;border-left:0;border-top:1px solid var(--line)}.nav{align-items:flex-start;flex-direction:column;justify-content:center;gap:8px;min-height:96px;padding:14px 0}.links{display:flex;flex-wrap:nowrap;gap:16px;width:100%;max-width:100%;overflow-x:auto;white-space:nowrap;-webkit-overflow-scrolling:touch;scrollbar-width:none}.links::-webkit-scrollbar{display:none}.links a{flex:0 0 auto}.hero{padding-top:138px}.content{font-size:17px}.info-table th{width:108px}.language-switch{gap:10px}.language-switch a{font-size:12px}}
    </style>
  </head>
  <body>
    <header class="top"><div class="wrap nav"><a class="brand" href="../">트립뷰</a>${articleNav}</div></header>
    <main>
      <section class="wrap hero"><h1>${esc(post.title)}</h1><div class="meta"><span>트립뷰 편집팀</span><span>${esc(post.date)}</span><span>${esc(post.read)}</span><span>${esc(post.region)}</span></div></section>
      ${gallery}
      <section class="wrap layout"><article class="content"><table class="info-table"><tbody>${rows}</tbody></table>${sections}<h2>자주 묻는 질문</h2>${faqs}${related}<p class="note">일정과 세부 운영은 현장 사정에 따라 달라질 수 있습니다. 출발 전 당일 공지를 한 번 더 확인하면 불필요한 이동을 줄일 수 있습니다.</p></article><aside class="aside"><strong>운영 메모</strong>${memo}<a href="../">목록으로 돌아가기</a></aside></section>
    </main>
    <footer><div class="wrap"><strong>트립뷰</strong><p>오늘 바로 움직일 수 있는 여행 큐레이션.</p></div></footer>
    <script>const header=document.querySelector('.top');const syncHeader=()=>header.classList.toggle('is-scrolled',window.scrollY>24);syncHeader();window.addEventListener('scroll',syncHeader,{passive:true});</script>
    <script src="/assets/i18n.js" defer></script><script src="/assets/topic-filter.js?v=post-click-20260704" defer></script>
  </body>
</html>
`;
}

const targetSlugs = String(process.env.POST_RENDER_TARGETS || "")
  .split(",")
  .map((slug) => slug.trim())
  .filter(Boolean);
const targetSet = new Set(targetSlugs);
const sourcePosts = await readJson("data/generated-posts.json", []);
const posts = targetSlugs.length ? sourcePosts : sourcePosts.map(polishPost);
const counts = countCategories(posts);
const renderTargets = targetSlugs.length ? posts.filter((post) => targetSet.has(post.slug)) : posts;

for (const post of renderTargets) {
  await fs.mkdir(path.join(ROOT, post.slug), { recursive: true });
  await fs.writeFile(path.join(ROOT, post.slug, "index.html"), renderArticle(post, counts, posts), "utf8");
}

if (!targetSlugs.length) {
  await writeJson("data/generated-posts.json", posts);
  console.log(`Polished contextual copy for ${posts.length} post(s).`);
} else {
  console.log(`Rendered contextual copy for ${renderTargets.length} target post(s).`);
}
