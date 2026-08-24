import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POSTS_PATH = path.join(ROOT, "data", "generated-posts.json");
const MANIFEST_PATH = path.join(ROOT, "data", "data-post-manifest.json");
const LOG_PATH = path.join(ROOT, "data", "data-post-pipeline-log.json");
const SITE_URL = "https://tripview.kr";
const TODAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const ALLOWED_DATA_TYPES = new Set(["stay-price", "festival-schedule", "ticket-price"]);
const DATA_SLUG_PATTERN = /^data-(stay-price|festival-schedule|ticket-price)-[a-z0-9-]+$/;
const MAX_DAILY_POSTS = 3;
const MAX_DAILY_PER_TYPE = 1;
const MAX_AFFILIATE_LINKS = 8;
const MAX_AUTO_SHARE = 0.7;
const FORBIDDEN_PATTERNS = [
  /아마/g,
  /일 것입니다/g,
  /것입니다/g,
  /가보니/g,
  /걸어보면/g,
  /최고의/g,
  /꼭 가야 할/g,
  /반드시 가야/g,
  /놓치지 말아야/g,
  /숨은 명소/g,
  /핫플/g,
];
const SECRET_ENV_KEYS = [
  "TRIPVIEW_API_KEY",
  "TRIPVIEW_API_KEY_PARAM",
  "MYREALTRIP_API_KEY",
  "PARTNER_API_KEY",
  "MYREALTRIP_PARTNER_API_KEY",
  "COUPANG_ACCESS_KEY",
  "COUPANG_SECRET_KEY",
];
const TEXT_FILE_PATTERN = /\.(?:css|csv|html|js|json|md|mjs|txt|xml|yml|yaml)$/i;

function stripHtml(value = "") {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value = "") {
  return stripHtml(value).replace(/\s+/g, " ").trim();
}

function sourceNumbersFromValues(values = []) {
  const numbers = new Set();
  for (const value of values) {
    const text = String(value ?? "");
    for (const match of text.matchAll(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g)) {
      numbers.add(match[0].replaceAll(",", ""));
    }
  }
  return numbers;
}

function plainPostBody(post = {}) {
  const sections = Array.isArray(post.sections)
    ? post.sections.flatMap((section) => Array.isArray(section?.[1]) ? section[1] : []).join(" ")
    : "";
  const faq = Array.isArray(post.faq) ? post.faq.flat().join(" ") : "";
  const info = Array.isArray(post.info) ? post.info.flat().join(" ") : "";
  return normalizeText([post.title, post.description, post.excerpt, info, sections, faq, ...(Array.isArray(post.memo) ? post.memo : [])].join(" "));
}

function shingleSet(text, size = 5) {
  const words = normalizeText(text).split(/\s+/).filter(Boolean);
  if (words.length < size) return new Set(words);
  const set = new Set();
  for (let index = 0; index <= words.length - size; index += 1) {
    set.add(words.slice(index, index + size).join(" "));
  }
  return set;
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

function consecutiveOverviewMatch(body, overviews = []) {
  const normalizedBody = normalizeText(body);
  for (const overview of overviews) {
    const words = normalizeText(overview).split(/\s+/).filter(Boolean);
    for (let index = 0; index <= words.length - 3; index += 1) {
      const phrase = words.slice(index, index + 3).join(" ");
      if (phrase.length >= 6 && normalizedBody.includes(phrase)) return phrase;
    }
  }
  return "";
}

function dataTableEmptyRatio(document) {
  const table = String(document).match(/<table\b[^>]*\bclass=["'][^"']*\bdata-table\b[^"']*["'][^>]*>[\s\S]*?<\/table>/i)?.[0] || "";
  const body = table.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i)?.[1] || table;
  let total = 0;
  let empty = 0;
  for (const row of body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    for (const cell of row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)) {
      total += 1;
      if (!normalizeText(cell[1])) empty += 1;
    }
  }
  return total ? empty / total : 1;
}

function classBlockText(document, className) {
  const pattern = new RegExp(`<section\\b[^>]*\\bclass=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>[\\s\\S]*?<\\/section>`, "i");
  return stripHtml(String(document).match(pattern)?.[0] || "");
}

function articleText(document) {
  const article = String(document).match(/<article\b[^>]*\bclass=["'][^"']*\bcontent\b[^"']*["'][^>]*>[\s\S]*?<\/article>/i)?.[0] || document;
  return stripHtml(article);
}

function validationScope(document) {
  const article = String(document).match(/<article\b[^>]*\bclass=["'][^"']*\bcontent\b[^"']*["'][^>]*>[\s\S]*?<\/article>/i)?.[0] || document;
  return article
    .replace(/\s*<(?:aside|section)\b[^>]*\bclass=["'][^"']*\bregion-related\b[\s\S]*?<\/(?:aside|section)>/gi, " ")
    .replace(/\s*<(?:aside|section)\b[^>]*\bclass=["'][^"']*\btrust-note\b[\s\S]*?<\/(?:aside|section)>/gi, " ");
}

function secretValues() {
  return SECRET_ENV_KEYS
    .map((key) => process.env[key])
    .filter((value) => typeof value === "string" && value.trim().length >= 12);
}

function fail(errors, slug, reason) {
  errors.push(`${slug}: ${reason}`);
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function liveUrlOk(url) {
  try {
    const response = await fetch(url, { method: "GET", signal: AbortSignal.timeout(15000) });
    return response.status === 200;
  } catch {
    return false;
  }
}

function internalArticleUrls(document, postsBySlug, currentSlug) {
  const urls = new Set();
  for (const match of String(document).matchAll(/<a\b[^>]*\bhref=["'](\/[^"']+)["'][^>]*>/gi)) {
    const pathname = match[1].split(/[?#]/)[0].replace(/^\/+|\/+$/g, "");
    if (!pathname || pathname === currentSlug) continue;
    const linkedPost = postsBySlug.get(pathname);
    if (linkedPost && !linkedPost?.dataPipeline?.generated) urls.add(`${SITE_URL}/${pathname}/`);
  }
  return [...urls];
}

function postAllowedNumbers(post) {
  const validation = post?.dataPipeline?.validation || {};
  return new Set([
    ...(Array.isArray(validation.allowedNumbers) ? validation.allowedNumbers.map(String) : []),
    ...sourceNumbersFromValues([
      post.date,
      post.sortDate,
      post.updatedAt,
      post?.dataPipeline?.updatedAt,
      post?.dataPipeline?.affiliateLinkCount,
      validation.rowCount,
      validation.affiliateLinkCount,
      validation.maxAffiliateLinks,
      MAX_DAILY_POSTS,
      MAX_DAILY_PER_TYPE,
      MAX_AFFILIATE_LINKS,
      Math.round(MAX_AUTO_SHARE * 100),
    ]),
  ]);
}

function validateLog(errors, log) {
  const byDay = new Map();
  for (const run of Array.isArray(log?.runs) ? log.runs : []) {
    const date = run.runDate || "unknown";
    if (!byDay.has(date)) byDay.set(date, { count: 0, types: new Map() });
    const day = byDay.get(date);
    for (const item of run.generated || []) {
      day.count += 1;
      day.types.set(item.type, (day.types.get(item.type) || 0) + 1);
    }
    if (!Array.isArray(run.discarded)) fail(errors, "data-log", `discarded_reasons_missing:${date}`);
    for (const item of run.discarded || []) {
      if (!Array.isArray(item.reasons) || !item.reasons.length) fail(errors, "data-log", `discard_reason_missing:${item.slug || date}`);
    }
  }
  for (const [date, day] of byDay) {
    if (day.count > MAX_DAILY_POSTS) fail(errors, "data-log", `daily_generation_over_${MAX_DAILY_POSTS}:${date}:${day.count}`);
    for (const [type, count] of day.types) {
      if (count > MAX_DAILY_PER_TYPE) fail(errors, "data-log", `daily_type_generation_over_${MAX_DAILY_PER_TYPE}:${date}:${type}:${count}`);
    }
  }
}

async function committedSecretLeaks() {
  const secrets = secretValues();
  if (!secrets.length) return [];
  let stdout = "";
  try {
    ({ stdout } = await execFileAsync("git", ["ls-files", "-z"], { cwd: ROOT, maxBuffer: 16 * 1024 * 1024 }));
  } catch {
    return [];
  }
  const leaks = [];
  const files = stdout.split("\0").filter(Boolean).filter((file) => TEXT_FILE_PATTERN.test(file));
  for (const file of files) {
    const absolute = path.join(ROOT, file);
    let stat;
    try {
      stat = await fs.stat(absolute);
    } catch {
      continue;
    }
    if (stat.size > 5 * 1024 * 1024) continue;
    let text = "";
    try {
      text = await fs.readFile(absolute, "utf8");
    } catch {
      continue;
    }
    if (secrets.some((secret) => text.includes(secret))) leaks.push(file);
  }
  return leaks;
}

async function main() {
  const [posts, manifest, log] = await Promise.all([
    readJson(POSTS_PATH, []),
    readJson(MANIFEST_PATH, { posts: [] }),
    readJson(LOG_PATH, { runs: [] }),
  ]);
  const postsBySlug = new Map(posts.map((post) => [post.slug, post]));
  const dataPosts = posts.filter((post) => post?.dataPipeline?.generated);
  const errors = [];
  if (!dataPosts.length) fail(errors, "data-posts", "no data pipeline posts found");

  const autoShare = dataPosts.length / Math.max(1, posts.length);
  if (autoShare > MAX_AUTO_SHARE) fail(errors, "data-posts", `auto-generated share over 70%:${autoShare.toFixed(3)}`);

  const manifestPolicy = manifest?.policy || {};
  if (manifestPolicy.maxDailyPosts !== MAX_DAILY_POSTS) fail(errors, "data-manifest", "maxDailyPosts_policy_mismatch");
  if (manifestPolicy.maxDailyPerType !== MAX_DAILY_PER_TYPE) fail(errors, "data-manifest", "maxDailyPerType_policy_mismatch");
  if (manifestPolicy.maxAffiliateLinks !== MAX_AFFILIATE_LINKS) fail(errors, "data-manifest", "maxAffiliateLinks_policy_mismatch");
  if (manifestPolicy.maxAutoGeneratedShare !== MAX_AUTO_SHARE) fail(errors, "data-manifest", "maxAutoGeneratedShare_policy_mismatch");
  if (manifestPolicy.urlPattern !== "/data-{type}-{region}/") fail(errors, "data-manifest", "urlPattern_policy_mismatch");
  validateLog(errors, log);

  const existingBodies = posts
    .filter((post) => post?.slug && !post?.dataPipeline?.generated)
    .map((post) => ({ slug: post.slug, shingles: shingleSet(plainPostBody(post)) }));
  const shouldCheckLive = String(process.env.DATA_PIPELINE_VALIDATE_LIVE_URLS || "").toLowerCase() === "true";

  for (const post of dataPosts) {
    const kind = post?.dataPipeline?.kind || "";
    if (!ALLOWED_DATA_TYPES.has(kind)) fail(errors, post.slug, `unsupported_data_type:${kind || "missing"}`);
    if (!DATA_SLUG_PATTERN.test(post.slug || "")) fail(errors, post.slug, "invalid_data_url_pattern");
    const htmlPath = path.join(ROOT, post.slug, "index.html");
    let document = "";
    try {
      document = await fs.readFile(htmlPath, "utf8");
    } catch {
      fail(errors, post.slug, "html_missing");
      continue;
    }
    const body = plainPostBody(post);
    const scopedDocument = validationScope(document);
    const text = stripHtml(scopedDocument);
    const validation = post?.dataPipeline?.validation || {};
    if (!Array.isArray(validation.allowedNumbers) || !validation.allowedNumbers.length) fail(errors, post.slug, "validation_allowed_numbers_missing");
    if (!Array.isArray(validation.allowedTypes) || validation.allowedTypes.some((type) => !ALLOWED_DATA_TYPES.has(type))) fail(errors, post.slug, "validation_allowed_types_invalid");

    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(text)) fail(errors, post.slug, `forbidden_expression:${pattern.source}`);
      pattern.lastIndex = 0;
    }

    const allowedNumbers = postAllowedNumbers(post);
    for (const match of text.matchAll(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g)) {
      const number = match[0].replaceAll(",", "");
      if (!allowedNumbers.has(number)) fail(errors, post.slug, `unmatched_number:${match[0]}`);
    }

    const sourcePostSlugs = Array.isArray(validation.sourcePostSlugs) ? validation.sourcePostSlugs : [];
    if (kind === "festival-schedule" && !sourcePostSlugs.length) fail(errors, post.slug, "source_post_slugs_missing");
    const sourceOverviews = sourcePostSlugs.map((slug) => postsBySlug.get(slug)?.tourApi?.overview).filter(Boolean);
    const overviewMatch = consecutiveOverviewMatch(body, sourceOverviews);
    if (overviewMatch) fail(errors, post.slug, `tour_overview_overlap:${overviewMatch}`);

    const candidateShingles = shingleSet(body);
    for (const existing of existingBodies) {
      const similarity = jaccard(candidateShingles, existing.shingles);
      if (similarity > 0.8) {
        fail(errors, post.slug, `body_similarity_over_80:${existing.slug}:${similarity.toFixed(3)}`);
        break;
      }
    }

    const emptyRatio = dataTableEmptyRatio(document);
    if (emptyRatio > 0.3) fail(errors, post.slug, `table_empty_cells_over_30:${emptyRatio.toFixed(3)}`);
    if (Number(validation.tableEmptyRatio || 0) > 0.3) fail(errors, post.slug, `metadata_table_empty_cells_over_30:${validation.tableEmptyRatio}`);

    const affiliateLinks = [...document.matchAll(/<a\b([^>]*\bdata-affiliate-link\b[^>]*)>/gi)];
    if (affiliateLinks.length > MAX_AFFILIATE_LINKS) fail(errors, post.slug, `affiliate_links_over_8:${affiliateLinks.length}`);
    const affiliateBlockText = classBlockText(document, "affiliate-block");
    const affiliateRatio = affiliateBlockText.length / Math.max(1, articleText(document).length);
    if (affiliateRatio > 0.3) fail(errors, post.slug, `affiliate_block_ratio_over_30:${affiliateRatio.toFixed(3)}`);
    if (Number(validation.affiliateTextRatio || 0) > 0.3) fail(errors, post.slug, `metadata_affiliate_ratio_over_30:${validation.affiliateTextRatio}`);

    if (/\[[^\]]+\]/.test(text)) fail(errors, post.slug, "bracket_instruction_remaining");

    for (const match of affiliateLinks) {
      const attrs = match[1];
      const rel = attrs.match(/\brel=["']([^"']*)["']/i)?.[1] || "";
      const target = attrs.match(/\btarget=["']([^"']*)["']/i)?.[1] || "";
      const href = (attrs.match(/\bhref=["']([^"']*)["']/i)?.[1] || "").replace(/&amp;/g, "&");
      if (!/\bsponsored\b/.test(rel)) fail(errors, post.slug, "affiliate_rel_sponsored_missing");
      if (!/\bnofollow\b/.test(rel)) fail(errors, post.slug, "affiliate_rel_nofollow_missing");
      if (target !== "_blank") fail(errors, post.slug, "affiliate_target_blank_missing");
      try {
        const url = new URL(href);
        const checkIn = url.searchParams.get("checkIn");
        if (checkIn && checkIn < TODAY) fail(errors, post.slug, `checkin_before_today:${checkIn}`);
      } catch {
        fail(errors, post.slug, "affiliate_href_invalid");
      }
    }

    for (const img of document.matchAll(/<img\b([^>]*)>/gi)) {
      const alt = img[1].match(/\balt=["']([^"']*)["']/i)?.[1] || "";
      if (!normalizeText(alt)) fail(errors, post.slug, "image_alt_missing");
      if (!/\bloading=["']lazy["']/i.test(img[1])) fail(errors, post.slug, "image_lazy_missing");
    }

    for (const secret of secretValues()) {
      if (document.includes(secret)) fail(errors, post.slug, "api_key_in_html");
      if (JSON.stringify(post).includes(secret)) fail(errors, post.slug, "api_key_in_json");
    }

    if (shouldCheckLive) {
      for (const url of internalArticleUrls(document, postsBySlug, post.slug)) {
        if (!(await liveUrlOk(url))) fail(errors, post.slug, `existing_url_not_200:${url}`);
      }
    }
  }

  for (const file of await committedSecretLeaks()) {
    fail(errors, "repository", `api_key_in_committed_file:${file}`);
  }

  if (errors.length) {
    throw new Error(`Data post validation failed:\n${errors.join("\n")}`);
  }
  console.log(`Validated ${dataPosts.length} data pipeline post(s).`);
}

await main();
