import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const TARGET = "전남광주통합특별시";
const FILES = [
  "data/generated-posts.json",
  "data/posts.json",
  "data/tour-posted.json"
];

const GWANGJU_DISTRICTS = ["광산구", "남구", "동구", "북구", "서구"];
const JEONNAM_LOCALITIES = [
  "목포시",
  "여수시",
  "순천시",
  "나주시",
  "광양시",
  "담양군",
  "곡성군",
  "구례군",
  "고흥군",
  "보성군",
  "화순군",
  "장흥군",
  "강진군",
  "해남군",
  "영암군",
  "무안군",
  "함평군",
  "영광군",
  "장성군",
  "완도군",
  "진도군",
  "신안군"
];

const SLUG_REGION_BASE = new Map([
  ["travel-2768883", "전라남도"],
  ["travel-130148", "전라남도"],
  ["travel-130810", "광주광역시"],
  ["travel-130811", "광주광역시"],
  ["travel-130835", "광주광역시"]
]);

function regionBaseForContext(context = "") {
  const slugMatch = context.match(/"slug"\s*:\s*"([^"]+)"/);
  if (slugMatch && SLUG_REGION_BASE.has(slugMatch[1])) {
    return SLUG_REGION_BASE.get(slugMatch[1]);
  }

  if (JEONNAM_LOCALITIES.some((name) => context.includes(`${TARGET} ${name}`) || context.includes(`${TARGET}${name}`))) {
    return "전라남도";
  }

  if (GWANGJU_DISTRICTS.some((name) => context.includes(`${TARGET} ${name}`) || context.includes(`${TARGET}${name}`))) {
    return "광주광역시";
  }

  return "전라남도";
}

function normalizeString(value, context) {
  if (!value.includes(TARGET)) return value;
  const base = regionBaseForContext(context || value);
  return value
    .replaceAll(`${TARGET} `, `${base} `)
    .replace(new RegExp(`${TARGET}(?=\\S)`, "g"), `${base} `)
    .replaceAll(TARGET, base)
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeNode(value, context = "") {
  if (typeof value === "string") return normalizeString(value, context);
  if (Array.isArray(value)) return value.map((item) => normalizeNode(item, context));
  if (!value || typeof value !== "object") return value;

  const objectContext = JSON.stringify(value);
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, normalizeNode(item, objectContext)])
  );
}

let totalReplacements = 0;

for (const file of FILES) {
  const filePath = path.join(ROOT, file);
  let before = "";
  try {
    before = await readFile(filePath, "utf8");
  } catch {
    continue;
  }

  const beforeCount = (before.match(new RegExp(TARGET, "g")) || []).length;
  if (!beforeCount) continue;

  const data = JSON.parse(before);
  const normalized = normalizeNode(data, before);
  const after = `${JSON.stringify(normalized, null, 2)}\n`;
  const afterCount = (after.match(new RegExp(TARGET, "g")) || []).length;
  const changed = beforeCount - afterCount;
  totalReplacements += changed;

  await writeFile(filePath, after, "utf8");
  console.log(`${file}: fixed ${changed} invalid region string(s).`);
}

console.log(`Fixed ${totalReplacements} invalid region string(s).`);
