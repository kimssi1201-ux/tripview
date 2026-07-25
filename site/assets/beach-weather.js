(() => {
  const root = document.querySelector("[data-beach-weather]");
  if (!root) return;

  const select = root.querySelector("[data-beach-weather-select]");
  const output = root.querySelector("[data-beach-weather-output]");
  const refresh = root.querySelector("[data-beach-weather-refresh]");
  let requestController;

  const labels = {
    loading: "\uD604\uC7AC \uB0A0\uC528\uC640 \uD574\uC591 \uC815\uBCF4\uB97C \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4.",
    error: "\uC2E4\uC2DC\uAC04 \uD574\uC218\uC695\uC7A5 \uB0A0\uC528\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
    empty: "\uD604\uC7AC \uC81C\uACF5\uB418\uB294 \uD574\uC591 \uC815\uBCF4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.",
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
    const text = String(value || "");
    if (/^\d{12}$/.test(text)) return `${text.slice(8, 10)}:${text.slice(10, 12)}`;
    if (/^\d{4}$/.test(text)) return `${text.slice(0, 2)}:${text.slice(2, 4)}`;
    return text || "-";
  }

  function dateTimeText(value) {
    const text = String(value || "");
    if (/^\d{12}$/.test(text)) return `${text.slice(0, 4)}.${text.slice(4, 6)}.${text.slice(6, 8)} ${timeText(text)}`;
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

  function render(payload) {
    if (!output) return;
    if (!payload?.ok) {
      setStatus(payload?.message || labels.error, "error");
      return;
    }

    const forecast = payload.forecast;
    const grid = node("dl", "beach-weather-grid");
    grid.append(metric("\uD558\uB298 \uC0C1\uD0DC", forecast?.condition || "-", forecast?.time ? `${timeText(forecast.time)} \uC608\uBCF4` : ""));
    grid.append(metric("\uAE30\uC628", valueText(forecast?.temperature, "\u00B0C"), "\uD574\uC218\uC695\uC7A5 \uB2E8\uAE30\uC608\uBCF4"));
    grid.append(metric("\uAC15\uC218\uD655\uB960", valueText(forecast?.rainProbability, "%"), forecast?.rainAmount ? `\uAC15\uC218\uB7C9 ${forecast.rainAmount}` : ""));
    grid.append(metric("\uD30C\uACE0", valueText(payload.wave?.value, "m"), dateTimeText(payload.wave?.observedAt)));
    grid.append(metric("\uC218\uC628", valueText(payload.waterTemperature?.value, "\u00B0C"), dateTimeText(payload.waterTemperature?.observedAt)));
    grid.append(metric("\uD574\uB728\uB294 \uC2DC\uAC04", timeText(payload.sun?.sunrise), payload.sun?.sunset ? `\uC77C\uBAB0 ${timeText(payload.sun.sunset)}` : ""));

    const wrapper = node("div", "beach-weather-result");
    wrapper.append(grid);
    if (Array.isArray(payload.tide) && payload.tide.length) {
      const tide = node("div", "beach-weather-tide");
      tide.append(node("strong", "beach-weather-subtitle", "\uC870\uC11D \uC815\uBCF4"));
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
    if (payload.message) wrapper.append(node("p", "beach-weather-partial", payload.message));
    output.replaceChildren(wrapper);
  }

  async function load() {
    const beachNumber = select?.value || "1";
    requestController?.abort();
    requestController = new AbortController();
    setStatus(labels.loading);
    if (refresh) refresh.disabled = true;
    try {
      const response = await fetch(`/api/beach-weather?beach_num=${encodeURIComponent(beachNumber)}`, {
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

  select?.addEventListener("change", load);
  refresh?.addEventListener("click", load);
  load();
})();
