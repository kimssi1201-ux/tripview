import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import {
  MAX_SCHEDULED_PUBLICATIONS_PER_DAY,
  publicationDateInKorea,
  publicationPost,
  selectScheduledPost,
  validateQueuedPost,
} from "../scripts/lib/scheduled-publishing.mjs";

const validPost = (slug = "travel-approved-sample") => ({
  slug,
  title: "운영 확인을 마친 여행 가이드 " + slug,
  category: "국내여행",
  region: "강원",
  image: "/assets/processed/verified-image.webp",
  editorialStatus: "reviewed",
  editorialReviewer: "트립뷰 편집팀",
  editorialReviewedAt: "2026-10-25",
  description: "출발 전 교통 정보와 운영 시간을 확인합니다.",
  sections: [
    ["이동 경로", ["운영처에서 확인한 대중교통 이동과 주차 동선을 정리했습니다. ".repeat(38)]],
    ["방문 준비", ["현장 운영 시간과 이용 조건을 방문 날짜에 다시 확인하세요. ".repeat(33)]],
  ],
});
const entry = (slug, date = "2026-10-27", props = {}) => ({
  publishDate: date, approved: true, post: validPost(slug), ...props,
});

test("one daily release uses Korean date even around UTC midnight", () => {
  assert.equal(MAX_SCHEDULED_PUBLICATIONS_PER_DAY, 1);
  assert.equal(publicationDateInKorea(new Date("2026-10-26T14:59:59Z")), "2026-10-26");
  assert.equal(publicationDateInKorea(new Date("2026-10-26T15:00:00Z")), "2026-10-27");
});

test("queue publishes first eligible approved reviewed post and never publishes two in one Korean day", () => {
  const invalid = entry("travel-needs-approval", "2026-10-20", { approved: false });
  const first = entry("travel-a", "2026-10-26");
  const second = entry("travel-b", "2026-10-27");
  const queue = [second, invalid, first];
  assert.equal(validateQueuedPost(invalid), "편집 승인 전");
  assert.equal(validateQueuedPost(first), "");
  const selected = selectScheduledPost({queue, date:"2026-10-27"});
  assert.equal(selected.entry.post.slug, "travel-a");
  const published = publicationPost(selected.entry, "2026-10-27");
  assert.equal(published.sortDate, "2026-10-27");
  assert.equal(published.renderManualPage, true);
  assert.equal(published.editorialStatus, "reviewed");
  assert.equal(selectScheduledPost({
    queue, archive:[published], published:[{slug:"travel-a", date:"2026-10-27"}], date:"2026-10-27",
  }).entry, null);
  assert.equal(selectScheduledPost({queue, existing:[validPost("travel-a")], date:"2026-10-27"}).entry.post.slug, "travel-b");
  assert.equal(selectScheduledPost({queue, date:"2026-10-25"}).entry, null);
});

test("missing image, short body, unreviewed content and duplicate slugs stay unpublished", () => {
  const missing = entry("travel-bad");missing.post.image = "";
  const short = entry("travel-short");short.post.sections = [["개요",["한 문장"]]];
  const pending = entry("travel-pending");pending.post.editorialStatus = "pending";
  assert.match(validateQueuedPost(missing), /썸네일/);
  assert.match(validateQueuedPost(short), /분량/);
  assert.match(validateQueuedPost(pending), /검수/);
  const existing = validPost("travel-duplicate");
  assert.equal(selectScheduledPost({
    queue:[missing,short,pending,entry(existing.slug)], existing:[existing], date:"2026-10-27",
  }).entry, null);
});

test("release CLI atomically stages one approved post with thumbnail checks and is idempotent", async () => {
  const root = await mkdtemp(join(tmpdir(),"tripview-schedule-"));
  const folder = join(root,"data");
  const assets = join(root,"assets","processed");
  try {
    await mkdir(folder,{recursive:true});
    await mkdir(assets,{recursive:true});
    const thumbnail = Buffer.alloc(160);
    thumbnail.write("RIFF", 0, "ascii");
    thumbnail.write("WEBP", 8, "ascii");
    await writeFile(join(assets,"verified-image.webp"),thumbnail);
    const queue = {
      timezone:"Asia/Seoul",
      posts:[entry("travel-reserved-first","2026-10-20"),entry("travel-reserved-second","2026-10-20")],
    };
    await writeFile(join(folder,"scheduled-posts.json"),JSON.stringify(queue));
    await writeFile(join(folder,"manual-posts-scheduled.json"),"[]");
    await writeFile(join(folder,"scheduled-publication-log.json"),'{"published":[]}');
    await writeFile(join(folder,"generated-posts.json"),"[]");
    const cli=resolve("scripts/publish-scheduled-post.mjs");
    const options={env:{...process.env,TRIPVIEW_SCHEDULE_ROOT:root},encoding:"utf8"};
    const first=execFileSync(process.execPath,[cli],options);
    assert.match(first,/승인 글 1개 준비/);
    const firstArchive=JSON.parse(await readFile(join(folder,"manual-posts-scheduled.json"),"utf8"));
    assert.equal(firstArchive.length,1);
    assert.equal(firstArchive[0].slug,"travel-reserved-first");
    const second=execFileSync(process.execPath,[cli],options);
    assert.match(second,/오늘 이미 예약 글 1개 발행됨/);
    assert.equal(JSON.parse(await readFile(join(folder,"manual-posts-scheduled.json"),"utf8")).length,1);
    assert.equal(JSON.parse(await readFile(join(folder,"scheduled-publication-log.json"),"utf8")).published.length,1);
  } finally {await rm(root,{recursive:true,force:true});}
});

test("scheduled GitHub Actions is the only scheduled article publisher", async () => {
  const [scheduled,legacy,dataposts]=await Promise.all([
    readFile(".github/workflows/daily-reviewed-publication.yml","utf8"),
    readFile(".github/workflows/daily-tour-posts.yml","utf8"),
    readFile(".github/workflows/data-post-pipeline.yml","utf8"),
  ]);
  assert.match(scheduled,/cron: "0 0 \* \* \*"/);
  assert.match(scheduled,/node scripts\/publish-scheduled-post\.mjs/);
  assert.match(scheduled,/steps\.release\.outputs\.count == '1'/);
  assert.doesNotMatch(legacy,/\n  schedule:/);
  assert.doesNotMatch(dataposts,/\n  schedule:/);
  assert.match(legacy,/POST_LIMIT: "1"/);
});
