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

test("risk check bundle preserves multiple persisted draft redline alerts exactly", async () => {
  const { assembleRiskCheckBundleView } = await import("../repositories/risk-checks.ts");

  const bundle = assembleRiskCheckBundleView({
    cardRow: makeCardRow({
      overall_alert: "high",
      redline_alerts: ["强监管领域 + 授权不明", "客户禁忌点与脚本目标冲突"],
    }),
    factRows: [],
    dimensionRows: [
      makeDimensionRow({
        dimension_key: "compliance",
        level: "high",
        evidence: "医疗品牌宣传且授权未说明",
      }),
    ],
  });

  assert.equal(bundle.card.overallAlert, "high");
  assert.deepEqual(bundle.redlineAlerts, ["强监管领域 + 授权不明", "客户禁忌点与脚本目标冲突"]);
});

test("risk check bundle maps regenerated upsert rows with cleared decision fields", async () => {
  const { assembleRiskCheckBundleView, RISK_CHECK_REGENERATE_DECISION_RESET_SQL } = await import("../repositories/risk-checks.ts");

  const bundle = assembleRiskCheckBundleView({
    cardRow: makeCardRow({
      status: "draft",
      human_decision: null,
      decision_reason: "",
      decided_by: null,
      decided_at: null,
    }),
    factRows: [],
    dimensionRows: [],
  });

  assert.equal(bundle.card.humanDecision, null);
  assert.equal(bundle.card.decisionReason, "");
  assert.equal(bundle.card.decidedBy, null);
  assert.equal(bundle.card.decidedAt, null);
  assert.match(RISK_CHECK_REGENERATE_DECISION_RESET_SQL, /human_decision = null/);
});

function makeCardRow(overrides = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    project_id: "00000000-0000-4000-8000-000000000002",
    status: "in_review",
    overall_alert: "redline",
    redline_alerts: [],
    human_decision: "accept",
    decision_reason: "已人工确认可推进",
    decided_by: "00000000-0000-4000-8000-000000000003",
    decided_at: "2026-06-26T10:00:00.000Z",
    source_artifact_id: null,
    created_by: null,
    created_at: "2026-06-26T09:00:00.000Z",
    updated_at: "2026-06-26T10:00:00.000Z",
    ...overrides,
  };
}

function makeDimensionRow(overrides = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000004",
    project_id: "00000000-0000-4000-8000-000000000002",
    card_id: "00000000-0000-4000-8000-000000000001",
    dimension_key: "schedule",
    level: "low",
    evidence: "交付周期 45 天",
    anchor_text: "",
    confidence: 0.9,
    created_by: null,
    created_at: "2026-06-26T09:00:00.000Z",
    updated_at: "2026-06-26T09:00:00.000Z",
    ...overrides,
  };
}
