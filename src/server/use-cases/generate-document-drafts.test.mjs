import test from "node:test";
import assert from "node:assert/strict";

test("normalizeDocumentDraftBundle turns model JSON into savable proposal quote and contract drafts", async () => {
  const { normalizeDocumentDraftBundle } = await import("./generate-document-drafts.ts");

  const draft = normalizeDocumentDraftBundle(
    {
      proposal: {
        title: "耐克世界杯 AIGC 视频提案",
        content:
          "本提案建议围绕世界杯训练场景展开，以写实广告片质感和三维产品细节表现运动员速度、爆发力和品牌精神，并保留授权、交付规格和修改轮次待确认事项。",
      },
      quote: {
        title: "耐克世界杯 AIGC 视频服务报价",
        currency: "cny",
        items: [
          { name: "创意深化", description: "故事大纲与提案整理", quantity: 1, unitPrice: 12000 },
          { name: "氛围图生成", description: "关键视觉方向", quantity: 3, unitPrice: 3000 },
        ],
        notes: "含两轮内部修改，外部发送前需确认授权边界。",
      },
      contract: {
        title: "耐克世界杯 AIGC 视频服务合同",
        templateFields: {
          partyAName: "耐克中国",
          partyBName: "跃然团队",
          projectName: "耐克 世界杯",
          deliveryScope: "交付创意提案、氛围图和 AIGC 视频生成资产。",
          paymentTerms: "合同签署后支付 50%，验收后支付 50%。",
          effectiveDate: "2026-06-24",
        },
        content: "",
      },
    },
    {
      project: {
        id: "project-1",
        brandName: "耐克",
        projectName: "世界杯",
        currentStage: "selection_quote_contract",
        ownerName: "商务负责人",
        dueDate: null,
        status: "in_progress",
        updatedAt: "2026-06-24T00:00:00.000Z",
      },
      structuredRequirements: [],
      assetAnalyses: [],
      creativeDirections: [
        {
          id: "direction-1",
          title: "训练场觉醒",
          coreIdea: "以写实训练场与三维产品特写串联品牌精神",
          fitReason: "贴合世界杯传播节点",
        },
      ],
      creativeExpansions: [],
    },
    new Date("2026-06-24T00:00:00.000Z")
  );

  assert.equal(draft.proposal.status, "draft");
  assert.match(draft.proposal.content, /授权/);
  assert.equal(draft.quote.currency, "CNY");
  assert.equal(draft.quote.items.length, 2);
  assert.equal(draft.contract.templateFields.quoteTotalAmount, 21000);
  assert.equal(draft.contract.templateFields.effectiveDate, "2026-06-24");
  assert.equal(draft.contract.templateFields.partyAName, "耐克中国");
});

test("normalizeDocumentDraftBundle rejects drafts without quote items", async () => {
  const { normalizeDocumentDraftBundle } = await import("./generate-document-drafts.ts");

  assert.throws(
    () =>
      normalizeDocumentDraftBundle(
        {
          proposal: { title: "提案", content: "这是一份足够长度的提案草稿内容，用于测试失败路径。" },
          quote: { title: "报价", currency: "CNY", items: [], notes: "" },
          contract: { title: "合同", templateFields: {}, content: "" },
        },
        {
          project: {
            id: "project-1",
            brandName: "耐克",
            projectName: "世界杯",
            currentStage: "selection_quote_contract",
            ownerName: "商务负责人",
            dueDate: null,
            status: "in_progress",
            updatedAt: "2026-06-24T00:00:00.000Z",
          },
          structuredRequirements: [],
          assetAnalyses: [],
          creativeDirections: [],
          creativeExpansions: [],
        },
        new Date("2026-06-24T00:00:00.000Z")
      ),
    /模型没有返回可保存的报价明细/
  );
});

test("document draft prompt helpers include workload estimate and delivery checklist", async () => {
  const { formatWorkloadEstimateForPrompt, formatDeliveryChecklistForPrompt } = await import("./generate-document-drafts.ts");

  const workloadText = formatWorkloadEstimateForPrompt({
    id: "estimate-1",
    projectId: "project-1",
    status: "draft",
    roleCount: 3,
    sceneCount: 8,
    shotCount: 90,
    imageCount: 180,
    videoCount: 90,
    revisionRounds: 3,
    deliverableVersions: ["横版", "竖版", "无字幕版"],
    complexity: "high",
    priceRange: { minCny: 50000, maxCny: 80000 },
    rationale: "角色多，镜头量高。",
    riskNotes: "周期需要客户快速确认。",
    sourceRoundId: null,
    sourceJobId: null,
    updatedAt: "2026-06-24T00:00:00.000Z",
  });
  const checklistText = formatDeliveryChecklistForPrompt({
    id: "checklist-1",
    projectId: "project-1",
    estimateId: "estimate-1",
    status: "draft",
    version: 1,
    notes: "签约前确认。",
    confirmedBy: null,
    confirmedAt: null,
    updatedAt: "2026-06-24T00:00:00.000Z",
    items: [
      {
        id: "item-1",
        projectId: "project-1",
        checklistId: "checklist-1",
        itemKind: "horizontal_final",
        title: "横版成片",
        description: "最终确认版视频。",
        quantity: 1,
        status: "planned",
        changeRequestId: null,
        sortOrder: 0,
        metadata: {},
        updatedAt: "2026-06-24T00:00:00.000Z",
      },
    ],
  });

  assert.match(workloadText, /镜头 90/);
  assert.match(workloadText, /CNY 50000 - CNY 80000/);
  assert.match(checklistText, /横版成片/);
  assert.match(checklistText, /签约前确认/);
});
