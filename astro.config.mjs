import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://tripview.kr",
  output: "static",
  outDir: "./dist",
  publicDir: "./public",
  trailingSlash: "ignore",
  build: {
    format: "directory",
  },
});
