import { open, readFile, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  publicationDateInKorea, publicationPost, selectScheduledPost,
} from "./lib/scheduled-publishing.mjs";

const root = resolve(process.env.TRIPVIEW_SCHEDULE_ROOT || dirname(dirname(fileURLToPath(import.meta.url))));
const queueFile = join(root, "data/scheduled-posts.json");
const outputFile = join(root, "data/manual-posts-scheduled.json");
const logFile = join(root, "data/scheduled-publication-log.json");
const currentPostsFile = join(root, "data/generated-posts.json");

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}
async function writeJson(path, data) {
  await writeFile(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}
async function reportCount(count) {
  if (process.env.GITHUB_OUTPUT) {
    await import("node:fs/promises").then(({appendFile}) => appendFile(process.env.GITHUB_OUTPUT, "count=" + count + "\n", "utf8"));
  }
}

// Local thumbnails must be actual image files. Never accept a placeholder SVG.
// For remote images check a real image response instead of trusting a URL string.
async function validThumbnail(src) {
  if (typeof src !== "string" || !src.trim()) return false;
  if (/^https:\/\//i.test(src)) {
    try {
      const response = await fetch(src, {
        method: "GET",
        headers: {Range: "bytes=0-63", Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif"},
        signal: AbortSignal.timeout(12000),
        redirect: "follow",
      });
      const type = String(response.headers.get("content-type") || "").toLowerCase();
      await response.body?.cancel();
      return response.ok && /^image\/(jpeg|png|webp|avif|gif)(;|$)/.test(type);
    } catch { return false; }
  }
  if (!src.startsWith("/") || src.includes("..") || !/^\/assets\/.+\.(?:jpe?g|png|webp|avif|gif)$/i.test(src)) return false;
  const relative = src.replace(/^\//, "");
  const candidates = [join(root, relative), join(root, "public", relative)];
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    const file = await stat(candidate);
    if (!file.isFile() || file.size < 64) continue;
    const handle = await open(candidate, "r");
    const header = Buffer.alloc(16);
    try { await handle.read(header, 0, 16, 0); }
    finally { await handle.close(); }
    if (header.subarray(0, 3).toString("hex") === "ffd8ff" ||
        header.subarray(0, 8).toString("hex") === "89504e470d0a1a0a" ||
        (header.toString("ascii", 0, 4) === "RIFF" && header.toString("ascii", 8, 12) === "WEBP") ||
        header.toString("ascii", 0, 4) === "GIF8" ||
        header.toString("ascii", 4, 12).includes("ftypavif")) return true;
  }
  return false;
}

const today = publicationDateInKorea(new Date());
const [queueDoc, archive, logDoc, existing] = await Promise.all([
  readJson(queueFile, {timezone: "Asia/Seoul", posts: []}),
  readJson(outputFile, []),
  readJson(logFile, {published: []}),
  readJson(currentPostsFile, []),
]);
if (queueDoc.timezone !== "Asia/Seoul" || !Array.isArray(queueDoc.posts)) throw new Error("예약 목록의 timezone/posts 형식이 잘못됐습니다");
if (!Array.isArray(archive) || !Array.isArray(logDoc.published) || !Array.isArray(existing)) throw new Error("예약 기록 데이터 형식이 잘못됐습니다");
const chosen = selectScheduledPost({queue: queueDoc.posts, archive, published: logDoc.published, existing, date: today});

if (!chosen.entry) {
  console.log("[예약 발행] " + chosen.reason + " (" + today + "). 기존 글은 변경하지 않습니다.");
  await reportCount(0);
} else if (!await validThumbnail(chosen.entry.post.image)) {
  console.warn("[예약 발행 보류] 대표 이미지가 없거나 확인할 수 없습니다: " + chosen.entry.post.slug);
  await reportCount(0);
} else {
  const post = publicationPost(chosen.entry, today);
  const timestamp = new Date().toISOString();
  const nextPosts = queueDoc.posts.map((entry, i) => i === chosen.index
    ? {...entry, status:"published", publishedAt: timestamp}
    : entry);
  await writeJson(outputFile, [...archive, post]);
  await writeJson(queueFile, {...queueDoc, posts: nextPosts});
  await writeJson(logFile, {...logDoc, published: [...logDoc.published, {slug: post.slug, date:today, publishedAt:timestamp}]});
  console.log("[예약 발행] 한국시간 " + today + " 승인 글 1개 준비: " + post.slug);
  await reportCount(1);
}
