import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const postsPath = join(root, "data", "generated-posts.json");
const reportPath = join(root, "reports", "content-quality-report.json");
const reportsDir = join(root, "reports");
const logPath = join(reportsDir, "short-post-enrichment-log.json");

const VERSION = "short-post-top20-check-20260711";
const DEFAULT_LIMIT = Number(process.env.SHORT_POST_LIMIT || 30);
const GENERATED_SECTION_HEADINGS = new Set([
  "방문 전 확인 순서",
  "현장에서 시간을 쓰는 방법",
  "동행자별 체크 포인트",
  "축제 일정은 시작 시간보다 마감 시간을 먼저 보기",
  "해수욕장은 물보다 편의시설이 만족도를 좌우합니다",
  "계곡과 폭포는 비 온 뒤 판단이 가장 중요합니다",
  "실내 여행은 예약과 체류 시간을 함께 봐야 합니다",
  "여행 코스는 한 곳에 오래 묶어두지 않기",
]);

function clean(value = "") {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readJson(path, fallback) {
  return readFile(path, "utf8")
    .then((value) => JSON.parse(value))
    .catch(() => fallback);
}

function flattenSections(sections) {
  if (!Array.isArray(sections)) return "";
  return sections
    .flatMap((section) => {
      if (!Array.isArray(section)) return [];
      const [, body] = section;
      if (Array.isArray(body)) return body;
      return body ? [body] : [];
    })
    .map(clean)
    .join(" ");
}

function bodyLength(post) {
  return [
    post.description,
    post.excerpt,
    flattenSections(post.sections),
    Array.isArray(post.memo) ? post.memo.join(" ") : "",
  ]
    .map(clean)
    .join(" ").length;
}

function infoValue(post, labels) {
  const names = Array.isArray(labels) ? labels : [labels];
  const row = (post.info || []).find(([key]) => names.includes(key));
  return clean(row?.[1] || "");
}

function placeName(post) {
  return (
    clean(post.sourceTitle) ||
    infoValue(post, ["장소", "행사명", "이름"]) ||
    clean(post.title).split(",")[0].replace(/ 방문 전.*$/, "").trim()
  );
}

function broadRegion(post) {
  const region = clean(post.region);
  return region.split(/\s+/).slice(0, 2).join(" ") || region || "해당 지역";
}

function hasFinalConsonant(value) {
  const chars = clean(value);
  const code = chars.charCodeAt(chars.length - 1);
  if (Number.isNaN(code) || code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

function topicParticle(value) {
  return hasFinalConsonant(value) ? "은" : "는";
}

function placeType(post) {
  const text = `${post.title || ""} ${placeName(post)} ${post.category || ""}`;
  if (/축제|행사|페스티벌|문화제/.test(text)) return "festival";
  if (/해수욕장|바다|해변|비치/.test(text)) return "beach";
  if (/계곡|폭포|물놀이|물길/.test(text)) return "water";
  if (/박물관|전시|미술관|과학관|실내|문화원/.test(text)) return "indoor";
  return "travel";
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueMemo(items) {
  const seen = new Set();
  return ensureArray(items).filter((item) => {
    const key = clean(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function baseContext(post) {
  const place = placeName(post);
  const region = broadRegion(post);
  const address = infoValue(post, "주소");
  const operation = infoValue(post, ["운영 확인", "시간", "운영시간", "행사 기간", "기간"]);
  const price = infoValue(post, ["요금", "입장료"]);
  const point = infoValue(post, ["방문 포인트", "주요 프로그램"]);
  const contact = infoValue(post, ["문의", "전화"]);

  return { place, region, address, operation, price, point, contact };
}

function titleRegion(post) {
  return broadRegion(post)
    .replace("서울특별시", "서울")
    .replace("부산광역시", "부산")
    .replace("인천광역시", "인천")
    .replace("대구광역시", "대구")
    .replace("광주광역시", "광주")
    .replace("대전광역시", "대전")
    .replace("울산광역시", "울산")
    .replace("강원특별자치도", "강원")
    .replace("전북특별자치도", "전북")
    .replace("제주특별자치도", "제주")
    .replace("충청북도", "충북")
    .replace("충청남도", "충남")
    .replace("전라남도", "전남")
    .replace("경상북도", "경북")
    .replace("경상남도", "경남")
    .trim();
}

function practicalTitle(post) {
  const { place } = baseContext(post);
  const region = titleRegion(post);
  const type = placeType(post);
  const prefix = region && region !== "국내" ? `${region} ` : "";

  if (type === "festival") return `${prefix}${place} 일정·주차·운영정보 체크`;
  if (type === "beach") return `${prefix}${place} 물놀이 전 주차와 편의시설 체크`;
  if (type === "water") return `${prefix}${place} 방문 전 물놀이·동선 체크`;
  if (type === "indoor") return `${prefix}${place} 비 오는 날 운영정보와 관람 동선`;
  if (/숙소|예약/.test(clean(post.category))) return `${prefix}${place} 예약 전 위치와 이동 동선 체크`;
  return `${prefix}${place} 방문 전 주차와 여행 동선 체크`;
}

function practicalDescription(post) {
  const { place, region, operation, price } = baseContext(post);
  const checks = [
    operation ? "운영시간" : "운영 여부",
    price ? "요금" : "입장료",
    "주차",
    "대중교통",
    "주변 동선",
  ];
  return `${place} 방문 전에 ${checks.join(", ")}을 먼저 확인할 수 있도록 ${region} 기준 이동 동선과 현장 체크 포인트를 정리했습니다.`;
}

function practicalExcerpt(post) {
  const { place } = baseContext(post);
  return `${place}에 가기 전 운영 여부, 주차, 요금, 날씨 변수와 주변 코스를 한 번에 확인해보세요.`;
}

function sharedSections(post) {
  const { place, region, address, operation, price, point, contact } = baseContext(post);
  const destination = address ? `${address} 기준으로` : `${region} 안에서`;
  const priceText = price || "입장료와 유료 체험 여부";
  const contactText = contact && contact !== "방문 전 확인 필요" ? `${contact}로 문의하거나` : "공식 안내와 현장 공지를";

  return [
    [
      "방문 전 확인 순서",
      [
        `${place}는 이름만 보고 바로 출발하기보다 ${destination} 실제 이동 시간을 먼저 잡는 것이 좋습니다. 내비게이션 목적지와 주차장, 입구 위치가 조금씩 다를 수 있어 도착 직전에는 지도 앱에서 주차장과 도보 진입로를 따로 확인하세요.`,
        `${operationSentence(operation)} 계절, 날씨, 현장 정비, 행사 준비 상황에 따라 이용 가능 범위가 달라질 수 있으므로 ${contactText} 기준으로 보고 출발하는 편이 안전합니다.`,
      ],
    ],
    [
      "현장에서 시간을 쓰는 방법",
      [
        `${place}에서는 처음부터 깊숙이 들어가기보다 입구 주변 안내판, 화장실, 매점 또는 휴식 공간을 먼저 확인해두면 좋습니다. 특히 가족이나 부모님과 함께라면 돌아오는 길의 체력까지 계산해야 일정이 흐트러지지 않습니다.`,
        `사진을 찍는 시간과 실제로 쉬는 시간을 분리해두면 만족도가 높습니다. 도착 직후에는 전체 분위기를 보고, 사람이 몰리는 구간은 오래 머물기보다 한 바퀴 돌아본 뒤 다시 조용한 지점으로 이동하는 방식이 좋습니다.`,
      ],
    ],
    [
      "동행자별 체크 포인트",
      [
        `아이와 함께라면 이동 거리를 짧게 잡고 화장실 위치를 먼저 확인하세요. 부모님과 함께라면 경사, 계단, 그늘, 앉아 쉴 곳이 있는지가 중요합니다. 친구나 커플 여행이라도 한낮에는 체력 소모가 커질 수 있어 물과 가벼운 간식을 준비하는 편이 낫습니다.`,
        `${point ? `${point}도 함께 봐야 합니다. ` : ""}${priceText}${topicParticle(priceText)} 현장 조건에 따라 달라질 수 있으니 무료로 보이는 장소라도 주차비, 체험비, 입장 마감 시간을 같이 확인하세요.`,
      ],
    ],
  ];
}

function typedSections(post) {
  const { place, region } = baseContext(post);
  const type = placeType(post);

  if (type === "festival") {
    return [
      [
        "축제 일정은 시작 시간보다 마감 시간을 먼저 보기",
        [
          `${place} 같은 축제는 공연 시작 시간만 보고 움직이면 주차와 입장 동선에서 시간을 잃기 쉽습니다. 방문 날짜를 정했다면 대표 프로그램 시간, 체험 접수 마감, 푸드존 운영 시간, 귀가 교통편을 한 번에 묶어 확인하세요.`,
          `특히 8월 행사는 더위와 소나기 변수가 큽니다. 낮 프로그램과 야간 프로그램의 체감이 다르므로 아이와 함께라면 낮 시간을 줄이고, 야간 공연을 볼 계획이라면 귀가 시간을 먼저 정해두는 것이 좋습니다.`,
        ],
      ],
    ];
  }

  if (type === "beach") {
    return [
      [
        "해수욕장은 물보다 편의시설이 만족도를 좌우합니다",
        [
          `${place}를 여름 바다 코스로 본다면 개장 여부, 안전요원 배치, 샤워장, 그늘, 주차장을 먼저 확인해야 합니다. 바다는 잠깐 들어가도 젖은 짐과 모래 때문에 돌아오는 동선이 길어질 수 있습니다.`,
          `오전에는 비교적 여유롭게 자리를 잡기 좋고, 오후에는 햇볕과 혼잡이 동시에 커질 수 있습니다. ${region} 여행 중 들른다면 해변 체류 시간을 짧게 잡고 식사나 카페, 주변 산책 코스를 함께 붙이는 편이 안정적입니다.`,
        ],
      ],
    ];
  }

  if (type === "water") {
    return [
      [
        "계곡과 폭포는 비 온 뒤 판단이 가장 중요합니다",
        [
          `${place}처럼 물길을 보는 장소는 당일 날씨만으로 판단하면 부족합니다. 전날 비, 상류 수량, 탐방로 미끄럼, 출입 통제 여부를 함께 봐야 하고 물색이 탁하거나 흐름이 빠르면 물놀이보다 산책 중심으로 바꾸는 편이 안전합니다.`,
          `신발은 슬리퍼보다 접지력이 있는 운동화나 아쿠아슈즈가 낫습니다. 물가 사진을 찍을 때도 난간과 통제선을 넘지 말고, 아이와 함께라면 깊은 곳을 찾기보다 얕고 넓은 구간에서 짧게 쉬는 방식이 좋습니다.`,
        ],
      ],
    ];
  }

  if (type === "indoor") {
    return [
      [
        "실내 여행은 예약과 체류 시간을 함께 봐야 합니다",
        [
          `${place}는 비 오는 날이나 한여름 더위를 피하는 실내 코스로 보기 좋지만, 전시 교체일과 휴관일을 놓치면 헛걸음할 수 있습니다. 운영일, 입장 마감, 예약 필요 여부, 주차 가능 시간을 먼저 확인하세요.`,
          `실내 공간은 짧게 보면 아쉽고 오래 보면 피로가 쌓입니다. 관람 동선을 한 번에 모두 보려 하기보다 대표 전시나 체험을 먼저 보고, 이후 주변 카페나 식사 장소로 이어가는 방식이 좋습니다.`,
        ],
      ],
    ];
  }

  return [
    [
      "여행 코스는 한 곳에 오래 묶어두지 않기",
      [
        `${place}를 중심 일정으로 넣더라도 하루 전체를 한 장소에만 묶어두면 날씨나 혼잡에 취약합니다. 오전 방문, 점심 이동, 오후 대체 코스처럼 흐름을 나누면 일정이 훨씬 안정적입니다.`,
        `${region} 안에서 가까운 식사 장소나 실내 대체지를 하나 준비해두면 갑작스러운 비, 주차 혼잡, 현장 통제에도 여행 만족도를 크게 잃지 않습니다.`,
      ],
    ],
  ];
}

function extraFaq(post) {
  const { place } = baseContext(post);
  return [
    [`${place} 방문 전에 가장 먼저 확인할 것은 무엇인가요?`, "운영 시간, 주차 위치, 출입 가능 여부를 먼저 확인하는 것이 좋습니다. 날씨 영향을 받는 장소라면 당일 공지도 함께 봐야 합니다."],
    ["일정을 어느 정도로 잡으면 좋나요?", "처음 방문이라면 이동과 휴식 시간을 포함해 넉넉하게 잡는 편이 좋습니다. 한낮보다 오전이나 늦은 오후 방문이 부담이 적은 경우가 많습니다."],
  ];
}

function uniqueSections(sections) {
  const seen = new Set();
  return sections.filter(([heading]) => {
    const key = clean(heading);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function removeGeneratedSections(sections) {
  return ensureArray(sections).filter(([heading]) => !GENERATED_SECTION_HEADINGS.has(clean(heading)));
}

function operationSentence(operation) {
  const value = clean(operation);
  if (!value) return "그다음에는 운영 시간, 출입 가능 여부, 주차 상황을 확인해야 합니다.";
  if (value.endsWith("는 당일 확인 필요")) {
    return `그다음에는 ${value.replace(/는 당일 확인 필요$/, "")}를 당일 기준으로 확인해야 합니다.`;
  }
  if (value.endsWith("확인 필요")) {
    return `그다음에는 ${value.replace(/확인 필요$/, "").trim()}를 확인해야 합니다.`;
  }
  return `그다음에는 ${value}${topicParticle(value)} 방문 판단 기준입니다.`;
}

function uniqueFaq(faq) {
  const seen = new Set();
  return faq.filter(([question, answer]) => {
    const key = clean(question);
    if (!key || !clean(answer) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const posts = await readJson(postsPath, []);
const report = await readJson(reportPath, { highPriority: [] });
const explicitTargets = String(process.env.SHORT_POST_TARGETS || "")
  .split(",")
  .map((slug) => slug.trim())
  .filter(Boolean);
const targetSlugs = explicitTargets.length
  ? explicitTargets
  : report.highPriority
      .filter((item) => Array.isArray(item.issues) && item.issues.includes("short_body_under_1500_chars"))
      .slice(0, DEFAULT_LIMIT)
      .map((item) => item.slug);
const targetSet = new Set(targetSlugs);

const updated = [];
const nextPosts = posts.map((post) => {
  if (!targetSet.has(post.slug)) return post;
  const beforeLength = bodyLength(post);
  const sections = uniqueSections([
    ...removeGeneratedSections(post.sections),
    ...sharedSections(post),
    ...typedSections(post),
  ]);
  const faq = uniqueFaq([...ensureArray(post.faq), ...extraFaq(post)]);
  const memo = uniqueSections([
    ["방문 전 보강", [
      "운영 여부, 주차, 현장 통제, 날씨 변수를 함께 확인하도록 본문을 보강했습니다.",
    ]],
  ]).flatMap(([, lines]) => lines);
  const nextPost = {
    ...post,
    title: practicalTitle(post),
    description: practicalDescription(post),
    excerpt: practicalExcerpt(post),
    read: "약 8분",
    sections,
    faq,
    memo: uniqueMemo([...ensureArray(post.memo), ...memo]),
    contentDepthVersion: VERSION,
    contentDepthUpdatedAt: new Date().toISOString().slice(0, 10),
  };
  updated.push({
    slug: post.slug,
    beforeTitle: post.title,
    afterTitle: nextPost.title,
    beforeLength,
    afterLength: bodyLength(nextPost),
  });
  return nextPost;
});

await writeFile(postsPath, `${JSON.stringify(nextPosts, null, 2)}\n`, "utf8");
await mkdir(reportsDir, { recursive: true });
await writeFile(logPath, `${JSON.stringify({ version: VERSION, limit: DEFAULT_LIMIT, updated }, null, 2)}\n`, "utf8");

console.log(`Enriched ${updated.length} short post(s).`);
for (const item of updated.slice(0, 10)) {
  console.log(`${item.slug}: ${item.beforeLength} -> ${item.afterLength}`);
}
