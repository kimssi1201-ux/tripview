import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

import { searchIndex } from "../src/lib/content.mjs";

const DIST = "dist";
const CLOUDFLARE_OUTPUT = "www";

function isEnabled(value) {
  return /^(1|true|yes)$/i.test(String(value || ""));
}

async function copyFileIfExists(source, target = join(DIST, source)) {
  if (!existsSync(source)) return;
  await mkdir(dirname(target), { recursive: true });
  await cp(source, target, { force: true });
}

async function copyDirIfExists(source, target = join(DIST, source)) {
  if (!existsSync(source)) return;
  await mkdir(dirname(target), { recursive: true });
  await cp(source, target, { recursive: true, force: true });
}

await copyDirIfExists("assets");
await copyDirIfExists("data");

for (const file of [
  "_headers",
  "_redirects",
  "ads.txt",
  "robots.txt",
  "favicon.svg",
  "favicon.ico",
  "apple-touch-icon.png",
  "icon-192.png",
  "icon-512.png",
  "manifest.webmanifest",
  "main.js",
  "style.css",
]) {
  await copyFileIfExists(file);
}

for (const file of [
  "about.html",
  "contact.html",
  "editorial-team.html",
  "editorial-policy.html",
  "affiliate-disclosure.html",
  "privacy.html",
  "terms.html",
]) {
  await copyFileIfExists(file);
}

await mkdir(join(DIST, "assets"), { recursive: true });
await writeFile(join(DIST, "assets", "search-index.json"), `${JSON.stringify(searchIndex())}\n`, "utf8");

if (existsSync(join(DIST, "sitemap.xml"))) {
  await mkdir(join(DIST, "site"), { recursive: true });
  await cp(join(DIST, "sitemap.xml"), join(DIST, "site", "sitemap.xml"), { force: true });
}

if (existsSync(join(DIST, "rss.xml"))) {
  await cp(join(DIST, "rss.xml"), join(DIST, "feed.xml"), { force: true });
}

if (isEnabled(process.env.CF_PAGES) || isEnabled(process.env.TRIPVIEW_MIRROR_WWW)) {
  await rm(CLOUDFLARE_OUTPUT, { recursive: true, force: true });
  await mkdir(CLOUDFLARE_OUTPUT, { recursive: true });
  await cp(DIST, CLOUDFLARE_OUTPUT, { recursive: true, force: true });
  console.log(`[postbuild:astro] Mirrored dist/ into ${CLOUDFLARE_OUTPUT}/ for the current Cloudflare Pages output setting.`);
}

console.log("[postbuild:astro] Copied static assets, data fallbacks, compatibility pages, and search index into dist/.");
