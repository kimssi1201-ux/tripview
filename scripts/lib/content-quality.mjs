export const MIN_INDEXABLE_BODY_LENGTH = 1500;

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
  return Boolean(post.slug && post.title && postBodyLength(post) >= MIN_INDEXABLE_BODY_LENGTH);
}
