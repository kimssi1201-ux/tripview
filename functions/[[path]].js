function pathParts(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || "")
    .split("/")
    .filter(Boolean);
}

function assetRequest(context, pathname) {
  const url = new URL(context.request.url);
  url.pathname = pathname;
  return new Request(url.toString(), context.request);
}

function articleAssetPath(parts) {
  if (parts.length === 1 && ["travel", "festival", "stay", "ticket", "region"].includes(parts[0])) {
    return `/site/${parts[0]}/`;
  }

  if (parts.length === 2 && parts[0] === "region" && /^[a-z0-9-]+$/.test(parts[1])) {
    return `/site/${parts.join("/")}/`;
  }

  if (parts.length === 1 && /^(travel|festival)-\d+$/.test(parts[0])) {
    return `/site/${parts[0]}/`;
  }

  if (parts[0] === "flight-deals" && parts.length >= 1 && parts.every((part) => /^[a-z0-9-]+$/.test(part))) {
    return `/site/${parts.join("/")}/`;
  }

  return "";
}

const CANONICAL_ORIGIN = "https://tripview.kr";
const ARTICLE_NAVIGATION = '<nav class="links" aria-label="주요 메뉴"><a href="/">홈</a><a href="/travel/">여행지</a><a href="/festival/">축제</a><a href="/stay/">숙소</a><a href="/ticket/">입장권·투어</a></nav>';

function canonicalFor(parts) {
  const pathname = parts.map((part) => encodeURIComponent(part)).join("/");
  return `${CANONICAL_ORIGIN}/${pathname}/`;
}

export function transformArticleHtml(document, parts) {
  let next = String(document || "");
  next = next
    .replace(/\s*<link\s+rel=["']canonical["'][^>]*>/gi, "")
    .replace(/<nav class=["']links["'] aria-label=["']주요 메뉴["']>[\s\S]*?<\/nav>/i, ARTICLE_NAVIGATION)
    .replaceAll("이 여행지 예약 정보", "주변 숙소·투어")
    .replaceAll("현재 글의 지역과 여행 목적이 일치하는 상품만 표시합니다.", "여행지 주변의 숙소와 이용 가능한 투어·티켓을 모았습니다.")
    .replaceAll(" 일정에 맞춘 인근 숙소", " 숙소")
    .replaceAll(" 일정에 맞춘 투어·티켓", " 투어·티켓")
    .replaceAll(" 일정에 맞춘 항공권", " 항공권");

  if (next.includes("</head>")) {
    next = next.replace("</head>", `    <link rel="canonical" href="${canonicalFor(parts)}">\n  </head>`);
  }
  return next;
}

async function articleResponse(response, parts, method) {
  if (method === "HEAD" || !response.ok) return response;
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("text/html")) return response;

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("content-type", "text/html; charset=utf-8");
  return new Response(transformArticleHtml(await response.text(), parts), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function onRequest(context) {
  if (!["GET", "HEAD"].includes(context.request.method)) {
    return context.env.ASSETS.fetch(context.request);
  }

  const parts = pathParts(context.params.path);
  if (parts[0] === "api" && context.next) {
    return context.next();
  }

  const target = articleAssetPath(parts);
  if (target) {
    const response = await context.env.ASSETS.fetch(assetRequest(context, target));
    return articleResponse(response, parts, context.request.method);
  }

  return context.env.ASSETS.fetch(context.request);
}
