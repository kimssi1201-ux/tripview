const KMA_API_BASE = "https://apis.data.go.kr/1360000/BeachInfoservice";
const BEACH_INFO_API_BASE = "https://apis.data.go.kr/1192000/service/OceansBeachInfoService1/getOceansBeachInfo1";
const REQUEST_TIMEOUT_MS = 8000;
const CACHE_SECONDS = 600;

// Only beaches with a known article-to-beach mapping are accepted here.
// KMA codes were checked against the official beach forecast pages. Entries
// without a KMA code still expose the official beach information API only.
const BEACHES = new Map([
  ["travel-126078", { code: 306, name: "\uAD11\uC548\uB9AC", sido: "\uBD80\uC0B0", aliases: ["\uAD11\uC548\uB9AC"] }],
  ["travel-126302", { code: 127, name: "\uC1A1\uD638\uB545\uB05D", sido: "\uC804\uB0A8", aliases: ["\uC1A1\uD638\uB545\uB05D", "\uB545\uB05D\uC1A1\uD638"] }],
  ["travel-128199", { name: "\uAC15\uB3D9\uBAA8\uB3CC\uD574\uBCC0", sido: "\uC6B8\uC0B0", aliases: ["\uAC15\uB3D9\uBAA8\uB3CC", "\uC815\uC790"] }],
  ["travel-125711", { code: 221, name: "\uC7A5\uD638", sido: "\uAC15\uC6D0", aliases: ["\uC7A5\uD638"] }],
  ["travel-125713", { code: 198, name: "\uB9DD\uC0C1", sido: "\uAC15\uC6D0", aliases: ["\uB9DD\uC0C1"] }],
  ["travel-3000205", { name: "\uC6B0\uB450", sido: "\uC804\uB0A8", aliases: ["\uC6B0\uB450"] }],
  ["travel-127722", { code: 174, name: "\uC548\uBAA9", sido: "\uAC15\uC6D0", aliases: ["\uC548\uBAA9"] }],
  ["travel-127764", { name: "\uB3C8\uBAA9", sido: "\uC804\uB0A8", aliases: ["\uB3C8\uBAA9"] }],
]);

const CODE_TO_SLUG = new Map(
  [...BEACHES.entries()]
    .filter(([, beach]) => beach.code)
    .map(([slug, beach]) => [String(beach.code), slug]),
);

function json(data, status = 200, cacheSeconds = 0) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cacheSeconds > 0
        ? `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}`
        : "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function text(value, fallback = "") {
  const result = String(value ?? fallback).trim();
  return result || fallback;
}

function apiKeyText(value) {
  const key = text(value);
  if (!key.includes("%")) return key;
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
}

function numberOrNull(value) {
  const number = Number.parseFloat(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

function dateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function dateText(parts) {
  return `${parts.year}${parts.month}${parts.day}`;
}

function timeText(parts) {
  return `${parts.hour}${parts.minute}`;
}

function latestForecastBase(now = new Date()) {
  const parts = dateParts(now);
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  const releaseMinutes = [120, 500, 800, 1100, 1400, 1700, 2000, 2300]
    .map((value) => Math.floor(value / 100) * 60 + value % 100);
  const latest = [...releaseMinutes].reverse().find((value) => value <= minutes);
  if (latest !== undefined) {
    return { date: dateText(parts), time: `${String(Math.floor(latest / 60)).padStart(2, "0")}00` };
  }
  const previous = dateParts(new Date(now.getTime() - 3 * 60 * 60 * 1000));
  return { date: dateText(previous), time: "2300" };
}

function currentObservationTime(now = new Date()) {
  const parts = dateParts(now);
  return `${dateText(parts)}${parts.hour}00`;
}

function responseItems(payload) {
  const items = payload?.response?.body?.items?.item
    || payload?.body?.items?.item
    || payload?.data?.items?.item
    || payload?.items?.item
    || [];
  return Array.isArray(items) ? items : items ? [items] : [];
}

function responseHeader(payload) {
  return payload?.response?.header || payload?.header || payload?.result || {};
}

function isSuccessful(payload) {
  const code = text(responseHeader(payload)?.resultCode, "00");
  return ["00", "0", "200", "NORMAL_SERVICE"].includes(code);
}

const OPERATION_PATHS = {
  forecast: "getVilageFcstBeach",
  wave: "getWhBuoyBeach",
  tide: "getTideInfoBeach",
  sun: "getSunInfoBeach",
  waterTemperature: "getTwBuoyBeach",
};

function operationParams(operation, beachCode, now) {
  const params = {
    numOfRows: operation === "forecast" ? "100" : operation === "tide" ? "20" : "5",
    pageNo: "1",
    dataType: "JSON",
    beach_num: String(beachCode),
  };
  const base = latestForecastBase(now);
  if (operation === "forecast") {
    params.base_date = base.date;
    params.base_time = base.time;
  }
  if (operation === "wave" || operation === "waterTemperature") params.searchTime = currentObservationTime(now);
  if (operation === "sun" || operation === "tide") params.base_date = dateText(dateParts(now));
  return params;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers: { accept: "application/json" }, signal: controller.signal });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload) throw new Error("Upstream API returned an unsuccessful response.");
    return payload;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("Upstream API request timed out.");
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchOperation(apiKey, operation, beachCode, now) {
  const url = new URL(`${KMA_API_BASE}/${OPERATION_PATHS[operation]}`);
  Object.entries(operationParams(operation, beachCode, now)).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set("serviceKey", apiKey);
  const payload = await fetchJson(url);
  if (!isSuccessful(payload)) throw new Error("KMA API returned an unsuccessful response.");
  return { operation, items: responseItems(payload) };
}

function normalizedPlaceName(value) {
  return text(value)
    .replace(/\s+/g, "")
    .replace(/[()·\-]/g, "")
    .replace(/\uD574\uC218\uC695\uC7A5|\uD574\uBCC0/g, "")
    .toLowerCase();
}

function provinceCandidates(sido) {
  return {
    "\uAC15\uC6D0": ["\uAC15\uC6D0", "\uAC15\uC6D0\uB3C4", "\uAC15\uC6D0\uD2B9\uBCC4\uC790\uCE58\uB3C4"],
    "\uC804\uB0A8": ["\uC804\uB0A8", "\uC804\uB77C\uB0A8\uB3C4"],
  }[sido] || [sido];
}

async function fetchBeachInfo(apiKey, beach) {
  const targets = new Set((beach.aliases || [beach.name]).map(normalizedPlaceName));
  for (const sido of provinceCandidates(beach.sido)) {
    const url = new URL(BEACH_INFO_API_BASE);
    Object.entries({
      ServiceKey: apiKey,
      pageNo: "1",
      numOfRows: "1000",
      SIDO_NM: sido,
      resultType: "JSON",
    }).forEach(([key, value]) => url.searchParams.set(key, value));
    try {
      const payload = await fetchJson(url);
      if (!isSuccessful(payload)) continue;
      const items = responseItems(payload);
      const item = items.find((candidate) => targets.has(normalizedPlaceName(candidate?.staNm || candidate?.beachNm || candidate?.name)));
      if (item) return normalizeBeachInfo(item);
    } catch {
      // Weather data remains usable when the optional beach information API fails.
    }
  }
  return null;
}

function safeHttpUrl(value) {
  const url = text(value);
  return /^https?:\/\//i.test(url) ? url : "";
}

function normalizeBeachInfo(item) {
  return {
    province: text(item?.sidoNm),
    county: text(item?.gugunNm),
    name: text(item?.staNm || item?.beachNm || item?.name),
    width: numberOrNull(item?.beachWid),
    length: numberOrNull(item?.beachLen),
    feature: text(item?.beachKnd),
    image: safeHttpUrl(item?.beachImg),
    emergencyPhone: text(item?.linkTel),
    link: safeHttpUrl(item?.linkAddr),
    linkName: text(item?.linkNm),
    latitude: numberOrNull(item?.lat),
    longitude: numberOrNull(item?.lon),
  };
}

function forecastValue(items, category) {
  return items.find((item) => text(item?.category).toUpperCase() === category)?.fcstValue ?? null;
}

function weatherLabel(sky, precipitation) {
  const pty = String(precipitation ?? "0");
  if (pty === "1") return "\uBE44";
  if (pty === "2") return "\uBE44/\uB208";
  if (pty === "3") return "\uB208";
  if (pty === "4") return "\uC18C\uB098\uAE30";
  return ({ "1": "\uB9D1\uC74C", "3": "\uAD6C\uB984 \uC870\uAE08", "4": "\uD754\uB9BC" })[String(sky)] || "\uC608\uBCF4 \uD655\uC778 \uD544\uC694";
}

function normalizeForecast(items, now) {
  if (!items.length) return null;
  const parts = dateParts(now);
  const currentKey = `${dateText(parts)}${timeText(parts)}`;
  const groups = new Map();
  items.forEach((item) => {
    const key = `${text(item?.fcstDate)}${text(item?.fcstTime)}`;
    if (key.length < 12) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });
  const targetKey = [...groups.keys()].sort((a, b) => {
    const aFuture = a >= currentKey;
    const bFuture = b >= currentKey;
    if (aFuture !== bFuture) return aFuture ? -1 : 1;
    return aFuture ? a.localeCompare(b) : b.localeCompare(a);
  })[0];
  const selected = groups.get(targetKey) || items;
  const rainAmount = text(forecastValue(selected, "PCP"), "");
  return {
    date: targetKey?.slice(0, 8) || "",
    time: targetKey?.slice(8, 12) || "",
    temperature: numberOrNull(forecastValue(selected, "TMP")),
    condition: weatherLabel(forecastValue(selected, "SKY"), forecastValue(selected, "PTY")),
    rainProbability: numberOrNull(forecastValue(selected, "POP")),
    rainAmount: rainAmount === "\uAC15\uC218\uC5C6\uC74C" ? "0" : rainAmount,
    windSpeed: numberOrNull(forecastValue(selected, "WSD")),
    humidity: numberOrNull(forecastValue(selected, "REH")),
  };
}

function normalizeWave(items) {
  const item = items[0];
  return item ? { value: numberOrNull(item.wh), observedAt: text(item.tm) } : null;
}

function normalizeWaterTemperature(items) {
  const item = items[0];
  return item ? { value: numberOrNull(item.tw), observedAt: text(item.tm) } : null;
}

function normalizeSun(items) {
  const item = items[0];
  return item ? { sunrise: text(item.sunrise), sunset: text(item.sunset) } : null;
}

function normalizeTide(items) {
  return items.map((item) => ({
    station: text(item.tiStnld),
    time: text(item.tiTime),
    type: text(item.tiType),
    level: numberOrNull(item.tilevel),
  })).filter((item) => item.time || item.type || item.level !== null).slice(0, 8);
}

async function loadSummary(apiKey, beach) {
  const now = new Date();
  const results = [];
  if (beach.code) {
    const operations = Object.keys(OPERATION_PATHS);
    const weatherResults = await Promise.all(operations.map(async (operation) => {
      try {
        return await fetchOperation(apiKey, operation, beach.code, now);
      } catch {
        return { operation, items: [], failed: true };
      }
    }));
    results.push(...weatherResults);
  }
  try {
    results.push({ operation: "info", items: await fetchBeachInfo(apiKey, beach) });
  } catch {
    results.push({ operation: "info", items: null, failed: true });
  }
  const byOperation = new Map(results.map((result) => [result.operation, result.items]));
  const forecast = normalizeForecast(byOperation.get("forecast") || [], now);
  const wave = normalizeWave(byOperation.get("wave") || []);
  const waterTemperature = normalizeWaterTemperature(byOperation.get("waterTemperature") || []);
  const sun = normalizeSun(byOperation.get("sun") || []);
  const tide = normalizeTide(byOperation.get("tide") || []);
  const info = byOperation.get("info") || null;
  const usable = forecast || wave || waterTemperature || sun || tide.length || info;
  if (!usable) throw new Error("No usable beach data returned.");
  const issues = results.filter((result) => result.failed || (result.operation === "info" ? !result.items : !result.items.length)).map((result) => result.operation);
  return {
    ok: true,
    beach: { id: beach.code || null, name: beach.name, slug: [...BEACHES.entries()].find(([, value]) => value === beach)?.[0] || "" },
    updatedAt: now.toISOString(),
    forecast,
    wave,
    waterTemperature,
    sun,
    tide,
    info,
    weatherSupported: Boolean(beach.code),
    partial: issues.length > 0,
    message: issues.length ? "\uC77C\uBD80 \uD574\uC591 \uC815\uBCF4\uB294 \uC9C0\uAE08 \uC81C\uACF5\uB418\uC9C0 \uC54A\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4." : "",
    sourceUrl: "https://www.data.go.kr/data/15102239/openapi.do",
    infoSourceUrl: "https://www.data.go.kr/data/15058519/openapi.do",
  };
}

function resolveBeach(url) {
  const slug = text(url.searchParams.get("beach"));
  if (slug && BEACHES.has(slug)) return { slug, beach: BEACHES.get(slug) };
  const code = text(url.searchParams.get("beach_num"));
  const mappedSlug = CODE_TO_SLUG.get(code);
  return mappedSlug ? { slug: mappedSlug, beach: BEACHES.get(mappedSlug) } : null;
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const resolved = resolveBeach(url);
  if (!resolved) return json({ ok: false, available: false, message: "\uB9E4\uD551\uB41C \uD574\uC218\uC695\uC7A5 \uC815\uBCF4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);

  const apiKey = apiKeyText(
    context.env?.KMA_BEACH_API_KEY
      || context.env?.BEACH_API_KEY
      || context.env?.TRIPVIEW_API_KEY,
  );
  if (!apiKey) return json({ ok: false, configured: false, message: "\uD574\uC218\uC695\uC7A5 API \uC778\uC99D\uD0A4\uAC00 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." }, 503);

  const cacheKey = new Request(`${url.origin}${url.pathname}?beach=${encodeURIComponent(resolved.slug)}`);
  const cache = globalThis.caches?.default;
  if (cache) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }
  try {
    const payload = await loadSummary(apiKey, resolved.beach);
    const response = json(payload, 200, CACHE_SECONDS);
    if (cache && typeof context.waitUntil === "function") context.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch {
    return json({ ok: false, message: "\uD574\uC218\uC695\uC7A5 \uC815\uBCF4\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uD655\uC778\uD574\uC8FC\uC138\uC694." }, 502);
  }
}
