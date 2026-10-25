import { TIME_CITIES, calendarDayDiff, dateTimeInSeoulInput, differenceFromSeoulMinutes, formatHourDifference, seoulDateTimeToInstant, zonedParts } from "./trip-time-utils.js";

const root = document.querySelector("[data-world-clock]");
if (root) {
  const citiesWrap = root.querySelector("[data-world-cities]");
  const citySelect = root.querySelector("[data-world-target]");
  const when = root.querySelector("[data-korea-datetime]");
  const result = root.querySelector("[data-world-result]");
  const converter = root.querySelector("[data-world-convert-form]");
  const status = root.querySelector("[data-world-clock-status]");
  const previewIds = ["seoul", "tokyo", "bangkok", "london", "newyork", "losangeles", "sydney"];
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const itemById = new Map(TIME_CITIES.map((c) => [c.id, c]));
  let targetId = "tokyo";

  for (const city of TIME_CITIES.filter((c) => c.id !== "seoul")) {
    const option = document.createElement("option");
    option.value = city.id;
    option.textContent = city.label + " · " + city.country;
    citySelect.append(option);
  }
  try { const saved = localStorage.getItem("tripview:world-city:v1"); if (itemById.has(saved) && saved !== "seoul") targetId = saved; } catch {}
  citySelect.value = targetId;
  when.value = dateTimeInSeoulInput(new Date());

  const dayLabel = (value) => {
    if (value === 0) return "한국과 같은 날짜";
    if (value === 1) return "한국보다 하루 빠른 날짜";
    if (value === -1) return "한국보다 하루 전 날짜";
    return "한국과 날짜 차이 " + value + "일";
  };
  const dayPart = (part) => {
    const hour = part.hour;
    return hour >= 6 && hour < 12 ? "오전" : hour >= 12 && hour < 18 ? "오후" : hour >= 18 && hour < 22 ? "저녁" : "밤";
  };
  const showClocks = () => {
    const now = new Date();
    const seoul = zonedParts(now, "Asia/Seoul");
    const displayIds = [...previewIds];
    if (!displayIds.includes(targetId)) displayIds.push(targetId);
    citiesWrap.replaceChildren();
    for (const id of displayIds) {
      const city = itemById.get(id);
      const local = zonedParts(now, city.zone);
      const diff = differenceFromSeoulMinutes(now, city.zone);
      const isSeoul = id === "seoul";
      const card = document.createElement("article");
      card.className="world-clock-card"+(id===targetId?" is-target":"");
      const header=document.createElement("div");header.className="world-clock-card-header";
      const name=document.createElement("strong");name.textContent=city.label;
      const country=document.createElement("small");country.textContent=city.country;
      header.append(name,country);
      const clock=document.createElement("time");clock.className="world-clock-time";
      clock.dateTime=local.dateKey+"T"+local.time;
      clock.textContent=local.time;
      const date=document.createElement("p");date.className="world-clock-date";date.textContent=local.month+"월 "+local.day+"일 · "+dayPart(local);
      const offset=document.createElement("p");offset.className="world-clock-offset";
      offset.textContent=isSeoul?"비교 기준 · 대한민국 표준시":formatHourDifference(diff)+" · "+dayLabel(calendarDayDiff(seoul.dateKey,local.dateKey));
      card.append(header,clock,date,offset);
      if (!isSeoul) {
        const choose=document.createElement("button");choose.type="button";choose.className="world-clock-choose";
        choose.textContent=id===targetId?"시간 변환 대상 선택됨":"이 도시로 변환";
        choose.setAttribute("aria-pressed", String(id===targetId));
        choose.addEventListener("click",()=>{targetId=id;citySelect.value=id;persist();showClocks();convert();});
        card.append(choose);
      }
      citiesWrap.append(card);
    }
    status.textContent="세계 표준시 데이터는 기기 브라우저의 시간대 규칙을 사용합니다. 최종 확인 시각: 한국 "+seoul.time;
  };
  const persist = () => { try { localStorage.setItem("tripview:world-city:v1",targetId); } catch {} };
  const convert = () => {
    const instant=seoulDateTimeToInstant(when.value);
    if (!instant) { result.textContent="유효한 한국 날짜와 시간을 입력해 주세요.";return; }
    const city=itemById.get(targetId);
    const local=zonedParts(instant,city.zone);
    const seoul=zonedParts(instant,"Asia/Seoul");
    const diff=differenceFromSeoulMinutes(instant,city.zone);
    result.replaceChildren();
    const name=document.createElement("p");name.textContent="한국 "+seoul.dateKey+" "+seoul.time+" → "+city.label+" 현지";
    const time=document.createElement("strong");time.textContent=local.dateKey+" "+local.time;
    const desc=document.createElement("p");desc.textContent=formatHourDifference(diff)+" · "+dayLabel(calendarDayDiff(seoul.dateKey,local.dateKey))+" (입력한 날짜의 일광절약시간 적용)";
    result.append(name,time,desc);
  };
  citySelect.addEventListener("change",()=>{targetId=citySelect.value;persist();showClocks();convert();});
  converter.addEventListener("submit",(e)=>{e.preventDefault();convert();});
  when.addEventListener("change", convert);
  showClocks();convert();
  // Update when the browser tab becomes visible and once every minute.
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)showClocks();});
  setInterval(showClocks,60000);
}
