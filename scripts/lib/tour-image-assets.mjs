import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const PROCESSED_TOUR_IMAGES_PATH = "data/processed-tour-images.json";
export const TOUR_IMAGE_SOURCE_LABEL = "한국관광공사 공공누리";
export const TOUR_IMAGE_BANNER_CAPTION = `출처: ${TOUR_IMAGE_SOURCE_LABEL} · 트립뷰 편집 배너`;
export const TOUR_IMAGE_CAPTION = `출처: ${TOUR_IMAGE_SOURCE_LABEL} · 트립뷰 편집 이미지`;

export async function readTourImageManifest(root, fallback = { items: {} }) {
  try {
    const manifest = JSON.parse(await readFile(join(root, PROCESSED_TOUR_IMAGES_PATH), "utf8"));
    return manifest && typeof manifest === "object" ? manifest : fallback;
  } catch {
    return fallback;
  }
}

export function isTourApiImage(value = "") {
  try {
    const url = new URL(String(value || ""));
    const host = url.hostname.toLowerCase();
    return host === "tong.visitkorea.or.kr" || host.endsWith(".visitkorea.or.kr");
  } catch {
    return false;
  }
}

export function tourImageEntry(manifest, post) {
  const slug = post?.slug || "";
  const items = manifest?.items && typeof manifest.items === "object" ? manifest.items : {};
  return items[slug] || null;
}

export function tourImageAssetsForPost(manifest, post) {
  const entry = tourImageEntry(manifest, post);
  if (!entry) return [];
  return [entry.cover, entry.banner, ...(Array.isArray(entry.images) ? entry.images : [])].filter((asset) => asset?.src);
}

export function tourImageAssetForSource(manifest, post, source = "") {
  const value = String(source || "");
  if (!value) return null;
  return tourImageAssetsForPost(manifest, post).find((asset) => asset.original === value || asset.src === value) || null;
}

export function postImageWithProcessed(manifest, post) {
  const cover = tourImageEntry(manifest, post)?.cover?.src;
  return cover || [post?.image, ...(Array.isArray(post?.images) ? post.images : [])].find(Boolean) || "";
}

export function tourImageBannerAssetForPost(manifest, post) {
  return tourImageEntry(manifest, post)?.banner || null;
}

export function postImagesWithProcessed(manifest, post) {
  const originals = [post?.image, ...(Array.isArray(post?.images) ? post.images : [])].filter(Boolean);
  const mapped = originals.map((source) => tourImageAssetForSource(manifest, post, source)?.src || source);
  return [...new Set(mapped)];
}

export function tourImageAlt(asset, post) {
  return asset?.alt || post?.alt || post?.title || "트립뷰 여행 이미지";
}

export function tourImageCaption(asset) {
  return asset?.caption || (asset?.kind === "hub-banner" ? TOUR_IMAGE_BANNER_CAPTION : TOUR_IMAGE_CAPTION);
}
