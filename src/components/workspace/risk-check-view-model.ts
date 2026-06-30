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
};

const dimensionFallbackLabels: Record<string, string> = {
  requirement_completeness: "需求完整度",
  material_readiness: "素材可用性",
  creative_expression: "创意表达",
  production_complexity: "生产复杂度",
  compliance_delivery: "合规与交付",
};

const dimensionPriority: Record<RiskCheckDimensionView["level"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function buildRiskIssues(riskCheck: RiskCheckBundleView | null): RiskIssueView[] {
  if (!riskCheck) return [];

  const issues: RiskIssueView[] = [];
  const usedDimensionKeys = new Set<string>();

  for (const alert of riskCheck.redlineAlerts ?? []) {
    const message = normalizeText(alert);
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

  const rankedDimensions = [...(riskCheck.dimensions ?? [])]
    .filter((dimension) => dimension.level !== "low")
    .sort((a, b) => {
      const levelDelta = dimensionPriority[a.level] - dimensionPriority[b.level];
      if (levelDelta !== 0) return levelDelta;
      return b.confidence - a.confidence;
    });

  for (const dimension of rankedDimensions) {
    const item = buildDimensionIssue(dimension);
    if (!item || usedDimensionKeys.has(dimension.dimensionKey)) continue;
    usedDimensionKeys.add(dimension.dimensionKey);
    issues.push(item);
    if (issues.length >= 5) return issues.slice(0, 5);
  }

  for (const fact of riskCheck.facts ?? []) {
    const item = buildFactIssue(fact);
    if (!item) continue;
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
  if (!riskCheck) return "当前还没有生成风险体检卡，请先补齐 Brief 和资料。";
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
  const titleGroup = dimensionTitleMap[dimension.dimensionKey];
  const levelLabel = dimension.level === "high" ? "高" : "中";
  const title = titleGroup?.[dimension.level] ?? `${dimensionFallbackLabels[dimension.dimensionKey] ?? dimension.dimensionKey}待确认`;
  const reason = normalizeText(dimension.evidence) || normalizeText(dimension.anchorText) || "需要人工确认该维度的影响范围。";

  if (dimension.level === "low" && !titleGroup) return null;
  return {
    key: `dimension-${dimension.dimensionKey}`,
    title,
    levelLabel,
    reason,
    tone: dimension.level === "high" ? "danger" : "warning",
  };
}

function buildFactIssue(fact: RiskCheckFactView): RiskIssueView | null {
  const confidence = Number.isFinite(fact.confidence) ? fact.confidence : 0;
  const valueText = normalizeText(String(fact.value ?? ""));
  const evidenceText = normalizeText(fact.evidence);
  if (confidence >= 0.6 && valueText && valueText !== "未说明" && evidenceText) return null;
  if (!valueText && !evidenceText) return null;

  return {
    key: `fact-${fact.fieldKey}`,
    title: `${fact.fieldLabel}待确认`,
    levelLabel: "待确认",
    reason: evidenceText || valueText || "该信息仍需人工补充。",
    tone: "warning",
  };
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim();
}
