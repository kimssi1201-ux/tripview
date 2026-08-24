import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { isIndexablePost } from "./lib/content-quality.mjs";
import {
  PROCESSED_TOUR_IMAGES_PATH,
  TOUR_IMAGE_CAPTION,
  TOUR_IMAGE_BANNER_CAPTION,
  isTourApiImage,
  readTourImageManifest,
  tourImageAssetsForPost,
} from "./lib/tour-image-assets.mjs";

const execFileAsync = promisify(execFile);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const POSTS_PATH = join(ROOT, "data", "generated-posts.json");
const ASSET_DIR = join(ROOT, "assets", "processed");
const CACHE_DIR = join(ROOT, ".cache", "tour-images");
const HELPER_PATH = join(ROOT, "scripts", "lib", "render_tour_image.py");
const PROCESSOR_VERSION = "no-overlay-poster-canvas-20260824";
const DOWNLOAD_TIMEOUT_MS = 12_000;
const FORCE = process.argv.includes("--force");
const LIMIT = Number.parseInt(process.env.TOUR_IMAGE_LIMIT || "", 10);

const REGION_SLUGS = new Map([
  ["서울", "seoul"],
  ["부산", "busan"],
  ["인천", "incheon"],
  ["대구", "daegu"],
  ["대전", "daejeon"],
  ["광주", "gwangju"],
  ["울산", "ulsan"],
  ["세종", "sejong"],
  ["제주", "jeju"],
  ["경기", "gyeonggi"],
  ["강원", "gangwon"],
  ["충북", "chungbuk"],
  ["충남", "chungnam"],
  ["전북", "jeonbuk"],
  ["전남", "jeonnam"],
  ["경북", "gyeongbuk"],
  ["경남", "gyeongnam"],
]);

const TERM_REPLACEMENTS = new Map([
  ["국가유산", "heritage"],
  ["문화유산", "heritage"],
  ["유네스코 세계유산", "unesco-heritage"],
  ["야행", "night-walk"],
  ["수국", "hydrangea"],
  ["해바라기", "sunflower"],
  ["어방", "eobang"],
  ["단오제", "danoje"],
  ["김밥", "gimbap"],
  ["갯벌", "tidal-flat"],
  ["송도스카이파크", "songdo-sky-park"],
  ["스카이파크", "sky-park"],
  ["한지체험박물관", "hanji-museum"],
  ["출렁다리", "suspension-bridge"],
  ["썸머워터 페스티벌", "summer-water-festival"],
  ["썸머워터페스티벌", "summer-water-festival"],
  ["페스티벌", "festival"],
  ["뮤지엄산", "museum-san"],
  ["도산서원", "dosanseowon"],
  ["김천포도", "gimcheon-grape"],
  ["구룡포과메기문화관", "guryongpo-gwamegi-museum"],
  ["경주 e스포츠 페스티벌", "gyeongju-esports-festival"],
  ["오감만족 문경새재 맨발페스티벌", "mungyeongsaejae-barefoot-festival"],
  ["왕산허위선생기념관", "wangsan-heowi-memorial"],
  ["콩세계과학관", "bean-world-science-museum"],
  ["어린이천문대", "children-observatory"],
  ["연꽃문화제", "lotus-festival"],
  ["하동케이블카", "hadong-cable-car"],
  ["통영한산대첩", "tongyeong-hansan-victory"],
  ["액티브파크 제주", "active-park-jeju"],
  ["빛의 벙커", "bunker-des-lumieres"],
  ["신재효판소리공원", "pansori-park"],
  ["신재효판소리박물관", "pansori-museum"],
  ["산림박물관", "forest-museum"],
  ["반디별 천문과학관", "starlight-observatory"],
  ["태권도원", "taekwondowon"],
  ["트레저헌터 in 진안", "treasure-hunter-jinan"],
  ["담빛예술창고", "dambit-art-warehouse"],
  ["곡성섬진강천문대", "seomjingang-observatory"],
  ["국립나주숲체원", "naju-forest-center"],
  ["땅끝송호해수욕장", "ttangkkeut-songho-beach"],
  ["영암곤충박물관", "yeongam-insect-museum"],
  ["국립어린이박물관", "national-children-museum"],
  ["우리동네 문화아지트", "local-culture-hub"],
  ["LH주택전시관", "lh-housing-exhibition"],
  ["복합문화행사", "culture-event"],
  ["K-일러스트레이션페어 마곡", "k-illustration-fair-magok"],
  ["가든 나이트 마켓", "garden-night-market"],
  ["광안리해수욕장", "gwangalli-beach"],
  ["해운대해수욕장", "haeundae-beach"],
  ["해운대시장", "haeundae-market"],
  ["반포한강공원", "banpo-hangang-park"],
  ["키자니아 서울", "kidzania-seoul"],
  ["환선굴", "hwanseongul"],
  ["삼척", "samcheok"],
  ["고흥", "goheung"],
  ["홍성", "hongseong"],
  ["괴산", "goesan"],
  ["옥천", "okcheon"],
  ["춘천", "chuncheon"],
  ["강릉", "gangneung"],
  ["횡성", "hoengseong"],
  ["김천", "gimcheon"],
  ["경주", "gyeongju"],
  ["영주", "yeongju"],
  ["성남", "seongnam"],
  ["하동", "hadong"],
  ["통영", "tongyeong"],
  ["고창", "gochang"],
  ["무주", "muju"],
  ["진안", "jinan"],
  ["담양", "damyang"],
  ["곡성", "gokseong"],
  ["나주", "naju"],
  ["영암", "yeongam"],
  ["마곡", "magok"],
  ["횡성호수길", "hoengseong-lake-road"],
  ["광안리", "gwangalli"],
  ["해운대", "haeundae"],
  ["한강", "hangang"],
  ["서울", "seoul"],
  ["부산", "busan"],
  ["인천", "incheon"],
  ["제주", "jeju"],
  ["강원", "gangwon"],
  ["경기", "gyeonggi"],
  ["경남", "gyeongnam"],
  ["경북", "gyeongbuk"],
  ["전남", "jeonnam"],
  ["전북", "jeonbuk"],
  ["충남", "chungnam"],
  ["충북", "chungbuk"],
  ["대구", "daegu"],
  ["대전", "daejeon"],
  ["광주", "gwangju"],
  ["울산", "ulsan"],
  ["세종", "sejong"],
  ["해수욕장", "beach"],
  ["해변", "beach"],
  ["계곡", "valley"],
  ["폭포", "waterfall"],
  ["호수", "lake"],
  ["공원", "park"],
  ["시장", "market"],
  ["축제", "festival"],
  ["박물관", "museum"],
  ["미술관", "museum"],
  ["과학관", "science-museum"],
  ["수목원", "arboretum"],
  ["정원", "garden"],
  ["동굴", "cave"],
  ["길", "trail"],
]);

const INITIALS = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"];
const VOWELS = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
const FINALS = ["", "k", "k", "ks", "n", "nj", "nh", "t", "l", "lk", "lm", "lb", "ls", "lt", "lp", "lh", "m", "p", "ps", "t", "t", "ng", "t", "t", "k", "t", "p", "t"];

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function normalizeText(value = "") {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function compactRegion(value = "") {
  const text = normalizeText(value).replace(/\([^)]*\)/g, "");
  if (!text) return "기타";
  if (text.includes("서울")) return "서울";
  if (text.includes("부산")) return "부산";
  if (text.includes("인천")) return "인천";
  if (text.includes("대구")) return "대구";
  if (text.includes("대전")) return "대전";
  if (text.includes("광주")) return "광주";
  if (text.includes("울산")) return "울산";
  if (text.includes("세종")) return "세종";
  if (text.includes("제주")) return "제주";
  if (text.includes("경기")) return "경기";
  if (text.includes("강원")) return "강원";
  if (text.includes("충북") || text.includes("충청북")) return "충북";
  if (text.includes("충남") || text.includes("충청남")) return "충남";
  if (text.includes("전북") || text.includes("전라북")) return "전북";
  if (text.includes("전남") || text.includes("전라남")) return "전남";
  if (text.includes("경북") || text.includes("경상북")) return "경북";
  if (text.includes("경남") || text.includes("경상남")) return "경남";
  return text.split(/\s+/)[0] || "기타";
}

function hangulToAscii(text = "") {
  let output = "";
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) {
      const value = code - 0xac00;
      const initial = Math.floor(value / 588);
      const vowel = Math.floor((value % 588) / 28);
      const final = value % 28;
      output += `${INITIALS[initial]}${VOWELS[vowel]}${FINALS[final]}`;
    } else if (/[\w]/.test(char)) {
      output += char;
    } else {
      output += "-";
    }
  }
  return output;
}

function semanticSlug(value = "") {
  let text = normalizeText(value)
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/2026|2025|\d+월|\d{1,2}~\d{1,2}일|\d+일|\d+구간|대표|이미지|방문|정보|체크|운영/g, " ");
  for (const [korean, english] of TERM_REPLACEMENTS) {
    text = text.replaceAll(korean, ` ${english} `);
  }
  return hangulToAscii(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(?:^|-)(?:si|gun|gu|do)(?=-|$)/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanPlaceName(post) {
  const title = normalizeText(post?.sourceTitle || post?.title || "");
  return title
    .replace(/\[[^\]]+\]/g, (match) => match.slice(1, -1))
    .replace(/\s*\d{4}.*$/g, "")
    .replace(/\s*(?:방문|운영정보|관람 정보|입장 정보).*$/g, "")
    .trim() || normalizeText(post?.title || "여행지");
}

function topicForPost(post) {
  const text = [post?.title, post?.sourceTitle, post?.category, post?.region, post?.excerpt, post?.description, ...(post?.keywords || [])]
    .filter(Boolean)
    .join(" ");
  const topics = [
    { pattern: /주차|차량|교통|동선|마감|대중교통/, label: "주차·동선", slug: "parking" },
    { pattern: /아이|가족|어린이|키즈|체험/, label: "아이와", slug: "family" },
    { pattern: /실내|박물관|미술관|전시|과학관|도서관|아쿠아리움/, label: "실내 코스", slug: "indoor" },
    { pattern: /축제|행사|페스티벌|공연|콘서트/, label: "축제 일정", slug: "festival" },
    { pattern: /해수욕장|해변|바다|물놀이|수영|계곡|워터|폭포|수변|호수/, label: "물놀이", slug: "water" },
    { pattern: /야경|드론|밤|노을/, label: "야경", slug: "night-view" },
    { pattern: /예약|입장권|티켓|요금/, label: "예약 체크", slug: "reservation" },
  ];
  return topics.find((topic) => topic.pattern.test(text)) || { label: "여행 포인트", slug: "travel" };
}

function fileBaseForPost(post, usedNames) {
  const region = locationSlug(post);
  let place = semanticSlug(cleanPlaceName(post)).split("-").filter(Boolean).slice(0, 5).join("-");
  if (region && place.startsWith(`${region}-`)) place = place.slice(region.length + 1);
  if (region && place === region) place = "";
  const topic = topicForPost(post).slug;
  const base = [region, place, topic].filter(Boolean).join("-") || semanticSlug(post?.slug || post?.title || "tripview-image");
  let candidate = base;
  let suffix = 2;
  while (usedNames.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  usedNames.add(candidate);
  return candidate;
}

function locationSlug(post) {
  const region = normalizeText(post?.region || "").replace(/\([^)]*\)/g, "");
  const parts = region.split(/\s+/).filter(Boolean);
  const first = parts[0] || compactRegion(region);
  const broad = compactRegion(first);
  const isMetro = ["서울", "부산", "인천", "대구", "대전", "광주", "울산", "세종", "제주"].includes(broad);
  const rawLocal = isMetro ? broad : (parts[1] || first);
  const local = rawLocal.replace(/특별자치도|특별자치시|특별시|광역시|자치도|도|시|군|구$/g, "");
  return semanticSlug(local) || REGION_SLUGS.get(compactRegion(region)) || semanticSlug(compactRegion(region));
}

function imageAlt(post, kind) {
  const region = compactRegion(post?.region);
  const place = cleanPlaceName(post);
  const topic = topicForPost(post).label;
  if (kind === "hub-banner") return `${region} ${place} ${topic} 정보를 담은 트립뷰 지역 허브 배너`;
  return `${region} ${place} 방문 동선을 참고할 수 있는 트립뷰 편집 이미지`;
}

function cachePathForSource(source) {
  const hash = createHash("sha1").update(source).digest("hex");
  let extension = ".jpg";
  try {
    extension = extname(new URL(source).pathname).toLowerCase() || extension;
  } catch {
    // keep default
  }
  return join(CACHE_DIR, `${hash}${extension}`);
}

function imageDimensionsFromBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24) return null;
  if (buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      if (offset + 4 >= buffer.length) break;
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (length < 2 || offset + 2 + length > buffer.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }
      offset += 2 + length;
    }
  }
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP" && buffer.length >= 30) {
    const chunk = buffer.toString("ascii", 12, 16);
    if (chunk === "VP8X" && buffer.length >= 30) {
      return {
        width: 1 + buffer.readUIntLE(24, 3),
        height: 1 + buffer.readUIntLE(27, 3),
      };
    }
    if (chunk === "VP8 " && buffer.length >= 30) {
      return {
        width: buffer.readUInt16LE(26) & 0x3fff,
        height: buffer.readUInt16LE(28) & 0x3fff,
      };
    }
    if (chunk === "VP8L" && buffer.length >= 25) {
      const b0 = buffer[21];
      const b1 = buffer[22];
      const b2 = buffer[23];
      const b3 = buffer[24];
      return {
        width: 1 + (((b1 & 0x3f) << 8) | b0),
        height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
      };
    }
  }
  return null;
}

async function cachedImageDimensions(source) {
  const cached = cachePathForSource(source);
  if (!await exists(cached)) return null;
  try {
    return imageDimensionsFromBuffer(await readFile(cached));
  } catch {
    return null;
  }
}

async function existingOutputDimensions(output) {
  try {
    return imageDimensionsFromBuffer(await readFile(output));
  } catch {
    return null;
  }
}

function dependencyPythonPath() {
  const dependencies = dirname(dirname(dirname(process.execPath)));
  return process.platform === "win32" ? join(dependencies, "python", "python.exe") : join(dependencies, "python", "bin", "python");
}

async function runnablePython(candidate) {
  if (!candidate) return false;
  try {
    await execFileAsync(candidate, ["-c", "from PIL import Image, features; assert features.check('webp')"], { windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

async function findPython() {
  const candidates = [
    process.env.PYTHON_BIN,
    process.env.PYTHON,
    dependencyPythonPath(),
    "python3",
    "python",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (await runnablePython(candidate)) return candidate;
  }
  return "";
}

async function downloadSource(source) {
  const target = cachePathForSource(source);
  const hasCachedSource = await exists(target);
  if (!FORCE && hasCachedSource) return target;
  await mkdir(CACHE_DIR, { recursive: true });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await fetch(source, {
      signal: controller.signal,
      headers: {
        "user-agent": "Tripview image processor (+https://tripview.kr)",
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    });
    if (!response.ok) throw new Error(`download failed ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) throw new Error("downloaded image is empty");
    await writeFile(target, buffer);
  } catch (error) {
    if (hasCachedSource) return target;
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  return target;
}

async function renderImage(python, payload) {
  await mkdir(CACHE_DIR, { recursive: true });
  const payloadPath = join(CACHE_DIR, `${createHash("sha1").update(`${payload.output}:${Date.now()}`).digest("hex")}.json`);
  await writeFile(payloadPath, `${JSON.stringify(payload)}\n`, "utf8");
  await execFileAsync(python, [HELPER_PATH, payloadPath], {
    windowsHide: true,
    maxBuffer: 1024 * 1024,
  });
}

async function processAsset({ python, post, source, kind, outputName, previous }) {
  const prior = tourImageAssetsForPost(previous, post)
    .find((asset) => asset.kind === kind && (asset.original === source || asset.src === `/assets/processed/${outputName}`));
  const publicPath = `/assets/processed/${outputName}`;
  const output = join(ASSET_DIR, outputName);
  const topic = topicForPost(post);
  const isBanner = kind === "hub-banner";
  const isCoverLike = kind === "cover" || isBanner;
  const width = isCoverLike ? 1200 : 1000;
  const height = kind === "cover" ? 750 : isBanner ? 675 : null;
  const asset = {
    kind,
    original: source,
    src: publicPath,
    alt: imageAlt(post, kind),
    caption: isBanner ? TOUR_IMAGE_BANNER_CAPTION : TOUR_IMAGE_CAPTION,
    width,
    height,
    processorVersion: PROCESSOR_VERSION,
    overlay: null,
  };

  const requiresVersionedRender = kind === "cover" || isBanner;
  const outputExists = await exists(output);
  const dimensions = isCoverLike ? await cachedImageDimensions(source) : null;
  const portraitSource = Boolean(dimensions && dimensions.height > dimensions.width);
  const renderedDimensions = outputExists && isCoverLike ? await existingOutputDimensions(output) : null;
  const outputMatchesTarget = Boolean(renderedDimensions && renderedDimensions.width === width && renderedDimensions.height === height);
  asset.posterCanvas = portraitSource;
  if (!FORCE && outputExists && (!requiresVersionedRender || prior?.processorVersion === PROCESSOR_VERSION || outputMatchesTarget || !portraitSource)) {
    return { ...asset, bytes: null };
  }

  try {
    const cachedSource = await downloadSource(source);
    await mkdir(ASSET_DIR, { recursive: true });
    await renderImage(python, {
      source: cachedSource,
      output,
      kind,
      width,
      height,
      quality: isCoverLike ? 84 : 82,
    });
    return asset;
  } catch (error) {
    if (prior?.src && await exists(join(ROOT, prior.src.replace(/^\//, "")))) {
      console.warn(`Keeping cached processed image for ${post.slug}: ${source} (${error.message})`);
      return prior;
    }
    console.warn(`Skipping image for ${post.slug}: ${source} (${error.message})`);
    return null;
  }
}

async function main() {
  const posts = JSON.parse(await readFile(POSTS_PATH, "utf8"));
  const targets = posts.filter(isIndexablePost);
  const selected = Number.isFinite(LIMIT) && LIMIT > 0 ? targets.slice(0, LIMIT) : targets;
  const previous = await readTourImageManifest(ROOT, { items: {} });
  const python = await findPython();
  if (!python) {
    const previousCount = Object.keys(previous?.items || {}).length;
    if (previousCount) {
      console.warn(`Python with Pillow was not found. Keeping ${previousCount} cached processed tour image set(s).`);
      return;
    }
    throw new Error("Python with Pillow and WebP support is required to process tour images.");
  }

  const items = {};
  const usedNames = new Set();
  let processed = 0;
  let skipped = 0;

  for (const post of selected) {
    const sources = [...new Set([post.image, ...(Array.isArray(post.images) ? post.images : [])].filter(isTourApiImage))];
    if (!post?.slug || !sources.length) continue;
    const base = fileBaseForPost(post, usedNames);
    const coverSource = sources.includes(post.image) ? post.image : sources[0];
    const cover = await processAsset({
      python,
      post,
      source: coverSource,
      kind: "cover",
      outputName: `${base}.webp`,
      previous,
    });
    if (!cover) {
      skipped += 1;
      continue;
    }
    const banner = await processAsset({
      python,
      post,
      source: coverSource,
      kind: "hub-banner",
      outputName: `${base}-banner.webp`,
      previous,
    });
    const images = [];
    let detailIndex = 1;
    for (const source of sources) {
      if (source === coverSource) continue;
      const detail = await processAsset({
        python,
        post,
        source,
        kind: "inline",
        outputName: `${base}-detail-${detailIndex}.webp`,
        previous,
      });
      detailIndex += 1;
      if (detail) images.push(detail);
    }
    items[post.slug] = {
      title: post.title,
      sourceTitle: post.sourceTitle || "",
      region: compactRegion(post.region),
      source: "한국관광공사 공공누리",
      cover,
      banner,
      images,
    };
    processed += 1;
    if (processed % 10 === 0) console.log(`Processed tour images: ${processed}/${selected.length}`);
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: "한국관광공사 공공누리",
    assetBasePath: "/assets/processed/",
    items,
  };
  await writeFile(join(ROOT, PROCESSED_TOUR_IMAGES_PATH), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Processed tour images for ${processed} post(s).${skipped ? ` Skipped ${skipped}.` : ""}`);
}

await main();
