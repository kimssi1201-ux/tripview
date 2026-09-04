import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const astroPackagePath = require.resolve("astro/package.json");
const astroBin = join(dirname(astroPackagePath), "astro.js");

if (!existsSync(astroBin)) {
  console.error(`Astro CLI was not found at ${astroBin}. Run npm install before building.`);
  process.exit(1);
}

const result = spawnSync(process.execPath, [astroBin, "build"], {
  stdio: "inherit",
  env: {
    ...process.env,
    ASTRO_TELEMETRY_DISABLED: "1",
  },
});

process.exit(result.status ?? 1);
