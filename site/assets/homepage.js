(() => {
  if (window.tripviewHomepageReady) return;
  window.tripviewHomepageReady = true;

  function initHomepage() {
    document.documentElement.dataset.homepageReady = "true";
    const bookingResults = document.querySelector("[data-booking-results]");
    const bookingBackdrop = document.querySelector("[data-booking-backdrop]");
    const bookingSheets = [...document.querySelectorAll("[data-booking-sheet]")];

    const today = new Date();
    const toDateInput = (date) => date.toISOString().slice(0, 10);
    const addDays = (date, days) => {
      const next = new Date(date);
      next.setDate(next.getDate() + days);
      return next;
    };

    document.querySelectorAll('[data-booking-search] input[type="date"]').forEach((input, index) => {
      input.value = toDateInput(addDays(today, index === 0 ? 14 : 16));
      input.min = toDateInput(today);
    });

    const bookingTitle = (type) => ({
      accommodation: "숙소 검색 결과",
      tna: "투어·티켓 검색 결과",
      flight: "항공권 최저가 여행지",
    }[type] || "예약 검색 결과");

    function closeBookingSheet() {
      bookingSheets.forEach((sheet) => { sheet.hidden = true; });
      if (bookingBackdrop) bookingBackdrop.hidden = true;
      document.body.classList.remove("booking-sheet-open");
    }

    function openBookingSheet(type) {
      bookingSheets.forEach((sheet) => { sheet.hidden = sheet.dataset.bookingSheet !== type; });
      if (bookingBackdrop) bookingBackdrop.hidden = false;
      document.body.classList.add("booking-sheet-open");
      const activeSheet = bookingSheets.find((sheet) => sheet.dataset.bookingSheet === type);
      window.setTimeout(() => activeSheet?.querySelector("form input, form select, form button")?.focus(), 30);
    }

    function applyBookingPreset(preset) {
      const form = preset.closest("form");
      const field = preset.dataset.field || "keyword";
      const input = form?.elements?.namedItem(field);
      if (!input) return;
      input.value = preset.dataset.value || preset.textContent.trim();
      form.querySelectorAll("[data-booking-preset]").forEach((item) => {
        if ((item.dataset.field || "keyword") === field) item.classList.remove("is-selected");
      });
      preset.classList.add("is-selected");
      input.focus();
    }

    function startBookingResults(type) {
      if (!bookingResults) return;
      bookingResults.hidden = false;
      bookingResults.innerHTML = "";
      const title = document.createElement("h3");
      title.className = "booking-results-title";
      title.textContent = bookingTitle(type);
      bookingResults.appendChild(title);
    }

    function setBookingStatus(message, type = "") {
      startBookingResults(type);
      const status = document.createElement("p");
      status.className = "booking-status";
      status.textContent = message;
      bookingResults?.appendChild(status);
    }

    function appendBookingResult(item) {
      if (!bookingResults) return;
      const card = document.createElement("a");
      card.className = `check-card product-card${item.image ? "" : " no-thumb"}`;
      const url = item.type === "flight" ? "/flight-deals/" : (item.url || "https://www.myrealtrip.com/");
      card.href = url;
      if (/^https?:\/\//.test(url)) card.rel = "sponsored noopener";

      if (item.image) {
        const thumb = document.createElement("span");
        thumb.className = "booking-thumb";
        const image = document.createElement("img");
        image.src = item.image;
        image.alt = item.title || "예약 상품";
        image.loading = "lazy";
        thumb.appendChild(image);
        card.appendChild(thumb);
      }

      const title = document.createElement("strong");
      title.textContent = item.title || "예약 상품";
      const meta = document.createElement("span");
      meta.textContent = item.meta || "예약 정보";
      card.appendChild(title);
      card.appendChild(meta);
      bookingResults.appendChild(card);
    }

    async function runBookingSearch(form) {
      const type = form.dataset.bookingSearch;
      const params = new URLSearchParams(new FormData(form));
      if (type === "accommodation") params.set("type", "accommodation");
      if (type === "tna") params.set("type", "tna");
      if (type === "flight") params.set("type", "flight");
      setBookingStatus("검색 중입니다.", type);

      try {
        const response = await fetch(`/api/myrealtrip/search?${params.toString()}`, {
          headers: { accept: "application/json" },
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.message || "검색에 실패했습니다.");

        startBookingResults(type);
        const items = Array.isArray(payload.items) ? payload.items : [];
        if (!items.length) {
          setBookingStatus(payload.message || "검색 결과가 없습니다. 다른 키워드로 다시 검색해 보세요.", type);
          closeBookingSheet();
          bookingResults?.scrollIntoView({ block: "start", behavior: "smooth" });
          return;
        }

        items.forEach(appendBookingResult);
        closeBookingSheet();
        bookingResults?.scrollIntoView({ block: "start", behavior: "smooth" });
      } catch (error) {
        setBookingStatus(error.message || "검색 중 오류가 발생했습니다.", type);
        closeBookingSheet();
        bookingResults?.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    }

    function submitBookingForm(event) {
      const form = event.target.closest("[data-booking-search]");
      if (!form) return true;
      event.preventDefault();
      event.tripviewBookingHandled = true;
      runBookingSearch(form);
      return false;
    }

    window.tripviewOpenBooking = openBookingSheet;
    window.tripviewCloseBooking = closeBookingSheet;
    window.tripviewPresetBooking = applyBookingPreset;
    window.tripviewSubmitBooking = submitBookingForm;

    document.addEventListener("click", (event) => {
      const opener = event.target.closest("[data-open-booking]");
      if (opener) {
        event.preventDefault();
        openBookingSheet(opener.dataset.openBooking);
        return;
      }

      if (event.target.closest("[data-booking-close]") || event.target === bookingBackdrop) {
        event.preventDefault();
        closeBookingSheet();
        return;
      }

      const preset = event.target.closest("[data-booking-preset]");
      if (preset) {
        event.preventDefault();
        applyBookingPreset(preset);
        return;
      }

      const filterLink = event.target.closest("[data-filter]");
      if (!filterLink) return;
      event.preventDefault();
      const links = [...document.querySelectorAll("[data-filter]")];
      const sections = [...document.querySelectorAll(".news-section")];
      const label = document.querySelector("[data-feed-label]");
      const page = document.querySelector(".page");
      const id = filterLink.dataset.filter || filterLink.getAttribute("href").replace("#", "");
      const showAll = id === "all";
      const selectedSection = document.getElementById(id);
      const headline = showAll ? (label?.dataset.defaultLabel || "주제별 최신 여행 정보") : (selectedSection?.dataset.headline || filterLink.textContent.trim());

      links.forEach((item) => item.classList.remove("is-active"));
      filterLink.classList.add("is-active");
      page?.classList.toggle("is-filtered", !showAll);
      sections.forEach((section) => section.classList.toggle("is-hidden", !showAll && section.id !== id));
      if (label) label.textContent = headline;
      page?.scrollIntoView({ block: "start" });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeBookingSheet();
    });

    document.addEventListener("submit", (event) => {
      if (event.tripviewBookingHandled) return;
      submitBookingForm(event);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHomepage, { once: true });
  } else {
    initHomepage();
  }
})();
