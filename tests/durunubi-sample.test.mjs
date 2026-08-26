import assert from "node:assert/strict";
import test from "node:test";

import {
  CONFIDENT_MATCH_SCORE,
  REGION_CONFIRMED_MATCH_SCORE,
  matchDurunubiCourse,
  regionTokensForPost,
  selectDurunubiSamplePosts,
  summarizeDurunubiResults,
} from "../scripts/sample-durunubi.mjs";

test("Durunubi sample candidates come from title, sourceTitle, or tags only", () => {
  const posts = [
    { slug: "trail-title", title: "횡성호수길 5구간 걷기 전 확인할 거리", region: "강원특별자치도 횡성군" },
    { slug: "trail-tag", title: "강릉 바다 여행", tags: ["숲길"], region: "강원특별자치도 강릉시" },
    { slug: "body-only", title: "일반 관광지", body: "본문에 산책이라는 말이 있습니다.", region: "서울특별시 중구" },
    { slug: "trail-source", sourceTitle: "지리산둘레길 방광-산동", title: "구례 걷기 코스", region: "전라남도 구례군" },
  ];

  const slugs = selectDurunubiSamplePosts(posts, 10).map((post) => post.slug);

  assert.deepEqual(slugs, ["trail-source", "trail-tag", "trail-title"]);
});

test("Durunubi course matching uses route, course name, and sigun text", () => {
  const post = {
    slug: "travel-2788055",
    title: "전남 구례군 [지리산둘레길] 방광-산동, 이용시간·예약과 준비물",
    region: "전라남도 구례군",
  };
  const routes = [{ routeIdx: "5", themeNm: "지리산둘레길", linemsg: "지리산 권역 걷기길" }];
  const courses = [
    {
      routeIdx: "5",
      sigun: "구례군",
      crsKorNm: "지리산둘레길 방광-산동",
      crsDstnc: "13.2km",
      crsTotlRqrmHour: "5시간",
      crsLevel: "2",
      gpxpath: "https://example.com/course.gpx",
    },
  ];

  const result = matchDurunubiCourse(post, courses, routes);

  assert.equal(result.matched, true);
  assert.equal(result.themeNm, "지리산둘레길");
  assert.equal(result.crsKorNm, "지리산둘레길 방광-산동");
  assert.equal(result.level, "중");
  assert.equal(result.hasGpx, true);
  assert.equal(result.score >= CONFIDENT_MATCH_SCORE, true);
});

test("Durunubi region tokens keep one-syllable district names matchable", () => {
  assert.deepEqual(regionTokensForPost({ region: "부산광역시 서구" }), ["부산", "서구"]);
});

test("Durunubi course matching does not pass on region-only overlap", () => {
  const post = {
    slug: "travel-127722",
    title: "강릉 안목해변 여름 코스, 바다 산책·카페거리·주차 체크",
    region: "강원특별자치도 강릉시",
  };
  const routes = [{ routeIdx: "7", themeNm: "해파랑길" }];
  const courses = [
    {
      routeIdx: "7",
      sigun: "강릉시",
      crsKorNm: "해파랑길 39코스",
      crsDstnc: "16.1km",
      crsTotlRqrmHour: "5시간",
      crsLevel: "2",
    },
  ];

  const result = matchDurunubiCourse(post, courses, routes);

  assert.equal(result.matched, false);
  assert.equal(result.score < CONFIDENT_MATCH_SCORE, true);
  assert.equal(result.regionExcluded, false);
});

test("Durunubi course matching accepts lower scores only when city or county is confirmed", () => {
  const post = {
    slug: "travel-donghae-trail",
    title: "동해 해안길 산책, 바다 따라 걷는 코스",
    region: "강원특별자치도 동해시",
    tags: ["산책로"],
  };
  const routes = [{ routeIdx: "7", themeNm: "해파랑길" }];
  const courses = [
    {
      routeIdx: "7",
      sigun: "강원 동해시",
      crsKorNm: "해안길 산책로 1코스",
      crsDstnc: "8",
      crsTotlRqrmHour: "150",
      crsLevel: "1",
    },
  ];

  const result = matchDurunubiCourse(post, courses, routes);

  assert.equal(result.regionConfirmed, true);
  assert.equal(result.score >= REGION_CONFIRMED_MATCH_SCORE, true);
  assert.equal(result.score < CONFIDENT_MATCH_SCORE, true);
  assert.equal(result.matched, true);
});

test("Durunubi course matching rejects province-only false positives", () => {
  const post = {
    slug: "travel-2774026",
    title: "횡성호수길 5구간 걷기 전 확인할 거리·난이도·귀환 동선",
    region: "강원특별자치도 횡성군",
  };
  const routes = [{ routeIdx: "47", themeNm: "DMZ 평화의 길" }];
  const courses = [
    {
      routeIdx: "47",
      sigun: "강원 철원군",
      crsKorNm: "DMZ 평화의 길 16코스",
      crsDstnc: "21",
      crsTotlRqrmHour: "420",
      crsLevel: "2",
    },
  ];

  const result = matchDurunubiCourse(post, courses, routes);

  assert.equal(result.matched, false);
  assert.equal(result.score, 0);
  assert.equal(result.regionExcluded, true);
  assert.equal(result.crsKorNm, undefined);
});

test("Durunubi course matching requires a confident score", () => {
  const post = {
    slug: "travel-125677",
    title: "동해 무릉계곡 여름 산책과 물놀이, 코스 길이·안전 체크",
    region: "강원특별자치도 동해시",
  };
  const routes = [{ routeIdx: "7", themeNm: "해파랑길" }];
  const courses = [
    {
      routeIdx: "7",
      sigun: "강원 동해시",
      crsKorNm: "해파랑길 33코스",
      crsDstnc: "14",
      crsTotlRqrmHour: "270",
      crsLevel: "1",
    },
  ];

  const result = matchDurunubiCourse(post, courses, routes);

  assert.equal(result.regionConfirmed, true);
  assert.equal(result.score < REGION_CONFIRMED_MATCH_SCORE, true);
  assert.equal(result.matched, false);
});

test("Durunubi course matching avoids partial district-name matches", () => {
  const post = {
    slug: "travel-2666784",
    title: "광주 동구 지호로 여행, 활기와 산책을 함께 즐기는 방문 동선",
    region: "광주광역시 동구",
  };
  const routes = [{ routeIdx: "47", themeNm: "DMZ 평화의 길" }];
  const courses = [
    {
      routeIdx: "47",
      sigun: "서울 강동구",
      crsKorNm: "DMZ 평화의 길 19-1코스",
      crsDstnc: "26",
      crsTotlRqrmHour: "540",
      crsLevel: "3",
    },
  ];

  const result = matchDurunubiCourse(post, courses, routes);

  assert.equal(result.matched, false);
  assert.equal(result.score, 0);
  assert.equal(result.regionExcluded, true);
  assert.equal(result.crsKorNm, undefined);
});

test("Durunubi sample summary reports match and failure rates", () => {
  const summary = summarizeDurunubiResults([
    { matched: true },
    { matched: false },
    { matched: true },
  ]);

  assert.equal(summary.checked, 3);
  assert.equal(summary.matched, 2);
  assert.equal(summary.failed, 1);
  assert.equal(summary.matchRate, 2 / 3);
  assert.equal(summary.failureRate, 1 / 3);
});
