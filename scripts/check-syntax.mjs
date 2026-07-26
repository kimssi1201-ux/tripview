import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join, relative } from "node:path";

const roots = ["functions", "scripts", "assets"];
const extensions = new Set([".js", ".mjs"]);

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(path));
    else if (extensions.has(path.slice(path.lastIndexOf(".")))) files.push(path);
  }
  return files;
}

const files = [];
for (const root of roots) files.push(...await collectFiles(root));
const rootEntries = await readdir(".", { withFileTypes: true });
for (const entry of rootEntries) {
  if (entry.isFile() && extensions.has(entry.name.slice(entry.name.lastIndexOf(".")))) {
    files.push(entry.name);
  }
}

const failures = [];
for (const file of files.sort()) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    failures.push({ file, output: `${result.stdout || ""}${result.stderr || ""}`.trim() });
  }
}

if (failures.length) {
  for (const failure of failures) {
    console.error(`Syntax error in ${relative(process.cwd(), failure.file)}\n${failure.output}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Syntax check passed for ${files.length} JavaScript files.`);
}
