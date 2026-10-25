/**
 * User-editable trip budget arithmetic and packing checklist.
 * Prices are assumptions supplied by the visitor, never market rates.
 */
export function calculateTripBudget(values = {}) {
  const bounded = (raw, low, high) => {
    const value = Number(raw);
    return Number.isFinite(value) ? Math.min(high, Math.max(low, value)) : low;
  };
  const travelers = Math.round(bounded(values.travelers, 1, 30));
  const days = Math.round(bounded(values.days, 1, 60));
  const nights = Math.max(0, days - 1);
  const rooms = Math.round(bounded(values.rooms, 1, 15));
  const lodgingPerRoomNight = bounded(values.lodgingPerRoomNight, 0, 10000000);
  const foodPerPersonDay = bounded(values.foodPerPersonDay, 0, 1000000);
  const localTransportPerPersonDay = bounded(values.localTransportPerPersonDay, 0, 1000000);
  const activitiesPerPersonDay = bounded(values.activitiesPerPersonDay, 0, 1000000);
  const roundtripPerPerson = bounded(values.roundtripPerPerson, 0, 10000000);
  const bufferPercent = bounded(values.bufferPercent, 0, 100);
  const lodging = nights * rooms * lodgingPerRoomNight;
  const food = days * travelers * foodPerPersonDay;
  const localTransport = days * travelers * localTransportPerPersonDay;
  const activities = days * travelers * activitiesPerPersonDay;
  const roundtrip = travelers * roundtripPerPerson;
  const subtotal = lodging + food + localTransport + activities + roundtrip;
  const buffer = Math.round(subtotal * bufferPercent / 100);
  const total = Math.round(subtotal + buffer);
  return { travelers, days, nights, rooms, lodging, food, localTransport, activities, roundtrip, subtotal, buffer, total, perPerson: Math.round(total / travelers) };
}

export const PACKING_PRESETS = Object.freeze({
  domestic: ["신분증", "휴대전화와 충전기", "결제 수단", "예약 내역", "날씨에 맞는 겉옷", "상비약", "세면도구", "개인 물병"],
  overseas: ["여권 유효기간 확인", "목적지 입국 요건 확인", "항공·숙박 예약 내역", "현지 결제 수단", "여행자 보험 검토", "로밍·이심 확인", "전원 어댑터", "상비약 반입 규정 확인", "충전기와 보조배터리"],
  camping: ["텐트와 폴", "방수포", "침낭과 매트", "랜턴", "식수", "식기와 취사도구", "쓰레기 회수 봉투", "구급용품", "날씨·화기 사용 규정 확인"],
  family: ["가족 신분증·필요 서류", "아동용 여벌옷", "간식과 물", "개인 상비약", "휴대전화와 충전기", "예약 내역", "차량용 안전 장비 확인", "우천 대체 일정"],
});

export function packingProgress(total, checked) {
  const totalCount = Math.max(0, Number(total) || 0);
  const completed = Math.min(totalCount, Math.max(0, Number(checked) || 0));
  return { total: totalCount, checked: completed, percent: totalCount ? Math.round(100 * completed / totalCount) : 0 };
}

const app = typeof document === "undefined" ? null : document.querySelector("[data-travel-tools]");
if (app) {
  const money = (n) => Number(n || 0).toLocaleString("ko-KR") + "원";
  const form = app.querySelector("[data-budget-form]");
  const result = app.querySelector("[data-budget-result]");
  const regionPresets = {
    metro: { lodgingPerRoomNight: 110000, foodPerPersonDay: 35000, localTransportPerPersonDay: 12000, activitiesPerPersonDay: 15000 },
    region: { lodgingPerRoomNight: 90000, foodPerPersonDay: 30000, localTransportPerPersonDay: 15000, activitiesPerPersonDay: 10000 },
    jeju: { lodgingPerRoomNight: 130000, foodPerPersonDay: 40000, localTransportPerPersonDay: 25000, activitiesPerPersonDay: 18000 },
    overseas: { lodgingPerRoomNight: 150000, foodPerPersonDay: 45000, localTransportPerPersonDay: 25000, activitiesPerPersonDay: 25000 },
  };
  const recalc = () => {
    const inputs = Object.fromEntries(new FormData(form).entries());
    const breakdown = calculateTripBudget(inputs);
    const fields = ["lodging", "food", "localTransport", "activities", "roundtrip", "buffer", "total", "perPerson"];
    for (const field of fields) {
      const output = result.querySelector("[data-budget-" + field + "]");
      if (output) output.textContent = money(breakdown[field]);
    }
    const desc = result.querySelector("[data-budget-description]");
    if (desc) desc.textContent = breakdown.travelers + "명 · " + breakdown.days + "일(" + breakdown.nights + "박) · 객실 " + breakdown.rooms + "개 기준";
  };
  form.addEventListener("submit", (event) => { event.preventDefault(); recalc(); });
  form.addEventListener("input", recalc);
  form.querySelector("[name=destination]").addEventListener("change", (event) => {
    const preset = regionPresets[event.target.value];
    if (preset) for (const [key, value] of Object.entries(preset)) form.elements.namedItem(key).value = String(value);
    recalc();
  });
  recalc();

  const theme = app.querySelector("[data-packing-theme]");
  const checklist = app.querySelector("[data-packing-items]");
  const progress = app.querySelector("[data-packing-progress]");
  const saveKey = (category) => "tripview:packing:v1:" + category;
  const getSaved = (category) => {
    try { return new Set(JSON.parse(localStorage.getItem(saveKey(category)) || "[]")); }
    catch { return new Set(); }
  };
  const setSaved = (category, values) => {
    try { localStorage.setItem(saveKey(category), JSON.stringify(values)); } catch {}
  };
  const updateProgress = () => {
    const completed = [...checklist.querySelectorAll("input:checked")].length;
    const p = packingProgress(PACKING_PRESETS[theme.value]?.length, completed);
    progress.textContent = p.checked + " / " + p.total + "개 완료 (" + p.percent + "%)";
    const bar = app.querySelector("[data-packing-bar]");
    if (bar) bar.value = p.percent;
  };
  const renderChecklist = () => {
    checklist.replaceChildren();
    const checked = getSaved(theme.value);
    for (const item of PACKING_PRESETS[theme.value] || []) {
      const label = document.createElement("label");
      label.className = "packing-item";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = item;
      input.checked = checked.has(item);
      const span = document.createElement("span");
      span.textContent = item;
      label.append(input, span);
      checklist.append(label);
    }
    updateProgress();
  };
  theme.addEventListener("change", renderChecklist);
  checklist.addEventListener("change", () => {
    const checked = [...checklist.querySelectorAll("input:checked")].map((input) => input.value);
    setSaved(theme.value, checked);
    updateProgress();
  });
  app.querySelector("[data-packing-reset]").addEventListener("click", () => {
    setSaved(theme.value, []);
    renderChecklist();
  });
  renderChecklist();
}
