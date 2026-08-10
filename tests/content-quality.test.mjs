import assert from "node:assert/strict";
import test from "node:test";

import {
  MIN_INDEXABLE_BODY_LENGTH,
  flattenPostSections,
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

test("content quality keeps automated drafts out of the index until editorial review", () => {
  const longPost = postWithBody(MIN_INDEXABLE_BODY_LENGTH + 100);
  assert.equal(isIndexablePost({ ...longPost, editorialStatus: "pending" }), false);
  assert.equal(isIndexablePost({ ...longPost, editorialStatus: undefined }), false);
  assert.equal(isIndexablePost(longPost), true);
});
