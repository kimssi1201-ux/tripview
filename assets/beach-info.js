(() => {
  const BEACHES = new Map([
    ["travel-126078", { name: "\uAD11\uC548\uB9AC" }],
    ["travel-126302", { name: "\uC1A1\uD638\uB545\uB05D" }],
    ["travel-128199", { name: "\uAC15\uB3D9\uBAA8\uB3CC\uD574\uBCC0" }],
    ["travel-125711", { name: "\uC7A5\uD638" }],
    ["travel-125713", { name: "\uB9DD\uC0C1" }],
    ["travel-3000205", { name: "\uC6B0\uB450" }],
    ["travel-127722", { name: "\uC548\uBAA9" }],
    ["travel-127764", { name: "\uB3C8\uBAA9" }],
    ["travel-126098", { name: "\uC77C\uAD11" }],
    ["travel-128767", { name: "\uC744\uC655\uB9AC" }],
    ["travel-129255", { name: "\uC120\uB140\uBC14\uC704" }],
    ["travel-129256", { name: "\uC655\uC0B0" }],
    ["travel-127698", { name: "\uC601\uC77C\uB300" }],
    ["travel-129400", { name: "\uAE40\uB155" }],
    ["travel-3041720", { name: "\uCCAD\uD638" }],
  ]);
  const slug = window.location.pathname.split("/").filter(Boolean).find((part) => BEACHES.has(part));
  const config = BEACHES.get(slug);
  if (!slug || !config) return;

  function ensureStyles() {
    if (document.getElementById("tripview-beach-info-style")) return;
    const style = document.createElement("style");
    style.id = "tripview-beach-info-style";
    style.textContent = `
      .article-beach-info{margin:34px 0;padding:24px 0;border-top:2px solid var(--ink,#111);border-bottom:1px solid var(--line,#ddd)}
      .article-beach-info h2{margin:0;font-size:24px;line-height:1.3}.beach-info-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:16px}
      .beach-info-head p{margin:6px 0 0;color:var(--muted,#666);font-size:13px}.beach-info-refresh{border:1px solid var(--line,#ddd);background:var(--paper,#fff);padding:8px 12px;color:var(--ink,#111);font:inherit;font-size:12px;font-weight:800;cursor:pointer}.beach-info-refresh:disabled{opacity:.5;cursor:wait}
      .beach-info-image{display:block;width:100%;max-height:280px;object-fit:cover;margin:0 0 8px}.beach-info-source{margin:0 0 16px;color:var(--muted,#666);font-size:12px}
      .beach-info-grid{display:grid;grid-template-columns:110px minmax(0,1fr);gap:8px 14px;margin:0}.beach-info-label{color:var(--muted,#666);font-size:12px;font-weight:800}.beach-info-value{margin:0;font-size:14px}.beach-info-link{display:inline-block;margin-top:16px;font-size:13px;font-weight:800;text-decoration:underline}.beach-info-coordinates{margin:16px 0 0;color:var(--muted,#666);font-size:12px}
      .beach-info-status{margin:0;color:var(--muted,#666);font-size:13px}.beach-info-status.is-error{color:#9b2c2c}
      @media(max-width:640px){.beach-info-head{align-items:flex-start}.beach-info-grid{grid-template-columns:86px minmax(0,1fr)}}`;
    document.head.append(style);
  }

  function createRoot() {
    const existing = document.querySelector("[data-beach-info]");
    if (existing) return existing;
    const section = document.createElement("section");
    section.className = "article-beach-info";
    section.dataset.beachInfo = "";
    section.dataset.beachSlug = slug;
    section.setAttribute("aria-labelledby", `${slug}-beach-info-title`);
    section.innerHTML = `
      <div class="beach-info-head"><div><h2 id="${slug}-beach-info-title"></h2><p>\uC704\uCE58\u00B7\uD574\uBCC0 \uD06C\uAE30\u00B7\uD2B9\uC9D5\u00B7\uC5F0\uB77D\uCC98\uC640 \uAD00\uB828 \uC0AC\uC774\uD2B8\uB97C \uD574\uBCC0\uBCC4\uB85C \uC815\uB9AC\uD588\uC2B5\uB2C8\uB2E4.</p></div><button type="button" class="beach-info-refresh" data-beach-info-refresh>\uC0C8\uB85C\uACE0\CE68</button></div>
      <div data-beach-info-output aria-live="polite"><p class="beach-info-status">\uD574\uC218\uC695\uC7A5 \uAE30\BCF8\uC815\uBCF4\uB97C \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4.</p></div>`;
    section.querySelector("h2").textContent = `${config.name} \uD574\uC218\uC695\uC7A5 \uAE30\BCF8\uC815\uBCF4`;
    const content = document.querySelector("article.content") || document.querySelector("main");
    const table = content?.querySelector(".info-table");
    if (table) table.insertAdjacentElement("afterend", section);
    else content?.prepend(section);
    return section;
  }

  function node(tag, className, value = "") {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value !== "") element.textContent = value;
    return element;
  }

  function valueText(value, suffix = "") {
    return value === null || value === undefined || value === "" ? "-" : `${value}${suffix}`;
  }

  function coordinateText(value) {
    return value === null || value === undefined || value === "" ? "" : String(value);
  }

  function setStatus(output, message, type = "") {
    output.replaceChildren(node("p", `beach-info-status${type ? ` is-${type}` : ""}`, message));
  }

  function renderInfo(output, info) {
    if (!info) {
      setStatus(output, "\uC77C\uCE58\uD558\uB294 \uD574\uC218\uC695\uC7A5 \uAE30\BCF8\uC815\uBCF4\uB97C \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", "error");
      return;
    }
    const wrapper = node("div", "beach-info-result");
    if (info.image) {
      const image = node("img", "beach-info-image");
      image.src = info.image;
      image.alt = `${info.name || config.name} \uD574\uC218\uc695\uC7A5 \uC774\uBBF8\uC9C0`;
      image.loading = "lazy";
      wrapper.append(image, node("p", "beach-info-source", "\uCD9C\uCC98: \uD574\uC591\uC218\uC0B0\uBD80 \uD574\uC218\uC695\uC7A5\uC815\uBCF4\uC11C\uBE44\uC2A4"));
    }
    const details = node("dl", "beach-info-grid");
    const rows = [
      ["\uC2DC\uB3C4\u00B7\uAD6C\uAD70", [info.province, info.county].filter(Boolean).join(" ")],
      ["\uC815\uC810\uBA85", info.name],
      ["\uD574\uBCC0 \uD3ED", valueText(info.width, "m")],
      ["\uD574\uBCC0 \uCD1D\uC5F0\uC7A5", valueText(info.length, "m")],
      ["\uD2B9\uC9D5", info.feature],
      ["\uBE44\uC0C1\uC5F0\uB77D\uCC98", info.emergencyPhone],
    ];
    rows.forEach(([label, value]) => {
      if (!value) return;
      details.append(node("dt", "beach-info-label", label), node("dd", "beach-info-value", value));
    });
    wrapper.append(details);
    const latitude = coordinateText(info.latitude);
    const longitude = coordinateText(info.longitude);
    if (latitude && longitude) {
      const coordinates = node("p", "beach-info-coordinates", `\uC704\uB3C4 ${latitude} \u00B7 \uACBD\uB3C4 ${longitude}`);
      wrapper.append(coordinates);
    }
    if (info.link) {
      const link = node("a", "beach-info-link", info.linkName || "\uAD00\uB828 \uC0AC\uC774\uD2B8 \uBCF4\uAE30");
      link.href = info.link;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      wrapper.append(link);
    }
    output.replaceChildren(wrapper);
  }

  async function load(root) {
    const output = root.querySelector("[data-beach-info-output]");
    const refresh = root.querySelector("[data-beach-info-refresh]");
    setStatus(output, "\uD574\uC218\uC695\uC7A5 \uAE30\BCF8\uC815\uBCF4\uB97C \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4.");
    if (refresh) refresh.disabled = true;
    try {
      const response = await fetch(`/api/beach-info?beach=${encodeURIComponent(slug)}`, { headers: { accept: "application/json" } });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || "\uD574\uC218\uc695\uC7A5 \uC815\uBCF4\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
      renderInfo(output, payload.info);
    } catch (error) {
      setStatus(output, error?.message || "\uD574\uC218\uC695\uC7A5 \uC815\uBCF4\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", "error");
    } finally {
      if (refresh) refresh.disabled = false;
    }
  }

  ensureStyles();
  const root = createRoot();
  root.querySelector("[data-beach-info-refresh]")?.addEventListener("click", () => load(root));
  load(root);
})();
