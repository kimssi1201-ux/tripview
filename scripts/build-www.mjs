import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "www");
const siteDir = join(root, "site");
const baseUrl = "https://kimssi1201-ux.github.io/tripview";
const posts = JSON.parse(await readFile(join(root, "data", "posts.json"), "utf8"));

const files = [
  "index.html",
  "style.css",
  "main.js",
  "privacy.html",
  "manifest.webmanifest",
  "package.json",
  "README.md",
  "_headers",
  "robots.txt",
  "sitemap.xml",
  "feed.xml"
];

function xml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function postUrl(post) {
  return `${baseUrl}/post.html?slug=${encodeURIComponent(post.slug)}`;
}

async function generateSitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${baseUrl}/`, lastmod: today },
    { loc: `${baseUrl}/privacy.html`, lastmod: today },
    ...posts.map((post) => ({ loc: postUrl(post), lastmod: post.date }))
  ];

  const body = urls
    .map(
      (item) => `  <url>\n    <loc>${xml(item.loc)}</loc>\n    <lastmod>${xml(item.lastmod)}</lastmod>\n  </url>`
    )
    .join("\n");

  await writeFile(
    join(root, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`,
    "utf8"
  );
}

async function generateFeed() {
  const latest = posts[0]?.date || new Date().toISOString().slice(0, 10);
  const items = posts
    .slice(0, 20)
    .map(
      (post) => `    <item>\n      <title>${xml(post.title)}</title>\n      <link>${xml(postUrl(post))}</link>\n      <guid>${xml(postUrl(post))}</guid>\n      <description>${xml(post.excerpt)}</description>\n      <category>${xml(post.category)}</category>\n      <pubDate>${new Date(post.date).toUTCString()}</pubDate>\n    </item>`
    )
    .join("\n");

  await writeFile(
    join(root, "feed.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n    <title>여행노트</title>\n    <link>${baseUrl}/</link>\n    <description>국내외 여행 정보와 후기</description>\n    <lastBuildDate>${new Date(latest).toUTCString()}</lastBuildDate>\n${items}\n  </channel>\n</rss>\n`,
    "utf8"
  );
}

async function copySite(targetDir) {
  await rm(targetDir, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });

  for (const file of files) {
    await cp(join(root, file), join(targetDir, file), { recursive: true });
  }

  await mkdir(join(targetDir, "data"), { recursive: true });
  await cp(join(root, "data", "posts.json"), join(targetDir, "data", "posts.json"));
}

await generateSitemap();
await generateFeed();
await copySite(outDir);
await copySite(siteDir);

console.log(`Built ${posts.length} posts into www and site`);
