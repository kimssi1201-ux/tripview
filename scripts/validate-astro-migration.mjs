import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

import { allPosts, indexablePosts, sectionPairs } from "../src/lib/content.mjs";

const BASE_URL = "https://tripview.kr";
const DIST = "dist";
const REPORT = "reports/astro-migration-validation.json";

function parseLocs(xml = "") {
  return [...String(xml).matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
}

function stripTags(value = "") {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function metaContent(document = "", name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return String(document).match(new RegExp(`<meta\\s+[^>]*(?:name|property)=["']${escaped}["'][^>]*content=["']([^"']*)["'][^>]*>`, "i"))?.[1] || "";
}

function titleOf(document = "") {
  return stripTags(String(document).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
}

function h1Of(document = "") {
  return stripTags(String(document).match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "");
}

function canonicalOf(document = "") {
  return String(document).match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i)?.[1] || "";
}

function imageSources(document = "") {
  return [...String(document).matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
}

function jsonLdCount(document = "") {
  return (String(document).match(/type=["']application\/ld\+json["']/g) || []).length;
}

function candidatesForUrl(url, root = ".") {
  const pathname = new URL(url).pathname;
  if (pathname === "/") return [join(root, "index.html")];
  const clean = pathname.replace(/^\/+|\/+$/g, "");
  if (pathname.endsWith("/")) return [join(root, clean, "index.html")];
  return [join(root, clean, "index.html"), join(root, `${clean}.html`)];
}

async function readFirstExisting(paths) {
  for (const file of paths) {
    if (existsSync(file)) return { file, text: await readFile(file, "utf8") };
  }
  return { file: paths[0], text: "" };
}

function setDiff(a, b) {
  const bSet = new Set(b);
  return a.filter((item) => !bSet.has(item));
}

function textSnippetFailures(url, document) {
  const slug = new URL(url).pathname.replace(/^\/+|\/+$/g, "");
  const post = allPosts.find((item) => item.slug === slug);
  if (!post) return [];
  const text = stripTags(document);
  const snippets = sectionPairs(post)
    .flatMap((section) => section.paragraphs)
    .slice(0, 3)
    .map((paragraph) => paragraph.slice(0, 60))
    .filter((snippet) => snippet.length >= 20);
  return snippets.filter((snippet) => !text.includes(snippet));
}

const legacySitemap = await readFile("sitemap.xml", "utf8");
const astroSitemap = await readFile(join(DIST, "sitemap.xml"), "utf8");
const legacyUrls = parseLocs(legacySitemap);
const astroUrls = parseLocs(astroSitemap);
const missingUrls = setDiff(legacyUrls, astroUrls);
const extraUrls = setDiff(astroUrls, legacyUrls);

const failures = [];
if (missingUrls.length) failures.push({ type: "missing-url", items: missingUrls });
if (extraUrls.length) failures.push({ type: "extra-url", items: extraUrls });

const compared = [];
for (const url of legacyUrls) {
  const legacy = await readFirstExisting(candidatesForUrl(url));
  const astro = await readFirstExisting(candidatesForUrl(url, DIST));
  if (!astro.text) {
    failures.push({ type: "missing-file", url, expected: astro.file });
    continue;
  }

  const legacyMeta = legacy.text ? {
    title: titleOf(legacy.text),
    description: metaContent(legacy.text, "description"),
    canonical: canonicalOf(legacy.text),
    h1: h1Of(legacy.text),
    ogImage: metaContent(legacy.text, "og:image"),
    jsonLd: jsonLdCount(legacy.text),
    imageCount: imageSources(legacy.text).length,
  } : null;
  const astroMeta = {
    title: titleOf(astro.text),
    description: metaContent(astro.text, "description"),
    canonical: canonicalOf(astro.text),
    h1: h1Of(astro.text),
    ogImage: metaContent(astro.text, "og:image"),
    jsonLd: jsonLdCount(astro.text),
    imageCount: imageSources(astro.text).length,
  };

  if (!astroMeta.title || !astroMeta.description || !astroMeta.canonical || !astroMeta.h1) {
    failures.push({ type: "missing-seo-field", url, astro: astroMeta });
  }
  if (legacyMeta?.canonical && astroMeta.canonical !== legacyMeta.canonical) {
    failures.push({ type: "canonical-changed", url, legacy: legacyMeta.canonical, astro: astroMeta.canonical });
  }
  if (legacyMeta?.h1 && astroMeta.h1 !== legacyMeta.h1) {
    failures.push({ type: "h1-changed", url, legacy: legacyMeta.h1, astro: astroMeta.h1 });
  }

  const snippetMissing = textSnippetFailures(url, astro.text);
  if (snippetMissing.length) failures.push({ type: "body-snippet-missing", url, snippets: snippetMissing });

  compared.push({ url, legacy: legacyMeta, astro: astroMeta });
}

const report = {
  generatedAt: new Date().toISOString(),
  legacyUrlCount: legacyUrls.length,
  astroUrlCount: astroUrls.length,
  indexablePostCount: indexablePosts.length,
  totalPostCount: allPosts.length,
  missingUrlCount: missingUrls.length,
  extraUrlCount: extraUrls.length,
  failures,
  compared,
};

await mkdir(dirname(REPORT), { recursive: true });
await writeFile(REPORT, `${JSON.stringify(report, null, 2)}\n`, "utf8");

if (failures.length) {
  console.error(`[validate:astro] ${failures.length} migration validation failure(s). See ${REPORT}.`);
  console.error(JSON.stringify(failures.slice(0, 10), null, 2));
  process.exit(1);
}

console.log(`[validate:astro] URL/SEO migration validation passed: ${legacyUrls.length} URL(s), ${indexablePosts.length} indexable article(s).`);
