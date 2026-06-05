import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "www");
const siteDir = join(root, "site");
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
];

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
await rm(siteDir, { recursive: true, force: true });
await mkdir(siteDir, { recursive: true });

for (const file of files) {
  await cp(join(root, file), join(outDir, file), { recursive: true });
  await cp(join(root, file), join(siteDir, file), { recursive: true });
}

console.log(`Copied ${files.length} files to www and site`);
