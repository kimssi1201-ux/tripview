export const PRETENDARD_LINK = '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css">';

const DEFAULT_REGION_LINKS = [
  { href: "/region/seoul/", label: "서울" },
  { href: "/region/gyeonggi/", label: "경기" },
  { href: "/region/gangwon/", label: "강원" },
  { href: "/region/busan/", label: "부산" },
  { href: "/region/jeju/", label: "제주" },
  { href: "/region/jeonbuk/", label: "전북" },
];

const NAV_GROUPS = [
  {
    id: "travel",
    href: "/travel/",
    label: "여행지",
    items: [
      { href: "/region/", icon: "지", label: "지역별", description: "지역 허브에서 글과 숙소를 함께 봅니다." },
      { href: "/travel/#tag-water", icon: "테", label: "테마별", description: "물놀이·실내·아이와 태그를 모았습니다." },
      { href: "/travel/#all-posts", icon: "전", label: "전국 관광지", description: "검수된 전국 여행지 글 목록입니다." },
    ],
  },
  {
    id: "festival",
    href: "/festival/",
    label: "축제·행사",
    items: [
      { href: "/festival/#ongoing", icon: "진", label: "진행 중", description: "오늘 기준 진행 중인 축제입니다." },
      { href: "/festival/#upcoming", icon: "예", label: "예정", description: "방문 계획을 잡기 좋은 예정 축제입니다." },
      { href: "/festival/#past", icon: "종", label: "지난 축제", description: "종료된 축제는 목록 하단에 둡니다." },
    ],
  },
  {
    id: "booking",
    href: "/stay/",
    label: "숙소·예약",
    affiliate: true,
    items: [
      { href: "/stay/", icon: "숙", label: "숙소", description: "위치와 취소 조건을 비교합니다." },
      { href: "/ticket/", icon: "권", label: "입장권·투어", description: "운영 시간과 포함 사항을 비교합니다." },
      { href: "/data-stay-price-seoul/", icon: "가", label: "숙소 가격 비교", description: "API 캐시 가격표를 데이터 글로 봅니다." },
    ],
  },
];
const MOBILE_MENU_SECTIONS = [
  {
    id: "travel",
    label: "여행지",
    items: [
      { href: "/region/", icon: "지", label: "지역별", description: "지역 허브" },
      { href: "/travel/#tag-water", icon: "테", label: "테마별", description: "물놀이·실내·아이와" },
      { href: "/travel/#all-posts", icon: "전", label: "전국 관광지", description: "검수 글 목록" },
    ],
  },
  {
    id: "festival",
    label: "축제·행사",
    items: [
      { href: "/festival/#ongoing", icon: "진", label: "진행 중", description: "오늘 기준" },
      { href: "/festival/#upcoming", icon: "예", label: "예정", description: "시작 전 일정" },
      { href: "/festival/#past", icon: "종", label: "지난 축제", description: "종료된 일정" },
    ],
  },
  {
    id: "booking",
    label: "예약",
    affiliate: true,
    items: [
      { href: "/stay/", icon: "숙", label: "숙소", description: "위치·취소 조건 비교" },
      { href: "/ticket/", icon: "권", label: "입장권·투어", description: "운영 시간·포함 사항 비교" },
    ],
  },
];
function activeGroup(activePath = "/") {
  const path = String(activePath || "/");
  if (path.startsWith("/ticket") || path.startsWith("/data-ticket")) return "booking";
  if (path.startsWith("/festival") || path.includes("festival-")) return "festival";
  if (path.startsWith("/stay") || path.startsWith("/data-stay")) return "booking";
  if (path.startsWith("/travel") || path.startsWith("/region") || path.includes("travel-")) return "travel";
  return path === "/" ? "home" : "";
}


function isCurrentNavItem(activePath = "/", href = "") {
  const path = String(activePath || "/");
  const target = String(href || "").split("#")[0] || "/";
  if (target === "/") return path === "/";
  if (target === "/stay/") return path.startsWith("/stay") || path.startsWith("/data-stay");
  if (target === "/ticket/") return path.startsWith("/ticket") || path.startsWith("/data-ticket");
  if (target === "/festival/") return path.startsWith("/festival") || path.includes("festival-");
  if (target === "/travel/") return path.startsWith("/travel") || path.includes("travel-");
  if (target === "/region/") return path.startsWith("/region");
  return path.startsWith(target);
}

function mobileMenuPanel(activePath = "/") {
  const sections = MOBILE_MENU_SECTIONS.map((section) => `<section class="mobile-menu-section${section.affiliate ? " is-affiliate" : ""}">
      <h2>${esc(section.label)}</h2>
      <div class="mobile-menu-items">
        ${section.items.map((item) => `<a class="mobile-menu-item${isCurrentNavItem(activePath, item.href) ? " is-current" : ""}" href="${esc(item.href)}"><span class="nav-item-icon" aria-hidden="true">${esc(item.icon)}</span><span class="mobile-menu-copy"><span class="nav-item-label">${esc(item.label)}</span></span><span class="mobile-menu-aside">${Number(item.count) >= 20 ? `${Number(item.count).toLocaleString("ko-KR")}개` : esc(item.description)}</span></a>`).join("")}
      </div>
    </section>`).join("");
  return `<button class="site-menu-backdrop" type="button" aria-label="메뉴 닫기" data-site-menu-close hidden></button>
    <aside class="mobile-menu-panel" id="site-mobile-menu" aria-hidden="true" data-site-menu-panel>
      <div class="mobile-menu-head"><a class="site-brand" href="/">트립뷰</a><button class="mobile-menu-close" type="button" aria-label="메뉴 닫기" data-site-menu-close>닫기</button></div>
      <nav class="mobile-menu-nav" aria-label="모바일 주요 메뉴">
        <a class="mobile-menu-home${activeGroup(activePath) === "home" ? " is-current" : ""}" href="/">홈</a>
        ${sections}
      </nav>
    </aside>`;
}
function esc(value = "") {
  return String(value).replace(/[&<>"']/g, (match) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[match]));
}

export const SITE_CSS = `
:root{--brand:#0F5C5C;--brand-hover:#147A7A;--bg:#FAFAF8;--card:#FFFFFF;--ink:#1A1A1A;--muted:#6B6B6B;--line:#E5E5E0;--cta:#E8A33D;--cta-hover:#D18F2A;--soft-teal:color-mix(in srgb,var(--brand) 9%,var(--card));--soft-cta:color-mix(in srgb,var(--cta) 16%,var(--card));--site-wrap:min(1180px,calc(100% - 32px))}
*{box-sizing:border-box}
html{scroll-padding-top:96px}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"Pretendard Variable",Pretendard,-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;font-size:16px;line-height:1.7;letter-spacing:0}
a{color:inherit;text-decoration:none}
img{display:block;max-width:100%;object-fit:cover;background:var(--card)}
button,input,select{font:inherit}
:focus-visible{outline:2px solid var(--brand);outline-offset:2px}
.site-header{position:sticky;top:0;z-index:300;border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:saturate(180%) blur(12px)}
.site-header-inner{width:var(--site-wrap);margin:0 auto;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:24px;min-height:72px}
.site-brand{display:inline-flex;align-items:center;min-height:44px;color:var(--ink);font-size:22px;font-weight:900;line-height:1}
.site-menu-toggle{display:none;min-width:44px;min-height:44px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);font-size:13px;font-weight:800}
.site-nav{display:flex;align-items:center;justify-content:center;gap:8px}
.site-nav-main{display:flex;align-items:center;gap:8px}
.site-home-link,.nav-summary{display:inline-flex;align-items:center;min-height:36px;padding:0 12px;border:0;border-radius:999px;background:transparent;color:var(--muted);font-size:14px;font-weight:800;cursor:pointer;transition:color 150ms ease,background-color 150ms ease}
.site-home-link.is-active,.nav-group.is-active>.nav-summary{background:var(--soft-teal);color:var(--brand)}
.nav-group.is-affiliate.is-active>.nav-summary{background:var(--soft-cta);color:var(--ink)}
.nav-group{position:relative}
.nav-group>summary{list-style:none}
.nav-group>summary::-webkit-details-marker{display:none}
.nav-summary::after{content:"";width:5px;height:5px;margin-left:7px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(45deg) translateY(-2px)}
.nav-dropdown{position:absolute;left:0;top:calc(100% + 10px);z-index:420;display:none;width:300px;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--card);box-shadow:0 12px 28px color-mix(in srgb,var(--ink) 14%,transparent)}
.nav-group[open] .nav-dropdown{display:grid}
.nav-dropdown a{display:flex;align-items:flex-start;gap:12px;padding:10px;border-radius:8px;transition:background-color 150ms ease}
.nav-dropdown a:hover,.nav-dropdown a:focus-visible{background:var(--soft-teal)}
.nav-item-icon{display:inline-grid;flex:0 0 32px;place-items:center;width:32px;height:32px;border:1px solid var(--line);border-radius:8px;color:var(--brand);font-size:12px;font-weight:900}
.nav-group.is-affiliate .nav-item-icon{color:var(--cta)}
.nav-item-text{display:grid;flex:1 1 auto;min-width:0;gap:2px}
.nav-item-label{color:var(--ink);font-size:14px;font-weight:800;line-height:1.35}
.nav-item-desc{color:var(--muted);font-size:12px;line-height:1.45}
.nav-item-count{color:var(--muted);font-size:11px;font-weight:800;line-height:1.35}
.site-search-link{display:grid;place-items:center;min-width:44px;min-height:44px;border:1px solid transparent;border-radius:999px;color:var(--ink);font-size:23px;line-height:1;transition:background-color 150ms ease,border-color 150ms ease}
.site-search-link:hover,.site-search-link:focus-visible{border-color:var(--line);background:var(--card)}
.site-menu-backdrop,.mobile-menu-panel{display:none}
.mobile-menu-close{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 14px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);font-size:13px;font-weight:800}
.is-site-menu-open{overflow:hidden}
.site-page{width:var(--site-wrap);margin:0 auto;padding:48px 0 64px}
.site-section{padding:48px 0}
.site-section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:16px}
.site-section-head h2{margin:0;font-size:20px;line-height:1.35;font-weight:800}
.site-section-more{color:var(--brand);font-size:14px;font-weight:800}
.story-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}
.story-card{display:block;min-width:0;border:1px solid var(--line);border-radius:8px;background:var(--card);overflow:hidden;transition:border-color 150ms ease}
.story-card:hover,.story-card:focus-visible{border-color:var(--brand)}
.story-thumb{position:relative;display:block;width:100%;aspect-ratio:16/10;overflow:hidden;background:var(--card)}
.story-thumb img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;display:block}
.story-card-body{display:grid;gap:8px;padding:16px}
.story-label{color:var(--brand);font-size:12px;font-weight:800;line-height:1.3}
.story-card strong{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin:0;color:var(--ink);font-size:18px;line-height:1.35;font-weight:800}
.story-card p{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin:0;color:var(--muted);font-size:14px;line-height:1.55}
.story-meta{color:var(--muted);font-size:12px;line-height:1.4}
.site-footer{border-top:1px solid var(--line);background:var(--card)}
.site-footer-inner{width:var(--site-wrap);margin:0 auto;display:grid;grid-template-columns:1.2fr repeat(4,minmax(0,.8fr));gap:24px;padding:40px 0}
.footer-brand strong{display:block;margin-bottom:8px;color:var(--ink);font-size:22px;font-weight:900}
.footer-brand p,.footer-business,.site-footer a{color:var(--muted);font-size:13px;line-height:1.65}
.footer-col{display:grid;align-content:start;gap:7px}
.footer-col b{margin-bottom:4px;color:var(--ink);font-size:14px}
.footer-bottom{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:8px 12px;padding-top:16px;border-top:1px solid var(--line);color:var(--muted);font-size:12px}
.cta-link{display:inline-flex;align-items:center;justify-content:center;min-height:44px;border-radius:8px;background:var(--cta);color:var(--card);font-weight:800;transition:background-color 150ms ease}
.cta-link:hover,.cta-link:focus-visible{background:var(--cta-hover)}
@media(max-width:900px){
  :root{--site-wrap:min(720px,calc(100% - 32px))}
  .site-header-inner{grid-template-columns:1fr auto auto;gap:8px;min-height:64px}
  .site-header.is-menu-open{z-index:1200}
  .site-menu-toggle{display:inline-flex;align-items:center;justify-content:center}
  .site-nav{display:none}
  .site-menu-backdrop{position:fixed;inset:0;z-index:1201;background:color-mix(in srgb,var(--ink) 18%,transparent)}
  .site-header.is-menu-open .site-menu-backdrop{display:block}
  .mobile-menu-panel{position:fixed;inset:0 0 0 auto;z-index:1202;display:grid;grid-template-rows:auto minmax(0,1fr);width:min(420px,calc(100% - 32px));max-width:100%;background:var(--card);box-shadow:-20px 0 40px color-mix(in srgb,var(--ink) 16%,transparent);transform:translateX(100%);transition:transform 150ms ease}
  .site-header.is-menu-open .mobile-menu-panel{transform:translateX(0)}
  .mobile-menu-head{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:64px;padding:10px 18px;border-bottom:1px solid var(--line);background:var(--card)}
  .mobile-menu-nav{display:block;overflow:auto;padding:18px;background:var(--card)}
  .mobile-menu-home{display:flex;align-items:center;min-height:48px;margin-bottom:18px;padding:0 14px;border:1px solid var(--line);border-radius:8px;background:var(--bg);font-weight:900}
  .mobile-menu-home.is-current{background:var(--soft-teal);color:var(--brand)}
  .mobile-menu-section{display:grid;gap:8px;margin-bottom:22px}
  .mobile-menu-section h2{margin:0;color:var(--muted);font-size:11px;font-weight:900;line-height:1.4}
  .mobile-menu-items{display:grid;gap:8px}
  .mobile-menu-item{display:grid;grid-template-columns:32px minmax(0,1fr) minmax(92px,.9fr);gap:12px;align-items:center;min-height:56px;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--card);transition:background-color 150ms ease,border-color 150ms ease}
  .mobile-menu-item.is-current{background:var(--soft-teal);border-color:color-mix(in srgb,var(--brand) 24%,var(--line))}
  .mobile-menu-section.is-affiliate .mobile-menu-item{border-color:color-mix(in srgb,var(--cta) 28%,var(--line));background:var(--soft-cta)}
  .mobile-menu-section.is-affiliate .mobile-menu-item.is-current{border-color:color-mix(in srgb,var(--cta) 40%,var(--line))}
  .mobile-menu-section.is-affiliate .mobile-menu-item .nav-item-icon{color:var(--cta);border-color:color-mix(in srgb,var(--cta) 40%,var(--line));background:var(--card)}
  .mobile-menu-copy{display:grid;min-width:0}
  .mobile-menu-aside{justify-self:end;min-width:0;color:var(--muted);font-size:12px;font-weight:800;line-height:1.35;text-align:right;overflow-wrap:anywhere}
  .site-page{padding:32px 0 48px}
  .site-section{padding:32px 0}
  .story-grid{grid-template-columns:1fr;gap:16px}
  .site-footer-inner{grid-template-columns:1fr;gap:20px;padding:32px 0}
  .site-search-link{font-size:22px}
}
@media(max-width:520px){body{font-size:15px}.site-section-head h2{font-size:19px}.story-card strong{font-size:17px}.story-card-body{padding:14px}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{transition-duration:0.01ms!important;animation-duration:0.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important}}
`;

export function siteHeader(activePath = "/") {
  const active = activeGroup(activePath);
  const groups = NAV_GROUPS.map((group) => `<details class="nav-group${group.affiliate ? " is-affiliate" : ""}${active === group.id ? " is-active" : ""}">
      <summary class="nav-summary">${esc(group.label)}</summary>
      <div class="nav-dropdown">
        ${group.items.map((item) => `<a href="${esc(item.href)}"><span class="nav-item-icon" aria-hidden="true">${esc(item.icon)}</span><span class="nav-item-text"><span class="nav-item-label">${esc(item.label)}</span><span class="nav-item-desc">${esc(item.description)}</span>${Number(item.count) >= 20 ? `<span class="nav-item-count">${Number(item.count).toLocaleString("ko-KR")}개</span>` : ""}</span></a>`).join("")}
      </div>
    </details>`).join("");
  return `<header class="site-header" data-site-header>
    <div class="site-header-inner">
      <a class="site-brand" href="/">트립뷰</a>
      <button class="site-menu-toggle" type="button" aria-expanded="false" aria-controls="site-mobile-menu" data-site-menu-toggle>메뉴</button>
      <nav class="site-nav site-nav-desktop" aria-label="주요 메뉴">
        <div class="site-nav-main">
          <a class="site-home-link${active === "home" ? " is-active" : ""}" href="/">홈</a>
          ${groups}
        </div>
      </nav>
      <a class="site-search-link" href="/travel/#all-posts" aria-label="검색">⌕</a>
      ${mobileMenuPanel(activePath)}
    </div>
  </header>`;
}

export function siteFooter({ regionLinks = DEFAULT_REGION_LINKS } = {}) {
  const safeRegionLinks = (regionLinks.length ? regionLinks : DEFAULT_REGION_LINKS).slice(0, 8);
  return `<footer class="site-footer">
    <div class="site-footer-inner">
      <div class="footer-brand">
        <strong>트립뷰</strong>
        <p>국내 여행지, 축제, 숙소 예약 정보를 지역과 목적별로 정리합니다.</p>
      </div>
      <div class="footer-col">
        <b>카테고리</b>
        <a href="/travel/">여행지</a>
        <a href="/festival/">축제·행사</a>
        <a href="/stay/">숙소</a>
        <a href="/ticket/">입장권·투어</a>
      </div>
      <div class="footer-col">
        <b>지역 허브</b>
        ${safeRegionLinks.map((link) => `<a href="${esc(link.href)}">${esc(link.label)}</a>`).join("")}
      </div>
      <div class="footer-col">
        <b>운영</b>
        <a href="/editorial-team">편집팀</a>
        <a href="/editorial-policy">콘텐츠 운영 기준</a>
        <a href="/affiliate-disclosure">제휴 안내</a>
      </div>
      <div class="footer-col">
        <b>정책</b>
        <a href="/privacy">개인정보처리방침</a>
        <a href="/terms">이용약관</a>
        <a href="/sitemap.xml">사이트맵</a>
        <a href="/contact">문의</a>
      </div>
      <div class="footer-bottom">
        <span>사업자 정보: 트립뷰 콘텐츠 운영</span>
        <span>Copyright 2026 Tripview.</span>
      </div>
    </div>
  </footer>`;
}

export function siteNavScript() {
  return `<script>
    (() => {
      const header = document.querySelector("[data-site-header]");
      const toggle = document.querySelector("[data-site-menu-toggle]");
      if (!header || !toggle) return;
      const panel = header.querySelector("[data-site-menu-panel]");
      const backdrop = header.querySelector(".site-menu-backdrop");
      const closeButtons = Array.from(header.querySelectorAll("[data-site-menu-close]"));
      const groups = Array.from(header.querySelectorAll(".site-nav-desktop .nav-group"));
      let menuOpen = false;
      const closeGroups = (except) => {
        groups.forEach((group) => {
          if (group !== except) group.removeAttribute("open");
        });
      };
      const setMenuOpen = (open) => {
        menuOpen = Boolean(open);
        header.classList.toggle("is-menu-open", menuOpen);
        toggle.setAttribute("aria-expanded", String(menuOpen));
        panel?.setAttribute("aria-hidden", String(!menuOpen));
        if (backdrop) backdrop.hidden = !menuOpen;
        document.documentElement.classList.toggle("is-site-menu-open", menuOpen);
        document.body?.classList.toggle("is-site-menu-open", menuOpen);
        closeGroups();
      };
      const openGroup = (group) => {
        if (menuOpen) setMenuOpen(false);
        closeGroups(group);
        group.setAttribute("open", "");
      };
      groups.forEach((group) => {
        const summary = group.querySelector(".nav-summary");
        group.addEventListener("mouseenter", () => openGroup(group));
        group.addEventListener("focusin", () => openGroup(group));
        summary?.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (group.hasAttribute("open")) {
            group.removeAttribute("open");
          } else {
            openGroup(group);
          }
        });
      });
      toggle.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        setMenuOpen(!menuOpen);
      });
      panel?.addEventListener("click", (event) => event.stopPropagation());
      closeButtons.forEach((button) => button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        setMenuOpen(false);
      }));
      panel?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setMenuOpen(false)));
      header.addEventListener("mouseleave", () => closeGroups());
      document.addEventListener("click", (event) => {
        if (!header.contains(event.target)) {
          closeGroups();
          if (menuOpen) setMenuOpen(false);
        }
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          setMenuOpen(false);
        }
      });
    })();
  </script>`;
}
