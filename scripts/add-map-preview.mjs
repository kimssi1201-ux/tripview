import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = join(scriptDir, "..");
const MAP_START = "<!-- map-preview:start -->";
const MAP_END = "<!-- map-preview:end -->";
const CSS_MARKER = "/* map-preview */";

function decodeEntities(value = "") {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(value = "") {
  return decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, (match) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[match]));
}

function tableValue(html, labels) {
  const rows = [...html.matchAll(/<tr><th>([\s\S]*?)<\/th><td>([\s\S]*?)<\/td><\/tr>/gi)];
  for (const row of rows) {
    const key = stripHtml(row[1]);
    if (labels.includes(key)) return stripHtml(row[2]);
  }
  return "";
}

function titleFromHtml(html) {
  return stripHtml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "")
    .replace(/\s*\|\s*트립뷰$/, "")
    .trim();
}

function mapQuery(html) {
  const address = tableValue(html, ["주소", "장소"]);
  const title = titleFromHtml(html);
  return address || title;
}

function mapBlock(query) {
  const encoded = encodeURIComponent(query);
  const safe = esc(query);
  return `${MAP_START}
<section class="map-preview" aria-label="지도 미리보기">
  <h2>지도 미리보기</h2>
  <div class="map-frame">
    <iframe title="${safe} 지도 미리보기" src="https://maps.google.com/maps?q=${encoded}&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
  </div>
  <p class="map-address">${safe}</p>
  <div class="map-links">
    <a href="https://www.google.com/maps/search/?api=1&query=${encoded}" target="_blank" rel="noopener">Google 지도에서 보기</a>
    <a href="https://map.naver.com/p/search/${encoded}" target="_blank" rel="noopener">네이버 지도에서 보기</a>
  </div>
</section>
${MAP_END}`;
}

function removeExistingMap(html) {
  return html.replace(new RegExp(`${MAP_START}[\\s\\S]*?${MAP_END}\\s*`, "g"), "");
}

function ensureMapCss(html) {
  if (html.includes(CSS_MARKER)) return html;
  const css = `${CSS_MARKER}.map-preview{margin:34px 0 38px}.map-preview h2{margin:0 0 13px;font-size:26px;letter-spacing:0}.map-frame{border:1px solid var(--line);background:var(--soft);aspect-ratio:16/9;overflow:hidden}.map-frame iframe{display:block;width:100%;height:100%;border:0;filter:grayscale(.15)}.map-address{margin:10px 0 0;color:var(--muted);font-size:15px}.map-links{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}.map-links a{display:inline-flex;align-items:center;justify-content:center;min-height:38px;padding:8px 13px;border:1px solid var(--line);font-size:14px;font-weight:800;background:#fff}@media(max-width:640px){.map-frame{aspect-ratio:4/3}.map-links a{width:100%}}`;
  return html.replace(/<\/style>/i, `${css}</style>`);
}

function patchHtml(html) {
  if (!html.includes('class="info-table"')) return html;
  const query = mapQuery(html);
  if (!query) return html;

  let next = removeExistingMap(html);
  next = ensureMapCss(next);
  return next.replace(/<\/table>/i, `</table>${mapBlock(query)}`);
}

async function collectHtmlFiles(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules" || entry.name === "site" || entry.name === "www") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectHtmlFiles(full, files);
    } else if (entry.isFile() && entry.name === "index.html") {
      files.push(full);
    }
  }
  return files;
}

const htmlFiles = await collectHtmlFiles(root);
let patched = 0;

for (const file of htmlFiles) {
  const current = await readFile(file, "utf8");
  const next = patchHtml(current);
  if (next !== current) {
    await writeFile(file, next, "utf8");
    patched += 1;
  }
}

console.log(`Map previews verified. pages patched: ${patched}, pages checked: ${htmlFiles.length}`);
