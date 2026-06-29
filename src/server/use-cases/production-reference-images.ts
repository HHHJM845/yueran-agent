import { z } from "zod";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { assertAtmosphereImageReady } from "@/server/providers/ai";
import { generateOpenAIImage } from "@/server/providers/openai-image";
import { createGeneratedImageObjectKey, uploadOssObject } from "@/server/providers/oss";
import {
  createGeneratedImage,
  markGeneratedImageFailed,
  markGeneratedImageProcessing,
  markGeneratedImageSucceeded,
  updateGeneratedImageSourceJob,
} from "@/server/repositories/generated-images";
import { appendJobEvent, createJob, getJobInput, updateJobStatus } from "@/server/repositories/jobs";
import {
  appendProductionReferenceImage,
  listProductionEntities,
  listProductionReferenceSets,
  saveProductionReferencePrompt,
  upsertReferenceSet,
} from "@/server/repositories/production-entities";
import { recordStageProgress } from "@/server/use-cases/stage-progress";

const productionImageRatioSchema = z.enum(["1:1", "3:4", "4:3", "16:9", "9:16"]);

const referenceImageJobInputSchema = z.object({
  entityId: z.string().uuid(),
  referenceSetId: z.string().uuid(),
  generatedImageId: z.string().uuid(),
  requestedBy: z.string().uuid(),
  imageIndex: z.number().int().min(0),
  prompt: z.string().min(1),
  ratio: productionImageRatioSchema,
  size: z.string().min(1),
});

export function ratioToOpenAIImageSize(ratio: z.infer<typeof productionImageRatioSchema>) {
  const sizes = {
    "1:1": "1024x1024",
    "3:4": "1024x1536",
    "4:3": "1536x1024",
    "16:9": "1536x864",
    "9:16": "864x1536",
  } satisfies Record<z.infer<typeof productionImageRatioSchema>, string>;
  return sizes[ratio];
}

export async function enqueueProductionReferenceImages(input: {
  projectId: string;
  entityId: string;
  requestedBy: string;
  prompt: string;
  count: number;
  ratio: z.infer<typeof productionImageRatioSchema>;
}) {
  const config = assertAtmosphereImageReady();
  const [entities, referenceSets] = await Promise.all([
    listProductionEntities(input.projectId),
    listProductionReferenceSets(input.projectId),
  ]);

  if (!input.prompt.trim()) {
    throw new AppError({
      status: 422,
      code: "production_reference_prompt_required",
      userMessage: "请先填写这个人物或场景的生成提示词。",
    });
  }

  if (!Number.isInteger(input.count) || input.count < 1 || input.count > 8) {
    throw new AppError({
      status: 422,
      code: "production_reference_count_invalid",
      userMessage: "请一次生成 1 到 8 张设定图。",
    });
  }

  const entity = entities.find((item) => item.id === input.entityId);
  if (!entity || entity.inclusionStatus === "ignored" || entity.status === "locked") {
    throw new AppError({
      status: 422,
      code: "production_entity_not_available",
      userMessage: "这个人物或场景暂时不能生成设定图。请确认它没有被忽略或锁定。",
    });
  }

  const jobs: Array<{ jobId: string; generatedImageId: string; entityId: string; referenceSetId: string }> = [];
  const activeReference =
    referenceSets.find((set) => set.entityId === entity.id && set.depth === entity.referenceDepth) ??
    (await upsertReferenceSet({
      projectId: input.projectId,
      entityId: entity.id,
      depth: entity.referenceDepth,
      status: "draft",
      prompt: input.prompt,
      snapshot: { entityType: entity.entityType, name: entity.name, sourceShotIds: entity.sourceShotIds },
      actorId: input.requestedBy,
    }));

  const generatingReference = await saveProductionReferencePrompt({
    projectId: input.projectId,
    referenceSetId: activeReference.id,
    prompt: input.prompt,
    ratio: input.ratio,
    generationCount: input.count,
    actorId: input.requestedBy,
  });
  if (!generatingReference) {
    throw new AppError({
      status: 404,
      code: "production_reference_set_not_found",
      userMessage: "没有找到这个设定图卡片。请刷新后重试。",
    });
  }

  for (let imageIndex = 0; imageIndex < input.count; imageIndex += 1) {
    const size = ratioToOpenAIImageSize(input.ratio);
    const generatedImage = await createGeneratedImage({
      projectId: input.projectId,
      prompt: input.prompt,
      provider: config.provider,
      modelName: config.model,
      status: "queued",
      metadata: {
        purpose: "production_reference",
        entityId: entity.id,
        referenceSetId: generatingReference.id,
        entityType: entity.entityType,
        ratio: input.ratio,
        size,
        prompt: input.prompt,
      },
      createdBy: input.requestedBy,
    });
    const job = await createJob({
      projectId: input.projectId,
      type: "production_reference_image_generation",
      title: `生成${entity.entityType === "character" ? "人物" : "场景"}设定图：${entity.name} #${imageIndex + 1}`,
      provider: config.provider,
      modelName: config.model,
      inputJson: {
        entityId: entity.id,
        referenceSetId: generatingReference.id,
        generatedImageId: generatedImage.id,
        requestedBy: input.requestedBy,
        imageIndex,
        prompt: input.prompt,
        ratio: input.ratio,
        size,
      },
      createdBy: input.requestedBy,
      maxAttempts: 2,
    });
    await updateGeneratedImageSourceJob({ id: generatedImage.id, sourceJobId: job.jobId });
    await appendProductionReferenceImage({
      projectId: input.projectId,
      referenceSetId: generatingReference.id,
      generatedImageId: generatedImage.id,
      actorId: input.requestedBy,
    });
    jobs.push({
      jobId: job.jobId,
      generatedImageId: generatedImage.id,
      entityId: entity.id,
      referenceSetId: generatingReference.id,
    });
  }

  const currentPrompt = generatingReference.currentPrompt;
  const lastGenerationCount = generatingReference.lastGenerationCount;

  await recordStageProgress({
    projectId: input.projectId,
    stageKey: "script_storyboard_confirmation",
    status: "in_progress",
    currentStage: "script_storyboard_confirmation",
    projectStatus: "in_progress",
    userMessage: "人物和场景设定图生成任务已创建，完成后可在设定卡片中选择参考图。",
    outputRefs: jobs.map((job) => ({ type: "generated_image", id: job.generatedImageId })),
    snapshot: {
      jobCount: jobs.length,
      entityCount: 1,
      currentPrompt,
      lastGenerationCount,
      ratio: generatingReference.defaultRatio,
    },
  });

  return {
    jobs,
    message: `已创建 ${jobs.length} 个设定图生成任务。完成后会追加到当前卡片的候选图池。`,
  };
}

export async function runProductionReferenceImageGenerationJob(jobId: string) {
  const job = await getJobInput<z.infer<typeof referenceImageJobInputSchema>>(jobId);
  if (!job) {
    throw new AppError({
      status: 404,
      code: "job_not_found",
      userMessage: "没有找到这个设定图生成任务。",
    });
  }
  const input = referenceImageJobInputSchema.parse(job.input);
  const [entities, referenceSets] = await Promise.all([
    listProductionEntities(job.projectId),
    listProductionReferenceSets(job.projectId),
  ]);
  const entity = entities.find((item) => item.id === input.entityId);
  const referenceSet = referenceSets.find((item) => item.id === input.referenceSetId);
  if (!entity || !referenceSet) {
    throw new AppError({
      status: 404,
      code: "production_reference_source_missing",
      userMessage: "设定图对应的人物或场景设定不存在。请刷新后重新发起生成。",
    });
  }

  await markGeneratedImageProcessing({ id: input.generatedImageId });
  await updateJobStatus(jobId, {
    status: "processing",
    currentStep: "production_reference_image_generation",
    userMessage: "正在生成角色或场景设定图。",
  });
  await appendJobEvent(jobId, {
    type: "tool.started",
    jobId,
    projectId: job.projectId,
    callId: "openai_production_reference_image_generation",
    title: "调用图片模型",
    userMessage: "系统正在根据人物或场景设定生成参考图。",
    at: new Date().toISOString(),
  });

  try {
    const prompt = input.prompt;
    const image = await generateOpenAIImage({
      model: env.OPENAI_IMAGE_MODEL,
      prompt,
      size: input.size,
      timeoutMs: 180_000,
      telemetry: {
        projectId: job.projectId,
        jobId,
        callId: "openai_production_reference_image_generation",
        provider: env.ATMOSPHERE_IMAGE_PROVIDER,
        operation: "production_reference_image_generation",
        metadata: {
          entityId: entity.id,
          referenceSetId: referenceSet.id,
          generatedImageId: input.generatedImageId,
          ratio: input.ratio,
          size: input.size,
          promptSource: "visible_card_prompt",
        },
      },
    });
    const objectKey = createGeneratedImageObjectKey(job.projectId, input.generatedImageId, image.extension);
    const uploaded = await uploadOssObject({
      objectKey,
      body: image.bytes,
      contentType: image.mimeType,
    });
    const savedImage = await markGeneratedImageSucceeded({
      id: input.generatedImageId,
      ossKey: uploaded.ossKey,
      ossUrl: uploaded.ossUrl,
    });
    if (!savedImage) {
      throw new AppError({
        status: 500,
        code: "production_reference_image_update_failed",
        userMessage: "设定图已生成，但保存记录失败。请刷新后检查生成历史。",
      });
    }
    const updatedReferenceSet = await appendProductionReferenceImage({
      projectId: job.projectId,
      referenceSetId: referenceSet.id,
      generatedImageId: savedImage.id,
      actorId: input.requestedBy,
    });
    await updateJobStatus(jobId, {
      status: "succeeded",
      currentStep: "completed",
      userMessage: "人物或场景设定图生成完成。",
    });
    return { generatedImage: savedImage, referenceSet: updatedReferenceSet };
  } catch (error) {
    const userMessage =
      error instanceof AppError ? error.userMessage : "设定图生成失败。请稍后重试，或检查图片模型配置。";
    await markGeneratedImageFailed({ id: input.generatedImageId, failureReason: userMessage });
    await updateJobStatus(jobId, {
      status: "failed",
      currentStep: "failed",
      userMessage,
      errorCode: error instanceof AppError ? error.code : "production_reference_image_failed",
    });
    throw error;
  }
}
