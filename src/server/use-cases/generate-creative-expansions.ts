import { z } from "zod";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { callArkJson } from "@/server/providers/ark";
import { createArtifact, listProjectArtifacts, updateArtifactStatus, type ArtifactSummary } from "@/server/repositories/artifacts";
import {
  archiveDirectionCreativeExpansions,
  createCreativeExpansions,
} from "@/server/repositories/creative-expansions";
import { getProjectCreativeDirection } from "@/server/repositories/creative-directions";
import { appendJobEvent, createJob, getJobInput, updateJobStatus } from "@/server/repositories/jobs";
import { recordStageProgress } from "@/server/use-cases/stage-progress";

const creativeExpansionJobInputSchema = z.object({
  directionId: z.string().uuid(),
  operation: z.enum(["story_cards", "round2_outline", "round2_script", "round2_split_storyboard"]).optional().default("story_cards"),
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

export function parseCreativeExpansionResponse(response: unknown) {
  const items = extractCreativeExpansionItems(response);
  return creativeExpansionResponseSchema.parse({
    expansions: items.map(normalizeCreativeExpansionItem),
  });
}

function extractCreativeExpansionItems(response: unknown): unknown[] {
  if (Array.isArray(response)) return response;
  if (!isRecord(response)) return [];

  const nestedItems = findCreativeExpansionArray(response);
  if (nestedItems) return nestedItems;

  for (const key of EXPANSION_ARRAY_KEYS) {
    const value = response[key];
    if (Array.isArray(value)) return value;
    if (isRecord(value)) {
      const values = Object.values(value);
      if (values.length > 0 && values.every(isRecord)) return values;
    }
  }

  if (hasAnyKey(response, ["title", "sceneTitle", "shotTitle", "oneLiner", "description", "sceneDescription"])) {
    return [response];
  }

  const objectValues = Object.values(response).filter(isRecord);
  return objectValues.length > 0 ? objectValues : [];
}

const EXPANSION_ARRAY_KEYS = [
  "expansions",
  "scenes",
  "storyboardScenes",
  "storyboard_scenes",
  "storyboard",
  "storyboards",
  "shots",
  "items",
  "data",
  "result",
  "results",
  "精彩场景",
  "分镜场景",
  "精彩分镜",
  "场景",
  "分镜",
  "镜头",
];

function findCreativeExpansionArray(value: unknown, depth = 0): unknown[] | null {
  if (depth > 4) return null;
  if (Array.isArray(value)) {
    return value.some(isRecord) ? value : null;
  }
  if (!isRecord(value)) return null;

  for (const key of EXPANSION_ARRAY_KEYS) {
    const nested = value[key];
    const found = findCreativeExpansionArray(nested, depth + 1);
    if (found) return found;
  }

  for (const nested of Object.values(value)) {
    const found = findCreativeExpansionArray(nested, depth + 1);
    if (found) return found;
  }

  return null;
}

function normalizeCreativeExpansionItem(item: unknown, index: number) {
  if (!isRecord(item)) {
    const text = formatUnknownValue(item);
    return {
      title: text || `精彩场景 ${index + 1}`,
      oneLiner: text,
      storyArc: text ? { beginning: text } : {},
      visualHighlights: text ? [text] : [],
      visualStyle: "",
      productionDifficulty: "",
      riskNotes: "",
    };
  }

  const description = pickFirstValue(item, [
    "oneLiner",
    "one_liner",
    "summary",
    "description",
    "sceneDescription",
    "scene_description",
    "visualDescription",
    "visual_description",
    "shotDescription",
    "shot_description",
    "content",
    "story",
    "plot",
    "narrative",
    "一句话",
    "一句话描述",
    "摘要",
    "梗概",
    "故事梗概",
    "剧情",
    "画面内容",
    "画面",
    "画面描述",
    "场景描述",
    "镜头描述",
  ]);
  const genericText = formatUnknownValue(item);
  const descriptionText = formatUnknownValue(description) || genericText;
  const titleText =
    formatUnknownValue(pickFirstValue(item, ["title", "sceneTitle", "scene_title", "shotTitle", "shot_title", "name", "标题", "场景标题", "镜头标题"])) ||
    deriveExpansionTitle(descriptionText, index);
  const highlights = pickFirstValue(item, [
    "visualHighlights",
    "visual_highlights",
    "visuals",
    "keyVisuals",
    "key_visuals",
    "visualElements",
    "visual_elements",
    "highlights",
    "shots",
    "imageHighlights",
    "image_highlights",
    "画面亮点",
    "视觉亮点",
    "关键画面",
    "视觉元素",
  ]);

  return {
    title: titleText,
    oneLiner: descriptionText || formatUnknownValue(highlights) || titleText,
    storyArc: buildStoryArcFromAliases(item, descriptionText),
    visualHighlights: highlights ?? (descriptionText ? [descriptionText] : []),
    visualStyle: pickFirstValue(item, ["visualStyle", "visual_style", "style", "visualTone", "visual_tone", "tone", "视觉风格", "视觉调性"]),
    productionDifficulty: pickFirstValue(item, ["productionDifficulty", "production_difficulty", "difficulty", "制作难度"]),
    riskNotes: pickFirstValue(item, ["riskNotes", "risk_notes", "risk", "notes", "风险提示", "风险", "备注"]),
  };
}

function buildStoryArcFromAliases(item: Record<string, unknown>, description: string) {
  const explicitArc = pickFirstValue(item, ["storyArc", "arc", "story", "narrative", "storyline", "起承转合"]);
  if (isRecord(explicitArc)) return explicitArc;

  const arc = {
    beginning: pickFirstValue(item, ["beginning", "setup", "opening", "start", "起", "开端", "开始"]),
    development: pickFirstValue(item, ["development", "action", "middle", "progress", "承", "发展", "推进"]),
    turn: pickFirstValue(item, ["turn", "climax", "twist", "peak", "转", "高潮", "转折"]),
    ending: pickFirstValue(item, ["ending", "end", "resolution", "finish", "合", "结尾"]),
  };
  const normalized = Object.fromEntries(
    Object.entries(arc)
      .map(([key, value]) => [key, formatUnknownValue(value)])
      .filter(([, value]) => value)
  );
  return Object.keys(normalized).length > 0 ? normalized : description ? { beginning: description } : {};
}

function pickFirstValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && !value.trim()) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (isRecord(value) && Object.keys(value).length === 0) continue;
    return value;
  }
  return undefined;
}

function hasAnyKey(record: Record<string, unknown>, keys: string[]) {
  return keys.some((key) => key in record);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function deriveExpansionTitle(description: string, index: number) {
  const normalized = description.replace(/\s+/g, " ").trim();
  if (!normalized) return `精彩场景 ${index + 1}`;
  return normalized.length > 18 ? normalized.slice(0, 18) : normalized;
}

const round2OutlineResponseSchema = z.object({
  title: flexibleString.optional().default("深化故事稿"),
  outline: flexibleString,
});

const round2ScriptResponseSchema = z.object({
  title: flexibleString.optional().default("完整故事"),
  script: flexibleString,
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

export async function enqueueRound2DeepeningOutlineGeneration(input: {
  projectId: string;
  directionId: string;
  requestedBy: string;
}) {
  return enqueueCreativeExpansionOperation({
    ...input,
    operation: "round2_outline",
    titlePrefix: "生成深化故事稿",
  });
}

export async function enqueueRound2DeepeningScriptGeneration(input: {
  projectId: string;
  directionId: string;
  requestedBy: string;
}) {
  return enqueueCreativeExpansionOperation({
    ...input,
    operation: "round2_script",
    titlePrefix: "生成完整故事",
  });
}

export async function enqueueRound2DeepeningStoryboardSplit(input: {
  projectId: string;
  directionId: string;
  requestedBy: string;
}) {
  return enqueueCreativeExpansionOperation({
    ...input,
    operation: "round2_split_storyboard",
    titlePrefix: "精选精彩场景",
  });
}

async function enqueueCreativeExpansionOperation(input: {
  projectId: string;
  directionId: string;
  requestedBy: string;
  operation: z.infer<typeof creativeExpansionJobInputSchema>["operation"];
  titlePrefix: string;
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

  assertDirectionSelectedForDeepening(direction);

  const { jobId } = await createJob({
    projectId: input.projectId,
    type: "creative_expansion_generation",
    title: `${input.titlePrefix}：${direction.title}`,
    provider: env.TEXT_STRUCTURING_PROVIDER,
    modelName: env.ARK_TEXT_STRUCTURING_MODEL,
    inputJson: {
      directionId: input.directionId,
      operation: input.operation,
      requestedBy: input.requestedBy,
    },
    createdBy: input.requestedBy,
    maxAttempts: 2,
  });

  return { jobId };
}

function assertDirectionSelectedForDeepening(direction: { isSelected: boolean }) {
  if (!direction.isSelected) {
    throw new AppError({
      status: 422,
      code: "creative_direction_not_selected",
      userMessage: "请先确认这个创意方向已进入深化，再继续生成深化故事稿、完整故事或精彩场景。",
    });
  }
}

export async function confirmRound2DeepeningScript(input: {
  projectId: string;
  directionId: string;
}) {
  const artifacts = await listProjectArtifacts(input.projectId);
  const scriptArtifact = findLatestRound2Artifact(artifacts, input.directionId, "round2_deepening_script");
  if (!scriptArtifact || !readArtifactString(scriptArtifact, "script")) {
    throw new AppError({
      status: 422,
      code: "round2_deepening_script_missing",
      userMessage: "请先生成 700-800 字完整故事，再确认并精选精彩场景。",
    });
  }

  const updated = await updateArtifactStatus({
    projectId: input.projectId,
    artifactId: scriptArtifact.id,
    status: "confirmed",
  });
  if (!updated) {
    throw new AppError({
      status: 404,
      code: "round2_deepening_script_not_found",
      userMessage: "没有找到这份完整故事。请刷新后重新生成。",
    });
  }

  return {
    artifact: updated,
    message: "完整故事已确认，现在可以精选 4 个精彩场景。",
  };
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

  if (parsedInput.operation === "round2_outline") {
    assertDirectionSelectedForDeepening(direction);
    return runRound2OutlineGenerationJob({ jobId, job, direction, requestedBy: parsedInput.requestedBy ?? null, options });
  }

  if (parsedInput.operation === "round2_script") {
    assertDirectionSelectedForDeepening(direction);
    return runRound2ScriptGenerationJob({ jobId, job, direction, requestedBy: parsedInput.requestedBy ?? null, options });
  }

  if (parsedInput.operation === "round2_split_storyboard") {
    assertDirectionSelectedForDeepening(direction);
    return runRound2StoryboardSplitJob({ jobId, job, direction, requestedBy: parsedInput.requestedBy ?? null, options });
  }

  await updateJobStatus(jobId, {
    status: "processing",
    currentStep: "creative_expansion_generation",
    userMessage: "正在基于创意方向生成 4 个故事大纲或梗概。",
  });

  await appendJobEvent(jobId, {
    type: "step.started",
    jobId,
    projectId: job.projectId,
    stepId: "creative_expansion_generation",
    title: "开始深化创意方向",
    userMessage: "系统正在把创意方向展开成可进入提案的故事梗概。",
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

    const parsed = parseCreativeExpansionResponse(response);
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
type CreativeExpansionJob = NonNullable<Awaited<ReturnType<typeof getJobInput<z.infer<typeof creativeExpansionJobInputSchema>>>>>;

async function runRound2OutlineGenerationJob(input: {
  jobId: string;
  job: CreativeExpansionJob;
  direction: DirectionForExpansion;
  requestedBy: string | null;
  options: { workerManagedFailure?: boolean };
}) {
  await updateJobStatus(input.jobId, {
    status: "processing",
    currentStep: "round2_outline_generation",
    userMessage: "正在把已确认方向扩展成深化故事稿。",
  });

  try {
    const response = await callArkJson<z.infer<typeof round2OutlineResponseSchema>>({
      model: env.ARK_TEXT_STRUCTURING_MODEL,
      timeoutMs: 180_000,
      maxOutputTokens: 1600,
      temperature: 0.1,
      telemetry: {
        projectId: input.job.projectId,
        jobId: input.jobId,
        callId: "ark_round2_outline_generation",
        provider: env.TEXT_STRUCTURING_PROVIDER,
        operation: "round2_deepening_outline_generation",
        metadata: { directionId: input.direction.id },
      },
      messages: [
        {
          role: "system",
          content: "你是 AIGC 视频创意策划。请把选定创意方向扩展为深化故事稿，只输出严格 JSON：{\"title\":\"\",\"outline\":\"\"}。outline 用中文自然段，包含人物、起因、发展、高潮、结尾和视觉调性，为后续 700-800 字完整故事提供清晰骨架，不要 Markdown。",
        },
        { role: "user", content: buildRound2OutlinePrompt(input.direction) },
      ],
    });

    const parsed = round2OutlineResponseSchema.parse(response);
    if (!parsed.outline.trim()) {
      throw new AppError({ status: 502, code: "round2_outline_empty", userMessage: "模型没有返回可用的深化故事稿。请稍后重试，或先人工改写创意方向。" });
    }

    const artifact = await createArtifact({
      projectId: input.job.projectId,
      kind: "proposal",
      title: `Round 2 深化故事稿：${input.direction.title}`,
      status: "draft",
      data: {
        sop3ArtifactType: "round2_deepening_outline",
        directionId: input.direction.id,
        directionTitle: input.direction.title,
        title: parsed.title || `深化故事稿：${input.direction.title}`,
        outline: parsed.outline.trim(),
      },
      sourceJobId: input.jobId,
      createdBy: input.requestedBy,
    });

    await completeRound2Job({ jobId: input.jobId, projectId: input.job.projectId, direction: input.direction, artifact, title: "深化故事稿已生成", userMessage: "深化故事稿已生成。下一步可以基于它生成 700-800 字完整故事。" });
    return { jobId: input.jobId, artifact };
  } catch (error) {
    await failRound2Job({ ...input, error, fallbackMessage: "深化故事稿生成失败。请稍后重试，或先人工改写方向后再生成。" });
    throw error;
  }
}

async function runRound2ScriptGenerationJob(input: {
  jobId: string;
  job: CreativeExpansionJob;
  direction: DirectionForExpansion;
  requestedBy: string | null;
  options: { workerManagedFailure?: boolean };
}) {
  const artifacts = await listProjectArtifacts(input.job.projectId);
  const outlineArtifact = findLatestRound2Artifact(artifacts, input.direction.id, "round2_deepening_outline");
  const outline = outlineArtifact ? readArtifactString(outlineArtifact, "outline") : "";
  if (!outline) {
    throw new AppError({ status: 422, code: "round2_outline_required", userMessage: "请先生成深化故事稿，再生成 700-800 字完整故事。" });
  }

  await updateJobStatus(input.jobId, {
    status: "processing",
    currentStep: "round2_script_generation",
    userMessage: "正在基于深化故事稿生成 700-800 字完整故事。",
  });

  try {
    const response = await callArkJson<z.infer<typeof round2ScriptResponseSchema>>({
      model: env.ARK_TEXT_STRUCTURING_MODEL,
      timeoutMs: 180_000,
      maxOutputTokens: 1800,
      temperature: 0.1,
      telemetry: {
        projectId: input.job.projectId,
        jobId: input.jobId,
        callId: "ark_round2_script_generation",
        provider: env.TEXT_STRUCTURING_PROVIDER,
        operation: "round2_deepening_script_generation",
        metadata: { directionId: input.direction.id, outlineArtifactId: outlineArtifact?.id },
      },
      messages: [
        {
          role: "system",
          content: "你是 AIGC 视频短片编剧。请基于深化故事稿生成 700-800 字中文完整故事，只输出严格 JSON：{\"title\":\"\",\"script\":\"\"}。script 要有开端、推进、高潮、结尾、关键画面和角色动作，适合后续从中精选 4 个精彩场景生成图片，不要 Markdown。",
        },
        { role: "user", content: buildRound2ScriptPrompt(input.direction, outline) },
      ],
    });

    const parsed = round2ScriptResponseSchema.parse(response);
    if (!parsed.script.trim()) {
      throw new AppError({ status: 502, code: "round2_script_empty", userMessage: "模型没有返回可用的完整故事。请稍后重试，或先调整深化故事稿。" });
    }

    const artifact = await createArtifact({
      projectId: input.job.projectId,
      kind: "proposal",
      title: `Round 2 完整故事：${input.direction.title}`,
      status: "draft",
      data: {
        sop3ArtifactType: "round2_deepening_script",
        directionId: input.direction.id,
        directionTitle: input.direction.title,
        outlineArtifactId: outlineArtifact?.id ?? null,
        title: parsed.title || `完整故事：${input.direction.title}`,
        script: parsed.script.trim(),
        targetLength: "700-800 字",
      },
      sourceJobId: input.jobId,
      createdBy: input.requestedBy,
    });

    await completeRound2Job({ jobId: input.jobId, projectId: input.job.projectId, direction: input.direction, artifact, title: "完整故事已生成", userMessage: "700-800 字完整故事已生成。请人工确认后再精选 4 个精彩场景。" });
    return { jobId: input.jobId, artifact };
  } catch (error) {
    await failRound2Job({ ...input, error, fallbackMessage: "完整故事生成失败。请稍后重试，或先调整深化故事稿。" });
    throw error;
  }
}

async function runRound2StoryboardSplitJob(input: {
  jobId: string;
  job: CreativeExpansionJob;
  direction: DirectionForExpansion;
  requestedBy: string | null;
  options: { workerManagedFailure?: boolean };
}) {
  const artifacts = await listProjectArtifacts(input.job.projectId);
  const scriptArtifact = findLatestRound2Artifact(artifacts, input.direction.id, "round2_deepening_script");
  const script = scriptArtifact ? readArtifactString(scriptArtifact, "script") : "";
  if (!scriptArtifact || scriptArtifact.status !== "confirmed" || !script) {
    throw new AppError({ status: 422, code: "round2_script_confirmation_required", userMessage: "请先确认完整故事，再从中精选 4 个精彩场景。" });
  }

  await updateJobStatus(input.jobId, {
    status: "processing",
    currentStep: "round2_storyboard_split",
    userMessage: "正在从已确认完整故事中精选 4 个精彩场景。",
  });

  try {
    const response = await callArkJson<z.infer<typeof creativeExpansionResponseSchema>>({
      model: env.ARK_TEXT_STRUCTURING_MODEL,
      timeoutMs: 180_000,
      maxOutputTokens: 1800,
      temperature: 0.1,
      telemetry: {
        projectId: input.job.projectId,
        jobId: input.jobId,
        callId: "ark_round2_storyboard_split",
        provider: env.TEXT_STRUCTURING_PROVIDER,
        operation: "round2_deepening_storyboard_split",
        metadata: { directionId: input.direction.id, scriptArtifactId: scriptArtifact.id },
      },
      messages: [
        {
          role: "system",
          content: "你是 AIGC 视频视觉场景策划。请从已确认完整故事中选出恰好 4 个最精彩、最适合生成图片的视觉场景。只输出严格 JSON：{\"expansions\":[{\"title\":\"\",\"oneLiner\":\"\",\"storyArc\":{\"beginning\":\"\",\"development\":\"\",\"turn\":\"\",\"ending\":\"\"},\"visualHighlights\":[\"\"],\"visualStyle\":\"\",\"productionDifficulty\":\"\",\"riskNotes\":\"\"}]}。expansions 必须恰好包含 4 个对象，每个对象是一条独立精彩场景；不要输出镜头号、分镜编号或正式文字分镜；不要把 4 个画面写成 visualHighlights 数组；visualHighlights 只能写当前场景内部的视觉细节。每个场景要能独立生成图片。",
        },
        { role: "user", content: buildRound2StoryboardSplitPrompt(input.direction, script) },
      ],
    });

    const parsed = parseCreativeExpansionResponse(response);
    let normalized = normalizeExpansions(parsed.expansions, input.direction);
    if (normalized.length < 4) {
      normalized = buildFallbackRound2StoryboardScenes({
        expansions: parsed.expansions,
        direction: input.direction,
        script,
      });
    }
    if (normalized.length < 4) {
      throw new AppError({ status: 502, code: "round2_storyboard_scene_count_too_low", userMessage: "模型没有选出 4 个可用精彩场景。请稍后重试，或先调整完整故事。" });
    }

    await archiveDirectionCreativeExpansions({ directionId: input.direction.id, sourceJobId: input.jobId });
    const savedExpansions = await createCreativeExpansions({
      projectId: input.job.projectId,
      directionId: input.direction.id,
      sourceJobId: input.jobId,
      createdBy: input.requestedBy,
      expansions: normalized.slice(0, 4).map((expansion, index) => ({ ...expansion, sortOrder: index + 1 })),
    });

    const artifact = await createArtifact({
      projectId: input.job.projectId,
      kind: "creative_expansion",
      title: `Round 2 四个精彩场景：${input.direction.title}`,
      status: "draft",
      data: {
        sop3ArtifactType: "round2_deepening_storyboard_split",
        directionId: input.direction.id,
        directionTitle: input.direction.title,
        scriptArtifactId: scriptArtifact.id,
        expansionIds: savedExpansions.map((item) => item.id),
        expansions: savedExpansions,
      },
      sourceJobId: input.jobId,
      createdBy: input.requestedBy,
    });

    await completeRound2Job({ jobId: input.jobId, projectId: input.job.projectId, direction: input.direction, artifact, title: "四个精彩场景已精选", userMessage: "已从完整故事精选 4 个精彩场景。下一步可以为每个场景生成深化视觉图。" });
    return { jobId: input.jobId, expansions: savedExpansions, artifact };
  } catch (error) {
    await failRound2Job({ ...input, error, fallbackMessage: "精彩场景精选失败。请稍后重试，或先调整完整故事。" });
    throw error;
  }
}

async function completeRound2Job(input: {
  jobId: string;
  projectId: string;
  direction: DirectionForExpansion;
  artifact: ArtifactSummary;
  title: string;
  userMessage: string;
}) {
  await appendJobEvent(input.jobId, {
    type: "artifact.created",
    jobId: input.jobId,
    projectId: input.projectId,
    artifactId: input.artifact.id,
    title: input.title,
    payload: { artifactKind: input.artifact.kind, directionId: input.direction.id },
    userMessage: input.userMessage,
    at: new Date().toISOString(),
  });
  await recordStageProgress({
    projectId: input.projectId,
    stageKey: "creative_direction_proposal",
    status: "in_progress",
    currentStage: "creative_direction_proposal",
    projectStatus: "in_progress",
    jobId: input.jobId,
    title: input.title,
    userMessage: input.userMessage,
    inputRefs: [{ type: "creative_direction", id: input.direction.id }],
    outputRefs: [{ type: "artifact", id: input.artifact.id, kind: input.artifact.kind }],
    snapshot: { directionId: input.direction.id, artifactId: input.artifact.id },
  });
  await appendJobEvent(input.jobId, {
    type: "job.completed",
    jobId: input.jobId,
    projectId: input.projectId,
    title: input.title,
    userMessage: input.userMessage,
    at: new Date().toISOString(),
  });
  await updateJobStatus(input.jobId, { status: "succeeded", currentStep: "completed", userMessage: input.userMessage });
}

async function failRound2Job(input: {
  jobId: string;
  job: CreativeExpansionJob;
  error: unknown;
  fallbackMessage: string;
  options: { workerManagedFailure?: boolean };
}) {
  const userMessage = input.error instanceof AppError ? input.error.userMessage : input.fallbackMessage;
  await recordStageProgress({
    projectId: input.job.projectId,
    stageKey: "creative_direction_proposal",
    status: "needs_revision",
    currentStage: "creative_direction_proposal",
    projectStatus: "needs_revision",
    jobId: input.jobId,
    title: "创意方向深化需要修改",
    userMessage,
    errorMessage: userMessage,
  });
  await appendJobEvent(input.jobId, {
    type: "step.failed",
    jobId: input.jobId,
    projectId: input.job.projectId,
    stepId: "creative_expansion_generation",
    title: "创意方向深化失败",
    userMessage,
    recoverable: true,
    at: new Date().toISOString(),
  });
  if (!input.options.workerManagedFailure) {
    await updateJobStatus(input.jobId, {
      status: "failed",
      currentStep: "failed",
      userMessage,
      errorCode: input.error instanceof AppError ? input.error.code : "creative_expansion_generation_failed",
    });
  }
}

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

function buildRound2OutlinePrompt(direction: DirectionForExpansion) {
  return [
    "请基于这个已由甲方第一轮保留的创意方向，扩展深化故事稿。",
    `标题：${compactText(direction.title, 80)}`,
    `核心：${compactText(direction.coreIdea, 260)}`,
    `适配：${compactText(direction.fitReason, 180)}`,
    `视觉提示：${compactText(direction.atmospherePrompt, 180)}`,
    `标签：${direction.referenceTags.slice(0, 6).map((tag) => compactText(tag, 18)).join("、")}`,
    "要求：深化故事稿要能支撑 700-800 字完整故事；不要拆分分镜；不要输出 JSON 以外的内容。",
  ].join("\n");
}

function buildRound2ScriptPrompt(direction: DirectionForExpansion, outline: string) {
  return [
    "请基于深化故事稿生成 700-800 字完整故事。",
    `方向标题：${compactText(direction.title, 80)}`,
    `方向核心：${compactText(direction.coreIdea, 220)}`,
    `深化故事稿：${compactText(outline, 2400)}`,
    "要求：故事要连贯完整，包含角色行动、关键画面、情绪推进和结尾；后续会从中精选 4 个最精彩、最适合生成图片的场景；不要输出 JSON 以外的内容。",
  ].join("\n");
}

function buildRound2StoryboardSplitPrompt(direction: DirectionForExpansion, script: string) {
  return [
    "请从已确认完整故事中选出 4 个最精彩、最适合生成图片的视觉场景。",
    `方向标题：${compactText(direction.title, 80)}`,
    `方向核心：${compactText(direction.coreIdea, 220)}`,
    `完整故事：${compactText(script, 2600)}`,
    "要求：四个场景要覆盖故事关键转折，彼此画面不同；每个场景都必须有清晰视觉动作和生成图价值；不要写成分镜编号、镜头拆解或正式文字分镜；不要输出 JSON 以外的内容。",
  ].join("\n");
}

export function findLatestRound2Artifact(
  artifacts: ArtifactSummary[],
  directionId: string,
  type: "round2_deepening_outline" | "round2_deepening_script" | "round2_deepening_storyboard_split"
) {
  return artifacts.find((artifact) => {
    if (artifact.kind !== "proposal" && artifact.kind !== "creative_expansion") return false;
    return readArtifactString(artifact, "sop3ArtifactType") === type && readArtifactString(artifact, "directionId") === directionId;
  }) ?? null;
}

export function readArtifactString(artifact: Pick<ArtifactSummary, "data">, key: string) {
  if (!artifact.data || typeof artifact.data !== "object") return "";
  const value = (artifact.data as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
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

function buildFallbackRound2StoryboardScenes(input: {
  expansions: Array<z.infer<typeof creativeExpansionSchema>>;
  direction: DirectionForExpansion;
  script: string;
}) {
  const firstExpansion = input.expansions[0];
  const highlights = firstExpansion?.visualHighlights ?? [];
  const scriptSegments = splitTextIntoFourParts(input.script);
  const sceneTexts = Array.from({ length: 4 }, (_, index) => {
    const highlight = highlights[index]?.trim();
    const scriptSegment = scriptSegments[index]?.trim();
    return [highlight, scriptSegment].filter(Boolean).join("。");
  }).filter(Boolean);

  return sceneTexts.slice(0, 4).map((text, index) => {
    const sceneTitle = deriveFallbackSceneTitle(text, index);
    return {
      title: sceneTitle,
      oneLiner: text,
      storyArc: {
        beginning: text,
      },
      visualHighlights: [text],
      visualStyle: firstExpansion?.visualStyle.trim() || input.direction.referenceTags.slice(0, 3).join("、") || "写实广告片质感",
      productionDifficulty:
        firstExpansion?.productionDifficulty.trim() || inferExpansionDifficulty(`${sceneTitle} ${text}`, input.direction.technicalDifficulty),
      riskNotes: firstExpansion?.riskNotes.trim() || inferExpansionRisk(text, input.direction),
    };
  });
}

function splitTextIntoFourParts(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const sentences = normalized.match(/[^。！？!?]+[。！？!?]?/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [normalized];
  const buckets = ["", "", "", ""];
  sentences.forEach((sentence, index) => {
    buckets[index % 4] = [buckets[index % 4], sentence].filter(Boolean).join("");
  });

  if (buckets.some((bucket) => bucket)) return buckets;

  const chunkSize = Math.ceil(normalized.length / 4);
  return Array.from({ length: 4 }, (_, index) => normalized.slice(index * chunkSize, (index + 1) * chunkSize).trim()).filter(Boolean);
}

function deriveFallbackSceneTitle(text: string, index: number) {
  const prefix = ["场景一", "场景二", "场景三", "场景四"][index] ?? `场景${index + 1}`;
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return prefix;
  const summary = normalized.length > 24 ? normalized.slice(0, 24) : normalized;
  return `${prefix}：${summary}`;
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
