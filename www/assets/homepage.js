(() => {
  if (window.tripviewHomepageReady && window.tripviewSubmitBooking) return;
  window.tripviewHomepageReady = true;

  function initHomepage() {
    document.documentElement.dataset.homepageReady = "true";
    const bookingResults = document.querySelector("[data-booking-results]");
    const bookingBackdrop = document.querySelector("[data-booking-backdrop]");
    const bookingSheets = [...document.querySelectorAll("[data-booking-sheet]")];

    const koreaToday = () => {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date());
      const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      return new Date(Number(value.year), Number(value.month) - 1, Number(value.day));
    };
    const today = koreaToday();
    const padDatePart = (value) => String(value).padStart(2, "0");
    const toDateInput = (date) => [
      date.getFullYear(),
      padDatePart(date.getMonth() + 1),
      padDatePart(date.getDate()),
    ].join("-");
    const addDays = (date, days) => {
      const next = new Date(date);
      next.setDate(next.getDate() + days);
      return next;
    };
    const defaultStayWindow = (reference = today) => {
      const daysUntilFriday = (5 - reference.getDay() + 7) % 7 || 7;
      const checkInDate = addDays(reference, daysUntilFriday);
      const checkOutDate = addDays(checkInDate, 2);
      return {
        checkIn: toDateInput(checkInDate),
        checkOut: toDateInput(checkOutDate),
      };
    };
    const defaultStay = defaultStayWindow();

    function accommodationUrlWithStay(rawUrl, stay = defaultStay) {
      try {
        const url = new URL(rawUrl, window.location.href);
        if (url.hostname.toLowerCase() !== "accommodation.myrealtrip.com") return rawUrl;
        url.searchParams.set("checkIn", stay.checkIn);
        url.searchParams.set("checkOut", stay.checkOut);
        url.searchParams.set("adultCount", "2");
        url.searchParams.set("childCount", "0");
        url.searchParams.set("childAges", "");
        return url.toString();
      } catch {
        return rawUrl;
      }
    }

    function refreshAccommodationCardLinks() {
      document.querySelectorAll('a[href*="accommodation.myrealtrip.com/union/products/"]').forEach((link) => {
        const original = link.dataset.accommodationSourceUrl || link.getAttribute("href") || "";
        if (!original) return;
        link.dataset.accommodationSourceUrl = original;
        link.href = accommodationUrlWithStay(original);
      });
    }

    const guideSections = [
      {
        id: "region-guide",
        label: "REGION",
        nav: "지역별",
        title: "지역별 빠른 탐색",
        intro: "서울, 수도권, 강원, 제주처럼 여행자가 먼저 찾는 지역을 기준으로 최신 글 목록과 바로 연결했습니다.",
        cards: [
          { label: "서울", title: "서울 도심 여행", desc: "전시, 공연, 실내 명소를 짧은 동선으로 묶어 확인하세요.", links: [["서울 글 모아보기", "/?region=서울#routes"], ["비 오는 날 실내 여행", "#indoor"]] },
          { label: "수도권", title: "경기·인천 근교", desc: "주말에 다녀오기 좋은 축제, 산책지, 가족 코스를 빠르게 찾습니다.", links: [["경기·인천 글", "/?region=경기%C2%B7인천#routes"], ["이번 주말 추천", "#weekend"]] },
          { label: "강원", title: "강원 계곡·바다", desc: "물놀이, 해수욕장, 여름 피서지를 목적별로 이어 봅니다.", links: [["강원 글", "/?region=강원#routes"], ["물놀이·계곡", "#water"]] },
          { label: "제주", title: "제주 여행 준비", desc: "숙소, 투어, 이동 전 확인할 포인트를 한 번에 점검합니다.", links: [["제주 글", "/?region=제주#routes"], ["예약 전 체크", "#booking"]] },
        ],
      },
      {
        id: "travel-plan",
        label: "PLAN",
        nav: "목적별",
        title: "여행 목적별 추천",
        intro: "지금 필요한 여행 목적에 맞춰 글과 예약 체크 영역으로 바로 이동할 수 있게 정리했습니다.",
        cards: [
          { label: "주말", title: "이번 주말 바로 가기", desc: "가까운 일정으로 움직일 때 보기 좋은 최신 여행지와 축제를 모았습니다.", links: [["주말 글 보기", "#weekend"], ["전체 글 검색", "#routes"]] },
          { label: "축제", title: "8월 축제 일정", desc: "행사 기간, 장소, 방문 전 확인 포인트가 있는 글을 우선 확인합니다.", links: [["축제 섹션", "#festival"], ["공연/축제 글", "/?topic=festival#routes"]] },
          { label: "물놀이", title: "계곡·해수욕장", desc: "더운 날 고르기 쉬운 물놀이 여행지를 따로 묶었습니다.", links: [["물놀이 섹션", "#water"], ["숙소 검색", "#booking"]] },
          { label: "실내", title: "날씨 영향 적은 코스", desc: "비 오는 날이나 폭염일 때 부담을 줄이는 실내 여행 후보입니다.", links: [["실내 여행", "#indoor"], ["투어·티켓 검색", "#booking"]] },
          { label: "가족", title: "아이와 함께", desc: "이동 부담과 체류 시간을 고려한 가족 여행 글을 확인하세요.", links: [["아이와 섹션", "#family"], ["국내여행 글", "/?topic=domestic#routes"]] },
          { label: "예약", title: "숙소·투어·항공", desc: "지역을 정했다면 숙소, 투어, 항공권 검색으로 바로 이어집니다.", links: [["예약 전 체크", "#booking"], ["투어 추천", "#myrealtrip-deals"]] },
        ],
      },
      {
        id: "precheck-guide",
        label: "CHECK",
        nav: "준비가이드",
        title: "방문 전 준비 가이드",
        intro: "출발 전에 한 번 더 보면 좋은 확인 항목을 여행 상황별로 나눴습니다.",
        cards: [
          { label: "운영", title: "운영시간·휴무 확인", desc: "계절, 기상, 행사 준비에 따라 운영 정보가 달라질 수 있어 공식 안내를 먼저 확인하세요.", links: [["최신 글 목록", "#routes"]] },
          { label: "교통", title: "주차·대중교통 동선", desc: "주말과 축제 기간에는 주차장 만차와 교통 통제가 잦아 대체 동선을 함께 봅니다.", links: [["이번 주말", "#weekend"]] },
          { label: "날씨", title: "우천·폭염 대안", desc: "물놀이와 야외 축제는 날씨 변수가 커서 실내 대체지를 함께 잡아두면 좋습니다.", links: [["실내 여행", "#indoor"], ["물놀이", "#water"]] },
          { label: "예산", title: "숙소·티켓 비교", desc: "인원, 날짜, 지역을 바꿔 보며 숙소와 투어 가격대를 먼저 확인합니다.", links: [["예약 검색", "#booking"]] },
        ],
      },
    ];

    function ensureGuideStyle() {
      if (document.getElementById("tripview-guide-style")) return;
      const style = document.createElement("style");
      style.id = "tripview-guide-style";
      style.textContent = [
        ".guide-intro{max-width:760px;margin:-6px 0 18px;color:var(--muted);font-size:14px;line-height:1.65}",
        ".content-guide-grid{display:grid;grid-template-columns:1fr;gap:0;border-top:1px solid var(--line)}",
        ".guide-card{display:block;min-width:0;padding:16px 0;border-bottom:1px solid var(--line)}",
        ".guide-label{display:block;color:#555;font-size:10px;font-weight:900;letter-spacing:.08em}",
        ".guide-card h3{margin:6px 0 7px;font-size:20px;line-height:1.24;font-weight:900}",
        ".guide-card p{margin:0;color:var(--muted);font-size:13px;line-height:1.58}",
        ".guide-links{display:grid;gap:7px;margin-top:12px}",
        ".guide-links a{display:block;color:var(--ink);font-size:14px;line-height:1.35;font-weight:900}",
        ".guide-links a span{color:var(--muted);font-size:12px;font-weight:800}",
        "@media(min-width:760px){.content-guide-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:0 18px}.travel-plan-grid,.precheck-guide-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}",
        "@media(min-width:900px){.region-guide-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:0 20px}.travel-plan-grid,.precheck-guide-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:0 20px}.guide-intro{font-size:15px}.guide-card h3{font-size:21px}}",
        "@media(max-width:430px){.guide-intro{font-size:13px}.guide-card h3{font-size:18px}.guide-links a{font-size:13px}}",
      ].join("");
      document.head.appendChild(style);
    }

    function createGuideSection(config) {
      const section = document.createElement("section");
      section.className = "news-section guide-section";
      section.id = config.id;
      section.setAttribute("aria-labelledby", `${config.id}-title`);
      section.dataset.headline = config.title;
      section.innerHTML = [
        '<div class="section-headline">',
        `<div><span class="section-kicker">${config.label}</span><h2 id="${config.id}-title">${config.title}</h2></div>`,
        "</div>",
        `<p class="guide-intro">${config.intro}</p>`,
        `<div class="content-guide-grid ${config.id}-grid">`,
        ...config.cards.map((card) => [
          '<article class="guide-card">',
          `<span class="guide-label">${card.label}</span>`,
          `<h3>${card.title}</h3>`,
          `<p>${card.desc}</p>`,
          '<div class="guide-links">',
          ...card.links.map(([text, href]) => `<a href="${href}">${text} <span>보기</span></a>`),
          "</div>",
          "</article>",
        ].join("")),
        "</div>",
      ].join("");
      return section;
    }

    function insertGuideNav() {
      const nav = document.querySelector(".nav-scroll");
      if (!nav) return;
      const bookingLink = nav.querySelector('[href="#booking"], [data-filter="booking"]');
      guideSections.forEach((section) => {
        if (nav.querySelector(`[href="#${section.id}"]`)) return;
        const link = document.createElement("a");
        link.href = `#${section.id}`;
        link.dataset.filter = section.id;
        link.textContent = section.nav;
        nav.insertBefore(link, bookingLink || null);
      });
    }

    function insertGuideSections() {
      const page = document.querySelector(".page");
      if (!page || document.getElementById("region-guide")) return;
      ensureGuideStyle();
      insertGuideNav();
      const anchor = document.getElementById("myrealtrip-deals") || document.getElementById("booking");
      guideSections.forEach((section) => {
        page.insertBefore(createGuideSection(section), anchor || null);
      });
    }

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
      appendBookingNotice(message);
    }

    function appendBookingNotice(message) {
      if (!bookingResults || !message) return;
      const status = document.createElement("p");
      status.className = "booking-status";
      status.textContent = message;
      bookingResults?.appendChild(status);
    }

    function appendBookingResult(item) {
      if (!bookingResults) return;
      const card = document.createElement("a");
      card.className = `check-card product-card${item.image ? "" : " no-thumb"}`;
      const fallbackFlightUrl = "https://flights.myrealtrip.com/";
      const url = item.type === "flight"
        ? (item.bookingUrl || (/^https?:\/\//.test(item.url || "") ? item.url : fallbackFlightUrl))
        : accommodationUrlWithStay(item.url || "https://www.myrealtrip.com/");
      card.href = url;
      if (/^https?:\/\//.test(url)) {
        card.target = "_blank";
        card.rel = "sponsored noopener";
      }

      if (item.image) {
        const thumb = document.createElement("span");
        thumb.className = "booking-thumb";
        const image = document.createElement("img");
        image.src = item.image;
        image.alt = item.title || "예약 상품";
        image.loading = "lazy";
        image.decoding = "async";
        image.width = 160;
        image.height = 125;
        image.addEventListener("error", () => {
          thumb.remove();
          card.classList.add("no-thumb");
        }, { once: true });
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
      if (type === "accommodation") {
        params.set("type", "accommodation");
        params.set("checkIn", params.get("checkIn") || defaultStay.checkIn);
        params.set("checkOut", params.get("checkOut") || defaultStay.checkOut);
        params.set("adultCount", params.get("adultCount") || "2");
        params.set("childCount", "0");
      }
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

        if (payload.fallback && payload.message) appendBookingNotice(payload.message);
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

    refreshAccommodationCardLinks();

    document.querySelectorAll('[data-booking-search="accommodation"] input[name="checkIn"]').forEach((input) => {
      input.value = defaultStay.checkIn;
      input.min = toDateInput(today);
    });
    document.querySelectorAll('[data-booking-search="accommodation"] input[name="checkOut"]').forEach((input) => {
      input.value = defaultStay.checkOut;
      input.min = defaultStay.checkIn;
    });
    document.querySelectorAll('[data-booking-search="accommodation"] input[name="adultCount"]').forEach((input) => {
      input.value = "2";
    });

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
