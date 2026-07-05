import test from "node:test";
import assert from "node:assert/strict";

const fiveSectionTitles = [
  "一、工作量估算生成商务草稿",
  "二、报价编辑与甲方确认",
  "三、合同编辑和签署",
  "四、确认交付清单",
  "五、锁定",
];

test("buildSop4ContractTemplateContent renders a five-section contract template from quote fields", async () => {
  const { buildSop4ContractTemplateContent } = await import("./contract-template.ts");

  const content = buildSop4ContractTemplateContent({
    title: "耐克世界杯 AIGC 视频服务合同",
    partyAName: "耐克中国",
    partyBName: "跃然团队",
    projectName: "世界杯 AIGC 视频",
    quoteTitle: "耐克世界杯 AIGC 视频报价",
    quoteTotalAmount: 54000,
    quoteCurrency: "CNY",
    deliveryScope: "AIGC 视频创意、氛围图和主视觉生成",
    paymentTerms: "合同签署后支付 50%，验收后支付 50%。",
    effectiveDate: "2026-06-24",
  });

  for (const title of fiveSectionTitles) {
    assert.match(content, new RegExp(title));
  }

  assert.match(content, /合同模板版本：SOP4-五板块商务模板 v1/);
  assert.match(content, /甲方：耐克中国/);
  assert.match(content, /乙方：跃然团队/);
  assert.match(content, /项目名称：世界杯 AIGC 视频/);
  assert.match(content, /关联报价：耐克世界杯 AIGC 视频报价/);
  assert.match(content, /报价金额：CNY 54,000/);
  assert.match(content, /交付范围：AIGC 视频创意、氛围图和主视觉生成/);
  assert.match(content, /付款条款：合同签署后支付 50%，验收后支付 50%。/);
  assert.match(content, /生效日期：2026-06-24/);
});

test("buildSop4ContractTemplateOutline returns the same five business sections", async () => {
  const { buildSop4ContractTemplateOutline } = await import("./contract-template.ts");

  const outline = buildSop4ContractTemplateOutline("甲方合同模板.docx");

  assert.deepEqual(outline.map((item) => item.title), [
    "工作量估算生成商务草稿",
    "报价编辑与甲方确认",
    "合同编辑和签署",
    "确认交付清单",
    "锁定",
  ]);
  assert.match(outline[0].detail, /甲方合同模板\.docx/);
  assert.match(outline[2].detail, /合同主体/);
  assert.match(outline[4].detail, /脚本、人物场景和文字分镜/);
});
