import { calendarGrid, calendarDayDiff, dateKey, parseDateKey, zonedParts } from "./trip-time-utils.js";

const root = document.querySelector("[data-trip-calendar]");
if (root) {
  const STORAGE = "tripview:trip-calendar:v1";
  const todayKey = () => zonedParts(new Date(), "Asia/Seoul").dateKey;
  const today = parseDateKey(todayKey());
  const heading = root.querySelector("[data-calendar-month]");
  const grid = root.querySelector("[data-calendar-days]");
  const selectedLabel = root.querySelector("[data-calendar-selected]");
  const departure = root.querySelector("[data-trip-departure]");
  const arrival = root.querySelector("[data-trip-return]");
  const countdown = root.querySelector("[data-trip-countdown]");
  const agenda = root.querySelector("[data-calendar-agenda]");
  const eventForm = root.querySelector("[data-calendar-form]");
  const status = root.querySelector("[data-calendar-status]");
  let state = { departure: "", arrival: "", entries: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) || "{}");
    if (saved && typeof saved === "object") {
      state.departure = parseDateKey(saved.departure)?.year ? saved.departure : "";
      state.arrival = parseDateKey(saved.arrival)?.year ? saved.arrival : "";
      state.entries = Array.isArray(saved.entries)
        ? saved.entries.filter((e) => e && parseDateKey(e.day) && typeof e.title === "string" && e.title.length <= 160 && /^[0-2]\d:[0-5]\d$/.test(e.time || "00:00")).slice(0, 200)
        : [];
    }
  } catch {}
  let selected = todayKey();
  let year = today.year;
  let month = today.month;
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const save = () => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(state));
      status.textContent = "이 기기에 일정이 저장됐습니다.";
    } catch { status.textContent = "저장이 제한된 브라우저입니다. 현재 화면에서는 일정을 사용할 수 있습니다."; }
  };
  const moveMonth = (offset) => {
    const next = new Date(Date.UTC(year, month - 1 + offset, 1));
    year = next.getUTCFullYear(); month = next.getUTCMonth() + 1;
    renderCalendar();
  };
  const showCountdown = () => {
    const diff = calendarDayDiff(todayKey(), state.departure);
    if (diff === null) countdown.textContent = "출발일을 입력하면 D-Day를 확인할 수 있습니다.";
    else if (diff === 0) countdown.textContent = "오늘 출발해요! D-DAY";
    else if (diff > 0) countdown.textContent = "여행 출발까지 D-" + diff;
    else countdown.textContent = "선택한 출발일이 " + Math.abs(diff) + "일 지났습니다.";
  };
  const renderAgenda = () => {
    agenda.replaceChildren();
    const date = parseDateKey(selected);
    selectedLabel.textContent = date.year + "년 " + date.month + "월 " + date.day + "일 일정";
    const entries = state.entries.filter((event) => event.day === selected).sort((a,b) => a.time.localeCompare(b.time));
    if (!entries.length) {
      const p = document.createElement("p"); p.className = "calendar-empty"; p.textContent = "등록한 일정이 없습니다. 아래에서 한 줄 일정을 추가하세요."; agenda.append(p); return;
    }
    for (const entry of entries) {
      const item = document.createElement("li");
      const meta = document.createElement("span"); meta.className = "calendar-event-copy";
      const time = document.createElement("small"); time.textContent = entry.time;
      const title = document.createElement("strong"); title.textContent = entry.title;
      meta.append(time, title);
      const remove = document.createElement("button"); remove.type="button"; remove.className="calendar-remove"; remove.textContent="삭제"; remove.setAttribute("aria-label",entry.title+" 일정 삭제");
      remove.addEventListener("click", () => {
        state.entries = state.entries.filter((e) => e.id !== entry.id); save(); renderCalendar();
      });
      item.append(meta, remove); agenda.append(item);
    }
  };
  const renderCalendar = () => {
    heading.textContent = year + "년 " + month + "월";
    grid.replaceChildren();
    for (const cell of calendarGrid(year, month)) {
      const button = document.createElement("button");button.type="button";
      const isToday = cell.key === todayKey();
      const inRange = state.departure && state.arrival && cell.key >= state.departure && cell.key <= state.arrival;
      const hasEvent = state.entries.some((e) => e.day === cell.key);
      button.className = ["calendar-day",cell.inMonth ? "" : "is-other",cell.weekday===0?"is-sunday":"",cell.weekday===6?"is-saturday":"",isToday?"is-today":"",inRange?"is-trip":"",cell.key===selected?"is-selected":""].filter(Boolean).join(" ");
      button.setAttribute("aria-label",cell.key + (hasEvent ? " · 일정 있음" : "") + (isToday?" · 오늘":""));
      button.setAttribute("aria-pressed",String(cell.key===selected));
      const num = document.createElement("span");num.textContent=String(cell.day);button.append(num);
      if (hasEvent) {const dot=document.createElement("span");dot.className="calendar-event-dot";dot.setAttribute("aria-hidden","true");button.append(dot);}
      button.addEventListener("click", () => {
        selected = cell.key;
        if (!cell.inMonth) { year=Number(cell.key.slice(0,4));month=Number(cell.key.slice(5,7)); }
        renderCalendar();
      });
      grid.append(button);
    }
    renderAgenda();showCountdown();
  };
  departure.value = state.departure;
  arrival.value = state.arrival;
  const updateTrip = () => {
    state.departure = parseDateKey(departure.value) ? departure.value : "";
    state.arrival = parseDateKey(arrival.value) ? arrival.value : "";
    if (state.departure && state.arrival && state.arrival < state.departure) {
      status.textContent = "귀국·도착 날짜는 출발 날짜보다 빠를 수 없습니다.";
      arrival.setCustomValidity("출발일 이후 날짜를 선택하세요.");
      return;
    }
    arrival.setCustomValidity("");
    save();renderCalendar();
  };
  departure.addEventListener("change", updateTrip);
  arrival.addEventListener("change", updateTrip);
  root.querySelector("[data-calendar-prev]").addEventListener("click", () => moveMonth(-1));
  root.querySelector("[data-calendar-next]").addEventListener("click", () => moveMonth(1));
  root.querySelector("[data-calendar-today]").addEventListener("click", () => {
    const t = parseDateKey(todayKey()); year=t.year;month=t.month;selected=todayKey();renderCalendar();
  });
  eventForm.addEventListener("submit",(event) => {
    event.preventDefault();
    const title = eventForm.elements.namedItem("title").value.trim().slice(0, 100);
    const time = eventForm.elements.namedItem("time").value || "09:00";
    if (!title) return;
    if (state.entries.length >= 200) { status.textContent="저장할 수 있는 일정은 최대 200개입니다."; return; }
    state.entries.push({id:Date.now().toString(36)+"-"+Math.random().toString(36).slice(2),day:selected,title,time});
    save();eventForm.elements.namedItem("title").value="";renderCalendar();
  });
  renderCalendar();
}
