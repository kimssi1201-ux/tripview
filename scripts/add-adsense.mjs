import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = join(scriptDir, "..");

const ADSENSE_PUBLISHER_ID = "ca-pub-5751319666030430";
const ADS_TXT_LINE = `google.com, ${ADSENSE_PUBLISHER_ID.replace("ca-", "")}, DIRECT, f08c47fec0942fa0\n`;
const NAVER_VERIFICATION_ID = "38616b4b4209994ed384d0d2439bddcbec2cc711";
const ADSENSE_PUBLISHER_RE = /ca-pub-\d+/g;
const ADSENSE_SCRIPT_RE = /\s*<script\s+async\s+src=["']https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-\d+["'][^>]*crossorigin=["']anonymous["'][^>]*><\/script>/gi;
const NAVER_VERIFICATION_RE = /\s*<meta\s+name=["']naver-site-verification["']\s+content=["'][^"']+["']\s*\/?>/gi;

const requiredHeadSnippets = [
  {
    name: "AdSense",
    marker: ADSENSE_PUBLISHER_ID,
    html: `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER_ID}"\n     crossorigin="anonymous"></script>`,
  },
  {
    name: "Naver Search Advisor",
    marker: NAVER_VERIFICATION_ID,
    html: `<meta name="naver-site-verification" content="${NAVER_VERIFICATION_ID}" />`,
  },
];

const generatorFiles = [
  join(root, "scripts", "build-homepage.mjs"),
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

function insertRequiredHeadSnippets(text) {
  const normalizedText = removeManagedSnippetsOutsideHead(
    text.replace(ADSENSE_PUBLISHER_RE, ADSENSE_PUBLISHER_ID),
  );

  return normalizedText.replace(/<head(?=[\s>])([^>]*)>([\s\S]*?)<\/head>/gi, (match, attrs, body) => {
    let nextBody = body
      .replace(ADSENSE_SCRIPT_RE, "")
      .replace(NAVER_VERIFICATION_RE, "");

    for (const snippet of requiredHeadSnippets) {
      if (!nextBody.includes(snippet.marker)) {
        nextBody = `\n    ${snippet.html}${nextBody}`;
      }
    }

    return `<head${attrs}>${nextBody}</head>`;
  });
}

function removeManagedSnippetsOutsideHead(text) {
  const headRe = /<head(?=[\s>])[^>]*>[\s\S]*?<\/head>/gi;
  let result = "";
  let lastIndex = 0;

  for (const match of text.matchAll(headRe)) {
    result += stripManagedSnippets(text.slice(lastIndex, match.index));
    result += match[0];
    lastIndex = match.index + match[0].length;
  }

  result += stripManagedSnippets(text.slice(lastIndex));
  return result;
}

function stripManagedSnippets(text) {
  return text
    .replace(ADSENSE_SCRIPT_RE, "")
    .replace(NAVER_VERIFICATION_RE, "");
}

function missingHeadSnippets(text) {
  const blocks = [...text.matchAll(/<head(?=[\s>])[^>]*>([\s\S]*?)<\/head>/gi)].map((match) => match[1]);
  const missing = [];

  blocks.forEach((block, index) => {
    for (const snippet of requiredHeadSnippets) {
      if (!block.includes(snippet.marker)) {
        missing.push(`${snippet.name} in head #${index + 1}`);
      }
    }
  });

  return missing;
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
  const next = insertRequiredHeadSnippets(source);
  if (await writeIfChanged(file, next)) patchedGenerators += 1;
}

const htmlFiles = await collectHtmlFiles(root);
let patchedPages = 0;
const missingPages = [];

for (const file of htmlFiles) {
  const source = await readText(file);
  const next = insertRequiredHeadSnippets(source);
  if (await writeIfChanged(file, next)) patchedPages += 1;

  const missing = missingHeadSnippets(await readText(file));
  if (missing.length) {
    missingPages.push(`${relative(root, file)}: ${missing.join(", ")}`);
  }
}

const adsTextUpdated = await writeIfChanged(join(root, "ads.txt"), ADS_TXT_LINE);

const missingGenerators = [];
for (const file of generatorFiles) {
  const missing = missingHeadSnippets(await readText(file));
  if (missing.length) {
    missingGenerators.push(`${relative(root, file)}: ${missing.join(", ")}`);
  }
}

if (missingPages.length || missingGenerators.length) {
  throw new Error(
    `Head tag insertion incomplete. pages=${missingPages.join(" | ")} generators=${missingGenerators.join(" | ")}`,
  );
}

console.log(
  `Head tags verified. generators patched: ${patchedGenerators}, pages patched: ${patchedPages}, pages checked: ${htmlFiles.length}, ads.txt updated: ${adsTextUpdated}`,
);
