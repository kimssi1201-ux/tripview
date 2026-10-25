export const MIN_INDEXABLE_BODY_LENGTH = 1500;
export const REVIEWED_STATUS = "reviewed";

// These legacy pages are dated snapshot feeds, not independently maintained
// travel guides. Hold them for human verification while preserving their URLs.
// This is an editorial policy, not a claim that AdSense requires noindex.
export const LEGACY_SNAPSHOT_SLUG_PATTERN = /^data-(?:stay-price|ticket-price|stay-ticket|festival-schedule)-/;

export function requiresFreshEditorialReview(post = {}) {
  return LEGACY_SNAPSHOT_SLUG_PATTERN.test(String(post.slug || ""));
}

function text(value) {
  return String(value ?? "").trim();
}

export function flattenPostSections(sections) {
  if (!Array.isArray(sections)) return "";
  return sections
    .flatMap((section) => {
      if (!Array.isArray(section)) return [];
      const [, body] = section;
      if (Array.isArray(body)) return body;
      return body ? [body] : [];
    })
    .map(text)
    .join(" ");
}

export function postBodyLength(post = {}) {
  return [
    post.description,
    post.excerpt,
    flattenPostSections(post.sections),
    Array.isArray(post.memo) ? post.memo.join(" ") : "",
  ].map(text).filter(Boolean).join(" ").length;
}

export function isIndexablePost(post = {}) {
  return Boolean(
    post.slug &&
    !requiresFreshEditorialReview(post) &&
    post.title &&
    post.editorialStatus === REVIEWED_STATUS &&
    postBodyLength(post) >= MIN_INDEXABLE_BODY_LENGTH
  );
}
