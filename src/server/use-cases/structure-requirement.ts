import { z } from "zod";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { callArkJson } from "@/server/providers/ark";
import { createArtifact } from "@/server/repositories/artifacts";
import { listProjectClientReviewTasks } from "@/server/repositories/client-reviews";
import { appendJobEvent, createJob, getJobInput, updateJobStatus } from "@/server/repositories/jobs";
import { setProjectCurrentStage } from "@/server/repositories/project-stages";
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

const REQUIREMENT_STRUCTURING_INPUT_LIMIT = 14_000;
const REQUIREMENT_STRUCTURING_HEAD_CHARS = 9_500;
const REQUIREMENT_STRUCTURING_TAIL_CHARS = 4_500;

export type StructuredRequirement = z.infer<typeof structuredRequirementSchema>;

function normalizeTextValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map((item) => normalizeTextValue(item)).filter(Boolean).join("、");
  if (typeof value === "object") return Object.values(value).map((item) => normalizeTextValue(item)).filter(Boolean).join("、");
  return String(value);
}

function prepareRequirementStructuringInput(value: string) {
  const normalized = value.replace(/\n{3,}/g, "\n\n").trim();
  if (normalized.length <= REQUIREMENT_STRUCTURING_INPUT_LIMIT) return normalized;

  return [
    normalized.slice(0, REQUIREMENT_STRUCTURING_HEAD_CHARS),
    "【系统提示】原始材料过长，中间部分已省略。请优先抽取保留材料中的明确信息；无法确认的信息必须写入 openQuestions，不能猜测。",
    normalized.slice(-REQUIREMENT_STRUCTURING_TAIL_CHARS),
  ].join("\n\n");
}

function extractAnsweredOpenQuestions(input: string) {
  const match = input.match(/【本轮待补充问题】\s*\n([\s\S]*?)(?:\n\n【|$)/);
  if (!match) return [];
  return match[1]
    .split("\n")
    .map((line) => normalizeOpenQuestionForComparison(line))
    .filter(Boolean);
}

function removeAnsweredOpenQuestions(openQuestions: string[], answeredQuestions: string[]) {
  const answered = answeredQuestions.map(normalizeOpenQuestionForComparison).filter(Boolean);
  if (answered.length === 0) return openQuestions;
  return openQuestions.filter((question) => {
    const normalized = normalizeOpenQuestionForComparison(question);
    return !answered.some((answeredQuestion) => (
      normalized === answeredQuestion ||
      normalized.includes(answeredQuestion) ||
      answeredQuestion.includes(normalized)
    ));
  });
}

function normalizeOpenQuestionForComparison(value: string) {
  return value
    .replace(/^\s*(?:Q\s*)?\d+\s*[.、．-]?\s*/i, "")
    .replace(/[？?。.\s]+$/g, "")
    .trim();
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
  const modelInputText = prepareRequirementStructuringInput(cleanText);

  await updateJobStatus(jobId, {
    status: "processing",
    currentStep: "calling_ark_model",
    userMessage: "在生成中",
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
        modelInputChars: modelInputText.length,
      },
      at: new Date().toISOString(),
    });

    const result = await callArkJson<StructuredRequirement>({
      model: env.ARK_TEXT_STRUCTURING_MODEL,
      maxOutputTokens: 5000,
      timeoutMs: 180_000,
      telemetry: {
        projectId: job.projectId,
        jobId,
        callId: "ark_requirement_structuring",
        provider: env.TEXT_STRUCTURING_PROVIDER,
        operation: "requirement_structuring",
        metadata: {
          inputChars: cleanText.length,
          modelInputChars: modelInputText.length,
          inputTrimmed: modelInputText.length < cleanText.length,
        },
      },
      messages: [
        {
          role: "system",
          content:
            "你是 AIGC 视频商业项目的需求结构化助手。只输出一个严格 JSON 对象，不要 Markdown、解释或代码块。字段必须包括 brandInfo, productOrService, targetAudience, videoGoal, expectedStyle, referenceSamples, keySellingPoints, restrictions, deliverySpecs, timeline, budgetOrQuoteInfo, openQuestions, summary。Brief 的最低推进标准是尽量抽取品牌/客户、项目内容、视频目标、交付形式、时间节点、敏感内容或授权风险；目标受众、风格参考、投放渠道、时长、核心卖点、预算、客户偏好、参考案例属于建议项；角色、场景、特效复杂度、画面细节、文件规格、审核人和反馈规则可后续补充。只根据材料明确出现的信息填写；缺失或不确定项写入 openQuestions，但 openQuestions 只作为待确认提示，不代表 Brief 不可进入下一环节。如果输入中包含本轮待补充问题和客户针对该问题的回复，已回答的问题不得继续写入 openQuestions，只保留仍未解决的问题。数组字段输出字符串数组。每个字段保持简洁，summary 控制在 80 字以内。",
        },
        {
          role: "user",
          content: modelInputText,
        },
      ],
    });

    const parsed = structuredRequirementSchema.parse(result);
    const answeredOpenQuestions = extractAnsweredOpenQuestions(cleanText);
    const structuredRequirement: StructuredRequirement = {
      ...parsed,
      openQuestions: removeAnsweredOpenQuestions(parsed.openQuestions, answeredOpenQuestions),
    };

    await appendJobEvent(jobId, {
      type: "tool.completed",
      jobId,
      projectId: job.projectId,
      callId: "ark_requirement_structuring",
      title: "豆包模型已返回结构化需求",
      payload: {
        openQuestionCount: structuredRequirement.openQuestions.length,
        keySellingPointCount: structuredRequirement.keySellingPoints.length,
      },
      at: new Date().toISOString(),
    });

    const artifact = await createArtifact({
      projectId: job.projectId,
      kind: "structured_requirement",
      title: "标准化客户需求模板",
      status: "draft",
      data: structuredRequirement,
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
      status: "in_progress",
      currentStage: "brand_requirement_intake",
      projectStatus: "in_progress",
      jobId,
      title: "品牌方需求洽谈已整理",
      userMessage: "标准化需求已保存，项目仍停留在 Brief 环节。请补齐缺失项或人工确认 Brief 后再进入接单风险评估。",
      outputRefs: [{ type: "artifact", id: artifact.id, kind: artifact.kind }],
      snapshot: { artifactId: artifact.id, summary: structuredRequirement.summary },
    });
    await ensureBriefStageAfterStructuring(job.projectId, "in_progress");

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
    await ensureBriefStageAfterStructuring(job.projectId, "needs_revision");

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

async function ensureBriefStageAfterStructuring(projectId: string, status: "in_progress" | "needs_revision") {
  const tasks = await listProjectClientReviewTasks(projectId);
  const hasApprovedBriefConfirmation = tasks.some((task) => task.reviewType === "brief_confirmation" && task.status === "approved");
  if (hasApprovedBriefConfirmation) return;

  await setProjectCurrentStage({
    projectId,
    currentStage: "brand_requirement_intake",
    status,
  });
}
