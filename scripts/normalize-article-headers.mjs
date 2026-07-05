import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ARTICLE_HEADER = `<header class="top"><div class="wrap nav"><a class="brand" href="../">&#53944;&#47549;&#48624;</a><nav class="links" aria-label="&#51452;&#50836; &#47700;&#45684;"><a href="../">&#54856;</a><a href="../#travel">&#44032;&#48380;&#47564;&#54620; &#44275;</a><a href="../#festival">&#52629;&#51228;&#51221;&#48372;</a><a href="../#seoul">&#51648;&#50669;&#48324;</a></nav></div></header>`;

async function patchFile(file) {
  let html;
  try {
    html = await fs.readFile(file, "utf8");
  } catch {
    return false;
  }

  const next = html.replace(/<header class="top"><div class="wrap nav">[\s\S]*?<\/div><\/header>/, ARTICLE_HEADER);
  if (next === html) return false;

  await fs.writeFile(file, next, "utf8");
  return true;
}

async function findArticleIndexFiles(baseDir) {
  const files = [];
  let entries;
  try {
    entries = await fs.readdir(baseDir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!/^(festival|travel)-/.test(entry.name) && !entry.name.includes("-")) continue;
    files.push(path.join(baseDir, entry.name, "index.html"));
  }

  return files;
}

let patched = 0;
const seen = new Set();

for (const base of [ROOT, path.join(ROOT, "site"), path.join(ROOT, "www")]) {
  for (const file of await findArticleIndexFiles(base)) {
    if (seen.has(file)) continue;
    seen.add(file);
    if (await patchFile(file)) patched += 1;
  }
}

console.log(`Article headers normalized: ${patched}`);
