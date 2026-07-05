import { readFile, writeFile } from "node:fs/promises";

const GENERATED_PATH = "data/generated-posts.json";
const SOURCE_PATH = "data/posts.json";
const TODAY_LABEL = "2026년 7월 5일";
const TODAY_SORT = "2026-07-05";

const TARGETS = [
  {
    sourceSlug: "tour-127934",
    region: "대구광역시 달성군",
    kind: "waterpark",
    title: "스파밸리 워터파크, 7월 물놀이 전 확인할 이용 팁",
  },
  {
    sourceSlug: "tour-126098",
    region: "부산광역시 기장군",
    kind: "beach",
    title: "일광해수욕장, 부산 여름 바다 방문 전 체크할 것",
  },
  {
    sourceSlug: "tour-128767",
    region: "인천광역시 중구",
    kind: "beach",
    title: "을왕리해수욕장, 인천 당일치기 물놀이 동선",
  },
  {
    sourceSlug: "tour-129255",
    region: "인천광역시 중구",
    kind: "beach",
    title: "선녀바위 해수욕장, 조용한 바다 산책과 물놀이 포인트",
  },
  {
    sourceSlug: "tour-129256",
    region: "인천광역시 중구",
    kind: "beach",
    title: "왕산해수욕장, 을왕리 근처 여름 바다 코스",
  },
  {
    sourceSlug: "tour-127698",
    region: "경상북도 포항시",
    kind: "beach",
    title: "영일대해수욕장, 포항 바다 여행과 야간 산책 코스",
  },
  {
    sourceSlug: "tour-647272",
    region: "강원특별자치도 영월군",
    kind: "valley",
    title: "연하계곡, 영월 계곡 물놀이 전 확인할 안전 포인트",
  },
  {
    sourceSlug: "tour-125677",
    region: "강원특별자치도 동해시",
    kind: "valley",
    title: "무릉계곡, 동해 여름 계곡 산책과 물놀이 동선",
  },
  {
    sourceSlug: "tour-126265",
    region: "전라남도 구례군",
    kind: "valley",
    title: "피아골계곡, 구례 지리산 계곡 여행 준비 포인트",
  },
  {
    sourceSlug: "tour-129400",
    region: "제주특별자치도 제주시",
    kind: "beach",
    title: "김녕해수욕장, 제주 에메랄드빛 바다 방문 전 체크",
  },
  {
    sourceSlug: "tour-125652",
    region: "강원특별자치도 철원군",
    kind: "waterfall",
    title: "삼부연폭포, 철원 여름 물길 여행 전 알아둘 것",
  },
  {
    sourceSlug: "tour-125838",
    region: "충청북도 영동군",
    kind: "waterfall",
    title: "옥계폭포, 영동 여름 폭포 여행과 주변 동선",
  },
];

function contentId(slug) {
  return slug.replace(/^tour-/, "");
}

function generatedSlug(sourceSlug) {
  return `travel-${contentId(sourceSlug)}`;
}

function strip(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function addressFrom(source) {
  const text = source?.content?.find((line) => line.startsWith("주소는 ")) || "";
  const match = text.match(/^주소는\s+(.+?)입니다\./);
  return strip(match?.[1] || source?.excerpt || source?.destination || "방문 전 위치 확인 필요");
}

function sourceTitle(source) {
  return strip(source?.title || "여름 물놀이 여행지");
}

function typeLabel(kind) {
  if (kind === "beach") return "해수욕장";
  if (kind === "valley") return "계곡";
  if (kind === "waterpark") return "워터파크";
  return "폭포";
}

function visitPoint(kind) {
  if (kind === "beach") return "해수욕장 개장 여부, 입수 가능 구역, 샤워장·화장실, 주차장, 일몰 후 귀가 동선";
  if (kind === "valley") return "계곡 출입 가능 여부, 우천 뒤 통제, 물 깊이, 미끄럼 구간, 주차장과 화장실 위치";
  if (kind === "waterpark") return "운영 시간, 입장권, 락커·샤워장, 복장 규정, 음식물 반입, 주차";
  return "탐방로 통제, 미끄럼 구간, 전망 지점, 주차장, 우천 뒤 수량과 안전 안내";
}

function descriptionFor(target, source) {
  const name = sourceTitle(source);
  const label = typeLabel(target.kind);
  if (target.kind === "beach") {
    return `${name}을 7월 여름 바다 코스로 볼 때 확인해야 할 개장 여부, 입수 가능 구역, 주차와 샤워장, 주변 식사 동선을 정리했습니다.`;
  }
  if (target.kind === "valley") {
    return `${name}을 여름 계곡 물놀이 코스로 볼 때 필요한 출입 가능 여부, 우천 뒤 통제, 물 깊이와 미끄럼 안전, 주변 동선을 정리했습니다.`;
  }
  if (target.kind === "waterpark") {
    return `${name}을 7월 가족 물놀이 코스로 이용하기 전 확인할 운영 시간, 입장권, 락커와 샤워장, 복장과 주차 정보를 정리했습니다.`;
  }
  return `${name}을 여름 물길 여행 코스로 볼 때 필요한 탐방로 안전, 우천 뒤 통제, 전망 포인트와 주변 동선을 정리했습니다.`;
}

function sectionsFor(target, source, address) {
  const name = sourceTitle(source);
  const label = typeLabel(target.kind);
  const region = target.region;

  if (target.kind === "beach") {
    return [
      [
        "여름 바다 코스로 볼 때",
        [
          `${name}은 ${region}에서 7월 물놀이와 바다 산책을 함께 잡기 좋은 ${label}입니다. 이름만 보고 바로 출발하기보다, 당일 개장 여부와 입수 가능 구역을 먼저 확인해야 일정이 흔들리지 않습니다.`,
          `해수욕장은 날씨가 좋아도 파고, 조류, 안전요원 배치, 시설 점검에 따라 입수가 제한될 수 있습니다. 아이와 함께 간다면 물에 들어가는 시간보다 그늘에서 쉬는 시간, 씻고 갈아입는 시간까지 여유 있게 잡는 편이 좋습니다.`,
        ],
      ],
      [
        "위치와 이동 동선",
        [
          `위치는 ${address} 기준입니다. 차량 이동이라면 해변 바로 앞 주차장만 보지 말고, 만차 때 이동할 보조 주차장과 걸어가는 길을 함께 확인하세요.`,
          `대중교통을 이용한다면 마지막 정류장에서 해변 입구까지 걷는 거리, 귀가 시간대 배차 간격을 같이 봐야 합니다. 여름 성수기에는 들어갈 때보다 나올 때 시간이 더 걸리는 경우가 많습니다.`,
        ],
      ],
      [
        "현장에서 먼저 확인할 것",
        [
          `도착하면 입수 가능 구역, 안전요원 위치, 샤워장과 화장실, 구명 장비 위치를 먼저 확인하는 것이 좋습니다. 파라솔이나 돗자리를 펼 자리도 물가와 너무 가깝지 않게 잡아야 짐이 젖거나 밀려오는 물에 당황하지 않습니다.`,
          `해변 주변 음식점이나 편의점만 믿고 준비물을 줄이면 성수기에는 줄이 길어질 수 있습니다. 물, 수건, 여벌 옷, 방수팩, 선크림, 슬리퍼는 기본으로 챙기고, 어린이는 모래놀이 뒤 씻길 물티슈나 작은 타월도 따로 두면 편합니다.`,
        ],
      ],
      [
        "날씨와 안전 포인트",
        [
          `해수욕장은 비 예보보다 바람과 파도가 더 중요할 때가 있습니다. 출발 전에는 날씨 앱만 보지 말고 해수욕장 운영 공지, 지자체 안내, 현장 안전 방송을 함께 확인하세요.`,
          `일몰 뒤 입수는 피하는 편이 안전합니다. 사진을 찍거나 산책을 이어갈 계획이라면 물놀이를 먼저 끝내고, 샤워와 환복을 마친 뒤 해변 산책이나 식사로 일정을 넘기는 흐름이 안정적입니다.`,
        ],
      ],
      [
        "함께 묶기 좋은 일정",
        [
          `${name}은 반나절 코스로 잡아도 좋지만, 성수기에는 이동과 주차 시간이 길어질 수 있어 하루 전체를 느슨하게 보는 편이 낫습니다. 오전 도착, 점심 전후 휴식, 늦은 오후 산책 순서가 가장 부담이 적습니다.`,
          `주변 카페나 식당을 붙일 때는 해변에서 가까운 곳만 고르지 말고 귀가 방향에 있는 곳도 후보에 넣어두세요. 젖은 짐과 사람 많은 시간을 피하려면 동선을 한 방향으로 정리하는 것이 좋습니다.`,
        ],
      ],
    ];
  }

  if (target.kind === "valley") {
    return [
      [
        "계곡 물놀이 코스로 볼 때",
        [
          `${name}은 ${region}에서 여름 물소리와 숲길을 함께 즐기기 좋은 계곡 코스입니다. 다만 계곡은 보기보다 물 깊이가 갑자기 달라지고 바위가 미끄러워, 해수욕장보다 준비를 더 꼼꼼히 해야 합니다.`,
          `물놀이 목적이라면 풍경보다 먼저 출입 가능 여부, 물놀이 허용 구간, 우천 뒤 통제 여부를 확인하세요. 전날 비가 많이 왔다면 당일 날씨가 맑아도 수량이 갑자기 늘 수 있습니다.`,
        ],
      ],
      [
        "위치와 접근 방법",
        [
          `위치는 ${address} 기준입니다. 계곡은 내비게이션 목적지와 실제 내려가는 지점이 다를 수 있어, 주차장과 탐방로 입구를 따로 확인하는 편이 좋습니다.`,
          `차량 이동이라면 좁은 도로, 만차 시 회차 가능 여부, 화장실 위치까지 함께 봐야 합니다. 대중교통은 배차 간격이 길 수 있으므로 돌아오는 시간을 먼저 정하고 들어가는 것이 안전합니다.`,
        ],
      ],
      [
        "준비물과 안전 체크",
        [
          `계곡에서는 아쿠아슈즈나 미끄럼 방지 샌들이 체감 차이를 크게 만듭니다. 평평해 보이는 바위도 물이 닿으면 미끄럽고, 아이들은 얕은 곳에서도 중심을 잃기 쉽습니다.`,
          `돗자리, 수건, 방수팩, 벌레 기피제, 여벌 옷을 챙기고 쓰레기는 되가져가는 기준으로 준비하세요. 취사나 야영 가능 여부는 장소마다 다르므로 현장 안내판을 따르는 것이 좋습니다.`,
        ],
      ],
      [
        "비 온 뒤에는 이렇게 판단",
        [
          `비가 그친 뒤 바로 물에 들어가는 일정은 피하는 편이 좋습니다. 물 색이 탁하거나 유속이 빠르면 얕아 보여도 위험할 수 있고, 상류 상황을 현장에서 알기 어렵습니다.`,
          `출발 전에는 지자체 통제 공지와 탐방로 안내를 확인하고, 현장에서는 안전선 안쪽에서만 움직이세요. 물놀이보다 산책 중심으로 바꾸는 선택지도 미리 생각해두면 일정이 무너지지 않습니다.`,
        ],
      ],
      [
        "주변 일정 붙이는 법",
        [
          `${name}은 오전이나 이른 오후에 먼저 들른 뒤, 식사와 카페를 뒤에 붙이는 방식이 편합니다. 젖은 옷과 신발을 오래 들고 이동하지 않도록 환복 장소를 먼저 정해두세요.`,
          `아이와 함께라면 오래 머무는 것보다 짧게 놀고 쉬는 리듬이 낫습니다. 계곡은 체온이 빨리 떨어질 수 있어 물 밖에서 쉴 수 있는 그늘과 마른 수건을 꼭 확보하는 것이 좋습니다.`,
        ],
      ],
    ];
  }

  if (target.kind === "waterpark") {
    return [
      [
        "가족 물놀이 코스로 볼 때",
        [
          `${name}은 ${region}에서 시설형 물놀이를 계획할 때 후보에 넣기 좋은 워터파크입니다. 자연 계곡이나 해수욕장보다 편의시설은 안정적이지만, 성수기에는 입장 대기와 락커, 샤워장 이용 시간이 길어질 수 있습니다.`,
          `방문 전에는 운영 시간, 휴장일, 입장권 구매 방식, 종일권과 오후권 차이를 먼저 확인하세요. 할인권만 보고 갔다가 이용 조건이나 적용 시간이 맞지 않으면 현장에서 시간이 지체됩니다.`,
        ],
      ],
      [
        "위치와 주차",
        [
          `위치는 ${address} 기준입니다. 차량 방문이라면 주차장 입구, 만차 시 안내, 입장 게이트와의 거리를 함께 확인하는 것이 좋습니다.`,
          `대중교통 이용 시에는 젖은 짐을 들고 돌아오는 시간을 고려해야 합니다. 어린이와 함께라면 퇴장 시간대에 택시나 버스 대기가 길어질 수 있어 귀가 수단을 미리 정해두는 편이 안전합니다.`,
        ],
      ],
      [
        "입장 전 준비물",
        [
          `수영복, 수모 또는 캡, 방수팩, 수건, 여벌 옷, 아쿠아슈즈를 기본으로 준비하세요. 시설마다 음식물 반입, 튜브 규격, 구명조끼 대여 조건이 다를 수 있어 공식 안내를 확인해야 합니다.`,
          `아이와 함께라면 락커 위치와 만나는 장소를 먼저 정해두세요. 사람이 많은 워터파크에서는 짧은 이동도 길어질 수 있어, 한 번에 모든 시설을 보려 하기보다 쉬는 시간을 중간에 넣는 편이 좋습니다.`,
        ],
      ],
      [
        "성수기 이용 팁",
        [
          `인기 슬라이드나 파도풀은 오전과 점심 직후 대기가 길어질 수 있습니다. 가장 이용하고 싶은 시설을 먼저 정하고, 나머지는 대기 시간이 짧을 때 붙이는 방식이 현실적입니다.`,
          `샤워장과 탈의실은 퇴장 시간에 몰립니다. 아이가 있거나 짐이 많다면 폐장 직전까지 머물기보다 조금 일찍 씻고 나오는 편이 전체 피로가 줄어듭니다.`,
        ],
      ],
      [
        "예약 전 체크",
        [
          `${name} 방문 전에는 온라인 예매 가능 여부, 현장 발권, 우천 시 운영, 환불 기준을 확인하세요. 실내외 시설이 섞여 있더라도 일부 시설은 날씨나 안전 점검으로 운영이 달라질 수 있습니다.`,
          `최종 일정은 입장권, 주차, 식사, 샤워와 환복 시간을 포함해 잡는 것이 좋습니다. 물놀이 시간만 계산하면 실제 귀가가 늦어지기 쉽습니다.`,
        ],
      ],
    ];
  }

  return [
    [
      "여름 물길 여행으로 볼 때",
      [
        `${name}은 ${region}에서 폭포와 물길 풍경을 보기 좋은 여름 코스입니다. 물에 직접 들어가는 장소라기보다 시원한 경관과 산책을 중심으로 잡는 편이 안전합니다.`,
        `폭포 주변은 물안개와 젖은 바위 때문에 미끄러운 구간이 생기기 쉽습니다. 사진을 찍을 때도 난간 밖으로 나가거나 물가에 너무 가까이 붙지 않는 것이 좋습니다.`,
      ],
    ],
    [
      "위치와 이동 동선",
      [
        `위치는 ${address} 기준입니다. 주차장과 전망 지점 사이의 거리, 계단이나 경사 구간을 먼저 확인하면 동행자에 맞는 체류 시간을 잡기 쉽습니다.`,
        `비가 온 뒤에는 수량이 늘어 경관은 좋아질 수 있지만 탐방로가 미끄러울 수 있습니다. 현장 통제 안내가 있으면 우회하거나 주변 실내 코스로 바꾸는 편이 안전합니다.`,
      ],
    ],
    [
      "준비물과 현장 팁",
      [
        `걷기 편한 신발, 물, 얇은 겉옷, 방수 가능한 가방을 챙기세요. 폭포 주변은 그늘이 있어도 습도가 높고, 계단을 오르내리면 생각보다 체력 소모가 있습니다.`,
        `아이와 함께라면 전망 지점까지 무리해서 이동하기보다 안전한 구간에서 짧게 보고 쉬는 흐름이 좋습니다. 사진 촬영은 사람이 몰리는 지점을 피하면 이동도 훨씬 수월합니다.`,
      ],
    ],
    [
      "함께 묶기 좋은 일정",
      [
        `${name}은 단독 목적지로 오래 머무르기보다 근처 식사, 카페, 산책 코스와 묶으면 만족도가 높습니다. 오전에 먼저 들르면 더위와 혼잡을 피하기 쉽습니다.`,
        `여름에는 갑작스러운 소나기가 생길 수 있으니 실내 대체 코스를 하나 준비해두세요. 물길 여행은 안전 안내를 따르는 것이 가장 중요한 기준입니다.`,
      ],
    ],
  ];
}

function faqFor(target, source) {
  const name = sourceTitle(source);
  if (target.kind === "beach") {
    return [
      ["물놀이가 항상 가능한가요?", "아닙니다. 개장 기간이어도 파고, 조류, 안전요원 배치, 현장 통제에 따라 입수가 제한될 수 있습니다."],
      ["가장 먼저 확인할 것은 무엇인가요?", "입수 가능 구역, 샤워장과 화장실, 주차장 위치, 귀가 동선을 먼저 확인하는 것이 좋습니다."],
      ["아이와 함께 가도 괜찮나요?", "가능하지만 구명조끼, 여벌 옷, 수건, 그늘에서 쉴 시간을 반드시 챙기세요."],
      ["비 예보가 있으면 어떻게 해야 하나요?", "비보다 바람과 파도 상태가 더 중요할 수 있어 현장 안전 안내를 함께 확인해야 합니다."],
      ["문의는 어디서 확인하나요?", `${name} 관련 운영 여부는 지자체 또는 현장 안내를 출발 전에 확인하는 편이 안전합니다.`],
    ];
  }
  if (target.kind === "valley") {
    return [
      ["비 온 뒤에도 갈 수 있나요?", "전날 비가 많이 왔다면 유속과 수위가 달라질 수 있어 출입 통제 여부를 먼저 확인해야 합니다."],
      ["물놀이 준비물은 무엇이 필요한가요?", "아쿠아슈즈, 수건, 여벌 옷, 방수팩, 벌레 기피제, 마른 옷을 챙기는 것이 좋습니다."],
      ["아이와 함께 갈 때 주의할 점은요?", "얕아 보여도 물 깊이가 갑자기 달라질 수 있어 보호자가 가까이 있어야 합니다."],
      ["취사나 야영이 가능한가요?", "장소마다 다릅니다. 현장 안내판과 지자체 공지를 기준으로 판단하세요."],
      ["문의는 어디서 확인하나요?", `${name} 출입 가능 여부와 안전 안내는 출발 전 공식 안내를 확인하는 것이 좋습니다.`],
    ];
  }
  if (target.kind === "waterpark") {
    return [
      ["온라인 예매가 필요한가요?", "성수기에는 현장 대기가 길 수 있어 온라인 예매와 이용 조건을 먼저 확인하는 편이 좋습니다."],
      ["무엇을 챙겨야 하나요?", "수영복, 수모 또는 캡, 수건, 여벌 옷, 방수팩, 아쿠아슈즈를 기본으로 준비하세요."],
      ["음식물 반입이 가능한가요?", "시설마다 기준이 다르므로 방문 전 공식 안내에서 반입 가능 품목을 확인해야 합니다."],
      ["아이와 함께 이용하기 괜찮나요?", "가능하지만 락커 위치, 만나는 장소, 쉬는 시간을 먼저 정해두는 것이 좋습니다."],
      ["우천 시에도 운영하나요?", "실내외 시설 구성과 안전 점검에 따라 달라질 수 있어 당일 운영 공지를 확인하세요."],
    ];
  }
  return [
    ["물에 들어갈 수 있는 곳인가요?", "폭포 주변은 대체로 경관 감상과 산책 중심으로 보는 것이 안전합니다."],
    ["비 온 뒤 방문해도 괜찮나요?", "수량이 늘어도 탐방로가 미끄러울 수 있어 통제 여부를 먼저 확인하세요."],
    ["준비물은 무엇이 필요한가요?", "미끄럼이 덜한 신발, 물, 얇은 겉옷, 방수 가능한 가방을 챙기면 좋습니다."],
    ["아이와 함께 가도 되나요?", "가능하지만 난간 밖 이동이나 물가 접근은 피하고 짧은 코스로 보는 편이 안전합니다."],
  ];
}

function toGenerated(target, source) {
  const address = addressFrom(source);
  const name = sourceTitle(source);
  return {
    contentid: contentId(target.sourceSlug),
    slug: generatedSlug(target.sourceSlug),
    title: target.title,
    sourceTitle: name,
    description: descriptionFor(target, source),
    category: "국내여행",
    region: target.region,
    date: TODAY_LABEL,
    sortDate: TODAY_SORT,
    read: "약 7분",
    image: source.image,
    images: [source.image].filter(Boolean),
    alt: `${name} 이미지`,
    excerpt: `${name} 방문 전 ${visitPoint(target.kind)}를 한 번에 확인해보세요.`,
    keywords: ["물놀이", typeLabel(target.kind), target.region, name],
    info: [
      ["장소", name],
      ["주소", address],
      ["문의", "방문 전 확인 필요"],
      ["요금", target.kind === "waterpark" ? "이용권별 상이" : "현장 안내 기준"],
      ["운영 확인", "개장·입수·출입 가능 여부는 당일 확인 필요"],
      ["방문 포인트", visitPoint(target.kind)],
    ],
    memo: [
      `지역: ${target.region}`,
      `유형: ${typeLabel(target.kind)}`,
      "핵심 체크: 운영 여부, 안전 통제, 주차, 샤워장·화장실, 귀가 동선",
    ],
    tourApi: {
      contentTypeId: "12",
      overview: "",
      homepage: "",
      mapx: "",
      mapy: "",
      intro: {},
    },
    sections: sectionsFor(target, source, address),
    faq: faqFor(target, source),
    manualWaterPostVersion: 1,
  };
}

const [generatedRaw, sourceRaw] = await Promise.all([
  readFile(GENERATED_PATH, "utf8"),
  readFile(SOURCE_PATH, "utf8"),
]);

const generated = JSON.parse(generatedRaw);
const sourcePosts = JSON.parse(sourceRaw);
const sourceBySlug = new Map(sourcePosts.map((post) => [post.slug, post]));
const newPosts = TARGETS.map((target) => {
  const source = sourceBySlug.get(target.sourceSlug);
  if (!source) throw new Error(`Missing source post: ${target.sourceSlug}`);
  return toGenerated(target, source);
});
const newSlugs = new Set(newPosts.map((post) => post.slug));
const next = [...newPosts, ...generated.filter((post) => !newSlugs.has(post.slug))];

await writeFile(GENERATED_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
console.log(`Added ${newPosts.length} water posts.`);
