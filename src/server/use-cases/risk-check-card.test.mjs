import assert from "node:assert/strict";
import test from "node:test";

test("normalizeRiskCheckModelOutput preserves evidence and redline", async () => {
  const { normalizeRiskCheckModelOutput } = await import("./risk-check-card.ts");
  const draft = normalizeRiskCheckModelOutput({
    facts: {
      roleCount: { value: 3, evidence: "三位主角", confidence: 0.9 },
      industry: { value: "医疗", evidence: "用于医疗品牌宣传", confidence: 0.92 },
      authorization: { value: "未说明", evidence: "", confidence: 0.2 },
    },
    dimensions: [
      { key: "compliance", level: "high", evidence: "医疗品牌宣传且授权未说明", confidence: 0.8 },
      { key: "schedule", level: "low", evidence: "交付周期 45 天", confidence: 0.9 },
    ],
    redlineAlerts: ["强监管领域 + 授权不明"],
  });

  assert.equal(draft.overallAlert, "redline");
  assert.equal(draft.facts[0].fieldKey, "roleCount");
  assert.equal(draft.dimensions.find((item) => item.dimensionKey === "compliance").level, "high");
});

test("normalizeRiskCheckModelOutput falls back to medium and defaults missing evidence/confidence", async () => {
  const { normalizeRiskCheckModelOutput } = await import("./risk-check-card.ts");
  const draft = normalizeRiskCheckModelOutput({
    facts: {
      deliverables: { value: ["KV", "15s 视频"] },
    },
    dimensions: [{ key: "resource", level: "medium" }, { key: "schedule", level: "low", evidence: "档期偏紧" }],
  });

  assert.equal(draft.overallAlert, "medium");
  assert.deepEqual(draft.facts[0], {
    fieldKey: "deliverables",
    fieldLabel: "deliverables",
    value: ["KV", "15s 视频"],
    evidence: "",
    confidence: 0,
  });
  assert.deepEqual(draft.dimensions.find((item) => item.dimensionKey === "resource"), {
    dimensionKey: "resource",
    level: "medium",
    evidence: "",
    anchorText: "",
    confidence: 0,
  });
});

test("regenerating a draft clears prior human decision fields in conflict update sql", async () => {
  const { RISK_CHECK_REGENERATE_DECISION_RESET_SQL } = await import("../repositories/risk-checks.ts");

  assert.match(RISK_CHECK_REGENERATE_DECISION_RESET_SQL, /human_decision = null/);
  assert.match(RISK_CHECK_REGENERATE_DECISION_RESET_SQL, /decision_reason = ''/);
  assert.match(RISK_CHECK_REGENERATE_DECISION_RESET_SQL, /decided_by = null/);
  assert.match(RISK_CHECK_REGENERATE_DECISION_RESET_SQL, /decided_at = null/);
});
