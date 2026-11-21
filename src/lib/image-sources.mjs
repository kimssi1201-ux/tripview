import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Published image sources: remote HTTP(S) images or files actually present
 * in the source tree. A stale processed-image manifest is not sufficient.
 */
export function isUsableImageSource(value = "", root = process.cwd()) {
  const src = String(value || "").trim();
  if (/^https?:\/\/[^\s]+$/i.test(src)) return true;
  if (!src.startsWith("/") || src.startsWith("//") || src.includes("\\")) return false;
  const pathname = src.split(/[?#]/, 1)[0];
  if (!/\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(pathname)) return false;
  let relative = "";
  try {
    relative = decodeURIComponent(pathname.slice(1));
  } catch {
    return false;
  }
  if (!relative || relative.split("/").some((part) => part === "." || part === "..")) return false;
  return existsSync(join(root, relative)) || existsSync(join(root, "public", relative));
}

export function isUsableImageAsset(asset, root = process.cwd()) {
  return Boolean(asset && isUsableImageSource(asset.src, root));
}

/**
 * Alternative photos must belong to the same article; a failed image must
 * never be silently replaced with an unrelated destination's picture.
 */
export function imageAlternativeSources(asset = {}, post = {}, root = process.cwd()) {
  const sources = [asset.original, post.image, ...(Array.isArray(post.images) ? post.images : [])];
  const unique = new Set([String(asset.src || "").trim()]);
  const alternatives = [];
  for (const item of sources) {
    const src = typeof item === "string" ? item.trim() : String(item?.src || "").trim();
    if (!src || unique.has(src) || !isUsableImageSource(src, root)) continue;
    unique.add(src);
    alternatives.push(src);
  }
  return alternatives;
}
