import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POSTS_PATH = path.join(ROOT, "data", "generated-posts.json");
const TODAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const SECRET_ENV_KEYS = [
  "TRIPVIEW_API_KEY",
  "MYREALTRIP_API_KEY",
  "PARTNER_API_KEY",
  "MYREALTRIP_PARTNER_API_KEY",
  "COUPANG_ACCESS_KEY",
  "COUPANG_SECRET_KEY",
];

function stripHtml(value = "") {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function secretValues() {
  return SECRET_ENV_KEYS
    .map((key) => process.env[key])
    .filter((value) => typeof value === "string" && value.trim().length >= 12);
}

function fail(errors, slug, reason) {
  errors.push(`${slug}: ${reason}`);
}

async function main() {
  const posts = JSON.parse(await fs.readFile(POSTS_PATH, "utf8"));
  const dataPosts = posts.filter((post) => post?.dataPipeline?.generated);
  const errors = [];
  if (!dataPosts.length) fail(errors, "data-posts", "no data pipeline posts found");

  const autoShare = dataPosts.length / Math.max(1, posts.length);
  if (autoShare > 0.7) fail(errors, "data-posts", `auto-generated share over 70%:${autoShare.toFixed(3)}`);

  for (const post of dataPosts) {
    const htmlPath = path.join(ROOT, post.slug, "index.html");
    let document = "";
    try {
      document = await fs.readFile(htmlPath, "utf8");
    } catch {
      fail(errors, post.slug, "html_missing");
      continue;
    }
    const text = stripHtml(document);
    if (/\[[^\]]+\]/.test(text)) fail(errors, post.slug, "bracket_instruction_remaining");

    const affiliateLinks = [...document.matchAll(/<a\b([^>]*\bdata-affiliate-link\b[^>]*)>/gi)];
    if (affiliateLinks.length > 8) fail(errors, post.slug, `affiliate_links_over_8:${affiliateLinks.length}`);
    for (const match of affiliateLinks) {
      const attrs = match[1];
      const rel = attrs.match(/\brel=["']([^"']*)["']/i)?.[1] || "";
      const target = attrs.match(/\btarget=["']([^"']*)["']/i)?.[1] || "";
      const href = attrs.match(/\bhref=["']([^"']*)["']/i)?.[1] || "";
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
      if (!stripHtml(alt)) fail(errors, post.slug, "image_alt_missing");
      if (!/\bloading=["']lazy["']/i.test(img[1])) fail(errors, post.slug, "image_lazy_missing");
    }

    for (const secret of secretValues()) {
      if (document.includes(secret)) fail(errors, post.slug, "api_key_in_html");
      if (JSON.stringify(post).includes(secret)) fail(errors, post.slug, "api_key_in_json");
    }
  }

  if (errors.length) {
    throw new Error(`Data post validation failed:\n${errors.join("\n")}`);
  }
  console.log(`Validated ${dataPosts.length} data pipeline post(s).`);
}

await main();
