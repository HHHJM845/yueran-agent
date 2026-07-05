import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./workspace-shell.tsx", import.meta.url), "utf8");

test("change request panel is mounted at project workspace level", () => {
  const stageAreaIndex = source.search(/<div className="workspace-main-area"[^>]*>/);
  const firstPanelIndex = source.indexOf("<ChangeRequestsPanel", stageAreaIndex);
  const stageAreaEndIndex = source.indexOf("\n      </div>\n    </div>\n  );\n}\n\nfunction StagePanel", stageAreaIndex);

  assert.notEqual(firstPanelIndex, -1);
  assert.ok(firstPanelIndex > stageAreaIndex);
  assert.ok(firstPanelIndex < stageAreaEndIndex);
  assert.ok(source.slice(firstPanelIndex, stageAreaEndIndex).includes("selectedStage={selectedStage}"));
});

test("review cut stage does not own a separate change request panel", () => {
  const reviewCutFunctionIndex = source.indexOf("function ReviewCutStageModule");
  const feedbackFunctionIndex = source.indexOf("function Feedback", reviewCutFunctionIndex);
  const reviewCutSource = source.slice(reviewCutFunctionIndex, feedbackFunctionIndex);

  assert.equal(reviewCutSource.includes("<ChangeRequestsPanel"), false);
});

test("A-copy review cut stage is reduced to director upload, internal note, review, and B-copy handoff", () => {
  const reviewCutFunctionIndex = source.indexOf("function ReviewCutStageModule");
  const feedbackFunctionIndex = source.indexOf("function Feedback", reviewCutFunctionIndex);
  const reviewCutSource = source.slice(reviewCutFunctionIndex, feedbackFunctionIndex);

  assert.match(reviewCutSource, /导演上传视频/);
  assert.match(reviewCutSource, /内部说明/);
  assert.match(reviewCutSource, /上传并保存 A copy/);
  assert.match(reviewCutSource, /内部审核通过/);
  assert.match(reviewCutSource, /进入 B Copy/);
  assert.match(reviewCutSource, /甲方时间戳回传[\s\S]*进入 B Copy/);
  assert.doesNotMatch(reviewCutSource, /导演素材入口/);
  assert.doesNotMatch(reviewCutSource, /选择已上传成片资产/);
  assert.doesNotMatch(reviewCutSource, /本地\/临时视频播放链接/);
  assert.doesNotMatch(reviewCutSource, /一键下载全部/);
});

test("A-copy upload shows explicit OSS upload progress and timeout handling", () => {
  const reviewCutFunctionIndex = source.indexOf("function ReviewCutStageModule");
  const feedbackFunctionIndex = source.indexOf("function Feedback", reviewCutFunctionIndex);
  const reviewCutSource = source.slice(reviewCutFunctionIndex, feedbackFunctionIndex);

  assert.match(reviewCutSource, /reviewCutUploadLabel/);
  assert.match(reviewCutSource, /uploadReviewCutVideoWithTimeout/);
  assert.match(reviewCutSource, /成片视频上传 OSS 超时/);
});

test("review cut upload is proxied through the backend and B-copy can advance to archive", () => {
  const reviewCutFunctionIndex = source.indexOf("function ReviewCutStageModule");
  const feedbackFunctionIndex = source.indexOf("function Feedback", reviewCutFunctionIndex);
  const reviewCutSource = source.slice(reviewCutFunctionIndex, feedbackFunctionIndex);

  assert.match(reviewCutSource, /uploadReviewCutVideo/);
  assert.doesNotMatch(reviewCutSource, /createUploadUrl/);
  assert.doesNotMatch(reviewCutSource, /registerUploadedAsset/);
  assert.match(reviewCutSource, /进入完整归档/);
  assert.match(reviewCutSource, /advanceBCopyToArchive/);
  assert.doesNotMatch(reviewCutSource, /BcopyDeliveryChecklistPanel/);
});

test("workspace polls and refreshes when external client reviews are submitted", () => {
  assert.match(source, /refreshExternalClientReviewUpdates/);
  assert.match(source, /refreshWorkspace\(selectedProjectId\)/);
  assert.match(source, /window\.setInterval/);
  assert.match(source, /document\.addEventListener\("visibilitychange"/);
  assert.match(source, /window\.addEventListener\("focus"/);
  assert.match(source, /refreshDashboard\(\)/);
});

test("workspace actively refreshes while project AI jobs are running", () => {
  assert.match(source, /hasRunningWorkspaceJobs/);
  assert.match(source, /refreshRunningWorkspaceJobs/);
  assert.match(source, /selectedWorkspaceData\?\.jobs/);
  assert.match(source, /job\.status === "queued" \|\| job\.status === "processing" \|\| job\.status === "retrying"/);
  assert.match(source, /window\.setInterval[\s\S]*?3_000/);
  assert.match(source, /refreshWorkspace\(selectedProjectId\)/);
});
