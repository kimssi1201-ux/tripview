import assert from "node:assert/strict";
import test from "node:test";

import { readableSections, removeDuplicateLead, splitReadableParagraphs } from "../src/lib/readability.mjs";

test("article paragraphs are split into readable chunks", () => {
  const source = [
    "9월 현재 9월 19일부터 10월 2일까지는 준성수기로 분류되며 성인 13,000원, 청소년·어린이·경로는 11,000원이다.",
    "반면 10월 3일부터 11월 30일까지 이어지는 성수기에는 일반 15,000원, 어린이·청소년·경로·장애인은 13,000원으로 오른다.",
    "국화가 절정에 이르는 시기일수록 요금도 높아지는 구조인 셈이다.",
    "다만 36개월 미만 영유아는 증빙 서류를 지참하면 무료로 입장할 수 있어 어린 자녀를 동반한 가족이라면 이 부분을 챙겨두는 게 좋다.",
  ].join(" ");
  const [section] = readableSections([{ heading: "요금과 운영시간", paragraphs: [source] }]);

  assert.equal(section.heading, "요금과 운영시간");
  assert.ok(section.paragraphs.length >= 3);
  assert.ok(section.paragraphs.every((paragraph) => paragraph.length <= 140), section.paragraphs.join("\n---\n"));
  assert.equal(section.paragraphs.join(" "), source);
  assert.equal(splitReadableParagraphs("평점은 4.7점입니다. 리뷰는 2,666개입니다.").join(" "), "평점은 4.7점입니다. 리뷰는 2,666개입니다.");
});

test("repeated intro excerpt is removed without deleting original article text", () => {
  const excerpt = "부산타워는 야경 방문 전에 운영 시간과 발권 마감을 확인하는 여행지입니다.";
  const sections = readableSections([
    { heading: "관람 포인트", paragraphs: [excerpt, "야경 관람 후에는 용두산공원을 함께 걸어볼 수 있습니다."] },
    { heading: "운영시간", paragraphs: ["운영시간은 방문 날짜별로 달라질 수 있습니다."] },
  ]);
  const result = removeDuplicateLead(sections, excerpt);
  assert.equal(result.length, 2);
  assert.equal(result[0].paragraphs.join(" "), "야경 관람 후에는 용두산공원을 함께 걸어볼 수 있습니다.");
  assert.equal(removeDuplicateLead(sections, "완전히 다른 소개문")[0].paragraphs[0], excerpt);
});
