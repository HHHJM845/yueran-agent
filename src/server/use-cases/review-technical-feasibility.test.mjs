import assert from "node:assert/strict";
import test from "node:test";

test("technical feasibility blocked action keeps project in blocked technical stage", async () => {
  const { mapTechnicalFeasibilityStageProgress } = await import("./review-technical-feasibility.ts");

  const result = mapTechnicalFeasibilityStageProgress({
    action: "mark_blocked",
    reason: "客户要求超出当前可交付边界",
    nextStep: "管理员复核后调整交付规格",
  });

  assert.equal(result.stageStatus, "blocked");
  assert.equal(result.currentStage, "technical_feasibility");
  assert.equal(result.projectStatus, "blocked");
  assert.match(result.userMessage, /客户要求超出当前可交付边界/);
});

test("technical feasibility revision action routes back to requirement intake", async () => {
  const { mapTechnicalFeasibilityStageProgress } = await import("./review-technical-feasibility.ts");

  const result = mapTechnicalFeasibilityStageProgress({
    action: "request_revision",
    reason: "缺少预算与交付规格",
    nextStep: "",
  });

  assert.equal(result.stageStatus, "needs_revision");
  assert.equal(result.currentStage, "brand_requirement_intake");
  assert.equal(result.projectStatus, "needs_revision");
  assert.match(result.errorMessage, /缺少预算与交付规格/);
});
