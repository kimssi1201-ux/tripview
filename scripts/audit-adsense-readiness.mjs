import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { allPosts, festivalStatus, isFestivalPost, officialLinks } from "../src/lib/content.mjs";
import { flattenPostSections, isIndexablePost, postBodyLength, requiresFreshEditorialReview } from "./lib/content-quality.mjs";

// Diagnostics only: human review is required before changing indexability.
const report = {
  generatedAt: new Date().toISOString(),
  totalArticles: allPosts.length,
  indexableArticles: 0,
  pendingEditorialReview: [],
  shortArticles: [],
  heldLegacySnapshots: [],
  possibleDuplicateBodies: [],
  indexableWithoutOfficialReferences: [],
  endedFestivalArticles: [],
  undatedFestivalArticles: [],
};
const seenBodies = new Map();
for (const post of allPosts) {
  if (requiresFreshEditorialReview(post)) report.heldLegacySnapshots.push(post.slug);
  if (post.editorialStatus !== "reviewed") report.pendingEditorialReview.push(post.slug);
  const length = postBodyLength(post);
  if (length < 1500) report.shortArticles.push({ slug: post.slug, length });
  if (!isIndexablePost(post)) continue;
  report.indexableArticles += 1;
  if (officialLinks(post).length === 0) report.indexableWithoutOfficialReferences.push(post.slug);
  const body = flattenPostSections(post.sections).replace(/\s+/g, " ").trim();
  if (body.length > 250) {
    const fingerprint = createHash("sha256").update(body).digest("hex");
    if (seenBodies.has(fingerprint)) report.possibleDuplicateBodies.push({ slug: post.slug, matches: seenBodies.get(fingerprint) });
    else seenBodies.set(fingerprint, post.slug);
  }
  if (isFestivalPost(post)) {
    const status = festivalStatus(post);
    if (status.ended) report.endedFestivalArticles.push(post.slug);
    if (!status.ended && !status.ongoing && !status.upcoming) report.undatedFestivalArticles.push(post.slug);
  }
}
await mkdir("reports", { recursive: true });
await writeFile("reports/adsense-readiness.json", JSON.stringify(report, null, 2) + "\n", "utf8");
for (const [key, value] of Object.entries(report)) {
  console.log(key + ": " + (Array.isArray(value) ? value.length : value));
}
console.log("Wrote reports/adsense-readiness.json (diagnostics only, no automatic noindex).");
