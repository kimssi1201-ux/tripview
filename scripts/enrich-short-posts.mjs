import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { MIN_INDEXABLE_BODY_LENGTH, postBodyLength } from "./lib/content-quality.mjs";
import {
  ENRICHMENT_VERSION,
  MIN_ENRICHED_BODY_LENGTH,
  enrichPost,
  hasInternalProductionCopy,
} from "./lib/post-enrichment.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const postsPath = join(root, "data", "generated-posts.json");
const reportsDir = join(root, "reports");
const logPath = join(reportsDir, "short-post-enrichment-log.json");
const limitValue = Number.parseInt(process.env.SHORT_POST_LIMIT || "300", 10);
const limit = Number.isFinite(limitValue) && limitValue > 0 ? limitValue : Number.POSITIVE_INFINITY;
const updatedAt = process.env.CONTENT_UPDATED_AT || new Date().toISOString().slice(0, 10);

function explicitTargets() {
  return String(process.env.SHORT_POST_TARGETS || "")
    .split(",")
    .map((slug) => slug.trim())
    .filter(Boolean);
}

const posts = JSON.parse(await readFile(postsPath, "utf8"));
const requested = explicitTargets();
const requestedSet = new Set(requested);
const candidates = posts
  .filter((post) => requested.length ? requestedSet.has(post.slug) : postBodyLength(post) < MIN_INDEXABLE_BODY_LENGTH)
  .slice(0, limit);
const candidateSet = new Set(candidates.map((post) => post.slug));
const updated = [];

const nextPosts = posts.map((post) => {
  if (!candidateSet.has(post.slug)) return post;
  const beforeLength = postBodyLength(post);
  const enriched = enrichPost(post, updatedAt);
  const afterLength = postBodyLength(enriched);
  if (afterLength < MIN_ENRICHED_BODY_LENGTH) {
    throw new Error(`${post.slug} enrichment is still too short: ${afterLength}`);
  }
  if (hasInternalProductionCopy(enriched)) {
    throw new Error(`${post.slug} contains internal production wording after enrichment.`);
  }
  updated.push({
    slug: post.slug,
    beforeTitle: post.title,
    afterTitle: enriched.title,
    beforeLength,
    afterLength,
  });
  return enriched;
});

await writeFile(postsPath, `${JSON.stringify(nextPosts, null, 2)}\n`, "utf8");
await mkdir(reportsDir, { recursive: true });
await writeFile(logPath, `${JSON.stringify({ version: ENRICHMENT_VERSION, updatedAt, updated }, null, 2)}\n`, "utf8");

if (updated.length && process.env.SKIP_ARTICLE_RENDER !== "1") {
  process.env.POST_RENDER_TARGETS = updated.map(({ slug }) => slug).join(",");
  await import(`${pathToFileURL(join(root, "scripts", "polish-contextual-copy.mjs")).href}?v=${Date.now()}`);
}

console.log(`Enriched and rendered ${updated.length} short post(s).`);
for (const item of updated.slice(0, 12)) {
  console.log(`${item.slug}: ${item.beforeLength} -> ${item.afterLength}`);
}
