import { z } from "zod";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { callArkJson } from "@/server/providers/ark";
import { createArtifact } from "@/server/repositories/artifacts";
import { appendJobEvent, createJob, getJobInput, updateJobStatus } from "@/server/repositories/jobs";
import { recordStageProgress } from "@/server/use-cases/stage-progress";

const flexibleString = z.preprocess((value) => {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return value.map((item) => normalizeTextValue(item)).filter(Boolean).join("、");
  }
  if (typeof value === "object") {
    return Object.values(value).map((item) => normalizeTextValue(item)).filter(Boolean).join("、");
  }
  return String(value);
}, z.string().default(""));

const flexibleStringArray = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "string" ? item : JSON.stringify(item)));
  }
  if (typeof value === "string" && value.trim()) return [value];
  return [];
}, z.array(z.string()).default([]));

const structuredRequirementSchema = z.object({
  brandInfo: flexibleString,
  productOrService: flexibleString,
  targetAudience: flexibleString,
  videoGoal: flexibleString,
  expectedStyle: flexibleString,
  referenceSamples: flexibleStringArray,
  keySellingPoints: flexibleStringArray,
  restrictions: flexibleStringArray,
  deliverySpecs: flexibleString,
  timeline: flexibleString,
  budgetOrQuoteInfo: flexibleString,
  openQuestions: flexibleStringArray,
  summary: flexibleString,
});

const requirementJobInputSchema = z.object({
  requirementText: z.string().min(1),
});

export type StructuredRequirement = z.infer<typeof structuredRequirementSchema>;

function normalizeTextValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map((item) => normalizeTextValue(item)).filter(Boolean).join("、");
  if (typeof value === "object") return Object.values(value).map((item) => normalizeTextValue(item)).filter(Boolean).join("、");
  return String(value);
}

export async function enqueueRequirementStructuring(input: {
  projectId: string;
  requirementText: string;
}) {
  const cleanText = input.requirementText.trim();
  if (!cleanText) {
    throw new AppError({
      status: 400,
      code: "empty_requirement_text",
      userMessage: "请先粘贴客户需求文本，再发起结构化整理。",
    });
  }

  const { jobId } = await createJob({
    projectId: input.projectId,
    type: "requirement_structuring",
    title: "结构化品牌方需求",
    provider: env.TEXT_STRUCTURING_PROVIDER,
    modelName: env.ARK_TEXT_STRUCTURING_MODEL,
    inputJson: {
      requirementText: cleanText,
    },
  });

  return { jobId };
}

export async function runRequirementStructuringJob(jobId: string, options: { workerManagedFailure?: boolean } = {}) {
  const job = await getJobInput<z.infer<typeof requirementJobInputSchema>>(jobId);
  if (!job) {
    throw new AppError({
      status: 404,
      code: "job_not_found",
      userMessage: "没有找到这个需求结构化任务。它可能已经被删除，或你没有权限查看。",
    });
  }

  const parsedInput = requirementJobInputSchema.parse(job.input);
  const cleanText = parsedInput.requirementText.trim();

  await updateJobStatus(jobId, {
    status: "processing",
    currentStep: "calling_ark_model",
    userMessage: "正在调用豆包模型整理客户需求。",
  });

  await appendJobEvent(jobId, {
    type: "step.started",
    jobId,
    projectId: job.projectId,
    stepId: "requirement_structuring",
    title: "开始结构化客户需求",
    userMessage: "系统正在把客户原始需求整理成统一模板。",
    at: new Date().toISOString(),
  });

  try {
    await appendJobEvent(jobId, {
      type: "tool.started",
      jobId,
      projectId: job.projectId,
      callId: "ark_requirement_structuring",
      title: "调用豆包文本结构化模型",
      payload: {
        provider: env.TEXT_STRUCTURING_PROVIDER,
        model: env.ARK_TEXT_STRUCTURING_MODEL,
        inputChars: cleanText.length,
      },
      at: new Date().toISOString(),
    });

    const result = await callArkJson<StructuredRequirement>({
      model: env.ARK_TEXT_STRUCTURING_MODEL,
      maxOutputTokens: 12000,
      timeoutMs: 150_000,
      telemetry: {
        projectId: job.projectId,
        jobId,
        callId: "ark_requirement_structuring",
        provider: env.TEXT_STRUCTURING_PROVIDER,
        operation: "requirement_structuring",
        metadata: { inputChars: cleanText.length },
      },
      messages: [
        {
          role: "system",
          content:
            "你是 AIGC 视频商业项目的资深需求分析师。请把客户原始需求整理为严格 JSON，不要输出 Markdown。字段必须包括 brandInfo, productOrService, targetAudience, videoGoal, expectedStyle, referenceSamples, keySellingPoints, restrictions, deliverySpecs, timeline, budgetOrQuoteInfo, openQuestions, summary。数组字段输出字符串数组。内容要简洁，summary 控制在 80 字以内。",
        },
        {
          role: "user",
          content: cleanText,
        },
      ],
    });

    const parsed = structuredRequirementSchema.parse(result);

    await appendJobEvent(jobId, {
      type: "tool.completed",
      jobId,
      projectId: job.projectId,
      callId: "ark_requirement_structuring",
      title: "豆包模型已返回结构化需求",
      payload: {
        openQuestionCount: parsed.openQuestions.length,
        keySellingPointCount: parsed.keySellingPoints.length,
      },
      at: new Date().toISOString(),
    });

    const artifact = await createArtifact({
      projectId: job.projectId,
      kind: "structured_requirement",
      title: "标准化客户需求模板",
      status: "draft",
      data: parsed,
      sourceJobId: jobId,
    });

    await appendJobEvent(jobId, {
      type: "artifact.created",
      jobId,
      projectId: job.projectId,
      artifactId: artifact.id,
      title: "已创建标准化客户需求模板",
      payload: {
        artifactKind: artifact.kind,
        artifactTitle: artifact.title,
      },
      userMessage: "客户需求已整理成统一模板，并保存到项目产物中。",
      at: new Date().toISOString(),
    });

    await recordStageProgress({
      projectId: job.projectId,
      stageKey: "brand_requirement_intake",
      status: "completed",
      currentStage: "technical_feasibility",
      projectStatus: "in_progress",
      jobId,
      title: "品牌方需求洽谈已完成",
      userMessage: "标准化需求已保存，项目已进入技术可行性评估阶段。",
      outputRefs: [{ type: "artifact", id: artifact.id, kind: artifact.kind }],
      snapshot: { artifactId: artifact.id, summary: parsed.summary },
    });

    await appendJobEvent(jobId, {
      type: "job.completed",
      jobId,
      projectId: job.projectId,
      title: "需求结构化完成",
      userMessage: "需求结构化完成。你可以在工作区查看并继续编辑。",
      at: new Date().toISOString(),
    });

    await updateJobStatus(jobId, {
      status: "succeeded",
      currentStep: "completed",
      userMessage: "需求结构化完成。",
    });

    return { jobId, artifact };
  } catch (error) {
    const userMessage =
      error instanceof AppError
        ? error.userMessage
        : "需求结构化失败。请稍后重试，或检查输入内容是否过长。";

    await recordStageProgress({
      projectId: job.projectId,
      stageKey: "brand_requirement_intake",
      status: "needs_revision",
      currentStage: "brand_requirement_intake",
      projectStatus: "needs_revision",
      jobId,
      title: "品牌方需求洽谈需要补充",
      userMessage,
      errorMessage: userMessage,
    });

    await appendJobEvent(jobId, {
      type: "step.failed",
      jobId,
      projectId: job.projectId,
      stepId: "requirement_structuring",
      title: "需求结构化失败",
      userMessage,
      recoverable: true,
      at: new Date().toISOString(),
    });

    if (!options.workerManagedFailure) {
      await updateJobStatus(jobId, {
        status: "failed",
        currentStep: "failed",
        userMessage,
        errorCode: error instanceof AppError ? error.code : "requirement_structuring_failed",
      });
    }

    throw error;
  }
}
