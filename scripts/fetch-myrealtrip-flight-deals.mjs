import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PATH = path.join(ROOT, "data", "myrealtrip-flight-deals.json");

const API_KEY = process.env.MYREALTRIP_API_KEY
  || process.env.PARTNER_API_KEY
  || process.env.MYREALTRIP_PARTNER_API_KEY
  || "";
const API_URL = process.env.MYREALTRIP_FLIGHT_API_URL
  || process.env.MYREALTRIP_FLIGHT_LOWEST_URL
  || process.env.PARTNER_FLIGHT_API_URL
  || "https://partner-ext-api.myrealtrip.com/v1/products/flight/calendar/bulk-lowest";
const DEP_AIRPORT = process.env.MYREALTRIP_FLIGHT_DEP_AIRPORT || "ICN";
const PERIOD = Math.max(3, Math.min(7, Number.parseInt(process.env.MYREALTRIP_FLIGHT_PERIOD || "5", 10) || 5));
const LIMIT = Math.max(1, Math.min(30, Number.parseInt(process.env.MYREALTRIP_FLIGHT_LIMIT || "8", 10) || 8));
const URL_TEMPLATE = process.env.MYREALTRIP_FLIGHT_URL_TEMPLATE || "";

const AIRPORT_NAMES = {
  ICN: "인천",
  GMP: "김포",
  CJU: "제주",
  PUS: "부산",
  TAE: "대구",
  CJJ: "청주",
  MWX: "무안",
  BKK: "방콕",
  DMK: "방콕",
  NRT: "도쿄 나리타",
  HND: "도쿄 하네다",
  TYO: "도쿄",
  KIX: "오사카",
  OSA: "오사카",
  FUK: "후쿠오카",
  CTS: "삿포로",
  OKA: "오키나와",
  HIJ: "히로시마",
  MYJ: "마쓰야마",
  YGJ: "요나고",
  TAK: "다카마쓰",
  KKJ: "기타큐슈",
  TPE: "타이베이",
  HKG: "홍콩",
  MFM: "마카오",
  DAD: "다낭",
  HAN: "하노이",
  SGN: "호치민",
  CEB: "세부",
  MNL: "마닐라",
  SIN: "싱가포르",
  AKL: "오클랜드",
  SYD: "시드니",
  GUM: "괌",
  SPN: "사이판",
  LAX: "로스앤젤레스",
  SFO: "샌프란시스코",
  JFK: "뉴욕",
  CDG: "파리",
  LHR: "런던",
};

function airportName(code = "") {
  return AIRPORT_NAMES[String(code).toUpperCase()] || String(code).toUpperCase();
}

function formatWon(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "";
  return `${number.toLocaleString("ko-KR")}원`;
}

function formatDate(value) {
  if (!value) return "";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

function flightSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "") || "flight-deal";
}

function defaultFlightPath(deal) {
  return `/flight-deals/${flightSlug(`flight-${deal.fromCity}-${deal.toCity}-${deal.departureDate}-${deal.returnDate || "oneway"}`)}/`;
}

function buildUrl(deal) {
  if (!URL_TEMPLATE) return defaultFlightPath(deal);
  return URL_TEMPLATE
    .replaceAll("{fromCity}", encodeURIComponent(deal.fromCity || ""))
    .replaceAll("{toCity}", encodeURIComponent(deal.toCity || ""))
    .replaceAll("{depCityCd}", encodeURIComponent(deal.fromCity || ""))
    .replaceAll("{arrCityCd}", encodeURIComponent(deal.toCity || ""))
    .replaceAll("{departureDate}", encodeURIComponent(deal.departureDate || ""))
    .replaceAll("{returnDate}", encodeURIComponent(deal.returnDate || ""))
    .replaceAll("{period}", encodeURIComponent(String(deal.period || PERIOD)));
}

function normalizeDeal(item) {
  const fromCity = String(item?.fromCity || DEP_AIRPORT).toUpperCase();
  const toCity = String(item?.toCity || "").toUpperCase();
  const priceText = formatWon(item?.totalPrice);
  if (!fromCity || !toCity || !priceText || !item?.departureDate) return null;

  const route = `${airportName(fromCity)}-${airportName(toCity)}`;
  const period = item?.period || PERIOD;
  const title = `${route} 왕복 ${period}일 최저가 ${priceText}`;
  const description = [
    `출발 ${formatDate(item.departureDate)}`,
    item.returnDate ? `귀국 ${formatDate(item.returnDate)}` : "",
    item.airline ? `항공사 ${item.airline}` : "",
  ].filter(Boolean).join(" · ");

  return {
    id: `flight-${fromCity}-${toCity}-${item.departureDate}-${item.returnDate || "oneway"}`,
    type: "flight",
    title,
    url: buildUrl({ ...item, fromCity, toCity, period }),
    image: "",
    price: item.totalPrice,
    priceText,
    region: airportName(toCity),
    city: airportName(toCity),
    category: "항공권 최저가",
    description,
    tags: ["항공권", "최저가", "예약", "해외여행"],
    intents: ["booking"],
    fromCity,
    toCity,
    period,
    departureDate: item.departureDate,
    returnDate: item.returnDate || "",
    airline: item.airline || "",
    transfer: item.transfer ?? "",
    averagePrice: item.averagePrice ?? "",
    source: "myrealtrip-flight",
  };
}

async function writeDeals(deals) {
  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, `${JSON.stringify(deals, null, 2)}\n`, "utf8");
}

if (!API_KEY.trim()) {
  console.log("MyRealTrip flight fetch skipped: API key is not configured. Set MYREALTRIP_API_KEY or PARTNER_API_KEY.");
  process.exit(0);
}

const response = await fetch(API_URL, {
  method: "POST",
  headers: {
    authorization: `Bearer ${API_KEY}`,
    "content-type": "application/json",
    accept: "application/json",
  },
  body: JSON.stringify({ depCityCd: DEP_AIRPORT, period: PERIOD }),
});

if (!response.ok) {
  const body = await response.text();
  console.log(`MyRealTrip flight fetch skipped: request failed ${response.status} ${body.slice(0, 300)}`);
  process.exit(0);
}

const payload = await response.json();
const rows = Array.isArray(payload?.data) ? payload.data : [];
const today = new Date().toISOString().slice(0, 10);
const deals = rows
  .filter((item) => !item?.departureDate || item.departureDate >= today)
  .map(normalizeDeal)
  .filter(Boolean)
  .sort((a, b) => Number(a.price || 0) - Number(b.price || 0))
  .slice(0, LIMIT);

await writeDeals(deals);
console.log(`Saved ${deals.length} MyRealTrip flight deal(s) to data/myrealtrip-flight-deals.json.`);
