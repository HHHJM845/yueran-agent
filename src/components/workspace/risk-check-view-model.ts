import type {
  RiskCheckBundleView,
  RiskCheckCardView,
  RiskCheckDimensionView,
  RiskCheckFactView,
} from "@/components/workspace/api";

export type RiskIssueTone = "danger" | "warning" | "neutral";

export type RiskIssueView = {
  key: string;
  title: string;
  levelLabel: string;
  reason: string;
  tone: RiskIssueTone;
};

const dimensionTitleMap: Record<string, { high: string; medium: string }> = {
  requirement_completeness: {
    high: "需求完整度不足",
    medium: "需求完整度待确认",
  },
  material_readiness: {
    high: "素材可用性不足",
    medium: "素材可用性待确认",
  },
  creative_expression: {
    high: "创意表达风险偏高",
    medium: "创意表达待确认",
  },
  production_complexity: {
    high: "生产复杂度偏高",
    medium: "生产复杂度待确认",
  },
  compliance_delivery: {
    high: "合规与交付风险偏高",
    medium: "合规与交付待确认",
  },
  decision_chain: {
    high: "需求链路风险偏高",
    medium: "需求链路待确认",
  },
  compliance: {
    high: "合规与交付风险偏高",
    medium: "合规与交付待确认",
  },
  visual_reproduction: {
    high: "视觉还原风险偏高",
    medium: "视觉还原待确认",
  },
  commercial: {
    high: "预算商务风险偏高",
    medium: "预算商务待确认",
  },
  schedule: {
    high: "周期排期风险偏高",
    medium: "周期排期待确认",
  },
};

const dimensionFallbackLabels: Record<string, string> = {
  requirement_completeness: "需求完整度",
  material_readiness: "素材可用性",
  creative_expression: "创意表达",
  production_complexity: "生产复杂度",
  compliance_delivery: "合规与交付",
  decision_chain: "需求链路",
  compliance: "合规与交付",
  visual_reproduction: "视觉还原",
  commercial: "预算商务",
  schedule: "周期排期",
};

const dimensionPriority: Record<RiskCheckDimensionView["level"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function buildRiskIssues(riskCheck: RiskCheckBundleView | null): RiskIssueView[] {
  if (!riskCheck) return [];

  const issues: RiskIssueView[] = [];
  const usedSemanticKeys = new Set<string>();

  for (const alert of riskCheck.redlineAlerts ?? []) {
    const message = compactReason(alert, "命中红线风险，需要人工确认是否继续承接。");
    if (!message) continue;
    issues.push({
      key: `redline-${issues.length}`,
      title: "红线告警",
      levelLabel: "红线",
      reason: message,
      tone: "danger",
    });
    if (issues.length >= 5) return issues.slice(0, 5);
  }

  const rankedDimensions = (riskCheck.dimensions ?? [])
    .map((dimension, index) => ({ dimension, index }))
    .filter(({ dimension }) => dimension.level !== "low")
    .sort((a, b) => {
      const levelDelta = dimensionPriority[a.dimension.level] - dimensionPriority[b.dimension.level];
      return levelDelta !== 0 ? levelDelta : a.index - b.index;
    })
    .map(({ dimension }) => dimension);

  for (const dimension of rankedDimensions) {
    const item = buildDimensionIssue(dimension);
    if (!item || usedSemanticKeys.has(dimension.dimensionKey)) continue;
    usedSemanticKeys.add(dimension.dimensionKey);
    issues.push(item);
    if (issues.length >= 5) return issues.slice(0, 5);
  }

  for (const fact of riskCheck.facts ?? []) {
    const item = buildFactIssue(fact, usedSemanticKeys);
    if (!item) continue;
    usedSemanticKeys.add(fact.fieldKey);
    issues.push(item);
    if (issues.length >= 5) return issues.slice(0, 5);
  }

  if (issues.length === 0) {
    return [
      {
        key: "no-blocking-risk",
        title: "当前没有明确阻塞点",
        levelLabel: "可确认",
        reason: "仍建议人工确认后推进。",
        tone: "neutral",
      },
    ];
  }

  return issues.slice(0, 5);
}

export function getRiskPanelSummary(riskCheck: RiskCheckBundleView | null): string {
  if (!riskCheck) return "当前还没有生成接单风险评估，请先补齐 Brief 和资料。";
  if (riskCheck.card.overallAlert === "redline") {
    return "当前命中红线风险，请先确认是否具备继续承接条件。";
  }
  if (riskCheck.card.overallAlert === "high") {
    return "当前主要卡点集中在授权、预算、交付规格等落地条件。";
  }
  if (riskCheck.card.overallAlert === "medium") {
    return "当前存在需要人工确认的风险点，建议先补齐关键信息。";
  }
  return "当前没有明显阻塞，但仍建议核对关键资料后再推进。";
}

export function getRiskDecisionStateLabel(
  card: RiskCheckCardView | null,
  technicalStatus?: string | null
): string {
  if (!card) return "待生成";
  if (card.humanDecision === "accept") return "已通过";
  if (card.humanDecision === "reject") {
    if (technicalStatus === "blocked") return "已阻塞";
    if (technicalStatus === "needs_revision") return "已退回补资料";
    return "已拒绝";
  }

  if (technicalStatus === "blocked") return "已阻塞";
  if (technicalStatus === "needs_revision") return "待补资料";
  if (card.status === "in_review") return "待人工判断";
  if (card.status === "draft") return "待生成";
  if (card.status === "approved") return "已通过";
  return "待人工判断";
}

function buildDimensionIssue(dimension: RiskCheckDimensionView): RiskIssueView | null {
  const levelLabel = dimension.level === "high" ? "高" : "中";
  if (dimension.level === "low") return null;

  const titleGroup = dimensionTitleMap[dimension.dimensionKey];
  const titleKey: "high" | "medium" = dimension.level;
  const title = titleGroup?.[titleKey] ?? `${dimensionFallbackLabels[dimension.dimensionKey] ?? dimension.dimensionKey}待确认`;
  const reason = compactReason(dimension.evidence || dimension.anchorText, "需要人工确认该维度的影响范围。");
  return {
    key: `dimension-${dimension.dimensionKey}`,
    title,
    levelLabel,
    reason,
    tone: dimension.level === "high" ? "danger" : "warning",
  };
}

function buildFactIssue(fact: RiskCheckFactView, usedSemanticKeys: Set<string>): RiskIssueView | null {
  if (usedSemanticKeys.has(fact.fieldKey)) return null;
  const confidence = Number.isFinite(fact.confidence) ? fact.confidence : 0;
  const valueText = normalizeText(String(fact.value ?? ""));
  const evidenceText = normalizeText(fact.evidence);
  if (confidence >= 0.6 && valueText && valueText !== "未说明" && evidenceText) return null;
  if (!valueText && !evidenceText) return null;

  return {
    key: `fact-${fact.fieldKey}`,
    title: `${fact.fieldLabel}待确认`,
    levelLabel: "待确认",
    reason: compactReason(evidenceText || valueText, "该信息仍需人工补充。"),
    tone: "warning",
  };
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function compactReason(value: string | null | undefined, fallback: string): string {
  const normalized = normalizeText(value).replace(/\s+/g, " ") || fallback;
  return normalized.length > 72 ? `${normalized.slice(0, 70)}…` : normalized;
}
