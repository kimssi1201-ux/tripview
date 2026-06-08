import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = join(scriptDir, "..");
const publisher = "ca-pub-6066428844912614";
const adsenseScript = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6066428844912614"\n     crossorigin="anonymous"></script>';

const generatorFiles = [
  join(root, "scripts", "daily-tour-posts.mjs"),
  join(root, "scripts", "enrich-tour-posts.mjs"),
];

async function readText(path) {
  return readFile(path, "utf8");
}

async function writeIfChanged(path, text) {
  const current = await readText(path);
  if (current === text) return false;
  await writeFile(path, text, "utf8");
  return true;
}

function insertIntoHtml(text) {
  if (!text.includes("<head") || text.includes(publisher)) return text;
  return text.replace(/<head([^>]*)>/i, `<head$1>\n    ${adsenseScript}`);
}

function insertIntoGeneratorSource(text) {
  if (text.includes(publisher)) return text;

  let next = text.replaceAll(
    "<head>\\n    <meta",
    `<head>\\n    ${adsenseScript}\\n    <meta`,
  );

  next = next.replaceAll(
    "<head>\n    <meta",
    `<head>\n    ${adsenseScript}\n    <meta`,
  );

  return next;
}

async function collectHtmlFiles(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;

    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectHtmlFiles(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(fullPath);
    }
  }
  return files;
}

let patchedGenerators = 0;
for (const file of generatorFiles) {
  const source = await readText(file);
  const next = insertIntoGeneratorSource(source);
  if (await writeIfChanged(file, next)) patchedGenerators += 1;
}

const htmlFiles = await collectHtmlFiles(root);
let patchedPages = 0;
const missingPages = [];

for (const file of htmlFiles) {
  const source = await readText(file);
  const next = insertIntoHtml(source);
  if (await writeIfChanged(file, next)) patchedPages += 1;

  const updated = await readText(file);
  if (updated.includes("<head") && !updated.includes(publisher)) {
    missingPages.push(relative(root, file));
  }
}

const missingGenerators = [];
for (const file of generatorFiles) {
  const updated = await readText(file);
  if (!updated.includes(publisher)) missingGenerators.push(relative(root, file));
}

if (missingPages.length || missingGenerators.length) {
  throw new Error(
    `AdSense insertion incomplete. pages=${missingPages.join(", ")} generators=${missingGenerators.join(", ")}`,
  );
}

console.log(
  `AdSense script verified. generators patched: ${patchedGenerators}, pages patched: ${patchedPages}, pages checked: ${htmlFiles.length}`,
);
