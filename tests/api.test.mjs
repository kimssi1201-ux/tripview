import assert from "node:assert/strict";
import test from "node:test";

import { onRequestGet as beachInfoGet } from "../functions/api/beach-info.js";
import { onRequestGet as coupangGet } from "../functions/api/coupang/search.js";
import { onRequestGet as myrealtripGet } from "../functions/api/myrealtrip/search.js";
import { onRequest as routeRequest, transformArticleHtml } from "../functions/[[path]].js";
import { assetStore, jsonResponse, request, responseJson, withMockFetch } from "./helpers.mjs";

test("beach API rejects an unknown mapping and a missing key", async () => {
  const unknown = await beachInfoGet({ request: request("/api/beach-info?beach=unknown"), env: {} });
  assert.equal(unknown.status, 404);
  assert.equal((await responseJson(unknown)).ok, false);

  const missingKey = await beachInfoGet({ request: request("/api/beach-info?beach=travel-126078"), env: {} });
  assert.equal(missingKey.status, 503);
  assert.equal((await responseJson(missingKey)).configured, false);
});

test("beach API normalizes the official response and rejects unsafe links", async () => {
  const calls = [];
  const response = await withMockFetch(async (url, options) => {
    calls.push({ url: new URL(url), options });
    return jsonResponse({
      getOceansBeachInfo: {
        header: { code: "00" },
        item: [{
          sido_nm: "부산",
          gugun_nm: "수영구",
          sta_nm: "광안리",
          beach_wid: "20",
          beach_len: "1,000",
          beach_knd: "사빈",
          link_addr: "javascript:alert(1)",
          link_nm: "악성 링크",
          beach_img: "https://images.example.test/gwangalli.jpg",
          link_tel: "051-000-0000",
          lat: "35.1532",
          lon: "129.1186",
        }],
      },
    });
  }, async () => beachInfoGet({
    request: request("/api/beach-info?beach=travel-126078"),
    env: { TRIPVIEW_API_KEY: "encoded%2Fkey" },
  }));

  assert.equal(response.status, 200);
  const payload = await responseJson(response);
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.info, {
    province: "부산",
    county: "수영구",
    name: "광안리",
    width: 20,
    length: 1000,
    feature: "사빈",
    link: "",
    linkName: "악성 링크",
    image: "https://images.example.test/gwangalli.jpg",
    emergencyPhone: "051-000-0000",
    latitude: 35.1532,
    longitude: 129.1186,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.searchParams.get("ServiceKey"), "encoded/key");
  assert.equal(calls[0].url.searchParams.get("SIDO_NM"), "부산");
});

test("beach API follows pagination until the mapped beach is found", async () => {
  const pages = [];
  const response = await withMockFetch(async (url) => {
    const page = new URL(url).searchParams.get("pageNo");
    pages.push(page);
    return jsonResponse({
      getOceansBeachInfo: {
        header: { code: "00" },
        numOfRows: 1,
        totalCount: 2,
        item: page === "1" ? [{ sta_nm: "다른 해변" }] : [{ sta_nm: "광안리", beach_wid: "12" }],
      },
    });
  }, async () => beachInfoGet({
    request: request("/api/beach-info?beach=travel-126078"),
    env: { BEACH_INFO_API_KEY: "test-key" },
  }));

  assert.equal(response.status, 200);
  assert.equal((await responseJson(response)).info.width, 12);
  assert.deepEqual(pages, ["1", "2"]);
});

test("beach API returns a gateway error when the upstream fails", async () => {
  const response = await withMockFetch(async () => {
    throw new Error("upstream unavailable");
  }, async () => beachInfoGet({
    request: request("/api/beach-info?beach=travel-126078"),
    env: { BEACH_INFO_API_KEY: "test-key" },
  }));

  assert.equal(response.status, 502);
  assert.equal((await responseJson(response)).ok, false);
});

test("MyRealTrip search validates type and serves bounded static flight fallback", async () => {
  const invalid = await myrealtripGet({ request: request("/api/myrealtrip/search?type=unknown"), env: {} });
  assert.equal(invalid.status, 400);

  const assets = assetStore({
    "/data/myrealtrip-flight-deals.json": [
      { title: "ICN-TYO", fromCity: "ICN", toCity: "도쿄", totalPrice: 180000, priceText: "180,000원", period: 3 },
      { title: "ICN-KIX", fromCity: "ICN", toCity: "오사카", totalPrice: 220000, priceText: "220,000원", period: 5 },
    ],
  });
  const emptyAtUpperPeriod = await myrealtripGet({
    request: request("/api/myrealtrip/search?type=flight&departure=ICN&period=99"),
    env: { ASSETS: assets },
  });
  const emptyPayload = await responseJson(emptyAtUpperPeriod);
  assert.equal(emptyPayload.ok, true);
  assert.equal(emptyPayload.fallback, true);
  assert.deepEqual(emptyPayload.items, []);
});

test("MyRealTrip accommodation search clamps dates and guest counts", async () => {
  const calls = [];
  const response = await withMockFetch(async (url, options) => {
    calls.push({ url: new URL(url), options });
    if (url.endsWith("region-autocomplete")) {
      return jsonResponse({ data: { regions: [{ type: "CITY", regionId: "seoul", name: "서울" }] } });
    }
    return jsonResponse({ data: { items: [{
      itemName: "서울 호텔",
      productUrl: "https://accommodation.myrealtrip.com/products/1",
      thumbnailUrl: "https://cdn.example.test/hotel.jpg",
      salePrice: 100000,
    }] } });
  }, async () => myrealtripGet({
    request: request("/api/myrealtrip/search?type=accommodation&keyword=서울&checkIn=2026-07-30&checkOut=2026-07-20&adultCount=0&childCount=99"),
    env: { MYREALTRIP_API_KEY: "test-key" },
  }));

  assert.equal(response.status, 200);
  const payload = await responseJson(response);
  assert.equal(payload.items.length, 1);
  assert.equal(payload.items[0].image, "https://cdn.example.test/hotel.jpg");
  assert.equal(calls.length, 2);
  const body = JSON.parse(calls[1].options.body);
  assert.deepEqual(body, {
    regionId: "seoul",
    checkIn: "2026-07-30",
    checkOut: "2026-08-01",
    adultCount: 1,
    childCount: 9,
    page: 0,
    size: 10,
  });
});

test("MyRealTrip flight search uses a safe public booking URL", async () => {
  let requestBody;
  const response = await withMockFetch(async (url, options) => {
    assert.match(url, /flight\/calendar\/bulk-lowest$/);
    requestBody = JSON.parse(options.body);
    return jsonResponse({ data: [
      { fromCity: "인천", toCity: "후쿠오카", totalPrice: 150000, departureDate: "2026-08-01", returnDate: "2026-08-04" },
      { fromCity: "인천", toCity: "", totalPrice: 90000 },
    ] });
  }, async () => myrealtripGet({
    request: request("/api/myrealtrip/search?type=flight&departure=ICN&period=3"),
    env: { MYREALTRIP_API_KEY: "test-key" },
  }));

  const payload = await responseJson(response);
  assert.deepEqual(requestBody, { depCityCd: "ICN", period: 3 });
  assert.equal(payload.items.length, 1);
  assert.equal(payload.items[0].url, "https://flights.myrealtrip.com/");
});

test("MyRealTrip API failures fall back to local data", async () => {
  const assets = assetStore({
    "/data/myrealtrip-tna-products.json": [
      { title: "제주 투어", url: "https://experiences.myrealtrip.com/products/2", price: 50000 },
    ],
  });
  const response = await withMockFetch(async () => {
    throw new Error("service unavailable");
  }, async () => myrealtripGet({
    request: request("/api/myrealtrip/search?type=tna&keyword=제주"),
    env: { MYREALTRIP_API_KEY: "test-key", ASSETS: assets },
  }));

  const payload = await responseJson(response);
  assert.equal(response.status, 200);
  assert.equal(payload.fallback, true);
  assert.equal(payload.items[0].title, "제주 투어");
});

test("Coupang search filters unsafe stored links and clamps the limit", async () => {
  const assets = assetStore({
    "/data/coupang-products.json": [
      { title: "방수팩", url: "https://link.coupang.com/a/safe", image: "https://images.example.test/water.jpg", intent: "water" },
      { title: "허용되지 않은 상품", url: "javascript:alert(1)", intent: "water" },
    ],
  });
  const response = await coupangGet({
    request: request("/api/coupang/search?intent=water&limit=0"),
    env: { ASSETS: assets },
  });

  const payload = await responseJson(response);
  assert.equal(response.status, 200);
  assert.equal(payload.fallback, true);
  assert.equal(payload.items.length, 1);
  assert.equal(payload.items[0].url, "https://link.coupang.com/a/safe");
  assert.match(payload.disclosure, /쿠팡|諛⑹닔|荑좏뙜/);
});

test("Coupang search normalizes API products and signs the request", async () => {
  let authorization;
  const response = await withMockFetch(async (url, options) => {
    const endpoint = new URL(url);
    assert.equal(endpoint.searchParams.get("keyword"), "방수팩");
    authorization = options.headers.authorization;
    return jsonResponse({
      rCode: "0",
      data: { productData: [
        { productName: "방수팩", productUrl: "https://link.coupang.com/a/safe", productImage: "https://images.example.test/water.jpg", productPrice: 12000 },
        { productName: "잘못된 링크", productUrl: "https://evil.example.test/item", productPrice: 1 },
      ] },
    });
  }, async () => coupangGet({
    request: request("/api/coupang/search?keyword=방수팩&limit=10"),
    env: { COUPANG_ACCESS_KEY: "access", COUPANG_SECRET_KEY: "secret" },
    waitUntil() {},
  }));

  const payload = await responseJson(response);
  assert.equal(payload.ok, true);
  assert.equal(payload.items.length, 1);
  assert.equal(payload.items[0].price, 12000);
  assert.match(authorization, /^CEA algorithm=HmacSHA256, access-key=access,/);
});

test("Cloudflare route maps article paths to the site asset and delegates other methods", async () => {
  const calls = [];
  const assets = {
    async fetch(input) {
      calls.push(new URL(input.url || input).pathname);
      return new Response("ok");
    },
  };

  await routeRequest({ request: request("/travel-129256/"), params: { path: "travel-129256" }, env: { ASSETS: assets } });
  await routeRequest({ request: request("/unknown"), params: { path: "unknown" }, env: { ASSETS: assets } });
  assert.deepEqual(calls, ["/site/travel-129256/", "/unknown"]);
});

test("article response preserves contextual MyRealTrip blocks, removes paused Coupang blocks, and adds one canonical URL", async () => {
  const source = `<!doctype html><html><head>
    <link rel="canonical" href="https://old.example/article">
    <style>/* tripview-mrt-native-ad */.mrt-native-ad{}/* end-tripview-mrt-native-ad */</style>
  </head><body><nav class="links" aria-label="주요 메뉴"><a href="/#festival">7~8월 축제/행사</a></nav>
    <!-- MRT_AD_START mid --><section>unrelated booking</section><!-- MRT_AD_END -->
    <section aria-label="이 여행지 예약 정보"><strong>이 여행지 예약 정보</strong><p>현재 글의 지역과 여행 목적이 일치하는 상품만 표시합니다.</p><em>서울 일정에 맞춘 인근 숙소</em></section>
    <!-- COUPANG_AD_START bottom --><section>shopping</section><!-- COUPANG_AD_END -->
    <!-- COUPANG_WIDGET_START bottom --><section>carousel</section><!-- COUPANG_WIDGET_END -->
    <article>editorial content</article>
    <script src="/assets/coupang.js?v=test" defer></script>
  </body></html>`;

  const transformed = transformArticleHtml(source, ["travel-129256"]);
  assert.match(transformed, /editorial content/);
  assert.match(transformed, /unrelated booking|tripview-mrt-native-ad/);
  assert.doesNotMatch(transformed, /shopping|carousel|coupang\.js/);
  assert.doesNotMatch(transformed, /7~8월/);
  assert.match(transformed, />8월 가볼만한 곳</);
  assert.match(transformed, /주변 숙소·투어/);
  assert.match(transformed, /여행지 주변의 숙소와 이용 가능한 투어·티켓을 모았습니다/);
  assert.match(transformed, /서울 숙소/);
  assert.doesNotMatch(transformed, /이 여행지 예약 정보|일정에 맞춘 인근 숙소/);
  assert.equal((transformed.match(/rel="canonical"/g) || []).length, 1);
  assert.match(transformed, /href="https:\/\/tripview\.kr\/travel-129256\/"/);
});

test("Cloudflare route transforms successful HTML articles but leaves failed assets untouched", async () => {
  const htmlAssets = {
    async fetch() {
      return new Response("<html><head></head><body><!-- MRT_AD_START mid -->ad<!-- MRT_AD_END --><article>body</article></body></html>", {
        headers: { "content-type": "text/html" },
      });
    },
  };
  const response = await routeRequest({
    request: request("/festival-4091116/"),
    params: { path: "festival-4091116" },
    env: { ASSETS: htmlAssets },
  });
  const body = await response.text();
  assert.equal(response.headers.get("content-type"), "text/html; charset=utf-8");
  assert.match(body, />ad</);
  assert.match(body, /https:\/\/tripview\.kr\/festival-4091116\//);

  const failedAssets = { async fetch() { return new Response("missing", { status: 404 }); } };
  const failed = await routeRequest({
    request: request("/travel-9999999/"),
    params: { path: "travel-9999999" },
    env: { ASSETS: failedAssets },
  });
  assert.equal(failed.status, 404);
  assert.equal(await failed.text(), "missing");
});
