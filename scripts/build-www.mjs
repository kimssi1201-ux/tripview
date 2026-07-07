import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "www");
const siteDir = join(root, "site");
const baseUrl = "https://tripview.kr";

async function readJson(relativePath, fallback = []) {
  try {
    return JSON.parse(await readFile(join(root, relativePath), "utf8"));
  } catch {
    return fallback;
  }
}

const generatedPosts = await readJson("data/generated-posts.json");
const legacyPosts = await readJson("data/posts.json");
const posts = generatedPosts.length ? generatedPosts : legacyPosts;
const flightDeals = await readJson("data/myrealtrip-flight-deals.json");
const accommodationProducts = await readJson("data/myrealtrip-accommodations.json");
const tnaProducts = await readJson("data/myrealtrip-tna-products.json");

const files = [
  "index.html",
  "style.css",
  "main.js",
  "privacy.html",
  "manifest.webmanifest",
  "package.json",
  "README.md",
  "_headers",
  "_redirects",
  "robots.txt",
  "sitemap.xml",
  "feed.xml",
  "rss.xml",
  "ads.txt",
  "flight-deals"
];

function xml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function postUrl(post) {
  return `${baseUrl}/${encodeURIComponent(post.slug)}/`;
}

function flightSlug(deal) {
  return String(deal?.id || deal?.title || "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "") || "flight-deal";
}

function flightUrl(deal) {
  return `${baseUrl}/flight-deals/${encodeURIComponent(flightSlug(deal))}/`;
}

function publicFlightUrl(deal) {
  return html(deal?.url || "https://www.myrealtrip.com/flights");
}

function postDate(post) {
  return post.sortDate || post.date || new Date().toISOString().slice(0, 10);
}

function postExcerpt(post) {
  return post.excerpt || post.description || "";
}

function html(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(value = "") {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(value || "");
  return `${match[1]}년 ${Number(match[2])}월 ${Number(match[3])}일`;
}

function flightMeta(deal) {
  return [
    deal?.priceText ? `최저가 ${deal.priceText}` : "",
    deal?.departureDate ? `출발 ${formatDate(deal.departureDate)}` : "",
    deal?.returnDate ? `귀국 ${formatDate(deal.returnDate)}` : "",
    deal?.period ? `${deal.period}일 일정` : "",
  ].filter(Boolean).join(" · ");
}

function savingsText(deal) {
  const price = Number(deal?.price || 0);
  const average = Number(deal?.averagePrice || 0);
  if (!price || !average || average <= price) return "";
  const saved = average - price;
  return `평균가 대비 약 ${saved.toLocaleString("ko-KR")}원 낮게 확인된 일정입니다.`;
}

function productRegion(product) {
  return String(product?.region || product?.city || "").trim();
}

function relatedProducts(deal, count = 4) {
  const region = String(deal?.region || deal?.city || "").trim();
  const products = [...tnaProducts, ...accommodationProducts].filter((item) => item?.title && item?.url);
  const scored = products
    .map((product) => ({
      product,
      score:
        (region && productRegion(product).includes(region) ? 10 : 0) +
        (String(product?.title || "").includes(region) ? 5 : 0) +
        (product?.source === "myrealtrip-tna" ? 2 : 1),
    }))
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map((item) => item.product);
}

function productCard(product) {
  const image = product?.image
    ? `<span class="thumb"><img src="${html(product.image)}" alt="${html(product.title)}" loading="lazy"></span>`
    : `<span class="thumb empty"></span>`;
  return `<a class="product-card" href="${html(product.url)}" rel="sponsored noopener">
    ${image}
    <strong>${html(product.title)}</strong>
    <span>${html([product?.region || product?.city, product?.category, product?.priceText].filter(Boolean).join(" · "))}</span>
  </a>`;
}

function flightPageHtml(deal) {
  const products = relatedProducts(deal);
  const related = products.length
    ? `<section class="block"><h2>같이 보면 좋은 예약 정보</h2><div class="products">${products.map(productCard).join("")}</div></section>`
    : "";
  const description = `${deal.region || deal.city || "해외"} 여행을 검토할 때 참고할 항공권 가격, 출발일, 여행 기간을 한 번에 정리했습니다.`;
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${html(description)}">
    <title>${html(deal.title)} - 트립뷰</title>
    <style>
      :root{--ink:#111;--muted:#707070;--line:#e1e1e1;--paper:#fff;--soft:#f5f5f5}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:Arial,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;line-height:1.65}a{color:inherit;text-decoration:none}img{display:block;width:100%;height:100%;object-fit:cover}.wrap{width:min(760px,calc(100% - 32px));margin:auto}.top{position:sticky;top:0;background:rgba(255,255,255,.96);border-bottom:1px solid var(--line);z-index:10}.nav{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:68px}.brand{font-size:22px;font-weight:900}.links{display:flex;gap:14px;overflow-x:auto;white-space:nowrap;font-size:13px;font-weight:800}.language-switch{display:flex;gap:8px;white-space:nowrap}.language-switch a{font-size:12px;font-weight:900;color:#555;border-bottom:1px solid transparent}.language-switch a.is-active{color:#111;border-bottom-color:#111}.hero{padding:34px 0 22px}.hero h1{margin:0 0 14px;font-size:clamp(30px,8vw,46px);line-height:1.18;letter-spacing:-.01em}.meta{color:var(--muted);font-size:14px;font-weight:800}.fare{margin:22px 0 0;padding:20px 0;border-top:2px solid var(--ink);border-bottom:1px solid var(--line)}.fare strong{display:block;font-size:30px;line-height:1.1}.fare span{display:block;margin-top:8px;color:var(--muted);font-size:14px}.block{padding:28px 0;border-bottom:1px solid var(--line)}.block h2{margin:0 0 12px;font-size:23px;line-height:1.25}.info{display:grid;grid-template-columns:110px 1fr;gap:10px 16px;margin:0}.info dt{font-weight:900}.info dd{margin:0;color:#333}.products{display:grid;gap:0;border-top:1px solid var(--line)}.product-card{display:grid;grid-template-columns:92px minmax(0,1fr);gap:12px;align-items:center;padding:13px 0;border-bottom:1px solid var(--line)}.product-card .thumb{grid-row:1/3;display:block;aspect-ratio:1.28/1;background:var(--soft);overflow:hidden}.product-card .empty{background:linear-gradient(135deg,#f1f1f1,#dedede)}.product-card strong{font-size:17px;line-height:1.35;font-weight:900}.product-card span{display:block;color:var(--muted);font-size:12px}.note{color:var(--muted);font-size:14px}.footer{padding:28px 0 46px;color:var(--muted);font-size:13px}@media(max-width:520px){.nav{align-items:flex-start;flex-direction:column;padding:14px 0}.links{width:100%}.hero{padding-top:28px}.info{grid-template-columns:88px 1fr}.product-card{grid-template-columns:84px minmax(0,1fr)}}
    </style>
  </head>
  <body>
    <header class="top"><div class="wrap nav"><a class="brand" href="/">트립뷰</a><nav class="links" aria-label="주요 메뉴"><a href="/">홈</a><a href="/#flight-deals">항공권 최저가 여행지</a><a href="/#booking">예약 전 체크</a></nav><div class="language-switch notranslate" translate="no" aria-label="Language selector"><a href="?lang=ko" data-lang="ko" lang="ko">KO</a><a href="?lang=en" data-lang="en" lang="en">EN</a><a href="?lang=ja" data-lang="ja" lang="ja">JA</a><a href="?lang=zh" data-lang="zh" lang="zh-CN">ZH</a></div></div></header>
    <main class="wrap">
      <article>
        <section class="hero">
          <p class="meta">항공권 최저가 여행지 · ${html(deal.region || deal.city || "")}</p>
          <h1>${html(deal.title)}</h1>
          <p>${html(description)}</p>
          <div class="fare"><strong>${html(deal.priceText || "")}</strong><span>${html(flightMeta(deal))}</span></div>
        </section>
        <section class="block">
          <h2>가격과 일정 요약</h2>
          <dl class="info">
            <dt>출발</dt><dd>${html(deal.fromCity || "인천")}</dd>
            <dt>도착</dt><dd>${html(deal.region || deal.city || deal.toCity || "")}</dd>
            <dt>출발일</dt><dd>${html(formatDate(deal.departureDate))}</dd>
            <dt>귀국일</dt><dd>${html(formatDate(deal.returnDate))}</dd>
            <dt>여행 기간</dt><dd>${html(deal.period ? `${deal.period}일` : "")}</dd>
            <dt>참고</dt><dd>${html(savingsText(deal) || "가격은 변동될 수 있으니 실제 예약 전 조건을 다시 확인하는 편이 좋습니다.")}</dd>
          </dl>
        </section>
        <section class="block">
          <h2>이 목적지로 볼 때 체크할 것</h2>
          <p>항공권 가격만 보고 바로 결정하기보다 숙소 위치, 도착 시간대, 현지 이동 시간을 같이 봐야 실제 여행 비용이 흔들리지 않습니다. 특히 ${html(deal.region || deal.city || "목적지")} 일정은 왕복 항공권 가격과 함께 첫날 도착 후 이동 동선, 마지막 날 공항 복귀 시간을 같이 확인하는 것이 좋습니다.</p>
          <p class="note">항공권 가격은 여행지 선택을 돕는 참고 정보로 정리하고, 실제 예약 전에는 일정과 수하물 조건을 다시 확인하세요.</p>
        </section>
        ${related}
      </article>
    </main>
    <footer class="wrap footer">트립뷰는 항공권 가격을 여행지 선택의 기준으로 정리하고, 함께 볼 만한 숙소와 투어 정보를 연결합니다.</footer>
    <script src="/assets/i18n.js?v=i18n-link-fix-20260706" defer></script>
  </body>
</html>`;
}

function flightIndexHtml(deals) {
  const rows = deals
    .filter((deal) => deal?.title)
    .sort((a, b) => Number(a.price || 0) - Number(b.price || 0))
    .map((deal) => `<a class="product-card flight-card" href="${publicFlightUrl(deal)}" rel="sponsored noopener"><strong>${html(deal.title)}</strong><span>${html(flightMeta(deal))}</span></a>`)
    .join("");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>항공권 최저가 여행지 - 트립뷰</title><style>body{margin:0;font-family:Arial,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;color:#111}.wrap{width:min(760px,calc(100% - 32px));margin:auto}a{color:inherit;text-decoration:none}.top{border-bottom:1px solid #e1e1e1}.brand{display:block;padding:22px 0;font-size:26px;font-weight:900}.hero{padding:30px 0}.hero h1{margin:0;font-size:38px;line-height:1.15}.products{border-top:1px solid #e1e1e1}.product-card{display:grid;gap:6px;align-items:center;padding:16px 0;border-bottom:1px solid #e1e1e1}strong{font-size:19px;line-height:1.35}span{color:#707070;font-size:13px}</style></head><body><header class="top"><div class="wrap"><a class="brand" href="/">트립뷰</a></div></header><main class="wrap"><section class="hero"><h1>항공권 최저가 여행지</h1><p>항공권 가격을 기준으로 여행지를 고르고, 상세 페이지에서 함께 볼 숙소와 투어 정보를 확인하세요.</p></section><section class="products">${rows}</section></main><script src="/assets/i18n.js?v=i18n-link-fix-20260706" defer></script></body></html>`;
}

async function generateFlightDealPages() {
  const deals = Array.isArray(flightDeals) ? flightDeals.filter((deal) => deal?.title && deal?.price) : [];
  const dir = join(root, "flight-deals");
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "index.html"), flightIndexHtml(deals), "utf8");
  for (const deal of deals) {
    const pageDir = join(dir, flightSlug(deal));
    await mkdir(pageDir, { recursive: true });
    await writeFile(join(pageDir, "index.html"), flightPageHtml(deal), "utf8");
  }
}

async function generateSitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${baseUrl}/`, lastmod: today },
    { loc: `${baseUrl}/privacy.html`, lastmod: today },
    { loc: `${baseUrl}/flight-deals/`, lastmod: today },
    ...(Array.isArray(flightDeals) ? flightDeals : [])
      .filter((deal) => deal?.title)
      .map((deal) => ({ loc: flightUrl(deal), lastmod: deal.departureDate || today })),
    ...posts.map((post) => ({ loc: postUrl(post), lastmod: postDate(post) }))
  ];

  const body = urls
    .map(
      (item) => `  <url>
    <loc>${xml(item.loc)}</loc>
    <lastmod>${xml(item.lastmod)}</lastmod>
  </url>`
    )
    .join("\n");

  await writeFile(
    join(root, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`,
    "utf8"
  );
}

async function generateFeed() {
  const latest = postDate(posts[0] || {});
  const items = posts
    .slice(0, 50)
    .map(
      (post) => `    <item>
      <title>${xml(post.title)}</title>
      <link>${xml(postUrl(post))}</link>
      <guid>${xml(postUrl(post))}</guid>
      <description>${xml(postExcerpt(post))}</description>
      <category>${xml(post.category || "")}</category>
      <pubDate>${new Date(postDate(post)).toUTCString()}</pubDate>
    </item>`
    )
    .join("\n");

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>트립뷰</title>
    <link>${baseUrl}/</link>
    <description>국내여행과 공연/축제 여행 정보</description>
    <lastBuildDate>${new Date(latest).toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;

  await writeFile(join(root, "feed.xml"), feed, "utf8");
  await writeFile(join(root, "rss.xml"), feed, "utf8");
}

async function copyIfExists(from, to) {
  try {
    await cp(from, to, { recursive: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function copySite(targetDir) {
  await rm(targetDir, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });

  for (const file of files) {
    await copyIfExists(join(root, file), join(targetDir, file));
  }

  await copyIfExists(join(root, "assets"), join(targetDir, "assets"));
  await copyIfExists(join(root, "data"), join(targetDir, "data"));

  for (const post of generatedPosts) {
    await copyIfExists(join(root, post.slug), join(targetDir, post.slug));
  }
}

await generateFlightDealPages();
await generateSitemap();
await generateFeed();
await copySite(outDir);
await copySite(siteDir);

console.log(`Built ${posts.length} posts into www and site`);
