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
    id: "stay",
    href: "/stay/",
    label: "숙소",
    affiliate: true,
    items: [
      { href: "/stay/#accommodation-cards", icon: "숙", label: "지역별 숙소", description: "지역 기준 숙소 카드를 확인합니다." },
      { href: "/data-stay-price-seoul/", icon: "가", label: "숙소 가격 비교", description: "API 캐시 가격표를 데이터 글로 봅니다." },
      { href: "/stay/#all-posts", icon: "리", label: "숙소 상세 리뷰", description: "검수된 숙소·예약 관련 글을 모았습니다." },
    ],
  },
  {
    id: "ticket",
    href: "/ticket/",
    label: "입장권·투어",
    affiliate: true,
    items: [
      { href: "/ticket/#regional-tickets", icon: "권", label: "지역별 입장권", description: "지역별 티켓·이용권 가격 글을 확인합니다." },
      { href: "/ticket/#popular-experiences", icon: "체", label: "인기 체험", description: "여행지별 체험과 투어 상품을 연결합니다." },
    ],
  },
];

function activeGroup(activePath = "/") {
  const path = String(activePath || "/");
  if (path.startsWith("/ticket") || path.startsWith("/data-ticket")) return "ticket";
  if (path.startsWith("/festival") || path.includes("festival-")) return "festival";
  if (path.startsWith("/stay") || path.startsWith("/data-stay")) return "stay";
  if (path.startsWith("/travel") || path.startsWith("/region") || path.includes("travel-")) return "travel";
  return path === "/" ? "home" : "";
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
.site-header{position:sticky;top:0;z-index:50;border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:saturate(180%) blur(12px)}
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
.nav-dropdown{position:absolute;left:0;top:calc(100% + 10px);display:none;width:300px;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--card)}
.nav-group[open] .nav-dropdown,.nav-group:hover .nav-dropdown,.nav-group:focus-within .nav-dropdown{display:grid}
.nav-dropdown a{display:grid;grid-template-columns:32px minmax(0,1fr);gap:10px;padding:10px;border-radius:8px;transition:background-color 150ms ease}
.nav-dropdown a:hover,.nav-dropdown a:focus-visible{background:var(--soft-teal)}
.nav-item-icon{display:inline-grid;place-items:center;width:32px;height:32px;border:1px solid var(--line);border-radius:8px;color:var(--brand);font-size:12px;font-weight:900}
.nav-group.is-affiliate .nav-item-icon{color:var(--cta)}
.nav-item-text{display:grid;gap:2px}
.nav-item-label{color:var(--ink);font-size:14px;font-weight:800;line-height:1.35}
.nav-item-desc{color:var(--muted);font-size:12px;line-height:1.45}
.nav-item-count{color:var(--muted);font-size:11px;font-weight:800;line-height:1.35}
.site-search-link{display:grid;place-items:center;min-width:44px;min-height:44px;border:1px solid transparent;border-radius:999px;color:var(--ink);font-size:23px;line-height:1;transition:background-color 150ms ease,border-color 150ms ease}
.site-search-link:hover,.site-search-link:focus-visible{border-color:var(--line);background:var(--card)}
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
@media(max-width:900px){:root{--site-wrap:min(720px,calc(100% - 32px))}.site-header-inner{grid-template-columns:1fr auto auto;gap:8px;min-height:64px}.site-menu-toggle{display:inline-flex;align-items:center;justify-content:center}.site-nav{display:none;grid-column:1/-1;justify-content:stretch;padding:0 0 12px}.site-header.is-menu-open .site-nav{display:grid}.site-nav-main{display:grid;gap:6px}.site-home-link,.nav-summary{width:100%;justify-content:space-between;border-radius:8px;background:var(--card);min-height:44px}.nav-dropdown{position:static;display:none;width:auto;margin-top:6px}.nav-group[open] .nav-dropdown{display:grid}.site-page{padding:32px 0 48px}.site-section{padding:32px 0}.story-grid{grid-template-columns:1fr;gap:16px}.site-footer-inner{grid-template-columns:1fr;gap:20px;padding:32px 0}.site-search-link{font-size:22px}}
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
      <button class="site-menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav" data-site-menu-toggle>메뉴</button>
      <nav class="site-nav" id="site-nav" aria-label="주요 메뉴">
        <div class="site-nav-main">
          <a class="site-home-link${active === "home" ? " is-active" : ""}" href="/">홈</a>
          ${groups}
        </div>
      </nav>
      <a class="site-search-link" href="/travel/#all-posts" aria-label="검색">⌕</a>
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
      toggle.addEventListener("click", () => {
        const open = !header.classList.contains("is-menu-open");
        header.classList.toggle("is-menu-open", open);
        toggle.setAttribute("aria-expanded", String(open));
      });
    })();
  </script>`;
}
