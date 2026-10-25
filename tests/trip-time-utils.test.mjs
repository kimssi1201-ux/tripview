import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import {
  TIME_CITIES, calendarGrid, calendarDayDiff, dateKey, parseDateKey,
  zonedParts, differenceFromSeoulMinutes, formatHourDifference,
  seoulDateTimeToInstant, dateTimeInSeoulInput,
} from "../assets/trip-time-utils.js";
import { sitemapUrls } from "../src/lib/content.mjs";

test("calendar correctly fills aligned month grid including adjacent months", () => {
  const cells = calendarGrid(2026, 10);
  assert.equal(cells.length % 7, 0);
  assert.equal(cells[0].key, "2026-09-27");
  assert.equal(cells.filter((cell) => cell.inMonth).length, 31);
  assert.equal(cells.find((cell) => cell.key === "2026-10-25").weekday, 0);
  assert.deepEqual(calendarGrid(2026, 13), []);
});
test("trip dates and countdown handle month boundaries and leap years", () => {
  assert.equal(calendarDayDiff("2026-10-25", "2026-11-01"), 7);
  assert.equal(calendarDayDiff("2026-03-01", "2026-02-28"), -1);
  assert.equal(calendarDayDiff("2028-02-28", "2028-03-01"), 2);
  assert.equal(parseDateKey("2026-02-29"), null);
  assert.equal(parseDateKey("2028-02-29")?.day, 29);
  assert.equal(parseDateKey("2026-13-04"), null);
  assert.equal(dateKey(2026,1,2), "2026-01-02");
});
test("world times reflect seasonal DST in New York and London", () => {
  const winter = new Date("2026-01-15T12:00:00.000Z");
  const summer = new Date("2026-07-15T12:00:00.000Z");
  assert.equal(differenceFromSeoulMinutes(winter,"America/New_York"), -14*60);
  assert.equal(differenceFromSeoulMinutes(summer,"America/New_York"), -13*60);
  assert.equal(differenceFromSeoulMinutes(winter,"Europe/London"), -9*60);
  assert.equal(differenceFromSeoulMinutes(summer,"Europe/London"), -8*60);
  assert.equal(differenceFromSeoulMinutes(winter,"Asia/Tokyo"), 0);
  assert.equal(differenceFromSeoulMinutes(winter,"Pacific/Honolulu"), -19*60);
});
test("Seoul input conversion handles date boundary to Los Angeles", () => {
  const time = seoulDateTimeToInstant("2026-12-31T08:30");
  assert.equal(time?.toISOString(), "2026-12-30T23:30:00.000Z");
  assert.equal(dateTimeInSeoulInput(time), "2026-12-31T08:30");
  assert.deepEqual(zonedParts(time,"America/Los_Angeles"), {
    year:2026,month:12,day:30,hour:15,minute:30,dateKey:"2026-12-30",time:"15:30"
  });
  assert.equal(seoulDateTimeToInstant("2026-12-31T25:30"), null);
  assert.equal(seoulDateTimeToInstant("bad"), null);
  assert.equal(formatHourDifference(-780), "한국보다 느림 13시간");
  assert.equal(formatHourDifference(0), "한국과 시차 없음");
});
test("cities have valid unique ids and supported IANA timezones", () => {
  assert.ok(TIME_CITIES.length >= 12);
  assert.equal(new Set(TIME_CITIES.map((c) => c.id)).size,TIME_CITIES.length);
  for (const city of TIME_CITIES) {
    assert.ok(city.label && city.country);
    assert.ok(zonedParts(new Date("2026-10-25T00:00:00Z"),city.zone).time);
  }
});
test("new tools appear on homepage, navigation, sitemap and share Railmap contextually", async () => {
  const urls = sitemapUrls().map((item)=>item.loc);
  for (const path of ["/tools/calendar/","/tools/world-time/"]) {
    assert.ok(urls.includes("https://tripview.kr"+path));
  }
  const home = await readFile("src/pages/index.astro","utf8");
  const hub = await readFile("src/pages/tools/index.astro","utf8");
  const article = await readFile("src/pages/[slug].astro","utf8");
  const footer = await readFile("src/components/Footer.astro","utf8");
  assert.match(home,/href="\/tools\/calendar\/"/);
  assert.match(home,/href="\/tools\/world-time\/"/);
  assert.match(hub,/mustview\.co\.kr\/train/);
  assert.match(article,/isOverseasTrip/);
  assert.match(footer,/href="\/tools\/world-time\/"/);
});
test("built calendar and world time pages and scripts are available", async () => {
  if (!existsSync("dist/tools/calendar/index.html")) return;
  for (const [path,regex] of [
    ["dist/tools/calendar/index.html", /data-calendar-days/],
    ["dist/tools/world-time/index.html", /data-world-cities/],
    ["dist/assets/trip-calendar.js", /renderCalendar/],
    ["dist/assets/trip-world-clock.js", /showClocks/],
    ["dist/assets/trip-time-utils.js", /calendarGrid/],
  ]) assert.match(await readFile(path,"utf8"),regex);
});
