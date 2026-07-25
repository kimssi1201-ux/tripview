(() => {
  const BEACHES = new Map([
    ["travel-126078", { code: 306, name: "\uAD11\uC548\uB9AC" }],
    ["travel-126302", { code: 127, name: "\uC1A1\uD638\uB545\uB05D" }],
    ["travel-128199", { name: "\uAC15\uB3D9\uBAA8\uB3CC\uD574\uBCC0" }],
    ["travel-125711", { code: 221, name: "\uC7A5\uD638" }],
    ["travel-125713", { code: 198, name: "\uB9DD\uC0C1" }],
    ["travel-3000205", { name: "\uC6B0\uB450" }],
    ["travel-127722", { code: 174, name: "\uC548\uBAA9" }],
    ["travel-127764", { name: "\uB3C8\uBAA9" }],
  ]);
  const slug = window.location.pathname.split("/").filter(Boolean).find((part) => BEACHES.has(part));
  const config = BEACHES.get(slug);
  if (!slug || !config) return;

  function ensureStyles() {
    if (document.getElementById("tripview-beach-weather-style")) return;
    const style = document.createElement("style");
    style.id = "tripview-beach-weather-style";
    style.textContent = `
      .article-beach-weather{margin:34px 0;padding:24px 0;border-top:2px solid var(--ink,#111);border-bottom:1px solid var(--line,#ddd)}
      .article-beach-weather h2{margin:0;font-size:24px;line-height:1.3}.beach-weather-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:16px}
      .beach-weather-head p{margin:6px 0 0;color:var(--muted,#666);font-size:13px}.beach-weather-refresh{border:1px solid var(--line,#ddd);background:var(--paper,#fff);padding:8px 12px;color:var(--ink,#111);font:inherit;font-size:12px;font-weight:800;cursor:pointer}.beach-weather-refresh:disabled{opacity:.5;cursor:wait}
      .beach-weather-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;background:var(--line,#ddd);border:1px solid var(--line,#ddd)}.beach-weather-metric{min-width:0;padding:14px 12px;background:var(--paper,#fff)}
      .beach-weather-label,.beach-info-label{color:var(--muted,#666);font-size:12px;font-weight:800}.beach-weather-value{margin:4px 0 0;font-size:18px;font-weight:900}.beach-weather-meta{display:block;margin-top:4px;color:var(--muted,#666);font-size:11px;font-weight:600}
      .beach-weather-subtitle{margin:22px 0 10px;font-size:17px}.beach-info{margin-top:4px}.beach-info-image{width:100%;max-height:260px;object-fit:cover;margin-bottom:12px}.beach-info-grid{display:grid;grid-template-columns:100px minmax(0,1fr);gap:7px 14px;margin:0}.beach-info-value{margin:0;font-size:14px}.beach-info-link{display:inline-block;margin-top:14px;font-size:13px;font-weight:800;text-decoration:underline}
      .beach-weather-tide-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px;margin:0;padding:0;border-top:1px solid var(--line,#ddd);list-style:none}.beach-weather-tide-row{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--line,#ddd);font-size:13px}.beach-weather-tide-type{min-width:34px;color:var(--muted,#666);font-weight:700}.beach-weather-tide-level{margin-left:auto;color:var(--muted,#666)}.beach-weather-status,.beach-weather-partial{margin:0;color:var(--muted,#666);font-size:13px}.beach-weather-status.is-error{color:#9b2c2c}
      @media(max-width:640px){.beach-weather-head{align-items:flex-start}.beach-weather-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.beach-weather-tide-list{grid-template-columns:1fr}.beach-info-grid{grid-template-columns:86px minmax(0,1fr)}}`;
    document.head.append(style);
  }

  function createRoot() {
    const existing = document.querySelector("[data-beach-weather]");
    if (existing) return existing;
    const section = document.createElement("section");
    section.className = "article-beach-weather";
    section.dataset.beachWeather = "";
    section.dataset.beachSlug = slug;
    if (config.code) section.dataset.beachCode = String(config.code);
    section.setAttribute("aria-labelledby", `${slug}-beach-data-title`);
    section.innerHTML = `
      <div class="beach-weather-head"><div><h2 id="${slug}-beach-data-title"></h2><p>\uAE30\uC628\u00B7\uB0A0\uC528\u00B7\uD30C\uACE0\u00B7\uC218\uC628\u00B7\uC870\uC11D \uC911 \uD655\uC778 \uAC00\uB2A5\uD55C \uD56D\uBAA9\uC744 \uD574\uBCC0\uBCC4\uB85C \uBCF4\uC5EC\uC90D\uB2C8\uB2E4.</p></div><button type="button" class="beach-weather-refresh" data-beach-weather-refresh>\uC0C8\uB85C\uACE0\uCE68</button></div>
      <div data-beach-weather-output aria-live="polite"><p class="beach-weather-status">\uC815\uBCF4\uB97C \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4.</p></div>
      <p class="note">\uAE30\uC0C1\uCCAD \uD574\uC591\uC608\uBCF4\uC640 \uD574\uC591\uC218\uC0B0\uBD80 \uD574\uC218\uC695\uC7A5 \uC815\uBCF4\uB97C \uAE30\uC900\uC73C\uB85C \uD558\uBA70, \uC6B4\uC601 \uC5EC\uBD80\uC640 \uC785\uC7A5 \uC870\uAC74\uC740 \uD604\uC7A5 \uACF5\uC9C0\uB97C \uC6B0\uC120\uD569\uB2C8\uB2E4.</p>`;
    section.querySelector("h2").textContent = `${config.name} \uD574\uC218\uC695\uC7A5 \uD604\uC7A5 \uC815\uBCF4`;
    const content = document.querySelector("article.content") || document.querySelector("main");
    const table = content?.querySelector(".info-table");
    if (table) table.insertAdjacentElement("afterend", section);
    else content?.prepend(section);
    return section;
  }

  ensureStyles();
  const root = createRoot();

  const output = root.querySelector("[data-beach-weather-output]");
  const refresh = root.querySelector("[data-beach-weather-refresh]");
  let requestController;

  const labels = {
    loading: "\uD574\uC218\uC695\uC7A5 \uC815\uBCF4\uB97C \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4.",
    error: "\uD574\uC218\uC695\uC7A5 \uC815\uBCF4\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
    noData: "\uD604\uC7AC \uD655\uC778\uD560 \uC218 \uC788\uB294 \uC815\uBCF4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.",
  };

  function node(tag, className, value = "") {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value !== "") element.textContent = value;
    return element;
  }

  function valueText(value, suffix = "") {
    return value === null || value === undefined || value === "" ? "-" : `${value}${suffix}`;
  }

  function timeText(value) {
    const valueText = String(value || "");
    if (/^\d{12}$/.test(valueText)) return `${valueText.slice(8, 10)}:${valueText.slice(10, 12)}`;
    if (/^\d{4}$/.test(valueText)) return `${valueText.slice(0, 2)}:${valueText.slice(2, 4)}`;
    return valueText || "-";
  }

  function dateTimeText(value) {
    const valueText = String(value || "");
    if (/^\d{12}$/.test(valueText)) return `${valueText.slice(0, 4)}.${valueText.slice(4, 6)}.${valueText.slice(6, 8)} ${timeText(valueText)}`;
    return "";
  }

  function setStatus(message, type = "") {
    if (!output) return;
    output.replaceChildren(node("p", `beach-weather-status${type ? ` is-${type}` : ""}`, message));
  }

  function metric(label, value, meta = "") {
    const item = node("div", "beach-weather-metric");
    item.append(node("dt", "beach-weather-label", label));
    item.append(node("dd", "beach-weather-value", value));
    if (meta) item.append(node("small", "beach-weather-meta", meta));
    return item;
  }

  function renderInfo(info) {
    if (!info) return null;
    const section = node("section", "beach-info");
    section.append(node("h3", "beach-weather-subtitle", "\uD574\uC218\uC695\uC7A5 \uAE30\uBCF8\uC815\uBCF4"));
    if (info.image) {
      const image = node("img", "beach-info-image");
      image.src = info.image;
      image.alt = info.name ? `${info.name} \uD574\uC218\uC695\uC7A5` : "\uD574\uC218\uC695\uC7A5 \uC774\uBBF8\uC9C0";
      image.loading = "lazy";
      section.append(image);
    }
    const details = node("dl", "beach-info-grid");
    const location = [info.province, info.county].filter(Boolean).join(" ");
    const size = [
      info.width !== null && info.width !== undefined ? `\uD574\uBCC0\uD3ED ${info.width}m` : "",
      info.length !== null && info.length !== undefined ? `\uCD1D\uC5F0\uC7A5 ${info.length}m` : "",
    ].filter(Boolean).join(" \u00B7 ");
    [["\uC704\uCE58", location], ["\uD574\uBCC0 \uD2B9\uC9D5", info.feature], ["\uD574\uBCC0 \uD06C\uAE30", size], ["\uBE44\uC0C1\uC5F0\uB77D\uCC98", info.emergencyPhone]].forEach(([label, value]) => {
      if (!value) return;
      details.append(node("dt", "beach-info-label", label));
      details.append(node("dd", "beach-info-value", value));
    });
    section.append(details);
    if (info.link) {
      const link = node("a", "beach-info-link", info.linkName || "\uAD00\uB828 \uC548\uB0B4 \uBCF4\uAE30");
      link.href = info.link;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      section.append(link);
    }
    return section;
  }

  function render(payload) {
    if (!output) return;
    if (!payload?.ok) {
      setStatus(payload?.message || labels.error, "error");
      return;
    }
    const wrapper = node("div", "beach-weather-result");
    const forecast = payload.forecast;
    const metrics = [];
    if (forecast) {
      metrics.push(metric("\uD558\uB298 \uC0C1\uD0DC", forecast.condition || "-", forecast.time ? `${timeText(forecast.time)} \uC608\uBCF4` : ""));
      metrics.push(metric("\uAE30\uC628", valueText(forecast.temperature, "\u00B0C"), "\uD574\uC218\uC695\uC7A5 \uB2E8\uAE30\uC608\uBCF4"));
      metrics.push(metric("\uAC15\uC218\uD655\uB960", valueText(forecast.rainProbability, "%"), forecast.rainAmount ? `\uAC15\uC218\uB7C9 ${forecast.rainAmount}` : ""));
    }
    if (payload.wave) metrics.push(metric("\uD30C\uACE0", valueText(payload.wave.value, "m"), dateTimeText(payload.wave.observedAt)));
    if (payload.waterTemperature) metrics.push(metric("\uC218\uC628", valueText(payload.waterTemperature.value, "\u00B0C"), dateTimeText(payload.waterTemperature.observedAt)));
    if (payload.sun) metrics.push(metric("\uC77C\uCD9C", timeText(payload.sun.sunrise), payload.sun.sunset ? `\uC77C\uBAB0 ${timeText(payload.sun.sunset)}` : ""));
    if (metrics.length) {
      const grid = node("dl", "beach-weather-grid");
      metrics.forEach((item) => grid.append(item));
      wrapper.append(grid);
    }
    const info = renderInfo(payload.info);
    if (info) wrapper.append(info);
    if (Array.isArray(payload.tide) && payload.tide.length) {
      const tide = node("section", "beach-weather-tide");
      tide.append(node("h3", "beach-weather-subtitle", "\uC870\uC11D \uC815\uBCF4"));
      const list = node("ul", "beach-weather-tide-list");
      payload.tide.slice(0, 4).forEach((item) => {
        const row = node("li", "beach-weather-tide-row");
        row.append(node("span", "beach-weather-tide-type", item.type || "\uC870\uC11D"));
        row.append(node("b", "beach-weather-tide-time", timeText(item.time)));
        if (item.level !== null && item.level !== undefined) row.append(node("small", "beach-weather-tide-level", `${item.level}cm`));
        list.append(row);
      });
      tide.append(list);
      wrapper.append(tide);
    }
    if (!wrapper.children.length) {
      setStatus(labels.noData, "error");
      return;
    }
    if (payload.message) wrapper.append(node("p", "beach-weather-partial", payload.message));
    output.replaceChildren(wrapper);
  }

  async function load() {
    if (!slug) return;
    requestController?.abort();
    requestController = new AbortController();
    setStatus(labels.loading);
    if (refresh) refresh.disabled = true;
    try {
      const response = await fetch(`/api/beach-weather?beach=${encodeURIComponent(slug)}`, {
        headers: { accept: "application/json" },
        signal: requestController.signal,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) throw new Error(payload?.message || labels.error);
      render(payload);
    } catch (error) {
      if (error?.name !== "AbortError") setStatus(error?.message || labels.error, "error");
    } finally {
      if (refresh) refresh.disabled = false;
    }
  }

  refresh?.addEventListener("click", load);
  load();
})();
