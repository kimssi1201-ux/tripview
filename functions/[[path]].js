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
  if (parts.length === 1 && /^(travel|festival)-\d+$/.test(parts[0])) {
    return `/site/${parts[0]}/`;
  }

  if (parts[0] === "flight-deals" && parts.length >= 1 && parts.every((part) => /^[a-z0-9-]+$/.test(part))) {
    return `/site/${parts.join("/")}/`;
  }

  return "";
}

const CANONICAL_ORIGIN = "https://tripview.kr";
const GENERATED_BLOCKS = [
  ["<!-- MRT_AD_START", "MRT_AD_END -->"],
  ["<!-- COUPANG_AD_START", "COUPANG_AD_END -->"],
  ["<!-- COUPANG_WIDGET_START", "COUPANG_WIDGET_END -->"],
];
const ARTICLE_NAVIGATION = '<nav class="links" aria-label="주요 메뉴"><a href="/">홈</a><a href="/#popular">8월 가볼만한 곳</a><a href="/#water">물놀이·계곡</a><a href="/#weekend">이번 주말</a><a href="/#festival">8월 축제</a><a href="/#indoor">실내여행</a><a href="/#family">아이와</a><a href="/#booking">예약 전 체크</a><a href="/#flight-deals">항공권</a></nav>';

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function canonicalFor(parts) {
  const pathname = parts.map((part) => encodeURIComponent(part)).join("/");
  return `${CANONICAL_ORIGIN}/${pathname}/`;
}

export function transformArticleHtml(document, parts) {
  let next = String(document || "");
  for (const [start, end] of GENERATED_BLOCKS) {
    next = next.replace(new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`, "g"), "");
  }
  next = next
    .replace(/\/\* tripview-mrt-native-ad \*\/[\s\S]*?\/\* end-tripview-mrt-native-ad \*\//g, "")
    .replace(/\/\* tripview-coupang-native-ad \*\/[\s\S]*?\/\* end-tripview-coupang-native-ad \*\//g, "")
    .replace(/\s*<script\s+src=["']\/assets\/coupang\.js\?v=[^"']+["']\s+defer><\/script>/gi, "")
    .replace(/\s*<link\s+rel=["']canonical["'][^>]*>/gi, "")
    .replace(/<nav class=["']links["'] aria-label=["']주요 메뉴["']>[\s\S]*?<\/nav>/i, ARTICLE_NAVIGATION);

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
