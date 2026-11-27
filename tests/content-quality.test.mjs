import assert from "node:assert/strict";
import test from "node:test";

import {
  MIN_INDEXABLE_BODY_LENGTH,
  flattenPostSections,
  hasCompleteFaqAnswers,
  isIndexablePost,
  postBodyLength,
} from "../scripts/lib/content-quality.mjs";

function postWithBody(length) {
  return {
    slug: "travel-test",
    title: "테스트 여행지",
    editorialStatus: "reviewed",
    sections: [["본문", ["가".repeat(length)]]],
  };
}

test("content quality helper flattens paragraph arrays without metadata noise", () => {
  assert.equal(flattenPostSections([["제목", ["첫 문단", "둘째 문단"]], ["다음", "셋째 문단"]]), "첫 문단 둘째 문단 셋째 문단");
  assert.equal(flattenPostSections(null), "");
});

test("content quality boundary indexes 1500 characters but not 1499", () => {
  assert.equal(postBodyLength(postWithBody(MIN_INDEXABLE_BODY_LENGTH)), MIN_INDEXABLE_BODY_LENGTH);
  assert.equal(isIndexablePost(postWithBody(MIN_INDEXABLE_BODY_LENGTH)), true);
  assert.equal(isIndexablePost(postWithBody(MIN_INDEXABLE_BODY_LENGTH - 1)), false);
});

test("content quality rejects empty identity fields even with a long body", () => {
  const longPost = postWithBody(MIN_INDEXABLE_BODY_LENGTH + 100);
  assert.equal(isIndexablePost({ ...longPost, slug: "" }), false);
  assert.equal(isIndexablePost({ ...longPost, title: "" }), false);
  assert.equal(isIndexablePost({}), false);
});

test("dated legacy snapshot feeds stay out of the index even with reviewed content", () => {
  const snapshot = { ...postWithBody(MIN_INDEXABLE_BODY_LENGTH + 100), slug: "data-festival-schedule-2026" };
  assert.equal(isIndexablePost(snapshot), false);
});

test("content quality detects empty FAQ answers in either published field", () => {
  assert.equal(hasCompleteFaqAnswers({ faq: [["어디인가요?", "서울입니다."]] }), true);
  assert.equal(hasCompleteFaqAnswers({ faq: [["어디인가요?", ""]] }), false);
  assert.equal(hasCompleteFaqAnswers({ faqs: [["문의", ""]] }), false);
  assert.equal(hasCompleteFaqAnswers({ faq: [{ question: "운영 시간은?", answer: "" }] }), false);
  assert.equal(hasCompleteFaqAnswers({ faq: [{ question: "운영 시간은?", answer: "공식 안내 확인" }] }), true);
  assert.equal(hasCompleteFaqAnswers({}), true);
});

test("content quality keeps automated drafts out of the index until editorial review", () => {
  const longPost = postWithBody(MIN_INDEXABLE_BODY_LENGTH + 100);
  assert.equal(isIndexablePost({ ...longPost, editorialStatus: "pending" }), false);
  assert.equal(isIndexablePost({ ...longPost, editorialStatus: undefined }), false);
  assert.equal(isIndexablePost(longPost), true);
});
