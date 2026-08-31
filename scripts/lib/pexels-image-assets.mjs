import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const PEXELS_IMAGE_MANIFEST_PATH = "data/pexels-images.json";
export const PEXELS_SOURCE_LABEL = "Pexels 무료 사진";
export const PEXELS_PROVIDER_URL = "https://www.pexels.com/";

export async function readPexelsImageManifest(root, fallback = { source: "pexels", items: {} }) {
  try {
    const manifest = JSON.parse(await readFile(join(root, PEXELS_IMAGE_MANIFEST_PATH), "utf8"));
    return manifest && typeof manifest === "object" && manifest.items && typeof manifest.items === "object"
      ? manifest
      : fallback;
  } catch {
    return fallback;
  }
}

export function isPexelsImage(value = "") {
  try {
    const url = new URL(String(value || ""));
    const host = url.hostname.toLowerCase();
    return host === "images.pexels.com" || host === "www.pexels.com" || host.endsWith(".pexels.com");
  } catch {
    return false;
  }
}

export function pexelsImageEntry(manifest, post) {
  const slug = post?.slug || "";
  const items = manifest?.items && typeof manifest.items === "object" ? manifest.items : {};
  return items[slug] || null;
}

export function pexelsCoverAssetForPost(manifest, post) {
  const entry = pexelsImageEntry(manifest, post);
  return entry?.cover?.src ? entry.cover : Array.isArray(entry?.images) ? entry.images.find((asset) => asset?.src) || null : null;
}

export function pexelsImageAssetsForPost(manifest, post) {
  const entry = pexelsImageEntry(manifest, post);
  const assets = [entry?.cover, ...(Array.isArray(entry?.images) ? entry.images : [])].filter((asset) => asset?.src);
  const seen = new Set();
  return assets.filter((asset) => {
    const key = String(asset.id || asset.src || asset.original || "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function pexelsImageAssetForSource(manifest, post, source = "") {
  const value = String(source || "");
  if (!value) return null;
  return pexelsImageAssetsForPost(manifest, post).find((asset) => (
    asset.src === value || asset.original === value || asset.url === value
  )) || null;
}

export function pexelsImageAlt(asset, post) {
  return asset?.alt || post?.alt || post?.title || "트립뷰 여행 참고 이미지";
}

export function pexelsImageCaption(asset) {
  const photographer = String(asset?.photographer || "").trim();
  return photographer ? `출처: Pexels · 사진: ${photographer}` : "출처: Pexels";
}
