import { z } from "zod";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { assertAtmosphereImageReady } from "@/server/providers/ai";
import { generateOpenAIImage } from "@/server/providers/openai-image";
import { createGeneratedImageObjectKey, uploadOssObject } from "@/server/providers/oss";
import { createArtifact } from "@/server/repositories/artifacts";
import { getProjectCreativeDirection } from "@/server/repositories/creative-directions";
import { getProjectCreativeExpansion } from "@/server/repositories/creative-expansions";
import { listCreativeProposalRounds } from "@/server/repositories/creative-proposals";
import {
  createGeneratedImage,
  markGeneratedImageFailed,
  markGeneratedImageProcessing,
  markGeneratedImageRetrying,
  markGeneratedImageSucceeded,
  updateGeneratedImageSourceJob,
} from "@/server/repositories/generated-images";
import { appendJobEvent, createJob, getJobInput, updateJobStatus } from "@/server/repositories/jobs";
import { recordStageProgress } from "@/server/use-cases/stage-progress";

const atmosphereImageJobInputSchema = z.object({
  directionId: z.string().uuid(),
  expansionId: z.string().uuid().nullable().optional(),
  styleVariant: z.enum(["2d", "pixar_3d", "realistic"]).optional(),
  generatedImageId: z.string().uuid(),
  requestedBy: z.string().uuid().nullable().optional(),
});

export function parseAtmosphereImageJobInput(input: unknown) {
  return atmosphereImageJobInputSchema.parse(input);
}

type PromptDirection = {
  title: string;
  coreIdea: string;
  referenceTags: string[];
  atmospherePrompt: string;
};

type PromptExpansion = {
  title: string;
  oneLiner: string;
  storyArc: Record<string, string>;
  visualStyle: string;
  visualHighlights: string[];
};

type Round1StyleVariantKey = "2d" | "pixar_3d" | "realistic";

const ROUND_1_STYLE_VARIANTS: Array<{ key: Round1StyleVariantKey; label: string; prompt: string }> = [
  {
    key: "2d",
    label: "二维风格",
    prompt:
      "二维商业概念插画，扁平图形语言，清晰轮廓线，节制的色块分层，轻微纸面颗粒或赛璐璐质感；构图像广告主视觉海报，强调符号化人物姿态和场景关系，避免摄影写实材质、真实镜头虚化和 3D 渲染塑料感。",
  },
  {
    key: "pixar_3d",
    label: "三维皮克斯风格",
    prompt:
      "动画电影级 3D 视觉，角色体块圆润、表情夸张但可信，场景有可触摸的建模深度；使用柔和全局光、干净体积光、细腻皮肤/布料/道具材质和电影级色彩管理，整体明亮温暖，像高预算三维动画广告关键帧；不要二维线稿、不要扁平插画、不要真实摄影噪点。",
  },
  {
    key: "realistic",
    label: "写实风格",
    prompt:
      "真实商业摄影/电影广告质感，采用真实镜头语言、自然透视、可信人物比例、真实布料皮肤和环境材质；光影来自可解释的现场光源，允许浅景深、运动模糊或镜头眩光，但必须像实拍广告关键视觉，可直接延展成 AIGC 视频镜头；不要卡通化、不要 3D 动画圆润造型、不要插画笔触。",
  },
];

export async function enqueueAtmosphereImageGeneration(input: {
  projectId: string;
  directionId: string;
  expansionId?: string | null;
  styleVariant?: Round1StyleVariantKey;
  requestedBy: string;
}) {
  const config = assertAtmosphereImageReady();
  const [direction, expansion] = await Promise.all([
    getProjectCreativeDirection({
      projectId: input.projectId,
      directionId: input.directionId,
    }),
    input.expansionId
      ? getProjectCreativeExpansion({
          projectId: input.projectId,
          expansionId: input.expansionId,
        })
      : Promise.resolve(null),
  ]);

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
      userMessage: "请先选中这个创意方向，再生成氛围图。",
    });
  }

  const styleVariant = input.styleVariant ? getRound1StyleVariant(input.styleVariant) : null;
  if (!styleVariant && (!expansion || expansion.directionId !== direction.id)) {
    throw new AppError({
      status: 404,
      code: "creative_expansion_not_found",
      userMessage: "没有找到这个故事大纲。请先重新生成故事大纲，再生成氛围图。",
    });
  }

  const selectedStyle = styleVariant ? null : await findSelectedRound1StyleForDirection(input.projectId, direction.id);
  const prompt = styleVariant ? buildRound1StyleImagePrompt({ direction, styleVariant }) : buildAtmosphereImagePrompt({ direction, expansion: expansion!, selectedStyle });
  const generatedImage = await createGeneratedImage({
    projectId: input.projectId,
    directionId: direction.id,
    expansionId: expansion?.id ?? null,
    prompt,
    provider: config.provider,
    modelName: config.model,
    status: "queued",
    metadata: styleVariant
      ? { roundNumber: 1, styleVariant: styleVariant.key, styleLabel: styleVariant.label }
      : selectedStyle
        ? { roundNumber: 2, styleVariant: selectedStyle.styleVariant, styleLabel: selectedStyle.styleLabel, selectedRound1ImageId: selectedStyle.selectedImageId }
        : {},
    createdBy: input.requestedBy,
  });

  const { jobId } = await createJob({
    projectId: input.projectId,
    type: "atmosphere_image_generation",
    title: styleVariant ? `生成 Round 1 风格图：${direction.title} - ${styleVariant.label}` : `生成氛围图：${expansion!.title}`,
    provider: config.provider,
    modelName: config.model,
    inputJson: {
      directionId: input.directionId,
      expansionId: expansion?.id ?? null,
      styleVariant: styleVariant?.key,
      requestedBy: input.requestedBy,
      generatedImageId: generatedImage.id,
    },
    createdBy: input.requestedBy,
    maxAttempts: 2,
  });
  await updateGeneratedImageSourceJob({
    id: generatedImage.id,
    sourceJobId: jobId,
  });

  return {
    jobId,
    generatedImageId: generatedImage.id,
  };
}

export async function runAtmosphereImageGenerationJob(jobId: string, options: { workerManagedFailure?: boolean } = {}) {
  const job = await getJobInput<z.infer<typeof atmosphereImageJobInputSchema>>(jobId);
  if (!job) {
    throw new AppError({
      status: 404,
      code: "job_not_found",
      userMessage: "没有找到这个氛围图生成任务。",
    });
  }

  let parsedInput: z.infer<typeof atmosphereImageJobInputSchema>;
  let direction: Awaited<ReturnType<typeof getProjectCreativeDirection>>;
  let expansion: Awaited<ReturnType<typeof getProjectCreativeExpansion>> | null;
  let styleVariant: ReturnType<typeof getRound1StyleVariant>;
  let prompt: string;

  try {
    parsedInput = parseAtmosphereImageJobInput(job.input);
    [direction, expansion] = await Promise.all([
      getProjectCreativeDirection({
        projectId: job.projectId,
        directionId: parsedInput.directionId,
      }),
      parsedInput.expansionId
        ? getProjectCreativeExpansion({
            projectId: job.projectId,
            expansionId: parsedInput.expansionId,
          })
        : Promise.resolve(null),
    ]);

    styleVariant = parsedInput.styleVariant ? getRound1StyleVariant(parsedInput.styleVariant) : null;
    if (!direction || (!styleVariant && (!expansion || expansion.directionId !== direction.id))) {
      throw new AppError({
        status: 404,
        code: "atmosphere_image_source_not_found",
        userMessage: "氛围图对应的创意方向或故事大纲不存在。请刷新后重新发起生成。",
      });
    }

    const selectedStyle = styleVariant ? null : await findSelectedRound1StyleForDirection(job.projectId, direction.id);
    prompt = styleVariant ? buildRound1StyleImagePrompt({ direction, styleVariant }) : buildAtmosphereImagePrompt({ direction, expansion: expansion!, selectedStyle });
    await markGeneratedImageProcessing({ id: parsedInput.generatedImageId });
    await updateJobStatus(jobId, {
      status: "processing",
      currentStep: "atmosphere_image_generation",
      userMessage: styleVariant ? "正在调用图片模型生成 Round 1 风格图，并会保存到 OSS。" : "正在调用图片模型生成氛围图，并会保存到 OSS。",
    });

    await appendJobEvent(jobId, {
      type: "step.started",
      jobId,
      projectId: job.projectId,
      stepId: "atmosphere_image_generation",
      title: "开始生成氛围图",
      userMessage: styleVariant ? "系统正在根据创意方向生成 Round 1 风格图。" : "系统正在根据故事大纲生成氛围图。",
      at: new Date().toISOString(),
    });
  } catch (error) {
    await handleAtmosphereImageJobFailure({
      jobId,
      projectId: job.projectId,
      generatedImageId: readAtmosphereGeneratedImageIdFromInput(job.input),
      error,
      options,
    });
    throw error;
  }

  try {
    await appendJobEvent(jobId, {
      type: "tool.started",
      jobId,
      projectId: job.projectId,
      callId: "openai_atmosphere_image_generation",
      title: "调用图片模型",
      payload: {
        provider: env.ATMOSPHERE_IMAGE_PROVIDER,
        model: env.OPENAI_IMAGE_MODEL,
        expansionId: expansion?.id ?? null,
        styleVariant: styleVariant?.key,
      },
      at: new Date().toISOString(),
    });

    const image = await generateOpenAIImage({
      model: env.OPENAI_IMAGE_MODEL,
      prompt,
      timeoutMs: 180_000,
      telemetry: {
        projectId: job.projectId,
        jobId,
        callId: "openai_atmosphere_image_generation",
        provider: env.ATMOSPHERE_IMAGE_PROVIDER,
        operation: "atmosphere_image_generation",
        metadata: {
          directionId: direction.id,
          expansionId: expansion?.id ?? null,
          styleVariant: styleVariant?.key,
          generatedImageId: parsedInput.generatedImageId,
        },
      },
    });
    const objectKey = createGeneratedImageObjectKey(job.projectId, parsedInput.generatedImageId, image.extension);
    const uploaded = await uploadOssObject({
      objectKey,
      body: image.bytes,
      contentType: image.mimeType,
    });
    const savedImage = await markGeneratedImageSucceeded({
      id: parsedInput.generatedImageId,
      ossKey: uploaded.ossKey,
      ossUrl: uploaded.ossUrl,
    });

    if (!savedImage) {
      throw new AppError({
        status: 500,
        code: "generated_image_update_failed",
        userMessage: "氛围图文件已生成，但保存生成记录时失败。请刷新后检查历史记录，或联系管理员查看任务日志。",
      });
    }

    const artifact = await createArtifact({
      projectId: job.projectId,
      kind: "generated_image",
      title: styleVariant ? `Round 1 风格图：${direction.title} - ${styleVariant.label}` : `氛围图：${expansion!.title}`,
      status: "draft",
      data: {
        generatedImageId: parsedInput.generatedImageId,
        directionId: direction.id,
        directionTitle: direction.title,
        expansionId: expansion?.id ?? null,
        expansionTitle: expansion?.title ?? null,
        styleVariant: styleVariant?.key,
        styleLabel: styleVariant?.label,
        prompt,
        modelName: env.OPENAI_IMAGE_MODEL,
        ossKey: uploaded.ossKey,
        ossUrl: uploaded.ossUrl,
        revisedPrompt: image.revisedPrompt,
      },
      sourceJobId: jobId,
    });

    await appendJobEvent(jobId, {
      type: "artifact.created",
      jobId,
      projectId: job.projectId,
      artifactId: artifact.id,
      title: "已创建氛围图产物",
      payload: {
        artifactKind: artifact.kind,
        generatedImageId: parsedInput.generatedImageId,
      },
      userMessage: "氛围图已保存到 OSS，并写入项目产物。",
      at: new Date().toISOString(),
    });

    await recordStageProgress({
      projectId: job.projectId,
      stageKey: "creative_direction_proposal",
      status: "waiting_review",
      currentStage: "creative_direction_proposal",
      projectStatus: "waiting_review",
      jobId,
      title: "创意方向提案等待确认",
      userMessage: "氛围图已生成，创意方向提案可以进入人工确认和整理。",
      inputRefs: [
        { type: "creative_direction", id: direction.id },
        ...(expansion ? [{ type: "creative_expansion", id: expansion.id }] : []),
      ],
      outputRefs: [
        { type: "generated_image", id: savedImage.id },
        { type: "artifact", id: artifact.id, kind: artifact.kind },
      ],
      snapshot: {
        directionId: direction.id,
        expansionId: expansion?.id ?? null,
        styleVariant: styleVariant?.key,
        generatedImageId: savedImage.id,
      },
    });

    await appendJobEvent(jobId, {
      type: "job.completed",
      jobId,
      projectId: job.projectId,
      title: "氛围图生成完成",
      userMessage: "氛围图已生成并保存。",
      at: new Date().toISOString(),
    });

    await updateJobStatus(jobId, {
      status: "succeeded",
      currentStep: "completed",
      userMessage: "氛围图生成完成。",
    });

    return { jobId, generatedImage: savedImage, artifact };
  } catch (error) {
    await handleAtmosphereImageJobFailure({
      jobId,
      projectId: job.projectId,
      generatedImageId: parsedInput.generatedImageId,
      error,
      options,
    });
    throw error;
  }
}

async function handleAtmosphereImageJobFailure(input: {
  jobId: string;
  projectId: string;
  generatedImageId: string | null;
  error: unknown;
  options: { workerManagedFailure?: boolean };
}) {
  const userMessage =
    input.error instanceof AppError
      ? input.error.userMessage
      : input.error instanceof z.ZodError
        ? "氛围图生成任务参数不完整或格式不正确。请刷新项目后重新发起生成。"
        : "氛围图生成失败。系统已保存失败状态，你可以稍后重试或调整故事大纲。";
  const errorCode =
    input.error instanceof AppError
      ? input.error.code
      : input.error instanceof z.ZodError
        ? "atmosphere_image_job_input_invalid"
        : "atmosphere_image_generation_failed";

  await recordStageProgress({
    projectId: input.projectId,
    stageKey: "creative_direction_proposal",
    status: "needs_revision",
    currentStage: "creative_direction_proposal",
    projectStatus: "needs_revision",
    jobId: input.jobId,
    title: "创意方向提案需要修改",
    userMessage,
    errorMessage: userMessage,
  });

  if (input.generatedImageId) {
    if (input.options.workerManagedFailure) {
      await markGeneratedImageRetrying({
        id: input.generatedImageId,
        failureReason: userMessage,
      });
    } else {
      await markGeneratedImageFailed({
        id: input.generatedImageId,
        failureReason: userMessage,
      });
    }
  }

  await appendJobEvent(input.jobId, {
    type: "step.failed",
    jobId: input.jobId,
    projectId: input.projectId,
    stepId: "atmosphere_image_generation",
    title: "氛围图生成失败",
    userMessage,
    recoverable: true,
    at: new Date().toISOString(),
  });

  if (!input.options.workerManagedFailure) {
    await updateJobStatus(input.jobId, {
      status: "failed",
      currentStep: "failed",
      userMessage,
      errorCode,
    });
  }
}

export function readAtmosphereGeneratedImageIdFromInput(input: unknown) {
  if (!input || typeof input !== "object") return null;
  const value = (input as Record<string, unknown>).generatedImageId;
  return typeof value === "string" ? value : null;
}

export function buildAtmosphereImagePrompt(input: {
  direction: PromptDirection;
  expansion: PromptExpansion;
  selectedStyle?: { styleVariant: string; styleLabel: string } | null;
}) {
  const arc = Object.entries(input.expansion.storyArc)
    .map(([key, value]) => `${storyArcLabel(key)}：${value}`)
    .join("；");
  const highlights = input.expansion.visualHighlights.length ? input.expansion.visualHighlights.join("、") : "品牌产品、主视觉质感、关键情绪";
  const tags = input.direction.referenceTags.slice(0, 6).join("、") || "写实广告片";

  return [
    "为 AIGC 视频项目生成一张横版氛围图，用于内部提案评审。",
    "画面需要像高端商业广告概念图，主体明确，光影真实，细节适合后续视频分镜延展。",
    "不要出现文字、Logo、水印、UI 边框或字幕。",
    `创意方向：${input.direction.title}`,
    `方向核心：${input.direction.coreIdea}`,
    `故事大纲：${input.expansion.title}`,
    `一句话概念：${input.expansion.oneLiner}`,
    `起承转合：${arc}`,
    `画面风格：${input.expansion.visualStyle || tags}`,
    input.selectedStyle ? `甲方在 R1 选择的视觉风格：${input.selectedStyle.styleLabel}。本次深化图必须沿用这个风格方向。` : "",
    `视觉亮点：${highlights}`,
    `参考标签：${tags}`,
    input.direction.atmospherePrompt ? `补充氛围提示：${input.direction.atmospherePrompt}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildRound1StyleImagePrompt(input: {
  direction: PromptDirection;
  styleVariant: { key: Round1StyleVariantKey; label: string; prompt: string };
}) {
  const tags = input.direction.referenceTags.slice(0, 6).join("、") || "商业广告片";

  return [
    "为 AIGC 视频项目 Round 1 创意视觉提案生成一张横版静态场景图片。",
    "这张图用于甲方判断创意方向的视觉风格，不要做故事卡分镜，不要出现文字、Logo、水印、UI 边框或字幕。",
    `创意方向：${input.direction.title}`,
    `方向核心：${input.direction.coreIdea}`,
    `风格类型：${input.styleVariant.label}`,
    `风格要求：${input.styleVariant.prompt}`,
    `参考标签：${tags}`,
    input.direction.atmospherePrompt ? `补充氛围提示：${input.direction.atmospherePrompt}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function getRound1StyleVariant(key: Round1StyleVariantKey) {
  return ROUND_1_STYLE_VARIANTS.find((style) => style.key === key) ?? null;
}

async function findSelectedRound1StyleForDirection(projectId: string, directionId: string) {
  const { rounds } = await listCreativeProposalRounds(projectId);
  const latestRound1 = [...rounds].reverse().find((round) => round.roundNumber === 1);
  const decisionPayload = readRecordField(latestRound1?.clientFeedback, "decisionPayload");
  const selections = decisionPayload?.selectedDirectionStyles;
  if (!Array.isArray(selections)) return null;

  for (const selection of selections) {
    if (!selection || typeof selection !== "object") continue;
    const record = selection as Record<string, unknown>;
    if (readStringRecordField(record, "directionId") !== directionId) continue;
    const styleVariant = readStringRecordField(record, "styleVariant");
    const styleLabel = readStringRecordField(record, "styleLabel") || styleVariant;
    if (!styleVariant || !styleLabel) return null;
    return {
      styleVariant,
      styleLabel,
      selectedImageId: readStringRecordField(record, "selectedImageId") || null,
    };
  }

  return null;
}

function readRecordField(value: unknown, key: string) {
  if (!value || typeof value !== "object") return null;
  const nested = (value as Record<string, unknown>)[key];
  return nested && typeof nested === "object" ? (nested as Record<string, unknown>) : null;
}

function readStringRecordField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function storyArcLabel(key: string) {
  const labels: Record<string, string> = {
    beginning: "起",
    development: "承",
    turn: "转",
    ending: "合",
  };
  return labels[key] ?? key;
}
