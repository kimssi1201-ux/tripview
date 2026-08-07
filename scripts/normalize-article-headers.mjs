import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ARTICLE_HEADER = `<header class="top"><div class="wrap nav"><a class="brand" href="../">트립뷰</a><nav class="links" aria-label="주요 메뉴"><a href="../">홈</a><a href="../#popular">8월 가볼만한 곳</a><a href="../#water">물놀이·계곡</a><a href="../#weekend">이번 주말</a><a href="../#festival">8월 축제</a><a href="../#indoor">실내여행</a><a href="../#family">아이와</a><a href="../#booking">예약 전 체크</a><a href="../#flight-deals">항공권</a></nav></div></header>`;

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
