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
  assert.match(content, /合同模板版本：SOP4-五板块商务模板 v1/);
  assert.match(content, /一、工作量估算生成商务草稿/);
  assert.match(content, /二、报价编辑与甲方确认/);
  assert.match(content, /三、合同编辑和签署/);
  assert.match(content, /四、确认交付清单/);
  assert.match(content, /五、锁定/);
  assert.match(content, /交付范围：AIGC 视频创意、氛围图和主视觉生成/);
  assert.match(content, /付款条款：合同签署后支付 50%，验收后支付 50%。/);
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

test("saveContractInputSchema allows client-provided contracts to omit vendor template terms", async () => {
  const { saveContractInputSchema } = await import("./save-contract.ts");

  const parsed = saveContractInputSchema.parse({
    mode: "client_provided",
    title: "甲方采购合同",
    templateFields: {
      partyAName: "品牌甲方",
      partyBName: "跃然团队",
      projectName: "世界杯项目",
    },
    status: "confirmed",
    clientContractAssetId: "11111111-1111-4111-8111-111111111111",
  });

  assert.equal(parsed.mode, "client_provided");
  assert.equal(parsed.templateFields.deliveryScope, "");
  assert.equal(parsed.templateFields.paymentTerms, "");
  assert.equal(parsed.templateFields.effectiveDate, "");
});

test("vendor-provided contracts still require template business terms", async () => {
  const { saveContractInputSchema } = await import("./save-contract.ts");

  assert.throws(
    () =>
      saveContractInputSchema.parse({
        mode: "vendor_provided",
        title: "我方合同",
        templateFields: {
          partyAName: "品牌甲方",
          partyBName: "跃然团队",
          projectName: "世界杯项目",
        },
      }),
    /请输入交付范围|请输入付款条款|请输入合同生效日期/
  );
});

test("client-provided contract fallback content points to uploaded client file", async () => {
  const { buildPersistedContractContent } = await import("./save-contract.ts");

  const content = buildPersistedContractContent({
    mode: "client_provided",
    title: "甲方采购合同",
    fields: {
      partyAName: "品牌甲方",
      partyBName: "跃然团队",
      projectName: "世界杯项目",
      quoteTitle: "",
      quoteTotalAmount: 0,
      quoteCurrency: "CNY",
      deliveryScope: "",
      paymentTerms: "",
      effectiveDate: "",
    },
  });

  assert.match(content, /甲方上传的合同文件为准/);
  assert.doesNotMatch(content, /合同模板版本/);
});

test("saveProjectContract requires signed proof asset before signed status", async () => {
  const { saveProjectContract } = await import("./save-contract.ts");

  await assert.rejects(
    () =>
      saveProjectContract({
        projectId: "11111111-1111-4111-8111-111111111111",
        actorId: "22222222-2222-4222-8222-222222222222",
        mode: "client_provided",
        title: "甲方采购合同",
        status: "signed",
        templateFields: {
          partyAName: "品牌甲方",
          partyBName: "跃然团队",
          projectName: "世界杯项目",
          quoteTitle: "",
          quoteTotalAmount: 0,
          quoteCurrency: "CNY",
          deliveryScope: "",
          paymentTerms: "",
          effectiveDate: "",
        },
        clientContractAssetId: "33333333-3333-4333-8333-333333333333",
      }),
    (error) => error?.code === "contract_signed_proof_required"
  );
});
