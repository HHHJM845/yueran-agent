import test from "node:test";
import assert from "node:assert/strict";

test("buildContractContent fills template fields and quote total", async () => {
  const { buildContractContent } = await import("./save-contract.ts");

  const content = buildContractContent({
    title: "耐克世界杯 AIGC 视频合同",
    partyAName: "耐克中国",
    partyBName: "跃然团队",
    projectName: "世界杯",
    quoteTitle: "耐克世界杯 AIGC 视频报价",
    quoteTotalAmount: 54000,
    quoteCurrency: "CNY",
    deliveryScope: "AIGC 视频创意、氛围图和主视觉生成",
    paymentTerms: "合同签署后支付 50%，验收后支付 50%。",
    effectiveDate: "2026-06-24",
  });

  assert.match(content, /耐克中国/);
  assert.match(content, /跃然团队/);
  assert.match(content, /CNY 54,000/);
  assert.match(content, /AIGC 视频创意/);
});

test("buildContractSnapshotData captures versioned contract content", async () => {
  const { buildContractSnapshotData } = await import("./save-contract.ts");

  const snapshot = buildContractSnapshotData({
    contractId: "contract-1",
    title: "耐克世界杯 AIGC 视频合同",
    templateKey: "default_aigc_video_contract",
    templateFields: { partyAName: "耐克中国", partyBName: "跃然团队" },
    content: "合同正文内容，用于测试历史快照摘要是否短于正文，并保留完整正文。",
    status: "waiting_review",
    version: 2,
  });

  assert.equal(snapshot.contractId, "contract-1");
  assert.equal(snapshot.version, 2);
  assert.equal(snapshot.status, "waiting_review");
  assert.equal(snapshot.templateFields.partyAName, "耐克中国");
  assert.ok(snapshot.content.length > snapshot.summary.length);
});

test("buildContractStageProgressInput advances signed contracts into script confirmation", async () => {
  const { buildContractStageProgressInput } = await import("./save-contract.ts");

  const progress = buildContractStageProgressInput({
    projectId: "project-1",
    contractId: "contract-1",
    snapshotId: "snapshot-1",
    artifactId: "artifact-1",
    artifactKind: "contract",
    status: "signed",
    version: 3,
  });

  assert.equal(progress.currentStage, "script_storyboard_confirmation");
  assert.equal(progress.stageKey, "selection_quote_contract");
  assert.equal(progress.status, "completed");
  assert.equal(progress.projectStatus, "in_progress");
  assert.equal(progress.title, "报价与签约已完成");
  assert.match(progress.userMessage, /脚本/);
  assert.match(progress.userMessage, /人物/);
  assert.match(progress.userMessage, /场景设定/);
  assert.match(progress.userMessage, /文字分镜确认/);
  assert.deepEqual(progress.snapshot, {
    contractId: "contract-1",
    snapshotId: "snapshot-1",
    status: "signed",
    version: 3,
  });
});
