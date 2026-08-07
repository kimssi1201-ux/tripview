import assert from "node:assert/strict";
import test from "node:test";

import {
  affiliateRegionKeyword,
  deriveAffiliateRegionKeywords,
  deriveTourSearchQueries,
  isSafeMyRealTripUrl,
  normalizeRegion,
  selectAffiliateProducts,
} from "../scripts/lib/affiliate-matching.mjs";

const product = (overrides = {}) => ({
  title: "부산 해양 액티비티",
  url: "https://experiences.myrealtrip.com/products/100",
  image: "https://images.example.test/product.jpg",
  region: "부산",
  category: "액티비티",
  intents: ["booking", "water", "activity"],
  source: "myrealtrip-tna",
  ...overrides,
});

test("normalizes Korean regions and derives useful API search keywords", () => {
  assert.equal(normalizeRegion("전북특별자치도 진안군"), "전북");
  assert.equal(normalizeRegion("경기도 광주시"), "경기");
  assert.equal(affiliateRegionKeyword("전라남도 고흥군"), "고흥");
  assert.equal(affiliateRegionKeyword("서울특별시 용산구"), "서울");
  assert.equal(normalizeRegion(""), "");
});

test("selects only safe products matching both the section region and focused intent", () => {
  const stay = product({
    title: "부산 숙소",
    url: "https://accommodation.myrealtrip.com/union/products/200",
    category: "숙소 예약",
    type: "accommodation",
    intents: ["booking"],
    source: "myrealtrip-accommodation",
  });
  const selected = selectAffiliateProducts({
    sectionId: "water",
    posts: [{ title: "부산 해수욕장 물놀이", region: "부산광역시 해운대구" }],
    products: [
      product(),
      stay,
      product({ title: "오사카 요트", region: "오사카", url: "https://experiences.myrealtrip.com/products/300" }),
      product({ title: "부산 박물관", intents: ["booking", "indoor"], url: "https://experiences.myrealtrip.com/products/400" }),
      product({ title: "위조 링크", url: "https://example.com/products/500" }),
    ],
    limit: 3,
  });

  assert.equal(selected.length, 2);
  assert.deepEqual(new Set(selected.map((item) => item.source)), new Set(["myrealtrip-tna", "myrealtrip-accommodation"]));
  assert.ok(selected.every((item) => item.matchReason.includes("부산")));
});

test("does not fall back to unrelated regions or invalid and empty input", () => {
  const posts = [{ title: "강원 계곡", region: "강원특별자치도 인제군" }];
  assert.deepEqual(selectAffiliateProducts({ sectionId: "water", posts, products: [product()], limit: 2 }), []);
  assert.deepEqual(selectAffiliateProducts({ sectionId: "water", posts: [], products: [product()], limit: 2 }), []);
  assert.deepEqual(selectAffiliateProducts({ sectionId: "water", posts, products: [product()], limit: 0 }), []);
});

test("accepts only HTTPS MyRealTrip destinations", () => {
  assert.equal(isSafeMyRealTripUrl("https://flights.myrealtrip.com/"), true);
  assert.equal(isSafeMyRealTripUrl("http://myrealtrip.com/"), false);
  assert.equal(isSafeMyRealTripUrl("https://myrealtrip.com.example.test/"), false);
  assert.equal(isSafeMyRealTripUrl("not-a-url"), false);
});

test("derives diverse region and intent searches from the latest editorial posts", () => {
  const posts = [
    { title: "고흥 여름 축제", category: "공연/축제", region: "전라남도 고흥군" },
    { title: "부산 해수욕장 물놀이", region: "부산광역시 해운대구" },
    { title: "서울 아이와 박물관", region: "서울특별시 용산구" },
    { title: "서울 실내 미술관", region: "서울특별시 종로구" },
  ];

  const regions = deriveAffiliateRegionKeywords(posts, 3);
  const queries = deriveTourSearchQueries(posts, 8);
  assert.equal(regions[0], "서울");
  assert.ok(regions.includes("부산"));
  assert.ok(queries.includes("부산 액티비티"));
  assert.ok(queries.some((query) => query === "서울 입장권" || query === "서울 가족 체험"));
  assert.ok(queries.includes("고흥 티켓"));
});
