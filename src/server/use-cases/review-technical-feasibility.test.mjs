import assert from "node:assert/strict";
import test from "node:test";

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

test("technical feasibility approve action is the only forward decision", async () => {
  const { technicalFeasibilityActionSchema, mapTechnicalFeasibilityStageProgress } = await import("./review-technical-feasibility.ts");

  assert.deepEqual(technicalFeasibilityActionSchema.options, ["request_revision", "approve"]);

  const result = mapTechnicalFeasibilityStageProgress({
    action: "approve",
    reason: "风险可接受",
    nextStep: "",
  });

  assert.equal(result.stageStatus, "approved");
  assert.equal(result.currentStage, "creative_direction_proposal");
  assert.equal(result.projectStatus, "in_progress");
  assert.match(result.userMessage, /项目可继续推进创意方向提案/);
});
