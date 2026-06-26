import test from "node:test";
import assert from "node:assert/strict";

test("mapCommercialStageProgress marks rejected quote as needs revision with reason", async () => {
  const { mapCommercialStageProgress } = await import("./review-commercial-document.ts");

  const stage = mapCommercialStageProgress({
    documentType: "quote",
    action: "request_revision",
    status: "needs_revision",
    title: "世界杯报价",
    reason: "请补充第三轮修改费用。",
  });

  assert.equal(stage.stageStatus, "needs_revision");
  assert.equal(stage.projectStatus, "needs_revision");
  assert.match(stage.userMessage, /第三轮修改费用/);
});

test("mapCommercialStageProgress marks signed contract as completed and advances to script confirmation", async () => {
  const { mapCommercialStageProgress } = await import("./review-commercial-document.ts");

  const stage = mapCommercialStageProgress({
    documentType: "contract",
    action: "mark_signed",
    status: "signed",
    title: "世界杯合同",
    reason: "",
  });

  assert.equal(stage.stageStatus, "completed");
  assert.equal(stage.projectStatus, "in_progress");
  assert.equal(stage.currentStage, "script_storyboard_confirmation");
  assert.match(stage.userMessage, /文字分镜确认/);
});

test("commercialReviewActionLabel covers all commercial review actions", async () => {
  const { commercialReviewActionLabel } = await import("./review-commercial-document.ts");

  assert.equal(commercialReviewActionLabel("submit_review"), "提交审核");
  assert.equal(commercialReviewActionLabel("approve"), "审核确认");
  assert.equal(commercialReviewActionLabel("request_revision"), "驳回修改");
  assert.equal(commercialReviewActionLabel("mark_sent"), "标记已发送");
  assert.equal(commercialReviewActionLabel("mark_signed"), "标记已签署");
  assert.equal(commercialReviewActionLabel("terminate"), "终止");
});
