import assert from "node:assert/strict";
import test from "node:test";

test("workflow modules match confirmed SOP boundaries", async () => {
  const { workflowModules, stageStepLabels } = await import("./stage-machine.ts");

  assert.equal(workflowModules.length, 6);
  assert.equal(workflowModules[0].label, "功能模块一：Brief 与风险决策");
  assert.deepEqual(workflowModules[0].stages, ["brand_requirement_intake", "technical_feasibility"]);
  assert.equal(workflowModules[1].label, "功能模块二：创意视觉提案与签约");
  assert.deepEqual(workflowModules[1].stages, ["creative_direction_proposal", "selection_quote_contract"]);
  assert.equal(stageStepLabels.technical_feasibility, "风险体检卡");
  assert.equal(stageStepLabels.creative_direction_proposal, "两轮创意视觉提案");
  assert.equal(stageStepLabels.selection_quote_contract, "工作量估算、报价合同与交付清单");
});
