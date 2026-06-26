import { z } from "zod";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { callArkJson } from "@/server/providers/ark";
import { createArtifact, listProjectArtifacts } from "@/server/repositories/artifacts";
import { listProjectAssetAnalyses } from "@/server/repositories/asset-analyses";
import {
  archiveProjectCreativeDirections,
  createCreativeDirections,
  listProjectCreativeDirections,
} from "@/server/repositories/creative-directions";
import { appendJobEvent, createJob, getJobInput, updateJobStatus } from "@/server/repositories/jobs";
import { listScoringRules } from "@/server/repositories/scoring-rules";
import { searchProjectMaterials } from "@/server/use-cases/material-search";
import { normalizeCreativeDirections } from "@/server/use-cases/creative-proposal-rounds";
import { recordStageProgress } from "@/server/use-cases/stage-progress";

const creativeDirectionJobInputSchema = z.object({
  requestedBy: z.string().uuid().nullable().optional(),
});

const flexibleString = z.preprocess((value) => {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(formatUnknownValue).filter(Boolean).join("、");
  if (typeof value === "object") return Object.values(value).map(formatUnknownValue).filter(Boolean).join("、");
  return String(value);
}, z.string().default(""));

const flexibleTags = z.preprocess((value) => {
  if (Array.isArray(value)) return value.map(formatUnknownValue).filter(Boolean);
  if (typeof value === "string" && value.trim()) return value.split(/[、,，\n]/).map((item) => item.trim()).filter(Boolean);
  return [];
}, z.array(z.string()).default([]));

const creativeDirectionSchema = z.object({
  title: flexibleString,
  coreIdea: flexibleString,
  fitReason: flexibleString,
  referenceTags: flexibleTags.optional().default([]),
  score: z.coerce.number().min(0).max(100).optional().default(0),
  riskNotes: flexibleString.optional().default(""),
  costEstimate: flexibleString.optional().default(""),
  cycleEstimate: flexibleString.optional().default(""),
  technicalDifficulty: flexibleString.optional().default(""),
  atmospherePrompt: flexibleString.optional().default(""),
  detail: z.unknown().default({}),
});

const creativeDirectionResponseSchema = z.object({
  directions: z.array(creativeDirectionSchema).min(1).max(8),
});

export async function enqueueCreativeDirectionGeneration(input: {
  projectId: string;
  requestedBy: string;
}) {
  const { jobId } = await createJob({
    projectId: input.projectId,
    type: "creative_direction_generation",
    title: "生成 4 个创意方向",
    provider: env.TEXT_STRUCTURING_PROVIDER,
    modelName: env.ARK_TEXT_STRUCTURING_MODEL,
    inputJson: {
      requestedBy: input.requestedBy,
    },
    createdBy: input.requestedBy,
    maxAttempts: 2,
  });

  return { jobId };
}

export async function runCreativeDirectionGenerationJob(jobId: string, options: { workerManagedFailure?: boolean } = {}) {
  const job = await getJobInput<z.infer<typeof creativeDirectionJobInputSchema>>(jobId);
  if (!job) {
    throw new AppError({
      status: 404,
      code: "job_not_found",
      userMessage: "没有找到这个创意方向生成任务。",
    });
  }

  const parsedInput = creativeDirectionJobInputSchema.parse(job.input);

  await updateJobStatus(jobId, {
    status: "processing",
    currentStep: "collecting_project_context",
    userMessage: "正在汇总需求、样片解析和标签评分，用于生成 SOP 3 的 4 个创意方向。",
  });

  await appendJobEvent(jobId, {
    type: "step.started",
    jobId,
    projectId: job.projectId,
    stepId: "creative_direction_generation",
    title: "开始生成创意方向",
    userMessage: "系统正在从项目真实资料中整理创意输入。",
    at: new Date().toISOString(),
  });

  try {
    const context = await collectCreativeContext(job.projectId, jobId);
    if (!context.hasUsableInput) {
      throw new AppError({
        status: 422,
        code: "insufficient_creative_context",
        userMessage: "当前项目还缺少可用于生成创意方向的真实资料。请先完成需求结构化，或至少解析一份客户资料/样片后再生成。",
      });
    }

    await appendJobEvent(jobId, {
      type: "tool.started",
      jobId,
      projectId: job.projectId,
      callId: "ark_creative_direction_generation",
      title: "调用豆包生成 4 个创意方向",
      payload: {
        provider: env.TEXT_STRUCTURING_PROVIDER,
        model: env.ARK_TEXT_STRUCTURING_MODEL,
        structuredRequirementCount: context.structuredRequirementCount,
        assetAnalysisCount: context.assetAnalysisCount,
        scoreResultCount: context.scoreResultCount,
      },
      at: new Date().toISOString(),
    });

    const response = await callArkJson({
      model: env.ARK_TEXT_STRUCTURING_MODEL,
      timeoutMs: 90_000,
      maxOutputTokens: 1800,
      telemetry: {
        projectId: job.projectId,
        jobId,
        callId: "ark_creative_direction_generation",
        provider: env.TEXT_STRUCTURING_PROVIDER,
        operation: "creative_direction_generation",
        metadata: {
          structuredRequirementCount: context.structuredRequirementCount,
          assetAnalysisCount: context.assetAnalysisCount,
          materialMatchCount: context.promptInput.materialMatches.length,
        },
      },
      messages: [
        {
          role: "system",
          content:
            "你是 AIGC 视频商业项目的创意总监。基于输入资料生成恰好 4 个 SOP 3 创意视觉提案方向。只输出严格 JSON：{ directions: [...] }。每个 direction 必须包含 title, coreIdea, fitReason，可选 referenceTags 和 score。每项都要简短，适配三维风格和写实风格，不要 Markdown。",
        },
        {
          role: "user",
          content: buildCompactCreativePrompt(context),
        },
      ],
    });

    const parsed = creativeDirectionResponseSchema.parse(response);
    const normalizedDirections = normalizeCreativeDirections(normalizeDirections(parsed.directions, context));

    if (normalizedDirections.length !== 4) {
      throw new AppError({
        status: 502,
        code: "creative_direction_count_too_low",
        userMessage: "模型没有返回恰好 4 个创意方向。请稍后重试，或补充更多需求和样片信息后再生成。",
      });
    }

    const savedDirections = await createCreativeDirections({
      projectId: job.projectId,
      sourceJobId: jobId,
      createdBy: parsedInput.requestedBy ?? null,
      directions: normalizedDirections.slice(0, 4).map((direction, index) => ({
        ...direction,
        sortOrder: index + 1,
      })),
    });
    await archiveProjectCreativeDirections({ projectId: job.projectId, sourceJobId: jobId });

    const artifact = await createArtifact({
      projectId: job.projectId,
      kind: "creative_direction",
      title: "4 个创意方向",
      status: "draft",
      data: {
        directionIds: savedDirections.map((direction) => direction.id),
        directions: savedDirections,
        source: {
          structuredRequirementCount: context.structuredRequirementCount,
          assetAnalysisCount: context.assetAnalysisCount,
          scoreResultCount: context.scoreResultCount,
        },
      },
      sourceJobId: jobId,
    });

    await appendJobEvent(jobId, {
      type: "tool.completed",
      jobId,
      projectId: job.projectId,
      callId: "ark_creative_direction_generation",
      title: "豆包已返回创意方向",
      payload: {
        directionCount: savedDirections.length,
      },
      userMessage: "4 个创意方向已生成，并保存到项目工作台。",
      at: new Date().toISOString(),
    });

    await appendJobEvent(jobId, {
      type: "artifact.created",
      jobId,
      projectId: job.projectId,
      artifactId: artifact.id,
      title: "已创建 4 个创意方向快照",
      payload: {
        artifactKind: artifact.kind,
        directionCount: savedDirections.length,
      },
      userMessage: "创意方向卡片已保存。你可以人工改写或多选进入深化。",
      at: new Date().toISOString(),
    });

    await recordStageProgress({
      projectId: job.projectId,
      stageKey: "technical_feasibility",
      status: "completed",
      currentStage: "creative_direction_proposal",
      projectStatus: "in_progress",
      jobId,
      title: "技术可行性评估已完成",
      userMessage: "4 个创意方向已生成，项目已进入两轮创意视觉提案阶段。",
      outputRefs: [
        { type: "artifact", id: artifact.id, kind: artifact.kind },
        ...savedDirections.map((direction) => ({ type: "creative_direction", id: direction.id })),
      ],
      snapshot: {
        directionCount: savedDirections.length,
        directionIds: savedDirections.map((direction) => direction.id),
      },
    });

    await appendJobEvent(jobId, {
      type: "job.completed",
      jobId,
      projectId: job.projectId,
      title: "创意方向生成完成",
      userMessage: "4 个创意方向生成完成。",
      at: new Date().toISOString(),
    });

    await updateJobStatus(jobId, {
      status: "succeeded",
      currentStep: "completed",
      userMessage: "4 个创意方向生成完成。",
    });

    return { jobId, directions: await listProjectCreativeDirections(job.projectId), artifact };
  } catch (error) {
    const userMessage =
      error instanceof AppError
        ? error.userMessage
        : "创意方向生成失败。请稍后重试，或补充更清晰的需求、样片和标签评分信息。";

    await recordStageProgress({
      projectId: job.projectId,
      stageKey: "technical_feasibility",
      status: "blocked",
      currentStage: "technical_feasibility",
      projectStatus: "blocked",
      jobId,
      title: "技术可行性评估被阻塞",
      userMessage,
      errorMessage: userMessage,
    });

    await appendJobEvent(jobId, {
      type: "step.failed",
      jobId,
      projectId: job.projectId,
      stepId: "creative_direction_generation",
      title: "创意方向生成失败",
      userMessage,
      recoverable: true,
      at: new Date().toISOString(),
    });

    if (!options.workerManagedFailure) {
      await updateJobStatus(jobId, {
        status: "failed",
        currentStep: "failed",
        userMessage,
        errorCode: error instanceof AppError ? error.code : "creative_direction_generation_failed",
      });
    }

    throw error;
  }
}

async function collectCreativeContext(projectId: string, sourceJobId?: string | null) {
  const [artifacts, analyses, rules] = await Promise.all([
    listProjectArtifacts(projectId),
    listProjectAssetAnalyses(projectId),
    listScoringRules({ activeOnly: true }),
  ]);

  const structuredRequirements = artifacts
    .filter((artifact) => artifact.kind === "structured_requirement")
    .slice(0, 3)
    .map((artifact) => artifact.data);
  const scoreResults = artifacts
    .filter((artifact) => artifact.kind === "score_result")
    .slice(0, 10)
    .map((artifact) => artifact.data);
  const successfulAnalyses = analyses.filter((analysis) => analysis.status === "succeeded");

  const materialQueryText = buildMaterialQueryText({
    structuredRequirements,
    successfulAnalyses,
    rules,
  });
  const materialMatches = await searchProjectMaterials({
    projectId,
    queryText: materialQueryText,
    analyses: successfulAnalyses,
    sourceJobId,
    limit: 5,
  });

  return {
    hasUsableInput: structuredRequirements.length > 0 || successfulAnalyses.length > 0,
    structuredRequirementCount: structuredRequirements.length,
    assetAnalysisCount: successfulAnalyses.length,
    scoreResultCount: scoreResults.length,
    promptInput: {
      businessGoal: "为内部 AIGC 视频团队的一期商业闭环生成 4 个创意方向，用于进入 SOP 3 两轮创意视觉提案。",
      requiredOutputFields: [
        "标题",
        "核心创意",
        "适配理由",
        "风险提示",
        "参考标签",
        "评分",
        "成本预估",
        "周期预估",
        "技术难度",
        "氛围图提示词",
        "详情",
      ],
      productionStyles: ["三维风格", "写实风格"],
      structuredRequirements,
      assetAnalyses: successfulAnalyses.map((analysis) => ({
        summary: analysis.summary,
        labels: analysis.labels,
        metadata: analysis.metadata,
        extractedTextPreview: analysis.extractedText.slice(0, 500),
      })),
      scoreResults,
      materialMatches,
      scoringRules: rules.map((rule) => ({
        tag: rule.tag,
        weight: rule.weight,
        description: rule.description,
        positiveExamples: rule.positiveExamples,
        negativeExamples: rule.negativeExamples,
      })),
    },
  };
}

function buildMaterialQueryText(input: {
  structuredRequirements: unknown[];
  successfulAnalyses: Awaited<ReturnType<typeof listProjectAssetAnalyses>>;
  rules: Awaited<ReturnType<typeof listScoringRules>>;
}) {
  return [
    "AIGC 视频项目素材检索，用于生成商业创意方向。",
    "偏好三维风格、写实风格、商业广告片质感。",
    input.structuredRequirements.map(formatUnknownValue).join("\n").slice(0, 2000),
    input.successfulAnalyses
      .map((analysis) => `${analysis.summary}\n标签：${analysis.labels.join("、")}\n${analysis.extractedText.slice(0, 800)}`)
      .join("\n")
      .slice(0, 2400),
    input.rules.map((rule) => `${rule.tag}：${rule.description}`).join("\n").slice(0, 1200),
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeDirections(directions: Array<z.infer<typeof creativeDirectionSchema>>, context: Awaited<ReturnType<typeof collectCreativeContext>>) {
  const contextTags = collectContextTags(context);
  return directions
    .map((direction, index) => enrichDirection(direction, index, contextTags))
    .filter((direction) => direction.title && direction.coreIdea && direction.fitReason);
}

function enrichDirection(direction: z.infer<typeof creativeDirectionSchema>, index: number, contextTags: string[]) {
  const title = direction.title.trim();
  const coreIdea = direction.coreIdea.trim();
  const fitReason = direction.fitReason.trim();
  const referenceTags = Array.from(
    new Set([
      ...direction.referenceTags.map((tag) => tag.trim()).filter(Boolean),
      ...contextTags.slice(index, index + 4),
    ])
  ).slice(0, 10);
  const difficulty = inferDifficulty(`${title} ${coreIdea} ${referenceTags.join(" ")}`);
  const score = direction.score > 0 ? Math.round(direction.score) : Math.max(68, 88 - index * 4 - (difficulty === "高" ? 4 : 0));

  return {
    title,
    coreIdea,
    fitReason,
    riskNotes: direction.riskNotes.trim() || inferRiskNotes(`${title} ${coreIdea}`, difficulty),
    referenceTags,
    score: Math.max(0, Math.min(100, score)),
    costEstimate: direction.costEstimate.trim() || inferCostEstimate(difficulty),
    cycleEstimate: direction.cycleEstimate.trim() || inferCycleEstimate(difficulty),
    technicalDifficulty: direction.technicalDifficulty.trim() || difficulty,
    atmospherePrompt:
      direction.atmospherePrompt.trim() ||
      `商业级 AIGC 视频氛围图，${title}，${coreIdea}，${referenceTags.join("，")}，三维质感与写实镜头语言，16:9，高级广告片构图`,
    detail: direction.detail ?? {
      generationMode: "model_core_with_rule_enrichment",
      enrichmentBasis: "系统根据项目标签、创意文本和制作复杂度补齐成本周期风险字段。",
    },
  };
}

function collectContextTags(context: Awaited<ReturnType<typeof collectCreativeContext>>) {
  const tags = new Set<string>();
  for (const analysis of context.promptInput.assetAnalyses) {
    for (const tag of analysis.labels) tags.add(tag);
  }
  for (const rule of context.promptInput.scoringRules) {
    tags.add(rule.tag);
  }
  tags.add("三维风格");
  tags.add("写实风格");
  return Array.from(tags).filter(Boolean);
}

function buildCompactCreativePrompt(context: Awaited<ReturnType<typeof collectCreativeContext>>) {
  const requirementSummaries = context.promptInput.structuredRequirements
    .map((item) => summarizeStructuredRequirement(item))
    .filter(Boolean)
    .slice(0, 2)
    .join("\n");
  const analysisSummaries = context.promptInput.assetAnalyses
    .map((analysis) => `资料摘要：${analysis.summary}；标签：${analysis.labels.slice(0, 8).join("、")}`)
    .filter(Boolean)
    .slice(0, 3)
    .join("\n");
  const scoreSummary = context.promptInput.scoreResults
    .map((item) => formatUnknownValue(item).slice(0, 220))
    .filter(Boolean)
    .slice(0, 3)
    .join("\n");
  const ruleTags = context.promptInput.scoringRules.map((rule) => rule.tag).slice(0, 12).join("、");
  const materialSummary = context.promptInput.materialMatches
    .map((item) => `相似度 ${Math.round(item.score * 100)}：${item.contentPreview}；标签：${item.labels.join("、")}`)
    .filter(Boolean)
    .slice(0, 4)
    .join("\n");

  return [
    "请为这个 AIGC 视频项目生成恰好 4 个可供 SOP 3 两轮创意视觉提案使用的创意方向。",
    "输出严格 JSON：{ directions: [{ title, coreIdea, fitReason, referenceTags, score }] }。",
    "每个 title 不超过 14 个汉字；coreIdea 和 fitReason 各不超过 45 个汉字；referenceTags 最多 5 个；score 为 0-100。",
    "业务偏好：三维风格、写实风格、商业广告片质感。",
    requirementSummaries ? `客户需求：\n${requirementSummaries}` : "",
    analysisSummaries ? `资料分析：\n${analysisSummaries}` : "",
    materialSummary ? `素材库语义检索参考：\n${materialSummary}` : "",
    scoreSummary ? `评分结果：\n${scoreSummary}` : "",
    ruleTags ? `可参考标签：${ruleTags}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function summarizeStructuredRequirement(value: unknown) {
  if (!value || typeof value !== "object") return formatUnknownValue(value).slice(0, 260);
  const record = value as Record<string, unknown>;
  return [
    record.summary ? `摘要：${formatUnknownValue(record.summary)}` : "",
    record.brandInfo ? `品牌：${formatUnknownValue(record.brandInfo)}` : "",
    record.productOrService ? `产品/服务：${formatUnknownValue(record.productOrService)}` : "",
    record.videoGoal ? `目标：${formatUnknownValue(record.videoGoal)}` : "",
    record.expectedStyle ? `风格：${formatUnknownValue(record.expectedStyle)}` : "",
    record.deliverySpecs ? `规格：${formatUnknownValue(record.deliverySpecs)}` : "",
    record.timeline ? `周期：${formatUnknownValue(record.timeline)}` : "",
  ]
    .filter(Boolean)
    .join("；")
    .slice(0, 420);
}

function inferDifficulty(text: string) {
  const highSignals = ["三维", "写实", "群像", "城市", "大场景", "球星", "角色", "流体", "爆炸", "复杂"];
  const matched = highSignals.filter((signal) => text.includes(signal)).length;
  if (matched >= 3) return "高";
  if (matched >= 1) return "中高";
  return "中";
}

function inferCostEstimate(difficulty: string) {
  if (difficulty === "高") return "高，建议预留更多三维资产与合成迭代预算";
  if (difficulty === "中高") return "中高，适合控制镜头数量后推进";
  return "中，适合作为首轮提案方向";
}

function inferCycleEstimate(difficulty: string) {
  if (difficulty === "高") return "7-12 个工作日首版";
  if (difficulty === "中高") return "5-8 个工作日首版";
  return "3-5 个工作日首版";
}

function inferRiskNotes(text: string, difficulty: string) {
  const risks = [];
  if (text.includes("球星") || text.includes("名场面")) risks.push("涉及人物肖像或赛事素材时需提前确认授权边界");
  if (text.includes("写实")) risks.push("写实画面需要控制人物、服饰和品牌细节的一致性");
  if (text.includes("三维")) risks.push("三维资产复杂度会影响首版周期和渲染成本");
  if (difficulty === "高") risks.push("建议先做关键镜头测试，避免整片方向确认后返工");
  return risks.length ? risks.join("；") : "进入深化前需确认品牌禁忌、素材授权和交付规格。";
}

function formatUnknownValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(formatUnknownValue).filter(Boolean).join("、");
  if (typeof value === "object") return Object.values(value).map(formatUnknownValue).filter(Boolean).join("、");
  return String(value);
}
