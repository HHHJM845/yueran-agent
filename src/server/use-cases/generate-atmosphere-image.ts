import { z } from "zod";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { assertAtmosphereImageReady } from "@/server/providers/ai";
import { generateOpenAIImage } from "@/server/providers/openai-image";
import { createGeneratedImageObjectKey, uploadOssObject } from "@/server/providers/oss";
import { createArtifact } from "@/server/repositories/artifacts";
import { getProjectCreativeDirection } from "@/server/repositories/creative-directions";
import { getProjectCreativeExpansion } from "@/server/repositories/creative-expansions";
import {
  createGeneratedImage,
  markGeneratedImageFailed,
  markGeneratedImageProcessing,
  markGeneratedImageSucceeded,
  updateGeneratedImageSourceJob,
} from "@/server/repositories/generated-images";
import { appendJobEvent, createJob, getJobInput, updateJobStatus } from "@/server/repositories/jobs";
import { recordStageProgress } from "@/server/use-cases/stage-progress";

const atmosphereImageJobInputSchema = z.object({
  directionId: z.string().uuid(),
  expansionId: z.string().uuid(),
  generatedImageId: z.string().uuid(),
  requestedBy: z.string().uuid().nullable().optional(),
});

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

export async function enqueueAtmosphereImageGeneration(input: {
  projectId: string;
  directionId: string;
  expansionId: string;
  requestedBy: string;
}) {
  const config = assertAtmosphereImageReady();
  const [direction, expansion] = await Promise.all([
    getProjectCreativeDirection({
      projectId: input.projectId,
      directionId: input.directionId,
    }),
    getProjectCreativeExpansion({
      projectId: input.projectId,
      expansionId: input.expansionId,
    }),
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

  if (!expansion || expansion.directionId !== direction.id) {
    throw new AppError({
      status: 404,
      code: "creative_expansion_not_found",
      userMessage: "没有找到这个故事大纲。请先重新生成故事大纲，再生成氛围图。",
    });
  }

  const prompt = buildAtmosphereImagePrompt({ direction, expansion });
  const generatedImage = await createGeneratedImage({
    projectId: input.projectId,
    directionId: direction.id,
    expansionId: expansion.id,
    prompt,
    provider: config.provider,
    modelName: config.model,
    status: "queued",
    createdBy: input.requestedBy,
  });

  const { jobId } = await createJob({
    projectId: input.projectId,
    type: "atmosphere_image_generation",
    title: `生成氛围图：${expansion.title}`,
    provider: config.provider,
    modelName: config.model,
    inputJson: {
      directionId: input.directionId,
      expansionId: input.expansionId,
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

  const parsedInput = atmosphereImageJobInputSchema.parse(job.input);
  const [direction, expansion] = await Promise.all([
    getProjectCreativeDirection({
      projectId: job.projectId,
      directionId: parsedInput.directionId,
    }),
    getProjectCreativeExpansion({
      projectId: job.projectId,
      expansionId: parsedInput.expansionId,
    }),
  ]);

  if (!direction || !expansion || expansion.directionId !== direction.id) {
    throw new AppError({
      status: 404,
      code: "atmosphere_image_source_not_found",
      userMessage: "氛围图对应的创意方向或故事大纲不存在。请刷新后重新发起生成。",
    });
  }

  const prompt = buildAtmosphereImagePrompt({ direction, expansion });
  await markGeneratedImageProcessing({ id: parsedInput.generatedImageId });
  await updateJobStatus(jobId, {
    status: "processing",
    currentStep: "atmosphere_image_generation",
    userMessage: "正在调用图片模型生成氛围图，并会保存到 OSS。",
  });

  await appendJobEvent(jobId, {
    type: "step.started",
    jobId,
    projectId: job.projectId,
    stepId: "atmosphere_image_generation",
    title: "开始生成氛围图",
    userMessage: "系统正在根据故事大纲生成氛围图。",
    at: new Date().toISOString(),
  });

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
        expansionId: expansion.id,
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
          expansionId: expansion.id,
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
      title: `氛围图：${expansion.title}`,
      status: "draft",
      data: {
        generatedImageId: parsedInput.generatedImageId,
        directionId: direction.id,
        directionTitle: direction.title,
        expansionId: expansion.id,
        expansionTitle: expansion.title,
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
        { type: "creative_expansion", id: expansion.id },
      ],
      outputRefs: [
        { type: "generated_image", id: savedImage.id },
        { type: "artifact", id: artifact.id, kind: artifact.kind },
      ],
      snapshot: {
        directionId: direction.id,
        expansionId: expansion.id,
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
    const userMessage =
      error instanceof AppError
        ? error.userMessage
        : "氛围图生成失败。系统已保存失败状态，你可以稍后重试或调整故事大纲。";

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

    await markGeneratedImageFailed({
      id: parsedInput.generatedImageId,
      failureReason: userMessage,
    });

    await appendJobEvent(jobId, {
      type: "step.failed",
      jobId,
      projectId: job.projectId,
      stepId: "atmosphere_image_generation",
      title: "氛围图生成失败",
      userMessage,
      recoverable: true,
      at: new Date().toISOString(),
    });

    if (!options.workerManagedFailure) {
      await updateJobStatus(jobId, {
        status: "failed",
        currentStep: "failed",
        userMessage,
        errorCode: error instanceof AppError ? error.code : "atmosphere_image_generation_failed",
      });
    }

    throw error;
  }
}

export function buildAtmosphereImagePrompt(input: { direction: PromptDirection; expansion: PromptExpansion }) {
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
    `视觉亮点：${highlights}`,
    `参考标签：${tags}`,
    input.direction.atmospherePrompt ? `补充氛围提示：${input.direction.atmospherePrompt}` : "",
  ]
    .filter(Boolean)
    .join("\n");
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
