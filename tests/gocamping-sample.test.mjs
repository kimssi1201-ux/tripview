import assert from "node:assert/strict";
import test from "node:test";

import {
  distanceKm,
  gocampingKeywordForPost,
  matchGocampingItem,
  postCoordinates,
  regionTokensForPost,
  selectGocampingSamplePosts,
  summarizeGocampingResults,
} from "../scripts/sample-gocamping.mjs";

test("GoCamping sample candidates come from title, sourceTitle, or tags only", () => {
  const posts = [
    { slug: "camp-title", title: "서울 중랑숲캠핑장 예약 전 확인", region: "서울특별시 중랑구", contentid: "2709615" },
    { slug: "camp-tag", title: "강릉 바다 여행", tags: ["글램핑"], region: "강원특별자치도 강릉시" },
    { slug: "body-only", title: "일반 관광지", body: "본문에 캠핑이라는 말이 있습니다.", region: "서울특별시 중구" },
    { slug: "camp-source", sourceTitle: "속초밤하늘글램핑", title: "속초 숙박 동선", region: "강원특별자치도 속초시" },
  ];

  const slugs = selectGocampingSamplePosts(posts, 10).map((post) => post.slug);

  assert.deepEqual(slugs, ["camp-title", "camp-tag", "camp-source"]);
});

test("GoCamping direct contentId matching wins first", () => {
  const post = {
    slug: "travel-2709615",
    title: "서울 중랑구 중랑숲캠핑장, 예약 전 확인할 정보",
    region: "서울특별시 중랑구",
    contentid: "2709615",
  };
  const items = [
    {
      contentId: "999",
      facltNm: "중랑 비슷한 야영장",
      doNm: "서울",
      sigunguNm: "중랑구",
      mapX: "127.1",
      mapY: "37.6",
    },
    {
      contentId: "2709615",
      facltNm: "중랑숲캠핑장",
      doNm: "서울시",
      sigunguNm: "중랑구",
      firstImageUrl: "https://example.com/image.jpg",
    },
  ];

  const result = matchGocampingItem(post, items);

  assert.equal(result.matched, true);
  assert.equal(result.method, "contentId");
  assert.equal(result.contentId, "2709615");
  assert.equal(result.hasFirstImage, true);
});

test("GoCamping keyword extraction removes region and article suffixes", () => {
  assert.equal(
    gocampingKeywordForPost({
      title: "경기 양평군 천사봉오토캠핑장, 이용시간·예약과 준비물",
    }),
    "천사봉오토캠핑장",
  );
  assert.equal(
    gocampingKeywordForPost({
      sourceTitle: "월포해수욕장야영장",
      title: "경남 남해군 월포해수욕장야영장, 개장 여부·주차와 편의시설 확인",
    }),
    "월포해수욕장야영장",
  );
});

test("GoCamping text fallback requires confirmed city or county", () => {
  const post = {
    slug: "travel-2734043",
    title: "속초밤하늘글램핑 예약 전 확인할 정보",
    region: "강원특별자치도 속초시",
  };
  const items = [
    {
      contentId: "2734043",
      facltNm: "속초밤하늘글램핑",
      doNm: "강원",
      sigunguNm: "속초시",
    },
  ];

  const result = matchGocampingItem(post, items);

  assert.equal(result.matched, true);
  assert.equal(result.method, "text");
  assert.equal(result.regionConfirmed, true);
});

test("GoCamping text fallback rejects different city or county", () => {
  const post = {
    slug: "travel-2734043",
    title: "속초밤하늘글램핑 예약 전 확인할 정보",
    region: "강원특별자치도 속초시",
  };
  const items = [
    {
      contentId: "123",
      facltNm: "속초밤하늘글램핑",
      doNm: "강원",
      sigunguNm: "인제군",
    },
  ];

  const result = matchGocampingItem(post, items);

  assert.equal(result.matched, false);
  assert.equal(result.regionExcluded, true);
  assert.equal(result.score, 0);
});

test("GoCamping text fallback does not match only on generic camping words", () => {
  const post = {
    slug: "travel-2731167",
    title: "경기 포천시 화적연캠핑장, 이용시간·예약과 준비물",
    region: "경기도 포천시",
  };
  const items = [
    {
      contentId: "1057",
      facltNm: "캠핑플래닛2",
      lineIntro: "경기도 포천시에서 이용 가능한 캠핑장",
      doNm: "경기도",
      sigunguNm: "포천시",
    },
  ];

  const result = matchGocampingItem(post, items);

  assert.equal(result.regionConfirmed, true);
  assert.equal(result.exactFacilityName, false);
  assert.equal(result.matched, false);
});

test("GoCamping coordinate matching can be used when Tripview posts later expose coordinates", () => {
  const post = {
    slug: "camp-coord",
    title: "중랑숲캠핑장",
    region: "서울특별시 중랑구",
    mapX: "127.109",
    mapY: "37.606",
  };
  const items = [
    {
      contentId: "coord",
      facltNm: "다른 이름",
      doNm: "서울",
      sigunguNm: "중랑구",
      mapX: "127.110",
      mapY: "37.607",
    },
  ];

  const result = matchGocampingItem(post, items);

  assert.equal(postCoordinates(post)?.lon, 127.109);
  assert.equal(result.matched, true);
  assert.equal(result.method, "coordinates");
  assert.equal(result.distanceKm < 1, true);
  assert.equal(distanceKm({ lon: 127.109, lat: 37.606 }, { lon: 127.11, lat: 37.607 }) < 1, true);
});

test("GoCamping region tokens keep city and county names matchable", () => {
  assert.deepEqual(regionTokensForPost({ region: "강원특별자치도 속초시" }), ["강원", "속초시"]);
});

test("GoCamping summary reports match and failure rates", () => {
  const summary = summarizeGocampingResults([
    { matched: true, method: "contentId" },
    { matched: false, method: "none" },
    { matched: true, method: "text" },
  ]);

  assert.equal(summary.checked, 3);
  assert.equal(summary.matched, 2);
  assert.equal(summary.failed, 1);
  assert.equal(summary.directId, 1);
  assert.equal(summary.text, 1);
  assert.equal(summary.matchRate, 2 / 3);
  assert.equal(summary.failureRate, 1 / 3);
});
