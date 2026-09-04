import { spawnSync } from "node:child_process";

const steps = [
  ["merge-manual-posts.mjs", "수동 글 병합"],
  ["apply-editorial-review.mjs", "편집 검수 메타 적용"],
  ["fix-invalid-regions.mjs", "지역값 정규화"],
  ["fetch-pexels-images.mjs", "Pexels 이미지 manifest 갱신"],
  ["process-tour-images.mjs", "한국관광공사 이미지 가공"],
  ["fetch-myrealtrip-accommodations.mjs", "마이리얼트립 숙소 데이터 갱신"],
];

for (const [script, label] of steps) {
  console.log(`[prepare:data] ${label}`);
  const result = spawnSync(process.execPath, [`scripts/${script}`], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    process.exitCode = result.status || 1;
    break;
  }
}
