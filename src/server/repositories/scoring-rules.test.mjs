import test from "node:test";
import assert from "node:assert/strict";

test("getNextScoringRuleVersion starts at one and increments existing versions", async () => {
  const { getNextScoringRuleVersion } = await import("./scoring-rules.ts");

  assert.equal(getNextScoringRuleVersion(null), 1);
  assert.equal(getNextScoringRuleVersion(1), 2);
  assert.equal(getNextScoringRuleVersion(8), 9);
});

test("buildScoringRuleVersionSnapshot captures the complete immutable rule evidence", async () => {
  const { buildScoringRuleVersionSnapshot } = await import("./scoring-rules.ts");

  const snapshot = buildScoringRuleVersionSnapshot({
    id: "rule-1",
    tag: "写实运动",
    weight: "1.75",
    description: "适合强调真实运动质感的项目",
    positive_examples: ["真实材质", "自然光"],
    negative_examples: ["卡通渲染"],
    is_active: true,
    version: 4,
    updated_at: "2026-06-24T00:00:00.000Z",
  });

  assert.deepEqual(snapshot, {
    ruleId: "rule-1",
    version: 4,
    tag: "写实运动",
    weight: 1.75,
    description: "适合强调真实运动质感的项目",
    positiveExamples: ["真实材质", "自然光"],
    negativeExamples: ["卡通渲染"],
    isActive: true,
  });
});
