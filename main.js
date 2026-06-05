const articles = [
  {
    title: "부산항축제, 북항 친수공원에서 즐기는 불꽃놀이와 해양 체험",
    category: "공연/축제",
    excerpt: "여름 밤바다를 배경으로 열리는 공연, 체험 프로그램, 이동 동선과 방문 전 확인할 내용을 정리했습니다.",
    date: "2026년 6월 5일",
    read: "3분",
    views: 6,
    image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=900&q=82",
    alt: "밤하늘의 불꽃놀이",
    keywords: ["부산", "축제", "북항", "불꽃놀이"],
  },
  {
    title: "창원컨벤션센터, 경상남도 창원시 위치와 방문 정보",
    category: "국내여행",
    excerpt: "전시회와 컨퍼런스가 자주 열리는 창원컨벤션센터의 위치, 교통, 주변 명소를 간단히 확인하세요.",
    date: "2026년 6월 5일",
    read: "3분",
    views: 7,
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=900&q=82",
    alt: "현대적인 컨벤션 건물",
    keywords: ["창원", "컨벤션", "전시", "경남"],
  },
  {
    title: "속초 중앙 숙소, 후기 4.8점 시설과 주변 이동 확인",
    category: "국내여행",
    excerpt: "속초 여행의 숙소 선택 기준을 객실 컨디션, 중앙시장 접근성, 해변 이동 시간으로 나눠 봤습니다.",
    date: "2026년 6월 5일",
    read: "3분",
    views: 8,
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=82",
    alt: "도심 호텔 외관",
    keywords: ["속초", "호텔", "숙소", "후기"],
  },
  {
    title: "경산 단오 축제, 전통 공연과 체험 일정 정리",
    category: "공연/축제",
    excerpt: "전통문화를 즐길 수 있는 단오 축제의 기간, 장소, 프로그램과 방문 팁을 한 장으로 정리했습니다.",
    date: "2026년 6월 5일",
    read: "3분",
    views: 8,
    image: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=900&q=82",
    alt: "야외 축제 무대 조명",
    keywords: ["경산", "단오", "축제", "전통"],
  },
  {
    title: "평창 노산성, 강원도 산책 여행지 방문 정보",
    category: "국내여행",
    excerpt: "역사 명소와 산책 코스를 함께 즐기기 좋은 평창 노산성의 위치와 방문 포인트를 소개합니다.",
    date: "2026년 6월 5일",
    read: "3분",
    views: 9,
    image: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=82",
    alt: "산과 숲길 풍경",
    keywords: ["평창", "강원도", "산책", "역사"],
  },
  {
    title: "김천 원계서원, 고즈넉한 서원과 주변 산책 코스",
    category: "국내여행",
    excerpt: "조용한 역사 여행을 원하는 사람에게 맞는 서원 방문 정보와 가까운 산책 동선을 정리했습니다.",
    date: "2026년 6월 5일",
    read: "3분",
    views: 10,
    image: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=82",
    alt: "산책하기 좋은 자연 풍경",
    keywords: ["김천", "서원", "산책", "국내여행"],
  },
  {
    title: "여수 거문도 등대, 주차장과 관람 시간 확인",
    category: "국내여행",
    excerpt: "섬 여행을 계획할 때 필요한 등대 관람 동선, 주차장, 주변 볼거리 정보를 간단히 정리했습니다.",
    date: "2026년 6월 4일",
    read: "3분",
    views: 18,
    image: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=82",
    alt: "바다 가까운 언덕길",
    keywords: ["여수", "거문도", "등대", "주차"],
  },
  {
    title: "전주 가족여행 숙소, 객실과 예약 전 확인사항",
    category: "국내여행",
    excerpt: "가족 여행자가 보기 좋은 객실 타입, 주차, 한옥마을 이동 시간, 예약 전 체크리스트를 모았습니다.",
    date: "2026년 6월 4일",
    read: "3분",
    views: 20,
    image: "https://images.unsplash.com/photo-1528909514045-2fa4ac7a08ba?auto=format&fit=crop&w=900&q=82",
    alt: "깔끔한 호텔 객실",
    keywords: ["전주", "가족여행", "호텔", "숙소"],
  },
  {
    title: "제주 숙소와 체험 6곳, 위치별 호텔 추천",
    category: "국내여행",
    excerpt: "동쪽, 서쪽, 제주시권으로 나누어 숙소 위치와 체험 예약 포인트를 빠르게 비교했습니다.",
    date: "2026년 6월 4일",
    read: "5분",
    views: 22,
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=82",
    alt: "푸른 바다와 해변 풍경",
    keywords: ["제주", "호텔", "숙소", "체험"],
  },
];

const categoryTabs = [
  { label: "전체", value: "전체", count: "" },
  { label: "생활정보", value: "생활정보", count: "59" },
  { label: "여행", value: "여행", count: "0" },
  { label: "국내여행", value: "국내여행", count: "4,446" },
];

const state = {
  category: "전체",
  query: "",
  visible: 6,
};

const els = {
  searchForm: document.querySelector("#heroSearch"),
  searchInput: document.querySelector("#searchInput"),
  tabs: document.querySelector("#categoryTabs"),
  grid: document.querySelector("#articleGrid"),
  result: document.querySelector("#resultCopy"),
  loadMore: document.querySelector("#loadMoreButton"),
  toast: document.querySelector("#toast"),
};

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 2200);
}

function normalize(value) {
  return value.trim().toLowerCase();
}

function filteredArticles() {
  const query = normalize(state.query);
  return articles.filter((article) => {
    const haystack = normalize(
      [article.title, article.category, article.excerpt, article.keywords.join(" ")].join(" "),
    );
    const categoryMatch =
      state.category === "전체" ||
      article.category === state.category ||
      (state.category === "생활정보" && article.category === "공연/축제");
    return categoryMatch && (!query || haystack.includes(query));
  });
}

function renderTabs() {
  els.tabs.innerHTML = categoryTabs
    .map(
      (tab) => `
        <button class="${tab.value === state.category ? "is-active" : ""}" type="button" data-category="${tab.value}">
          ${tab.label}${tab.count ? `<span>${tab.count}</span>` : ""}
        </button>
      `,
    )
    .join("");
}

function renderArticles() {
  const filtered = filteredArticles();
  const visible = filtered.slice(0, state.visible);

  els.result.textContent = state.query
    ? `"${state.query}" 검색 결과 ${filtered.length}건`
    : `${state.category} 카테고리의 글 ${filtered.length}건`;

  els.grid.innerHTML = visible.length
    ? visible
        .map(
          (article) => `
            <article class="article-card">
              <div class="image-wrap">
                <img src="${article.image}" alt="${article.alt}" loading="lazy" />
              </div>
              <span class="category">${article.category}</span>
              <h3>${article.title}</h3>
              <p>${article.excerpt}</p>
              <div class="article-meta">
                <span>${article.date}</span>
                <span>◷ ${article.read}</span>
                <span>◎ ${article.views}</span>
              </div>
            </article>
          `,
        )
        .join("")
    : '<p class="result-copy">검색 조건에 맞는 여행 이야기가 없습니다.</p>';

  els.loadMore.hidden = visible.length >= filtered.length;
}

function renderAll() {
  renderTabs();
  renderArticles();
}

function setQuery(query) {
  state.query = query;
  state.visible = 6;
  els.searchInput.value = query;
  els.searchForm.classList.add("is-open");
  renderArticles();
  document.querySelector("#articles").scrollIntoView({ behavior: "smooth", block: "start" });
}

els.searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  setQuery(els.searchInput.value);
});

els.searchInput.addEventListener("input", () => {
  state.query = els.searchInput.value;
  state.visible = 6;
  renderArticles();
});

els.tabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  state.category = button.dataset.category;
  state.visible = 6;
  renderAll();
});

els.loadMore.addEventListener("click", () => {
  state.visible += 3;
  renderArticles();
});

document.addEventListener("click", (event) => {
  const focusSearch = event.target.closest("[data-focus-search]");
  if (focusSearch) {
    els.searchForm.classList.toggle("is-open");
    if (els.searchForm.classList.contains("is-open")) els.searchInput.focus();
    return;
  }

  const queryTarget = event.target.closest("[data-query]");
  if (queryTarget) {
    setQuery(queryTarget.dataset.query);
    return;
  }

  const categoryTarget = event.target.closest("[data-footer-category]");
  if (categoryTarget) {
    state.category = categoryTarget.dataset.footerCategory;
    state.visible = 6;
    renderAll();
    document.querySelector("#articles").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const languageTarget = event.target.closest("[data-language]");
  if (languageTarget) {
    showToast("다국어 페이지는 준비 중입니다.");
  }
});

renderAll();
