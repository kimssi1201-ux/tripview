import { CONTENT_TODAY, RSS_TITLE, SITE_NAME, SITE_URL, feedItems } from "../lib/content.mjs";

function xml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function GET() {
  const items = feedItems(50)
    .map((item) => `    <item>
      <title>${xml(item.title)}</title>
      <link>${xml(item.link)}</link>
      <guid>${xml(item.guid)}</guid>
      <description>${xml(item.description)}</description>
      <pubDate>${xml(item.pubDate)}</pubDate>
    </item>`)
    .join("\n");

  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${xml(RSS_TITLE)}</title>
    <link>${xml(SITE_URL)}/</link>
    <description>${xml(`${SITE_NAME} 여행 정보 최신 글`)}</description>
    <language>ko-KR</language>
    <lastBuildDate>${xml(new Date(`${CONTENT_TODAY}T00:00:00+09:00`).toUTCString())}</lastBuildDate>
${items}
  </channel>
</rss>
`, {
    headers: { "content-type": "application/rss+xml; charset=utf-8" },
  });
}
