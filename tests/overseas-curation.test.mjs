import assert from "node:assert/strict";
import test from "node:test";

import { compactRegion, groupByCategoryData, isOverseasTravelPost } from "../src/lib/content.mjs";

test("domestic attractions never enter overseas picks just because they mention foreign travel", () => {
  assert.equal(isOverseasTravelPost({ category: "여행지", region: "부산", title: "일본 여행보다 부산타워 야경" }), false);
  assert.equal(isOverseasTravelPost({ category: "여행지", region: "부산", description: "해외 여행객이 즐겨 찾는 명소" }), false);
  assert.equal(isOverseasTravelPost({ category: "해외여행", region: "부산" }), false);
  assert.equal(isOverseasTravelPost({ category: "해외여행", region: "해외" }), true);
  assert.equal(isOverseasTravelPost({ category: "여행지", region: "일본 도쿄" }), true);
});

test("published overseas card selection contains overseas regions only", () => {
  const { overseasPosts } = groupByCategoryData();
  assert.ok(overseasPosts.length > 0, "expected at least one reviewed overseas destination");
  assert.ok(overseasPosts.every((post) => compactRegion(post.region) === "해외"), overseasPosts.filter((post) => compactRegion(post.region) !== "해외").map((post) => post.slug).join(", "));
});
