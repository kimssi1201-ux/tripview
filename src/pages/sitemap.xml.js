import { sitemapUrls } from "../lib/content.mjs";

function xml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function GET() {
  const body = sitemapUrls()
    .map((item) => `  <url>
    <loc>${xml(item.loc)}</loc>
    <lastmod>${xml(item.lastmod)}</lastmod>
  </url>`)
    .join("\n");

  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`, {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}
