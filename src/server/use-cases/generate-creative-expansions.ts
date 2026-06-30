import { z } from "zod";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { callArkJson } from "@/server/providers/ark";
import { createArtifact } from "@/server/repositories/artifacts";
import {
  archiveDirectionCreativeExpansions,
  createCreativeExpansions,
} from "@/server/repositories/creative-expansions";
import { getProjectCreativeDirection } from "@/server/repositories/creative-directions";
import { appendJobEvent, createJob, getJobInput, updateJobStatus } from "@/server/repositories/jobs";
import { recordStageProgress } from "@/server/use-cases/stage-progress";

const creativeExpansionJobInputSchema = z.object({
  directionId: z.string().uuid(),
  requestedBy: z.string().uuid().nullable().optional(),
});

const flexibleString = z.preprocess((value) => {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(formatUnknownValue).filter(Boolean).join("、");
  if (typeof value === "object") return Object.values(value).map(formatUnknownValue).filter(Boolean).join("、");
  return String(value);
}, z.string().default(""));

const flexibleStringArray = z.preprocess((value) => {
  if (Array.isArray(value)) return value.map(formatUnknownValue).filter(Boolean);
  if (typeof value === "string" && value.trim()) return value.split(/[、,，\n]/).map((item) => item.trim()).filter(Boolean);
  return [];
}, z.array(z.string()).default([]));

const storyArcSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, formatUnknownValue(item)]));
}, z.record(z.string(), z.string()).default({}));

const creativeExpansionSchema = z.object({
  title: flexibleString,
  oneLiner: flexibleString,
  storyArc: storyArcSchema,
  visualHighlights: flexibleStringArray,
  visualStyle: flexibleString,
  productionDifficulty: flexibleString,
  riskNotes: flexibleString,
});

const creativeExpansionResponseSchema = z.object({
  expansions: z.array(creativeExpansionSchema).min(1).max(6),
});

export async function enqueueCreativeExpansionGeneration(input: {
  projectId: string;
  directionId: string;
  requestedBy: string;
}) {
  const direction = await getProjectCreativeDirection({
    projectId: input.projectId,
    directionId: input.directionId,
  });

  if (!direction) {
    throw new AppError({
      status: 404,
      code: "creative_direction_not_found",
      userMessage: "没有找到这张创意方向卡片。它可能已经被归档或删除。",
    });
  }

  if (!direction.isSelected) {
    throw new AppError({
      status: 422,
      code: "creative_direction_not_selected",
      userMessage: "请先选中这个创意方向，再生成故事大纲或梗概。",
    });
  }

  const { jobId } = await createJob({
    projectId: input.projectId,
    type: "creative_expansion_generation",
    title: `深化创意方向：${direction.title}`,
    provider: env.TEXT_STRUCTURING_PROVIDER,
    modelName: env.ARK_TEXT_STRUCTURING_MODEL,
    inputJson: {
      directionId: input.directionId,
      requestedBy: input.requestedBy,
    },
    createdBy: input.requestedBy,
    maxAttempts: 2,
  });

  return { jobId };
}

export async function runCreativeExpansionGenerationJob(jobId: string, options: { workerManagedFailure?: boolean } = {}) {
  const job = await getJobInput<z.infer<typeof creativeExpansionJobInputSchema>>(jobId);
  if (!job) {
    throw new AppError({
      status: 404,
      code: "job_not_found",
      userMessage: "没有找到这个创意深化任务。",
    });
  }

  const parsedInput = creativeExpansionJobInputSchema.parse(job.input);
  const direction = await getProjectCreativeDirection({
    projectId: job.projectId,
    directionId: parsedInput.directionId,
  });

  if (!direction) {
    throw new AppError({
      status: 404,
      code: "creative_direction_not_found",
      userMessage: "没有找到这张创意方向卡片。它可能已经被归档或删除。",
    });
  }

  if (!direction.isSelected) {
    throw new AppError({
      status: 422,
      code: "creative_direction_not_selected",
      userMessage: "这个创意方向还没有被选中。请先选中方向，再生成故事大纲。",
    });
  }

  await updateJobStatus(jobId, {
    status: "processing",
    currentStep: "creative_expansion_generation",
    userMessage: "正在基于已选创意方向生成 4 个故事大纲或梗概。",
  });

  await appendJobEvent(jobId, {
    type: "step.started",
    jobId,
    projectId: job.projectId,
    stepId: "creative_expansion_generation",
    title: "开始深化创意方向",
    userMessage: "系统正在把已选方向展开成可进入提案的故事梗概。",
    at: new Date().toISOString(),
  });

  try {
    await appendJobEvent(jobId, {
      type: "tool.started",
      jobId,
      projectId: job.projectId,
      callId: "ark_creative_expansion_generation",
      title: "调用豆包生成故事大纲",
      payload: {
        provider: env.TEXT_STRUCTURING_PROVIDER,
        model: env.ARK_TEXT_STRUCTURING_MODEL,
        directionId: direction.id,
      },
      at: new Date().toISOString(),
    });

    const response = await callArkJson<z.infer<typeof creativeExpansionResponseSchema>>({
      model: env.ARK_TEXT_STRUCTURING_MODEL,
      timeoutMs: 180_000,
      maxOutputTokens: 1200,
      temperature: 0.1,
      telemetry: {
        projectId: job.projectId,
        jobId,
        callId: "ark_creative_expansion_generation",
        provider: env.TEXT_STRUCTURING_PROVIDER,
        operation: "creative_expansion_generation",
        metadata: { directionId: direction.id },
      },
      messages: [
        {
          role: "system",
          content:
            "你是 AIGC 视频创意策划。请快速生成恰好 4 个短故事大纲。只输出严格 JSON，不要 Markdown。格式：{\"expansions\":[{\"title\":\"\",\"oneLiner\":\"\",\"storyArc\":{\"beginning\":\"\",\"development\":\"\",\"turn\":\"\",\"ending\":\"\"},\"visualHighlights\":[\"\"],\"visualStyle\":\"\",\"productionDifficulty\":\"\",\"riskNotes\":\"\"}]}。每个字段使用短句。",
        },
        {
          role: "user",
          content: buildExpansionPrompt(direction),
        },
      ],
    });

    const parsed = creativeExpansionResponseSchema.parse(response);
    const normalized = normalizeExpansions(parsed.expansions, direction);

    if (normalized.length < 4) {
      throw new AppError({
        status: 502,
        code: "creative_expansion_count_too_low",
        userMessage: "模型没有返回恰好 4 个故事大纲。请稍后重试，或调整创意方向后再生成。",
      });
    }

    await archiveDirectionCreativeExpansions({ directionId: direction.id, sourceJobId: jobId });
    const savedExpansions = await createCreativeExpansions({
      projectId: job.projectId,
      directionId: direction.id,
      sourceJobId: jobId,
      createdBy: parsedInput.requestedBy ?? null,
      expansions: normalized.slice(0, 4).map((expansion, index) => ({
        ...expansion,
        sortOrder: index + 1,
      })),
    });

    const artifact = await createArtifact({
      projectId: job.projectId,
      kind: "creative_expansion",
      title: `故事大纲：${direction.title}`,
      status: "draft",
      data: {
        directionId: direction.id,
        directionTitle: direction.title,
        expansionIds: savedExpansions.map((item) => item.id),
        expansions: savedExpansions,
      },
      sourceJobId: jobId,
    });

    await appendJobEvent(jobId, {
      type: "artifact.created",
      jobId,
      projectId: job.projectId,
      artifactId: artifact.id,
      title: "已创建故事大纲快照",
      payload: {
        artifactKind: artifact.kind,
        expansionCount: savedExpansions.length,
      },
      userMessage: "故事大纲已保存到项目工作台，后续可进入氛围图生成。",
      at: new Date().toISOString(),
    });

    await recordStageProgress({
      projectId: job.projectId,
      stageKey: "creative_direction_proposal",
      status: "in_progress",
      currentStage: "creative_direction_proposal",
      projectStatus: "in_progress",
      jobId,
      title: "创意方向提案已深化",
      userMessage: "故事大纲已生成，创意方向提案正在推进到氛围图和提案整理。",
      inputRefs: [{ type: "creative_direction", id: direction.id }],
      outputRefs: [
        { type: "artifact", id: artifact.id, kind: artifact.kind },
        ...savedExpansions.map((expansion) => ({ type: "creative_expansion", id: expansion.id })),
      ],
      snapshot: {
        directionId: direction.id,
        expansionCount: savedExpansions.length,
      },
    });

    await appendJobEvent(jobId, {
      type: "job.completed",
      jobId,
      projectId: job.projectId,
      title: "创意深化完成",
      userMessage: "已生成 4 个故事大纲或梗概。",
      at: new Date().toISOString(),
    });

    await updateJobStatus(jobId, {
      status: "succeeded",
      currentStep: "completed",
      userMessage: "创意方向深化完成。",
    });

    return { jobId, expansions: savedExpansions, artifact };
  } catch (error) {
    const userMessage =
      error instanceof AppError
        ? error.userMessage
        : "创意方向深化失败。请稍后重试，或先人工改写方向后再生成。";

    await recordStageProgress({
      projectId: job.projectId,
      stageKey: "creative_direction_proposal",
      status: "needs_revision",
      currentStage: "creative_direction_proposal",
      projectStatus: "needs_revision",
      jobId,
      title: "创意方向提案需要修改",
      userMessage,
      errorMessage: userMessage,
    });

    await appendJobEvent(jobId, {
      type: "step.failed",
      jobId,
      projectId: job.projectId,
      stepId: "creative_expansion_generation",
      title: "创意方向深化失败",
      userMessage,
      recoverable: true,
      at: new Date().toISOString(),
    });

    if (!options.workerManagedFailure) {
      await updateJobStatus(jobId, {
        status: "failed",
        currentStep: "failed",
        userMessage,
        errorCode: error instanceof AppError ? error.code : "creative_expansion_generation_failed",
      });
    }

    throw error;
  }
}

type DirectionForExpansion = NonNullable<Awaited<ReturnType<typeof getProjectCreativeDirection>>>;

function buildExpansionPrompt(direction: DirectionForExpansion) {
  return [
    "基于这个已选创意方向，生成恰好 4 个可用于氛围图的故事大纲。",
    `标题：${compactText(direction.title, 80)}`,
    `核心：${compactText(direction.coreIdea, 220)}`,
    `适配：${compactText(direction.fitReason, 160)}`,
    `风险：${compactText(direction.riskNotes, 120)}`,
    `标签：${direction.referenceTags.slice(0, 5).map((tag) => compactText(tag, 18)).join("、")}`,
    "要求：每个大纲都要有不同的视觉画面；字段简短；不要解释；不要输出 JSON 以外的内容。",
  ].join("\n");
}

function compactText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

function normalizeExpansions(expansions: Array<z.infer<typeof creativeExpansionSchema>>, direction: DirectionForExpansion) {
  return expansions
    .map((expansion) => {
      const text = `${expansion.title} ${expansion.oneLiner} ${formatUnknownValue(expansion.storyArc)}`;
      return {
        title: expansion.title.trim(),
        oneLiner: expansion.oneLiner.trim(),
        storyArc: normalizeArc(expansion.storyArc),
        visualHighlights: Array.from(new Set(expansion.visualHighlights.map((item) => item.trim()).filter(Boolean))).slice(0, 6),
        visualStyle: expansion.visualStyle.trim() || direction.referenceTags.slice(0, 3).join("、") || "写实广告片质感",
        productionDifficulty: expansion.productionDifficulty.trim() || inferExpansionDifficulty(text, direction.technicalDifficulty),
        riskNotes: expansion.riskNotes.trim() || inferExpansionRisk(text, direction),
      };
    })
    .filter((expansion) => expansion.title && expansion.oneLiner && Object.keys(expansion.storyArc).length > 0);
}

function normalizeArc(value: Record<string, string>) {
  const fallback = {
    beginning: value.beginning ?? value["起"] ?? value["起承转合"] ?? "",
    development: value.development ?? value["承"] ?? "",
    turn: value.turn ?? value["转"] ?? "",
    ending: value.ending ?? value["合"] ?? "",
  };
  const normalized = Object.fromEntries(
    Object.entries({ ...fallback, ...value })
      .map(([key, item]) => [key, String(item ?? "").trim()])
      .filter(([, item]) => item)
  );
  return normalized;
}

function inferExpansionDifficulty(text: string, directionDifficulty: string) {
  if (directionDifficulty.includes("高")) return directionDifficulty;
  const highSignals = ["群像", "大场景", "写实人物", "球星", "复杂运镜", "三维资产"];
  return highSignals.some((signal) => text.includes(signal)) ? "中高" : "中";
}

function inferExpansionRisk(text: string, direction: DirectionForExpansion) {
  const risks = [];
  if (text.includes("球星") || text.includes("赛事")) risks.push("需要提前确认人物、赛事和素材授权边界");
  if (text.includes("写实")) risks.push("写实人物与品牌细节需要做一致性测试");
  if (direction.technicalDifficulty.includes("高")) risks.push("建议先验证关键镜头，控制返工风险");
  return risks.length ? risks.join("；") : "进入氛围图生成前需确认品牌禁忌、视觉尺度和交付规格。";
}

function formatUnknownValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(formatUnknownValue).filter(Boolean).join("、");
  if (typeof value === "object") return Object.values(value).map(formatUnknownValue).filter(Boolean).join("、");
  return String(value);
}
