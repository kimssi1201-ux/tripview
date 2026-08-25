import assert from "node:assert/strict";
import test from "node:test";

import { postBodyLength } from "../scripts/lib/content-quality.mjs";
import {
  MIN_ENRICHED_BODY_LENGTH,
  enrichPost,
  hasInternalProductionCopy,
  postType,
  repairEnrichedPost,
  verifiedFacts,
} from "../scripts/lib/post-enrichment.mjs";

function samplePost(overrides = {}) {
  return {
    slug: "travel-test",
    title: "테스트문화관, 방문 전 알아둘 위치와 여행 동선",
    sourceTitle: "테스트문화관",
    category: "국내여행",
    region: "서울특별시 종로구",
    description: "짧은 설명",
    excerpt: "짧은 요약",
    info: [
      ["장소", "서울특별시 종로구 테스트로 1"],
      ["주소", "서울특별시 종로구 테스트로 1"],
      ["문의", "방문 전 확인 필요"],
      ["요금", "시설별 상이"],
      ["운영 확인", "방문 전 확인 필요"],
    ],
    tourApi: {
      contentTypeId: "14",
      overview: "지역의 생활문화 자료를 전시하는 공간입니다. 상설 전시와 기획 전시를 운영합니다.",
      intro: {
        usetimeculture: "10:00~18:00",
        restdateculture: "매주 월요일",
        usefee: "성인 5,000원",
        parkingculture: "주차 가능",
        infocenterculture: "02-1234-5678",
      },
    },
    sections: [],
    memo: [],
    ...overrides,
  };
}

test("enrichment uses verified detail fields and replaces placeholders", () => {
  const enriched = enrichPost(samplePost(), "2026-08-09");
  const info = Object.fromEntries(enriched.info);
  assert.equal(info["운영 확인"], "10:00~18:00");
  assert.equal(info["문의"], "02-1234-5678");
  assert.equal(info["요금"], "성인 5,000원");
  assert.equal(info["주차"], "주차 가능");
  assert.equal(info["쉬는 날"], "매주 월요일");
  assert.doesNotMatch(enriched.sections.flat(2).join(" "), /API|캐시|저장되어 있습니다|본문에 넣지 않았습니다/);
});

test("enrichment produces an indexable article without internal API wording", () => {
  const enriched = enrichPost(samplePost(), "2026-08-09");
  assert.ok(postBodyLength(enriched) >= MIN_ENRICHED_BODY_LENGTH);
  assert.equal(hasInternalProductionCopy(enriched), false);
  assert.equal(enriched.updatedAt, "2026-08-09");
});

test("enrichment handles empty detail values without inventing facts", () => {
  const enriched = enrichPost(samplePost({
    tourApi: { contentTypeId: "32", overview: "", intro: {} },
    info: [["장소", "부산광역시 해운대구 테스트로 2"]],
    sourceTitle: "테스트호텔",
    region: "부산광역시 해운대구",
  }));
  const text = enriched.sections.flat(2).join(" ");
  assert.equal(postType(enriched).key, "lodging");
  assert.doesNotMatch(text, /별도로 확인되지 않습니다|방문 전 확인 필요|시설별 상이/);
  assert.doesNotMatch(text, /24시간 운영합니다|무료 주차입니다|조식이 포함됩니다/);
  assert.ok(postBodyLength(enriched) >= MIN_ENRICHED_BODY_LENGTH);
});

test("content type mapping gives food and lodging different article structures", () => {
  const lodging = enrichPost(samplePost({ tourApi: { contentTypeId: "32", intro: {} } }));
  const food = enrichPost(samplePost({ tourApi: { contentTypeId: "39", intro: { opentimefood: "11:00~20:00" } } }));
  assert.match(lodging.title, /체크인/);
  assert.match(food.title, /영업시간/);
  assert.ok(lodging.sections.some(([heading]) => heading === "체크인 전 확인할 항목"));
  assert.ok(food.sections.some(([heading]) => heading === "영업시간과 식사 계획"));
});

test("verified facts prefer detailed values over generic info placeholders", () => {
  const facts = verifiedFacts(samplePost());
  assert.equal(facts.hours, "10:00~18:00");
  assert.equal(facts.fee, "성인 5,000원");
  assert.equal(facts.contact, "02-1234-5678");
});

test("article titles remove trailing source punctuation and generic domestic prefixes", () => {
  const enriched = enrichPost(samplePost({
    sourceTitle: "남파랑길 여행코스.",
    region: "국내",
    tourApi: { contentTypeId: "25", overview: "", intro: {} },
  }));
  assert.equal(enriched.title, "남파랑길 여행코스, 구간별 이동시간과 준비물");
});

test("empty API details omit placeholder rows and use natural fallback copy", () => {
  const enriched = enrichPost(samplePost({
    sourceTitle: "한적한 여행 코스",
    region: "국내",
    info: [
      ["주소", "방문 전 위치 확인 필요"],
      ["문의", "방문 전 확인 필요"],
      ["방문 포인트", "산책과 휴식"],
    ],
    tourApi: { contentTypeId: "25", overview: "", intro: {} },
  }), "2026-08-09");

  assert.deepEqual(enriched.info, [["방문 포인트", "산책과 휴식"]]);
  assert.doesNotMatch(JSON.stringify(enriched.sections), /국내 안/);
  assert.doesNotMatch(JSON.stringify(enriched.info), /방문 전 (?:위치 )?확인 필요/);
});

test("automated publishing preserves valid enrichment and repairs truncated copy", () => {
  const enriched = enrichPost(samplePost(), "2026-08-09");
  assert.strictEqual(repairEnrichedPost(enriched, "2026-08-10"), enriched);

  const truncated = { ...enriched, sections: enriched.sections.slice(0, 2) };
  const repaired = repairEnrichedPost(truncated, "2026-08-10");
  assert.ok(postBodyLength(repaired) >= MIN_ENRICHED_BODY_LENGTH);
  assert.equal(repaired.contentDepthUpdatedAt, "2026-08-10");
});
