import assert from "node:assert/strict";
import test from "node:test";

test("workflow modules match confirmed SOP boundaries", async () => {
  const { workflowModules, stageStepLabels } = await import("./stage-machine.ts");

  assert.equal(workflowModules.length, 6);
  assert.deepEqual(workflowModules, [
    {
      key: "brief_and_risk_decision",
      label: "功能模块一：Brief 与风险决策",
      detail: "覆盖资料进入、Brief 结构化、缺失信息澄清、接单风险评估和人工接单决策。",
      stages: ["brand_requirement_intake", "technical_feasibility"],
    },
    {
      key: "creative_visual_proposal_and_signing",
      label: "功能模块二：创意视觉提案与签约",
      detail: "覆盖两轮创意视觉提案、脚本方案和视觉风格确认、结构化工作量估算、报价合同、交付清单和签约。",
      stages: ["creative_direction_proposal", "selection_quote_contract"],
    },
    {
      key: "script_entity_storyboard_confirmation",
      label: "功能模块三：脚本设定与文字分镜确认",
      detail: "签约后确认最终脚本、人物设定、场景设定和文字分镜，锁定后进入图片生产。",
      stages: ["script_storyboard_confirmation"],
    },
    {
      key: "storyboard_image_batches",
      label: "功能模块四：分镜图片生产与全量审核",
      detail: "逐分镜生成候选图片池，不限轮次全量提交甲方逐镜审核，并保存批次和版本快照。",
      stages: ["storyboard_image_canvas"],
    },
    {
      key: "ai_video_production",
      label: "功能模块五：AI 视频生产与导演下发",
      detail: "支持单图、首尾帧、多图参考生成视频候选，按场次下发给导演外部剪辑。",
      stages: ["ai_video_canvas"],
    },
    {
      key: "post_production_delivery_archive",
      label: "功能模块六：成片审核、定稿与归档",
      detail: "覆盖 A-copy 多轮修改、B-copy 定稿确认、交付清单核对、结算交付和完整归档。",
      stages: ["a_copy_revision", "b_copy_final_confirmation", "settlement_delivery_archive"],
    },
  ]);

  assert.equal(stageStepLabels.brand_requirement_intake, "Brief 收集与需求结构化");
  assert.equal(stageStepLabels.technical_feasibility, "接单风险评估");
  assert.equal(stageStepLabels.creative_direction_proposal, "两轮创意视觉提案");
  assert.equal(stageStepLabels.selection_quote_contract, "工作量估算、报价合同与交付清单");
  assert.equal(stageStepLabels.script_storyboard_confirmation, "脚本、人物场景设定与文字分镜确认");
  assert.equal(stageStepLabels.storyboard_image_canvas, "分镜图片生产与全量审核");
  assert.equal(stageStepLabels.ai_video_canvas, "AI 视频生成与导演下发");
  assert.equal(stageStepLabels.a_copy_revision, "A-copy 生成与多轮修改");
  assert.equal(stageStepLabels.b_copy_final_confirmation, "B-copy 定稿确认与交付清单核对");
  assert.equal(stageStepLabels.settlement_delivery_archive, "结算交付与完整归档");
});
