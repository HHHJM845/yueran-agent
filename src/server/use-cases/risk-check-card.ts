import { z } from "zod";
import { AppError } from "@/lib/errors";
import { listProjectArtifacts } from "@/server/repositories/artifacts";
import { getProjectRiskCheck, updateRiskCheckDecision, upsertRiskCheckDraft } from "@/server/repositories/risk-checks";
import type { StructuredRequirement } from "@/server/use-cases/structure-requirement";

export type RiskLevel = "low" | "medium" | "high";
export type OverallRiskAlert = "low" | "medium" | "high" | "redline";
export type RiskCheckDecision = "accept" | "reject" | "conditional_accept";
export type RiskCheckCardStatus = "draft" | "in_review" | "needs_revision" | "approved" | "archived";

export type RiskCheckFactDraft = {
  fieldKey: string;
  fieldLabel: string;
  value: unknown;
  evidence: string;
  confidence: number;
};

export type RiskCheckDimensionDraft = {
  dimensionKey: string;
  level: RiskLevel;
  evidence: string;
  anchorText: string;
  confidence: number;
};

export type RiskCheckDraft = {
  status: Extract<RiskCheckCardStatus, "draft" | "in_review">;
  overallAlert: OverallRiskAlert;
  redlineAlerts: string[];
  facts: RiskCheckFactDraft[];
  dimensions: RiskCheckDimensionDraft[];
};

const sensitiveIndustryKeywords = [
  "医疗",
  "医美",
  "药",
  "药品",
  "保健",
  "金融",
  "证券",
  "保险",
  "银行",
  "政务",
  "政府",
  "教育",
  "招生",
  "儿童",
  "未成年人",
  "酒",
  "烟",
];

const decisionSchema = z.object({
  projectId: z.string().uuid("项目 ID 不合法"),
  cardId: z.string().uuid("风险卡 ID 不合法"),
  decision: z.enum(["accept", "reject", "conditional_accept"]),
  reason: z.string().trim().min(1, "请填写人工判断原因"),
  actorId: z.string().uuid("操作人 ID 不合法"),
});

const dimensionDefinitions = [
  {
    key: "decision_chain",
    label: "甲方决策链与需求确定性",
    anchors: {
      low: "关键信息齐全，需求边界基本明确，可直接进入创意提案。",
      medium: "仍有少量待确认项，需要商务在提案前补一次关键信息。",
      high: "关键决策链或需求边界不清，继续推进会放大返工风险。",
    },
  },
  {
    key: "compliance",
    label: "内容合规及监管风险",
    anchors: {
      low: "未见明显监管敏感点，授权信息基本清楚。",
      medium: "存在敏感行业、IP、logo 或表述限制，需要先补齐合规确认。",
      high: "存在强监管领域、授权不明或明显禁忌，需重点评估甚至暂缓接单。",
    },
  },
  {
    key: "visual_reproduction",
    label: "特效技能复刻与视觉还原",
    anchors: {
      low: "画面目标和制作方式常规，现有能力基本可覆盖。",
      medium: "存在一定风格还原或特效难度，需要提前锁定方案与资源。",
      high: "明显依赖高强度特效、复杂写实还原或超出现阶段稳定交付边界。",
    },
  },
  {
    key: "commercial",
    label: "商业风险",
    anchors: {
      low: "预算、付款和商务条款较清楚，风险可控。",
      medium: "预算或付款条件仍不完整，需在报价前补齐并确认。",
      high: "违约、付款或客户条款明显偏高风险，可能影响项目回款或交付边界。",
    },
  },
  {
    key: "schedule",
    label: "周期紧张程度",
    anchors: {
      low: "周期与交付要求匹配，排期压力可控。",
      medium: "档期偏紧，需要精确排产并控制变更。",
      high: "交付周期明显紧张，叠加复杂制作会显著提高失败概率。",
    },
  },
] as const;

const factLabelMap: Record<string, string> = {
  roleCount: "角色数",
  sceneCount: "场景数",
  duration: "视频时长",
  deliveryTimeline: "交付周期",
  ipLogoPresence: "是否包含 IP / logo",
  authorization: "授权情况",
  vfxRequired: "是否需要复杂特效",
  industry: "所属行业",
  sensitiveDomain: "是否涉敏感领域",
  penaltyClause: "违约或赔付要求",
  clientType: "客户类型",
  paymentTerms: "付款条件",
};

type NormalizedStructuredRequirement = {
  brandInfo: string;
  productOrService: string;
  targetAudience: string;
  videoGoal: string;
  expectedStyle: string;
  referenceSamples: string[];
  keySellingPoints: string[];
  restrictions: string[];
  deliverySpecs: string;
  timeline: string;
  budgetOrQuoteInfo: string;
  openQuestions: string[];
  summary: string;
};

type FactCollection = Record<string, RiskCheckFactDraft>;

export function buildRiskCheckPrompt(input: { briefText: string; fewShotExamples?: string }) {
  const dimensionPrompt = dimensionDefinitions
    .map(
      (dimension) =>
        `${dimension.label}\n- low: ${dimension.anchors.low}\n- medium: ${dimension.anchors.medium}\n- high: ${dimension.anchors.high}`
    )
    .join("\n\n");

  return [
    "你是 AIGC 视频项目售前风险评估助手。",
    "请先从 Brief 抽取事实，再对五个固定维度做 low / medium / high 定级。",
    "facts 必须包含 evidence 和 confidence；dimensions 必须包含 key、level、evidence、anchorText、confidence。",
    "如果命中强监管领域且授权不明，请输出 redlineAlerts。",
    "",
    "五个维度锚点：",
    dimensionPrompt,
    input.fewShotExamples?.trim() ? `\n示例：\n${input.fewShotExamples.trim()}` : "",
    "\nBrief：",
    input.briefText.trim(),
  ]
    .filter(Boolean)
    .join("\n");
}

export function normalizeRiskCheckModelOutput(value: unknown): RiskCheckDraft {
  const record = asRecord(value);
  const redlineAlerts = normalizeStringArray(record.redlineAlerts);
  const facts = normalizeFacts(record.facts);
  const dimensions = normalizeDimensions(record.dimensions);

  return {
    status: normalizeDraftStatus(record.status),
    overallAlert: deriveOverallAlert(redlineAlerts, dimensions),
    redlineAlerts,
    facts,
    dimensions,
  };
}

export async function generateRiskCheckFromProject(input: { projectId: string; actorId: string }) {
  const artifacts = await listProjectArtifacts(input.projectId);
  const structuredRequirement = artifacts.find((artifact) => artifact.kind === "structured_requirement") ?? null;

  if (!structuredRequirement) {
    throw new AppError({
      status: 409,
      code: "risk_check_brief_required",
      userMessage: "还没有找到可用的 Brief 结构化结果。请先完成 Brief 结构化，再生成风险体检卡。",
    });
  }

  const brief = normalizeStructuredRequirement(structuredRequirement.data);
  const briefText = buildBriefText(brief);
  if (!briefText.trim()) {
    throw new AppError({
      status: 409,
      code: "risk_check_brief_empty",
      userMessage: "当前 Brief 结构化结果内容太少，暂时无法做风险体检。请先补充需求信息后再试。",
    });
  }

  const draft = buildDraftFromStructuredBrief(brief);
  const riskCheck = await upsertRiskCheckDraft({
    projectId: input.projectId,
    actorId: input.actorId,
    sourceArtifactId: structuredRequirement.id,
    draft,
  });

  return {
    riskCheck,
    message:
      riskCheck.card.overallAlert === "redline"
        ? "风险体检卡已生成，并标出红线风险。请商务或管理员先人工确认后再决定是否继续。"
        : "风险体检卡已根据当前 Brief 生成并保存，接下来可以人工确认接单结论。",
  };
}

export async function saveRiskCheckDecision(input: {
  projectId: string;
  cardId: string;
  decision: RiskCheckDecision;
  reason: string;
  actorId: string;
}) {
  const parsed = decisionSchema.parse(input);
  const card = await updateRiskCheckDecision(parsed);

  if (!card) {
    throw new AppError({
      status: 404,
      code: "risk_check_not_found",
      userMessage: "没有找到这张风险体检卡。请刷新工作台后再试。",
    });
  }

  return card;
}

export async function getRiskCheckForProject(projectId: string) {
  return getProjectRiskCheck(projectId);
}

function buildDraftFromStructuredBrief(brief: NormalizedStructuredRequirement): RiskCheckDraft {
  const allText = buildBriefText(brief);
  const facts: FactCollection = {
    roleCount: createCountFact("roleCount", "角色数", findCountEvidence(allText, /(主角|角色|人物)/), /(主角|角色|人物)/),
    sceneCount: createCountFact("sceneCount", "场景数", findCountEvidence(allText, /(场景|场次|镜头)/), /(场景|场次|镜头)/),
    duration: createTextFact("duration", "视频时长", extractDurationEvidence(brief.deliverySpecs, brief.timeline, allText)),
    deliveryTimeline: createTextFact("deliveryTimeline", "交付周期", brief.timeline || brief.deliverySpecs || "未说明"),
    ipLogoPresence: createBooleanishFact(
      "ipLogoPresence",
      "是否包含 IP / logo",
      findKeywordEvidence([brief.expectedStyle, ...brief.referenceSamples, ...brief.restrictions, allText], ["IP", "logo", "Logo", "商标", "版权", "联名", "人物肖像"])
    ),
    authorization: createAuthorizationFact(brief, allText),
    vfxRequired: createBooleanishFact(
      "vfxRequired",
      "是否需要复杂特效",
      findKeywordEvidence(
        [brief.expectedStyle, brief.videoGoal, ...brief.referenceSamples, ...brief.keySellingPoints, allText],
        ["特效", "CG", "3D", "三维", "写实", "电影级", "虚拟", "合成"]
      )
    ),
    industry: createTextFact("industry", "所属行业", extractIndustryEvidence(brief, allText)),
    sensitiveDomain: createSensitiveDomainFact(brief, allText),
    penaltyClause: createTextFact("penaltyClause", "违约或赔付要求", findKeywordEvidence([brief.budgetOrQuoteInfo, ...brief.openQuestions, ...brief.restrictions, allText], ["违约", "赔付", "罚款", "赔偿"])),
    clientType: createClientTypeFact(brief, allText),
    paymentTerms: createTextFact("paymentTerms", "付款条件", findKeywordEvidence([brief.budgetOrQuoteInfo, ...brief.openQuestions, allText], ["付款", "账期", "预付款", "尾款", "结算"])),
  };

  const dimensions = [
    evaluateDecisionChain(brief, facts),
    evaluateCompliance(brief, facts),
    evaluateVisualReproduction(brief, facts),
    evaluateCommercial(brief, facts),
    evaluateSchedule(brief, facts),
  ];

  const redlineAlerts = deriveRedlineAlerts(facts, dimensions);

  return normalizeRiskCheckModelOutput({
    status: "in_review",
    facts,
    dimensions,
    redlineAlerts,
  });
}

function normalizeFacts(value: unknown): RiskCheckFactDraft[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeFactItem(item))
      .filter((item): item is RiskCheckFactDraft => item !== null);
  }

  const record = asRecord(value);
  return Object.entries(record)
    .map(([fieldKey, factValue]) => normalizeFactItem({ fieldKey, ...(asRecord(factValue)) }))
    .filter((item): item is RiskCheckFactDraft => item !== null);
}

function normalizeFactItem(value: unknown): RiskCheckFactDraft | null {
  const record = asRecord(value);
  const fieldKey = normalizeString(record.fieldKey || record.key);
  if (!fieldKey) return null;

  return {
    fieldKey,
    fieldLabel: normalizeString(record.fieldLabel || record.label) || factLabelMap[fieldKey] || fieldKey,
    value: record.value ?? record.valueJson ?? "",
    evidence: normalizeString(record.evidence),
    confidence: normalizeConfidence(record.confidence),
  };
}

function normalizeDimensions(value: unknown): RiskCheckDimensionDraft[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeDimensionItem(item))
      .filter((item): item is RiskCheckDimensionDraft => item !== null);
  }

  const record = asRecord(value);
  return Object.entries(record)
    .map(([dimensionKey, dimensionValue]) => normalizeDimensionItem({ dimensionKey, ...(asRecord(dimensionValue)) }))
    .filter((item): item is RiskCheckDimensionDraft => item !== null);
}

function normalizeDimensionItem(value: unknown): RiskCheckDimensionDraft | null {
  const record = asRecord(value);
  const dimensionKey = normalizeString(record.dimensionKey || record.key);
  if (!dimensionKey) return null;

  return {
    dimensionKey,
    level: normalizeRiskLevel(record.level),
    evidence: normalizeString(record.evidence),
    anchorText: normalizeString(record.anchorText),
    confidence: normalizeConfidence(record.confidence),
  };
}

function normalizeStructuredRequirement(value: unknown): NormalizedStructuredRequirement {
  const record = asRecord(value) as Partial<Record<keyof StructuredRequirement, unknown>>;

  return {
    brandInfo: normalizeText(record.brandInfo),
    productOrService: normalizeText(record.productOrService),
    targetAudience: normalizeText(record.targetAudience),
    videoGoal: normalizeText(record.videoGoal),
    expectedStyle: normalizeText(record.expectedStyle),
    referenceSamples: normalizeTextArray(record.referenceSamples),
    keySellingPoints: normalizeTextArray(record.keySellingPoints),
    restrictions: normalizeTextArray(record.restrictions),
    deliverySpecs: normalizeText(record.deliverySpecs),
    timeline: normalizeText(record.timeline),
    budgetOrQuoteInfo: normalizeText(record.budgetOrQuoteInfo),
    openQuestions: normalizeTextArray(record.openQuestions),
    summary: normalizeText(record.summary),
  };
}

function buildBriefText(brief: NormalizedStructuredRequirement) {
  return [
    brief.brandInfo && `品牌信息：${brief.brandInfo}`,
    brief.productOrService && `产品/服务：${brief.productOrService}`,
    brief.targetAudience && `目标受众：${brief.targetAudience}`,
    brief.videoGoal && `视频目标：${brief.videoGoal}`,
    brief.expectedStyle && `期望风格：${brief.expectedStyle}`,
    brief.referenceSamples.length > 0 && `参考样片：${brief.referenceSamples.join("；")}`,
    brief.keySellingPoints.length > 0 && `核心卖点：${brief.keySellingPoints.join("；")}`,
    brief.restrictions.length > 0 && `禁忌点：${brief.restrictions.join("；")}`,
    brief.deliverySpecs && `交付规格：${brief.deliverySpecs}`,
    brief.timeline && `时间节点：${brief.timeline}`,
    brief.budgetOrQuoteInfo && `预算/报价：${brief.budgetOrQuoteInfo}`,
    brief.openQuestions.length > 0 && `待确认问题：${brief.openQuestions.join("；")}`,
    brief.summary && `摘要：${brief.summary}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function createCountFact(fieldKey: string, fieldLabel: string, evidence: string, nounPattern: RegExp): RiskCheckFactDraft {
  const count = extractCountFromEvidence(evidence, nounPattern);
  return {
    fieldKey,
    fieldLabel,
    value: count ?? (evidence ? "未明确数量" : "未说明"),
    evidence,
    confidence: evidence ? (count !== null ? 0.78 : 0.42) : 0,
  };
}

function createTextFact(fieldKey: string, fieldLabel: string, evidence: string): RiskCheckFactDraft {
  return {
    fieldKey,
    fieldLabel,
    value: evidence || "未说明",
    evidence,
    confidence: evidence ? 0.76 : 0,
  };
}

function createBooleanishFact(fieldKey: string, fieldLabel: string, evidence: string): RiskCheckFactDraft {
  return {
    fieldKey,
    fieldLabel,
    value: evidence ? "是" : "未说明",
    evidence,
    confidence: evidence ? 0.72 : 0,
  };
}

function createAuthorizationFact(brief: NormalizedStructuredRequirement, allText: string): RiskCheckFactDraft {
  const evidence = findKeywordEvidence(
    [brief.expectedStyle, brief.deliverySpecs, brief.budgetOrQuoteInfo, ...brief.restrictions, ...brief.openQuestions, allText],
    ["授权", "版权", "肖像权", "商用", "logo", "IP"]
  );
  const lowerEvidence = evidence.toLowerCase();
  const value =
    !evidence
      ? "未说明"
      : /已授权|授权齐全|可商用|版权清晰/.test(evidence)
        ? "已说明"
        : /未授权|授权不明|待授权|待确认/.test(evidence) || lowerEvidence.includes("logo") || lowerEvidence.includes("ip")
          ? "未说明"
          : "待人工确认";

  return {
    fieldKey: "authorization",
    fieldLabel: "授权情况",
    value,
    evidence,
    confidence: evidence ? (/已授权|授权齐全|可商用|版权清晰/.test(evidence) ? 0.85 : 0.52) : 0,
  };
}

function createSensitiveDomainFact(brief: NormalizedStructuredRequirement, allText: string): RiskCheckFactDraft {
  const evidence = extractSensitiveDomainEvidence([brief.brandInfo, brief.productOrService, brief.videoGoal, ...brief.restrictions, allText]);
  return {
    fieldKey: "sensitiveDomain",
    fieldLabel: "是否涉敏感领域",
    value: evidence ? "是" : "否",
    evidence,
    confidence: evidence ? 0.82 : 0.58,
  };
}

function createClientTypeFact(brief: NormalizedStructuredRequirement, allText: string): RiskCheckFactDraft {
  const evidence = findKeywordEvidence(
    [brief.brandInfo, brief.productOrService, brief.summary, ...brief.openQuestions, allText],
    ["政府", "政务", "集团", "上市", "连锁", "国企", "央企", "品牌方", "甲方"]
  );
  return {
    fieldKey: "clientType",
    fieldLabel: "客户类型",
    value: evidence || "未说明",
    evidence,
    confidence: evidence ? 0.66 : 0,
  };
}

function evaluateDecisionChain(brief: NormalizedStructuredRequirement, facts: FactCollection): RiskCheckDimensionDraft {
  const missingCoreFields = [brief.timeline, brief.deliverySpecs, brief.budgetOrQuoteInfo].filter((item) => !item).length;
  const openQuestionCount = brief.openQuestions.length;
  const lowConfidenceCount = Object.values(facts).filter((fact) => fact.confidence > 0 && fact.confidence < 0.65).length;

  let level: RiskLevel = "low";
  if (openQuestionCount >= 3 || missingCoreFields >= 2) level = "high";
  else if (openQuestionCount > 0 || missingCoreFields > 0 || lowConfidenceCount >= 3) level = "medium";

  const evidence =
    brief.openQuestions.slice(0, 3).join("；") ||
    [!brief.timeline && "时间节点未说明", !brief.deliverySpecs && "交付规格未说明", !brief.budgetOrQuoteInfo && "预算/报价未说明"]
      .filter(Boolean)
      .join("；");

  return createDimensionDraft("decision_chain", level, evidence, level === "low" ? 0.78 : level === "medium" ? 0.72 : 0.82);
}

function evaluateCompliance(brief: NormalizedStructuredRequirement, facts: FactCollection): RiskCheckDimensionDraft {
  const sensitive = String(facts.sensitiveDomain.value) === "是";
  const authorizationUnknown = String(facts.authorization.value) !== "已说明";
  const hasIpOrLogo = String(facts.ipLogoPresence.value) === "是";
  const restrictionEvidence = brief.restrictions.join("；");

  let level: RiskLevel = "low";
  if ((sensitive && authorizationUnknown) || /禁用|禁忌|不能|不得/.test(restrictionEvidence)) level = "high";
  else if (sensitive || hasIpOrLogo || authorizationUnknown) level = "medium";

  const evidence = [facts.sensitiveDomain.evidence, facts.authorization.evidence, restrictionEvidence].filter(Boolean).join("；");
  return createDimensionDraft("compliance", level, evidence, level === "high" ? 0.84 : level === "medium" ? 0.74 : 0.64);
}

function evaluateVisualReproduction(brief: NormalizedStructuredRequirement, facts: FactCollection): RiskCheckDimensionDraft {
  const styleText = [brief.expectedStyle, brief.videoGoal, ...brief.referenceSamples, ...brief.keySellingPoints].join("；");
  const complexKeywords = ["电影级", "写实", "CG", "3D", "三维", "复杂特效", "虚实结合", "高精度", "高度还原"];
  const mediumKeywords = ["质感", "还原", "高级感", "特效", "动画", "拟真"];
  const hasComplex = complexKeywords.some((keyword) => styleText.includes(keyword));
  const hasMedium = mediumKeywords.some((keyword) => styleText.includes(keyword));

  let level: RiskLevel = "low";
  if (hasComplex) level = "high";
  else if (hasMedium || String(facts.vfxRequired.value) === "是") level = "medium";

  const evidence =
    findKeywordEvidence([styleText], complexKeywords) ||
    findKeywordEvidence([styleText, facts.vfxRequired.evidence], mediumKeywords) ||
    facts.vfxRequired.evidence;
  return createDimensionDraft("visual_reproduction", level, evidence, level === "high" ? 0.79 : level === "medium" ? 0.68 : 0.6);
}

function evaluateCommercial(brief: NormalizedStructuredRequirement, facts: FactCollection): RiskCheckDimensionDraft {
  const hasPenalty = Boolean(facts.penaltyClause.evidence);
  const hasPaymentTerms = Boolean(facts.paymentTerms.evidence);
  const hasBudget = Boolean(brief.budgetOrQuoteInfo);

  let level: RiskLevel = "low";
  if (hasPenalty || (!hasPaymentTerms && !hasBudget)) level = "high";
  else if (!hasPaymentTerms || !hasBudget) level = "medium";

  const evidence = [facts.penaltyClause.evidence, facts.paymentTerms.evidence, brief.budgetOrQuoteInfo].filter(Boolean).join("；");
  return createDimensionDraft("commercial", level, evidence, level === "high" ? 0.76 : level === "medium" ? 0.67 : 0.61);
}

function evaluateSchedule(brief: NormalizedStructuredRequirement, facts: FactCollection): RiskCheckDimensionDraft {
  const timelineText = [brief.timeline, brief.deliverySpecs].filter(Boolean).join("；");
  const days = extractDeadlineDays(timelineText);
  const complex = ["high", "medium"].includes(
    evaluateVisualReproduction(brief, facts).level
  );
  const urgent = /加急|尽快|本周|当天|立即/.test(timelineText);

  let level: RiskLevel = "low";
  if (urgent || (days !== null && days <= 10) || (days !== null && days <= 15 && complex)) level = "high";
  else if (!timelineText || (days !== null && days <= 30) || complex) level = "medium";

  const evidence = timelineText || "时间节点未说明";
  return createDimensionDraft("schedule", level, evidence, timelineText ? 0.8 : 0.48);
}

function createDimensionDraft(dimensionKey: string, level: RiskLevel, evidence: string, confidence: number): RiskCheckDimensionDraft {
  const definition = dimensionDefinitions.find((item) => item.key === dimensionKey);
  return {
    dimensionKey,
    level,
    evidence,
    anchorText: definition?.anchors[level] ?? "",
    confidence,
  };
}

function deriveRedlineAlerts(facts: FactCollection, dimensions: RiskCheckDimensionDraft[]) {
  const compliance = dimensions.find((dimension) => dimension.dimensionKey === "compliance");
  const sensitive = String(facts.sensitiveDomain.value) === "是";
  const authorizationUnknown = String(facts.authorization.value) !== "已说明";

  const alerts: string[] = [];
  if (compliance?.level === "high" && sensitive && authorizationUnknown) {
    alerts.push("强监管领域 + 授权不明，建议不接或升级到老板决策。");
  }

  return alerts;
}

function deriveOverallAlert(redlineAlerts: string[], dimensions: RiskCheckDimensionDraft[]): OverallRiskAlert {
  if (redlineAlerts.length > 0) return "redline";
  if (dimensions.some((item) => item.level === "high")) return "high";
  if (dimensions.some((item) => item.level === "medium")) return "medium";
  return "low";
}

function normalizeDraftStatus(value: unknown): Extract<RiskCheckCardStatus, "draft" | "in_review"> {
  return value === "in_review" ? "in_review" : "draft";
}

function normalizeRiskLevel(value: unknown): RiskLevel {
  return value === "high" || value === "medium" ? value : "low";
}

function normalizeText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map((item) => normalizeText(item)).filter(Boolean).join("；");
  if (value && typeof value === "object") return Object.values(value).map((item) => normalizeText(item)).filter(Boolean).join("；");
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeTextArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => normalizeText(item)).filter(Boolean);
  const text = normalizeText(value);
  return text ? [text] : [];
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeString(item)).filter(Boolean);
}

function normalizeConfidence(value: unknown): number {
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  if (!Number.isFinite(numberValue)) return 0;
  return Math.min(1, Math.max(0, numberValue));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function findCountEvidence(text: string, nounPattern: RegExp) {
  const match = text.match(new RegExp(`([一二两三四五六七八九十百\\d]+)\\s*(位|个|名)?${nounPattern.source}`, "i"));
  return match?.[0] ?? "";
}

function extractCountFromEvidence(evidence: string, nounPattern: RegExp) {
  const match = evidence.match(new RegExp(`([一二两三四五六七八九十百\\d]+)\\s*(位|个|名)?${nounPattern.source}`, "i"));
  if (!match) return null;
  return parseLooseNumber(match[1]);
}

function extractDurationEvidence(...texts: string[]) {
  return findRegexEvidence(texts, /(\d+\s*(秒|分钟|min|s))/i);
}

function extractIndustryEvidence(brief: NormalizedStructuredRequirement, allText: string) {
  const text = [brief.brandInfo, brief.productOrService, brief.summary, allText].join("；");
  const keyword = sensitiveIndustryKeywords.find((item) => text.includes(item));
  if (keyword) {
    const evidence = extractSnippet(text, keyword);
    return evidence || keyword;
  }

  return brief.productOrService || brief.brandInfo || "";
}

function extractSensitiveDomainEvidence(texts: string[]) {
  const text = texts.filter(Boolean).join("；");
  const keyword = sensitiveIndustryKeywords.find((item) => text.includes(item));
  return keyword ? extractSnippet(text, keyword) || keyword : "";
}

function findKeywordEvidence(texts: string[], keywords: string[]) {
  const text = texts.filter(Boolean).join("；");
  const keyword = keywords.find((item) => text.includes(item));
  return keyword ? extractSnippet(text, keyword) || keyword : "";
}

function findRegexEvidence(texts: string[], pattern: RegExp) {
  const text = texts.filter(Boolean).join("；");
  const match = text.match(pattern);
  return match?.[0] ?? "";
}

function extractSnippet(text: string, keyword: string) {
  const index = text.indexOf(keyword);
  if (index < 0) return "";
  return text.slice(Math.max(0, index - 14), Math.min(text.length, index + keyword.length + 18)).replace(/\s+/g, " ").trim();
}

function extractDeadlineDays(text: string) {
  const match = text.match(/(\d+)\s*(个)?(工作日|天|日)/);
  if (match) return Number(match[1]);
  const chineseMatch = text.match(/([一二两三四五六七八九十]+)\s*(个)?(工作日|天|日)/);
  return chineseMatch ? parseLooseNumber(chineseMatch[1]) : null;
}

function parseLooseNumber(value: string) {
  if (/^\d+$/.test(value)) return Number(value);
  const map: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  if (value === "十") return 10;
  if (value.includes("十")) {
    const [tensPart, onesPart] = value.split("十");
    const tens = tensPart ? map[tensPart] ?? 1 : 1;
    const ones = onesPart ? map[onesPart] ?? 0 : 0;
    return tens * 10 + ones;
  }
  return map[value] ?? null;
}
