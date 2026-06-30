import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRiskIssues,
  getRiskDecisionStateLabel,
  getRiskPanelSummary,
} from "./risk-check-view-model.ts";

function makeRiskCheck(overrides = {}) {
  return {
    card: {
      id: "risk-card-1",
      projectId: "project-1",
      status: "in_review",
      overallAlert: "high",
      humanDecision: null,
      decisionReason: "",
      decidedBy: null,
      decidedAt: null,
      sourceArtifactId: null,
      createdBy: null,
      createdAt: "2026-06-30T00:00:00.000Z",
      updatedAt: "2026-06-30T00:00:00.000Z",
      ...(overrides.card ?? {}),
    },
    redlineAlerts: overrides.redlineAlerts ?? [],
    dimensions: overrides.dimensions ?? [],
    facts: overrides.facts ?? [],
  };
}

function dimension(key, level, evidence, confidence = 0.8) {
  return {
    id: `dimension-${key}`,
    projectId: "project-1",
    cardId: "risk-card-1",
    dimensionKey: key,
    level,
    evidence,
    anchorText: `${key} anchor`,
    confidence,
    createdBy: null,
    createdAt: "2026-06-30T00:00:00.000Z",
    updatedAt: "2026-06-30T00:00:00.000Z",
  };
}

function fact(key, label, value, evidence, confidence) {
  return {
    id: `fact-${key}`,
    projectId: "project-1",
    cardId: "risk-card-1",
    fieldKey: key,
    fieldLabel: label,
    value,
    evidence,
    confidence,
    createdBy: null,
    createdAt: "2026-06-30T00:00:00.000Z",
    updatedAt: "2026-06-30T00:00:00.000Z",
  };
}

test("buildRiskIssues prioritizes redlines, high risk, medium risk, and fact gaps with max five items", () => {
  const issues = buildRiskIssues(
    makeRiskCheck({
      redlineAlerts: ["世界杯官方 Logo 授权边界未确认。"],
      dimensions: [
        dimension("compliance_delivery", "high", "合规与交付条件存在明显缺口。"),
        dimension("material_readiness", "high", "素材授权和清晰度未确认。"),
        dimension("requirement_completeness", "medium", "预算和投放渠道仍需确认。"),
        dimension("production_complexity", "medium", "写实质感和特效强度需要提前锁定。"),
        dimension("creative_expression", "low", "表达目标基本清楚。"),
      ],
      facts: [
        fact("paymentTerms", "付款条件", "未说明", "", 0),
        fact("sceneCount", "场景数", "未说明", "", 0),
        fact("authorization", "授权情况", "待人工确认", "Logo 相关授权待确认。", 0.52),
      ],
    })
  );

  assert.equal(issues.length, 5);
  assert.deepEqual(
    issues.map((issue) => issue.title),
    ["红线告警", "合规与交付风险偏高", "素材可用性不足", "需求完整度待确认", "生产复杂度待确认"]
  );
  assert.equal(issues[0].tone, "danger");
  assert.equal(issues[0].levelLabel, "红线");
  assert.match(issues[1].reason, /合规与交付条件/);
  assert.doesNotMatch(issues.map((issue) => issue.title).join("、"), /付款条件/);
});

test("buildRiskIssues falls back to a single empty-state issue when no risk is found", () => {
  const issues = buildRiskIssues(
    makeRiskCheck({
      card: { overallAlert: "low" },
      dimensions: [dimension("creative_expression", "low", "创意表达风险可控。")],
      facts: [fact("authorization", "授权情况", "已说明", "授权齐全。", 0.9)],
    })
  );

  assert.deepEqual(issues, [
    {
      key: "no-blocking-risk",
      title: "当前没有明确阻塞点",
      levelLabel: "可确认",
      reason: "仍建议人工确认后推进。",
      tone: "neutral",
    },
  ]);
});

test("buildRiskIssues skips fact rows that duplicate an already surfaced dimension key", () => {
  const issues = buildRiskIssues(
    makeRiskCheck({
      dimensions: [dimension("material_readiness", "high", "素材授权和清晰度未确认。")],
      facts: [fact("material_readiness", "素材可用性", "待人工确认", "素材还未就绪。", 0.2)],
    })
  );

  assert.equal(issues.length, 1);
  assert.deepEqual(issues.map((issue) => issue.key), ["dimension-material_readiness"]);
  assert.doesNotMatch(issues.map((issue) => issue.title).join("、"), /素材可用性待确认/);
});

test("risk panel summary and decision labels stay concise", () => {
  assert.equal(
    getRiskPanelSummary(makeRiskCheck({ card: { overallAlert: "redline" } })),
    "当前命中红线风险，请先确认是否具备继续承接条件。"
  );
  assert.equal(
    getRiskPanelSummary(makeRiskCheck({ card: { overallAlert: "high" } })),
    "当前主要卡点集中在授权、预算、交付规格等落地条件。"
  );
  assert.equal(getRiskDecisionStateLabel(null), "待生成");
  assert.equal(getRiskDecisionStateLabel(makeRiskCheck().card, "in_progress"), "待人工判断");
  assert.equal(getRiskDecisionStateLabel(makeRiskCheck({ card: { humanDecision: "accept" } }).card), "已通过");
  assert.equal(getRiskDecisionStateLabel(makeRiskCheck({ card: { humanDecision: "reject" } }).card, "blocked"), "已阻塞");
  assert.equal(getRiskDecisionStateLabel(makeRiskCheck({ card: { humanDecision: "reject" } }).card, "needs_revision"), "已退回补资料");
});
