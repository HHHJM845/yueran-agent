import assert from "node:assert/strict";
import test from "node:test";

test("creative direction rejected action moves proposal stage to needs_revision", async () => {
  const { mapCreativeDirectionStageProgress } = await import("./review-creative-direction.ts");

  const result = mapCreativeDirectionStageProgress({
    action: "request_revision",
    title: "世界级绿茵主场",
    reason: "风险提示不足，需要补充技术替代方案",
  });

  assert.equal(result.stageStatus, "needs_revision");
  assert.equal(result.projectStatus, "needs_revision");
  assert.match(result.userMessage, /世界级绿茵主场/);
  assert.match(result.errorMessage, /风险提示不足/);
});

test("creative direction resubmit action waits for admin review", async () => {
  const { mapCreativeDirectionStageProgress } = await import("./review-creative-direction.ts");

  const result = mapCreativeDirectionStageProgress({
    action: "submit_review",
    title: "世界级绿茵主场",
    reason: "",
  });

  assert.equal(result.stageStatus, "waiting_review");
  assert.equal(result.projectStatus, "waiting_review");
  assert.match(result.userMessage, /提交审核/);
});
