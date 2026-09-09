import assert from "node:assert/strict";
import test from "node:test";

import {
  articleAffiliatePlacements,
  debugArticleAffiliateSelection,
  selectArticleAffiliateProducts,
} from "../src/lib/affiliate.mjs";
import { selectAccommodationItems, selectTnaItems } from "../src/lib/content.mjs";

const post = (overrides = {}) => ({
  slug: "sample-post",
  title: "제주 성산 가을 여행 코스",
  sourceTitle: "제주 성산",
  description: "제주 성산과 오름을 돌아보는 여행 정보",
  excerpt: "성산 일대 동선과 입장권, 숙소 위치를 확인합니다.",
  category: "여행지",
  region: "제주특별자치도 서귀포시",
  keywords: ["제주", "성산", "가을"],
  info: [["주소", "제주특별자치도 서귀포시 성산읍"]],
  sections: [
    ["성산에서 먼저 볼 곳", ["성산 일대는 동선과 주차 확인이 중요합니다."]],
    ["입장권과 이동 체크", ["현장 상황에 따라 입장권과 이동 시간을 함께 확인합니다."]],
  ],
  ...overrides,
});

const product = (overrides = {}) => ({
  id: "tna-jeju-1",
  type: "tna",
  source: "myrealtrip-tna",
  title: "제주 성산 입장권",
  url: "https://experiences.myrealtrip.com/products/100",
  image: "https://images.example.test/jeju.jpg",
  price: 12000,
  priceText: "12,000원부터",
  region: "제주",
  city: "성산",
  category: "입장권",
  tags: ["제주", "성산", "입장권"],
  intents: ["booking", "ticket", "tour"],
  sourceLabel: "마이리얼트립",
  ...overrides,
});

test("prefers Jeju products for a Jeju article", () => {
  const selected = selectArticleAffiliateProducts({
    post: post(),
    products: [
      product({ id: "stay-busan", type: "accommodation", source: "myrealtrip-accommodation", title: "부산 호텔", region: "부산", city: "부산", url: "https://accommodation.myrealtrip.com/union/products/200" }),
      product({ id: "stay-jeju", type: "accommodation", source: "myrealtrip-accommodation", title: "제주 성산 숙소", region: "제주", city: "성산", url: "https://accommodation.myrealtrip.com/union/products/201" }),
    ],
    maxProducts: 1,
  });

  assert.equal(selected.length, 1);
  assert.equal(selected[0].product.id, "stay-jeju");
  assert.ok(selected[0].score > 0);
});

test("does not place Jeju products in a Busan article", () => {
  const selected = selectArticleAffiliateProducts({
    post: post({
      title: "부산 해운대 바다 여행",
      region: "부산광역시 해운대구",
      keywords: ["부산", "해운대"],
      info: [["주소", "부산광역시 해운대구"]],
    }),
    products: [product()],
    maxProducts: 2,
  });

  assert.deepEqual(selected, []);
});

test("selects Da Nang accommodation for a Da Nang overseas article", () => {
  const selected = selectArticleAffiliateProducts({
    post: post({
      title: "9월 다낭 여행, 해변과 호이안 동선",
      category: "해외여행",
      region: "해외",
      keywords: ["다낭", "호이안", "해외여행"],
      myrealtripAccommodationKeywords: ["다낭"],
      info: [],
    }),
    products: [
      product({ id: "osaka-stay", type: "accommodation", source: "myrealtrip-accommodation", title: "오사카 난바 호텔", region: "오사카", city: "오사카", url: "https://accommodation.myrealtrip.com/union/products/300" }),
      product({ id: "danang-stay", type: "accommodation", source: "myrealtrip-accommodation", title: "다낭 미케비치 리조트", region: "다낭", city: "다낭", url: "https://accommodation.myrealtrip.com/union/products/301" }),
    ],
    maxProducts: 1,
  });

  assert.equal(selected.length, 1);
  assert.equal(selected[0].product.id, "danang-stay");
  assert.ok(selected[0].reasons.some((reason) => reason.includes("다낭")));
});

test("hides the block when no product reaches the relevance threshold", () => {
  const selected = selectArticleAffiliateProducts({
    post: post(),
    products: [
      product({ id: "seoul-random", title: "서울 실내 전시", region: "서울", city: "서울", url: "https://experiences.myrealtrip.com/products/400" }),
    ],
    maxProducts: 2,
  });

  assert.equal(selected.length, 0);
});

test("does not select the same product twice", () => {
  const selected = selectArticleAffiliateProducts({
    post: post(),
    products: [
      product({ id: "dup", url: "https://experiences.myrealtrip.com/products/500" }),
      product({ id: "dup", url: "https://experiences.myrealtrip.com/products/500" }),
      product({ id: "stay-jeju", type: "accommodation", source: "myrealtrip-accommodation", title: "제주 성산 숙소", region: "제주", city: "성산", url: "https://accommodation.myrealtrip.com/union/products/501" }),
    ],
    maxProducts: 3,
  });

  assert.equal(new Set(selected.map((item) => item.product.id)).size, selected.length);
});

test("disableAuto prevents automatic placement", () => {
  const selected = selectArticleAffiliateProducts({
    post: post({ affiliate: { disableAuto: true } }),
    products: [product()],
    maxProducts: 2,
  });

  assert.deepEqual(selected, []);
});

test("article placements keep the default maximum of two blocks", () => {
  const placements = articleAffiliatePlacements({
    post: post(),
    products: [
      product({ id: "ticket-1", url: "https://experiences.myrealtrip.com/products/600" }),
      product({ id: "ticket-2", title: "제주 성산 투어", url: "https://experiences.myrealtrip.com/products/601" }),
      product({ id: "stay-1", type: "accommodation", source: "myrealtrip-accommodation", title: "제주 성산 숙소", region: "제주", city: "성산", url: "https://accommodation.myrealtrip.com/union/products/602" }),
    ],
  });

  assert.equal(placements.length, 2);
  assert.deepEqual(placements.map((item) => item.placement), ["inline", "bottom"]);
  assert.equal(placements[0].afterSectionIndex, 1);
});

test("debug selection exposes reasons without requiring production HTML output", () => {
  const debug = debugArticleAffiliateSelection({
    post: post(),
    products: [product()],
  });

  assert.equal(debug.post, "sample-post");
  assert.equal(debug.selectedProducts.length, 1);
  assert.ok(debug.selectedProducts[0].score > 0);
  assert.ok(debug.selectedProducts[0].reasons.length > 0);
});

test("legacy content selectors still return bounded arrays", () => {
  assert.ok(Array.isArray(selectAccommodationItems({ post: post({ title: "오사카 숙소", region: "해외", myrealtripAccommodationKeywords: ["오사카"] }), limit: 2 })));
  assert.ok(selectAccommodationItems({ post: post({ title: "오사카 숙소", region: "해외", myrealtripAccommodationKeywords: ["오사카"] }), limit: 2 }).length <= 2);
  assert.ok(Array.isArray(selectTnaItems({ post: post(), limit: 2 })));
  assert.ok(selectTnaItems({ post: post(), limit: 2 }).length <= 2);
});
