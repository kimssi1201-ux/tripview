const API_BASE = "https://apis.data.go.kr/1360000/BeachInfoservice";
const INFO_API_BASE = "https://apis.data.go.kr/1192000/service/OceansBeachInfoService1/getOceansBeachInfo1";
const REQUEST_TIMEOUT_MS = 8000;
const CACHE_SECONDS = 600;
const MAX_BEACH_NUMBER = 330;

const BEACH_NAMES = new Map([
  [1, "\uC744\uC655\uB9AC"],
  [2, "\uC655\uC0B0"],
  [3, "\uD558\uB098\uAC1C"],
  [4, "\uBBFC\uBA38\uB8E8"],
  [5, "\uC7A5\uACBD\uB9AC"],
  [6, "\uC639\uC554"],
  [7, "\uC218\uAE30"],
  [8, "\uB3D9\uB9C9"],
  [9, "\uC11C\uD3EC\uB9AC"],
  [10, "\uC2ED\uB9AC\uD3EC"],
  [11, "\uAD74\uC5C5"],
  [12, "\uB5BC\uBFCC\uB8E8"],
  [13, "\uBC27\uC9C0\uB984"],
  [14, "\uD55C\uB4E4"],
  [15, "\uD070\uD480\uC548"],
  [16, "\uC7A5\uACE8"],
  [17, "\uBC8C\uC548"],
]);

const BEACH_SIDO = new Map([...BEACH_NAMES.keys()].map((id) => [id, "\uC778\uCC9C"]));

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
  const releaseMinutes = [120, 500, 800, 1100, 1400, 1700, 2000, 2300].map((value) => Math.floor(value / 100) * 60 + value % 100);
  const latest = [...releaseMinutes].reverse().find((value) => value <= minutes);
  if (latest !== undefined) {
    return { date: dateText(parts), time: String(Math.floor(latest / 60)).padStart(2, "0") + "00" };
  }
  const previous = dateParts(new Date(now.getTime() - 3 * 60 * 60 * 1000));
  return { date: dateText(previous), time: "2300" };
}

function currentObservationTime(now = new Date()) {
  const parts = dateParts(now);
  return `${dateText(parts)}${parts.hour}00`;
}

function responseItems(payload) {
  return payload?.response?.body?.items?.item
    || payload?.body?.items?.item
    || payload?.data?.items?.item
    || payload?.items?.item
    || [];
}

function responseHeader(payload) {
  return payload?.response?.header || payload?.header || payload?.result || {};
}

function isSuccessful(payload) {
  const code = text(responseHeader(payload)?.resultCode, "00");
  return ["00", "0", "200", "NORMAL_SERVICE"].includes(code);
}

function operationParams(operation, beachNumber, now) {
  const params = {
    numOfRows: operation === "forecast" ? "100" : operation === "tide" ? "20" : "5",
    pageNo: "1",
    dataType: "JSON",
    beach_num: String(beachNumber),
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

const OPERATION_PATHS = {
  forecast: "getVilageFcstBeach",
  wave: "getWhBuoyBeach",
  tide: "getTideInfoBeach",
  sun: "getSunInfoBeach",
  waterTemperature: "getTwBuoyBeach",
};

async function fetchOperation(apiKey, operation, beachNumber, now) {
  const path = OPERATION_PATHS[operation];
  const url = new URL(`${API_BASE}/${path}`);
  const params = operationParams(operation, beachNumber, now);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set("serviceKey", apiKey);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || !isSuccessful(payload)) {
      throw new Error("KMA API returned an unsuccessful response.");
    }
    return { operation, items: Array.isArray(responseItems(payload)) ? responseItems(payload) : [] };
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("KMA API request timed out.");
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizedPlaceName(value) {
  return text(value).replace(/\s+/g, "").replace(/\uD574\uC218\uC695\uC7A5/g, "").toLowerCase();
}

function safeHttpUrl(value) {
  const url = text(value);
  return /^https?:\/\//i.test(url) ? url : "";
}

async function fetchBeachInfo(apiKey, beachNumber) {
  const beachName = BEACH_NAMES.get(beachNumber);
  const sido = BEACH_SIDO.get(beachNumber);
  if (!beachName || !sido) return { operation: "info", items: [] };

  const url = new URL(INFO_API_BASE);
  Object.entries({
    ServiceKey: apiKey,
    pageNo: "1",
    numOfRows: "100",
    SIDO_NM: sido,
    resultType: "JSON",
  }).forEach(([key, value]) => url.searchParams.set(key, value));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || !isSuccessful(payload)) throw new Error("Beach info API returned an unsuccessful response.");
    const items = Array.isArray(responseItems(payload)) ? responseItems(payload) : [];
    const target = normalizedPlaceName(beachName);
    return { operation: "info", items: items.filter((item) => normalizedPlaceName(item?.staNm) === target) };
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("Beach info API request timed out.");
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
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
  const currentKey = `${dateText(dateParts(now))}${timeText(dateParts(now))}`;
  const groups = new Map();
  items.forEach((item) => {
    const key = `${text(item?.fcstDate)}${text(item?.fcstTime)}`;
    if (!key || key.length < 12) return;
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
  const sky = forecastValue(selected, "SKY");
  const precipitation = forecastValue(selected, "PTY");
  const temperature = numberOrNull(forecastValue(selected, "TMP"));
  const rainProbability = numberOrNull(forecastValue(selected, "POP"));
  const windSpeed = numberOrNull(forecastValue(selected, "WSD"));
  const humidity = numberOrNull(forecastValue(selected, "REH"));
  const rainAmount = text(forecastValue(selected, "PCP"), "");
  return {
    date: targetKey?.slice(0, 8) || "",
    time: targetKey?.slice(8, 12) || "",
    temperature,
    sky: text(sky),
    precipitation: text(precipitation, "0"),
    condition: weatherLabel(sky, precipitation),
    rainProbability,
    rainAmount: rainAmount === "강수없음" ? "0" : rainAmount,
    windSpeed,
    humidity,
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
  return items
    .map((item) => ({
      station: text(item.tiStnld),
      time: text(item.tiTime),
      type: text(item.tiType),
      level: numberOrNull(item.tilevel),
    }))
    .filter((item) => item.time || item.type || item.level !== null)
    .slice(0, 8);
}

function normalizeBeachInfo(items) {
  const item = items[0];
  if (!item) return null;
  return {
    province: text(item.sidoNm),
    county: text(item.gugunNm),
    name: text(item.staNm),
    width: numberOrNull(item.beachWid),
    length: numberOrNull(item.beachLen),
    feature: text(item.beachKnd),
    image: safeHttpUrl(item.beachImg),
    emergencyPhone: text(item.linkTel),
    link: safeHttpUrl(item.linkAddr),
    linkName: text(item.linkNm),
    latitude: numberOrNull(item.lat),
    longitude: numberOrNull(item.lon),
  };
}

function publicErrorMessage(issues) {
  if (!issues.length) return "";
  return "\uC77C\uBD80 \uD574\uC591 \uC815\uBCF4\uB294 \uC9C0\uAE08 \uC81C\uACF5\uB418\uC9C0 \uC54A\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4.";
}

async function loadSummary(apiKey, beachNumber) {
  const now = new Date();
  const operations = Object.keys(OPERATION_PATHS);
  const weatherResults = await Promise.all(operations.map(async (operation) => {
    try {
      return await fetchOperation(apiKey, operation, beachNumber, now);
    } catch {
      return { operation, items: [], failed: true };
    }
  }));
  let infoResult;
  try {
    infoResult = await fetchBeachInfo(apiKey, beachNumber);
  } catch {
    infoResult = { operation: "info", items: [], failed: true };
  }
  const results = [...weatherResults, infoResult];
  const issues = results.filter((result) => result.failed || !result.items.length).map((result) => result.operation);
  const byOperation = new Map(results.map((result) => [result.operation, result.items]));
  const forecastItems = byOperation.get("forecast") || [];
  const waveItems = byOperation.get("wave") || [];
  const waterItems = byOperation.get("waterTemperature") || [];
  const sunItems = byOperation.get("sun") || [];
  const tideItems = byOperation.get("tide") || [];
  const infoItems = byOperation.get("info") || [];
  const data = {
    ok: true,
    beach: { id: beachNumber, name: BEACH_NAMES.get(beachNumber) || `\uD574\uC218\uC695\uC7A5 ${beachNumber}` },
    updatedAt: now.toISOString(),
    forecast: normalizeForecast(forecastItems, now),
    wave: normalizeWave(waveItems),
    waterTemperature: normalizeWaterTemperature(waterItems),
    sun: normalizeSun(sunItems),
    tide: normalizeTide(tideItems),
    info: normalizeBeachInfo(infoItems),
    partial: issues.length > 0,
    message: publicErrorMessage(issues),
    sourceUrl: "https://www.data.go.kr/data/15102239/openapi.do",
  };
  if (!data.forecast && !data.wave && !data.waterTemperature && !data.sun && !data.tide.length && !data.info) {
    throw new Error("KMA API returned no usable beach data.");
  }
  return data;
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const rawBeachNumber = url.searchParams.get("beach_num") || "1";
  if (!/^\d{1,3}$/.test(rawBeachNumber)) {
    return json({ ok: false, message: "\uD574\uC218\uC695\uC7A5 \uCF54\uB4DC\uB294 \uC22B\uC790\uB85C \uC785\uB825\uD574\uC8FC\uC138\uC694." }, 400);
  }
  const beachNumber = Number(rawBeachNumber);
  if (beachNumber < 1 || beachNumber > MAX_BEACH_NUMBER) {
    return json({ ok: false, message: "\uC9C0\uC6D0\uD558\uB294 \uD574\uC218\uC695\uC7A5 \uCF54\uB4DC \uBC94\uC704\uB97C \uD655\uC778\uD574\uC8FC\uC138\uC694." }, 400);
  }
  const apiKey = text(context.env?.KMA_BEACH_API_KEY);
  if (!apiKey) {
    return json({ ok: false, configured: false, message: "\uD574\uC218\uC695\uC7A5 \uB0A0\uC528 API \uC778\uC99D\uD0A4가 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." }, 503);
  }

  const cacheKey = new Request(`${url.origin}${url.pathname}?beach_num=${beachNumber}`);
  const cache = globalThis.caches?.default;
  if (cache) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }

  try {
    const payload = await loadSummary(apiKey, beachNumber);
    const response = json(payload, 200, CACHE_SECONDS);
    if (cache && typeof context.waitUntil === "function") context.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch {
    return json({ ok: false, message: "\uD574\uC218\uC695\uC7A5 \uB0A0\uC528\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uD655\uC778\uD574\uC8FC\uC138\uC694." }, 502);
  }
}
