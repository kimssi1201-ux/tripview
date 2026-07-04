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
  "feed.xml",
  "rss.xml",
  "ads.txt"
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

function postDate(post) {
  return post.sortDate || post.date || new Date().toISOString().slice(0, 10);
}

function postExcerpt(post) {
  return post.excerpt || post.description || "";
}

async function generateSitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${baseUrl}/`, lastmod: today },
    { loc: `${baseUrl}/privacy.html`, lastmod: today },
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

await generateSitemap();
await generateFeed();
await copySite(outDir);
await copySite(siteDir);

console.log(`Built ${posts.length} posts into www and site`);
