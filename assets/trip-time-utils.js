// Deterministic calendar and IANA timezone helpers shared by the travel widgets.
// Every displayed timezone comes from Intl, including seasonal daylight saving changes.
const formatterCache = new Map();
const fmt = (zone) => {
  if (!formatterCache.has(zone)) formatterCache.set(zone, new Intl.DateTimeFormat("en-GB", {
    timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }));
  return formatterCache.get(zone);
};
const pad = (value) => String(value).padStart(2, "0");
export const dateKey = (year, month, day) => [year, pad(month), pad(day)].join("-");

export function parseDateKey(raw) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(raw || ""));
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  if (year < 1900 || year > 2100 || check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return { year, month, day, ms };
}

export function calendarGrid(year, month) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return [];
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // Include adjacent-month days so columns always start on Sunday.
  const rows = Math.ceil((firstWeekday + daysInMonth) / 7);
  return Array.from({ length: rows * 7 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, 1 + index - firstWeekday));
    const cellYear = date.getUTCFullYear(), cellMonth = date.getUTCMonth() + 1, day = date.getUTCDate();
    return { key: dateKey(cellYear, cellMonth, day), day, inMonth: cellYear === year && cellMonth === month, weekday: index % 7 };
  });
}
export function calendarDayDiff(startKey, endKey) {
  const start = parseDateKey(startKey), end = parseDateKey(endKey);
  return start && end ? Math.round((end.ms - start.ms) / 86400000) : null;
}

export function zonedParts(instant, zone) {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid timestamp");
  const parts = Object.fromEntries(fmt(zone).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  return {
    year: parts.year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute,
    dateKey: dateKey(parts.year, parts.month, parts.day),
    time: pad(parts.hour) + ":" + pad(parts.minute),
  };
}
export function timeZoneOffsetMinutes(instant, zone) {
  const parts = zonedParts(instant, zone);
  const date = instant instanceof Date ? instant : new Date(instant);
  const roundedUtc = Math.floor(date.getTime() / 60000) * 60000;
  return Math.round((Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) - roundedUtc) / 60000);
}
export function differenceFromSeoulMinutes(instant, zone) {
  return timeZoneOffsetMinutes(instant, zone) - timeZoneOffsetMinutes(instant, "Asia/Seoul");
}
export function formatHourDifference(minutes) {
  const magnitude = Math.abs(minutes);
  const hours = Math.floor(magnitude / 60), extra = magnitude % 60;
  if (!minutes) return "한국과 시차 없음";
  return "한국보다 " + (minutes > 0 ? "빠름 " : "느림 ") + (hours ? hours + "시간" : "") + (extra ? " " + extra + "분" : "");
}
/** Interpret a user-entered YYYY-MM-DDTHH:mm as Korea local time (UTC+09:00). */
export function seoulDateTimeToInstant(value) {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(String(value || ""));
  const day = match && parseDateKey(match[1]);
  if (!day) return null;
  const hours = Number(match[2]), minutes = Number(match[3]);
  if (hours > 23 || minutes > 59) return null;
  return new Date(day.ms + (hours * 60 + minutes - 9 * 60) * 60000);
}
export function dateTimeInSeoulInput(instant) {
  const parts = zonedParts(instant, "Asia/Seoul");
  return parts.dateKey + "T" + parts.time;
}
export const TIME_CITIES = Object.freeze([
  { id: "seoul", label: "서울", country: "대한민국", zone: "Asia/Seoul" },
  { id: "tokyo", label: "도쿄", country: "일본", zone: "Asia/Tokyo" },
  { id: "osaka", label: "오사카", country: "일본", zone: "Asia/Tokyo" },
  { id: "taipei", label: "타이베이", country: "대만", zone: "Asia/Taipei" },
  { id: "bangkok", label: "방콕", country: "태국", zone: "Asia/Bangkok" },
  { id: "danang", label: "다낭", country: "베트남", zone: "Asia/Ho_Chi_Minh" },
  { id: "singapore", label: "싱가포르", country: "싱가포르", zone: "Asia/Singapore" },
  { id: "dubai", label: "두바이", country: "아랍에미리트", zone: "Asia/Dubai" },
  { id: "london", label: "런던", country: "영국", zone: "Europe/London" },
  { id: "paris", label: "파리", country: "프랑스", zone: "Europe/Paris" },
  { id: "newyork", label: "뉴욕", country: "미국", zone: "America/New_York" },
  { id: "losangeles", label: "로스앤젤레스", country: "미국", zone: "America/Los_Angeles" },
  { id: "honolulu", label: "호놀룰루", country: "미국", zone: "Pacific/Honolulu" },
  { id: "sydney", label: "시드니", country: "호주", zone: "Australia/Sydney" },
  { id: "auckland", label: "오클랜드", country: "뉴질랜드", zone: "Pacific/Auckland" },
]);
