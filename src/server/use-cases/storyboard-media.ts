import { z } from "zod";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { assertAtmosphereImageReady } from "@/server/providers/ai";
import { assertArkVideoGenerationReady, generateArkImageToVideo } from "@/server/providers/ark-video";
import { generateOpenAIImage } from "@/server/providers/openai-image";
import { createGeneratedImageObjectKey, createReadUrl, createStoryboardVideoObjectKey, uploadOssObject } from "@/server/providers/oss";
import { createArtifact } from "@/server/repositories/artifacts";
import { appendJobEvent, createJob, getJobInput, updateJobStatus } from "@/server/repositories/jobs";
import { listProductionEntities } from "@/server/repositories/production-entities";
import {
  createStoryboardImageRecord,
  createStoryboardVideoRecord,
  getSelectedStoryboardImage,
  getStoryboardShot,
  markStoryboardImageFailed,
  markStoryboardImageProcessing,
  markStoryboardImageSucceeded,
  markStoryboardVideoFailed,
  markStoryboardVideoProcessing,
  markStoryboardVideoSucceeded,
  selectStoryboardImage,
  selectStoryboardVideo,
  updateStoryboardImageSourceJob,
  updateStoryboardVideoSourceJob,
  listStoryboardShots,
} from "@/server/repositories/story-production";
import { assertProductionSetupLocked } from "@/server/use-cases/production-setup";
import { recordStageProgress } from "@/server/use-cases/stage-progress";

const storyboardImageJobInputSchema = z.object({
  shotId: z.string().uuid(),
  storyboardImageId: z.string().uuid(),
  requestedBy: z.string().uuid(),
});

const storyboardVideoJobInputSchema = z.object({
  shotId: z.string().uuid(),
  storyboardVideoId: z.string().uuid(),
  requestedBy: z.string().uuid(),
});

export async function enqueueStoryboardImageGeneration(input: {
  projectId: string;
  shotId: string;
  requestedBy: string;
}) {
  const config = assertAtmosphereImageReady();
  const shot = await getStoryboardShot({ projectId: input.projectId, shotId: input.shotId });
  if (!shot) {
    throw new AppError({
      status: 404,
      code: "storyboard_shot_not_found",
      userMessage: "没有找到这条文字分镜。请刷新后重新选择分镜。",
    });
  }
  const [entities, storyboardShots] = await Promise.all([
    listProductionEntities(input.projectId),
    listStoryboardShots(input.projectId),
  ]);
  assertProductionSetupLocked({ entities, storyboardShots });

  const prompt = buildStoryboardImagePrompt(shot);
  const image = await createStoryboardImageRecord({
    projectId: input.projectId,
    sceneId: shot.sceneId,
    shotId: shot.id,
    prompt,
    provider: config.provider,
    modelName: config.model,
    reference: {
      characterRefs: shot.characterRefs,
      sceneRefs: shot.sceneRefs,
    },
    actorId: input.requestedBy,
  });
  const job = await createJob({
    projectId: input.projectId,
    type: "storyboard_image_generation",
    title: `生成分镜图片：${shot.shotNumber}`,
    provider: config.provider,
    modelName: config.model,
    inputJson: {
      shotId: shot.id,
      storyboardImageId: image.id,
      requestedBy: input.requestedBy,
    },
    createdBy: input.requestedBy,
    maxAttempts: 2,
  });
  await updateStoryboardImageSourceJob({ id: image.id, sourceJobId: job.jobId });

  await recordStageProgress({
    projectId: input.projectId,
    stageKey: "storyboard_image_canvas",
    status: "in_progress",
    currentStage: "storyboard_image_canvas",
    projectStatus: "in_progress",
    userMessage: "分镜图片生成任务已创建，后台会调用真实图片模型并保存结果。",
    inputRefs: [{ type: "storyboard_shot", id: shot.id }],
    outputRefs: [{ type: "storyboard_image", id: image.id }],
    snapshot: { shotId: shot.id, storyboardImageId: image.id },
  });

  return {
    jobId: job.jobId,
    storyboardImageId: image.id,
    message: "分镜图片生成任务已创建。系统会写入后端任务日志，完成后刷新工作台即可查看结果。",
  };
}

export async function runStoryboardImageGenerationJob(jobId: string) {
  const job = await getJobInput<z.infer<typeof storyboardImageJobInputSchema>>(jobId);
  if (!job) {
    throw new AppError({
      status: 404,
      code: "job_not_found",
      userMessage: "没有找到这个分镜图片生成任务。",
    });
  }
  const input = storyboardImageJobInputSchema.parse(job.input);
  const shot = await getStoryboardShot({ projectId: job.projectId, shotId: input.shotId });
  if (!shot) {
    throw new AppError({
      status: 404,
      code: "storyboard_shot_not_found",
      userMessage: "分镜图片对应的文字分镜不存在。请刷新后重新发起生成。",
    });
  }

  await markStoryboardImageProcessing(input.storyboardImageId);
  await updateJobStatus(jobId, {
    status: "processing",
    currentStep: "storyboard_image_generation",
    userMessage: "正在调用图片模型生成正式分镜图片。",
  });
  await appendJobEvent(jobId, {
    type: "tool.started",
    jobId,
    projectId: job.projectId,
    callId: "openai_storyboard_image_generation",
    title: "调用图片模型",
    userMessage: "系统正在根据文字分镜、人物参考和场景参考生成分镜图片。",
    at: new Date().toISOString(),
  });

  try {
    const image = await generateOpenAIImage({
      model: env.OPENAI_IMAGE_MODEL,
      prompt: buildStoryboardImagePrompt(shot),
      timeoutMs: 180_000,
      telemetry: {
        projectId: job.projectId,
        jobId,
        callId: "openai_storyboard_image_generation",
        provider: env.ATMOSPHERE_IMAGE_PROVIDER,
        operation: "storyboard_image_generation",
        metadata: { shotId: shot.id, storyboardImageId: input.storyboardImageId },
      },
    });
    const objectKey = createGeneratedImageObjectKey(job.projectId, input.storyboardImageId, image.extension);
    const uploaded = await uploadOssObject({
      objectKey,
      body: image.bytes,
      contentType: image.mimeType,
    });
    const savedImage = await markStoryboardImageSucceeded({
      id: input.storyboardImageId,
      ossKey: uploaded.ossKey,
      ossUrl: uploaded.ossUrl,
    });
    if (!savedImage) {
      throw new AppError({
        status: 500,
        code: "storyboard_image_update_failed",
        userMessage: "分镜图片已生成，但保存记录失败。请刷新后检查生成历史。",
      });
    }

    const artifact = await createArtifact({
      projectId: job.projectId,
      kind: "storyboard_image",
      title: `分镜图片：${shot.shotNumber}`,
      status: "draft",
      data: {
        shotId: shot.id,
        sceneId: shot.sceneId,
        storyboardImageId: savedImage.id,
        prompt: savedImage.prompt,
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
      title: "已创建分镜图片产物",
      userMessage: "分镜图片已保存到 OSS，并写入项目产物。",
      at: new Date().toISOString(),
    });
    await updateJobStatus(jobId, {
      status: "succeeded",
      currentStep: "completed",
      userMessage: "分镜图片生成完成。",
    });
    return { jobId, storyboardImage: savedImage, artifact };
  } catch (error) {
    const userMessage =
      error instanceof AppError
        ? error.userMessage
        : "分镜图片生成失败。系统已保存失败状态，你可以稍后重试或调整 Prompt。";
    await markStoryboardImageFailed({ id: input.storyboardImageId, failureReason: userMessage });
    await recordStageProgress({
      projectId: job.projectId,
      stageKey: "storyboard_image_canvas",
      status: "needs_revision",
      currentStage: "storyboard_image_canvas",
      projectStatus: "needs_revision",
      userMessage,
      errorMessage: userMessage,
    });
    await updateJobStatus(jobId, {
      status: "failed",
      currentStep: "failed",
      userMessage,
      errorCode: error instanceof AppError ? error.code : "storyboard_image_generation_failed",
    });
    throw error;
  }
}

export async function confirmStoryboardImage(input: {
  projectId: string;
  imageId: string;
  actorId: string;
}) {
  const image = await selectStoryboardImage(input);
  if (!image) {
    throw new AppError({
      status: 404,
      code: "storyboard_image_not_found",
      userMessage: "没有找到这张分镜图片。它可能已经被删除或不属于当前项目。",
    });
  }
  return {
    image,
    message: "这张分镜图片已设为该分镜的正式候选，可随场次一起提交甲方审核。",
  };
}

export async function enqueueStoryboardVideoGeneration(input: {
  projectId: string;
  shotId: string;
  requestedBy: string;
}) {
  const config = assertArkVideoGenerationReady();
  const shot = await getStoryboardShot({ projectId: input.projectId, shotId: input.shotId });
  if (!shot) {
    throw new AppError({
      status: 404,
      code: "storyboard_shot_not_found",
      userMessage: "没有找到这条文字分镜。请刷新后重新选择分镜。",
    });
  }
  const selectedImage = await getSelectedStoryboardImage({ projectId: input.projectId, shotId: shot.id });
  if (!selectedImage?.ossUrl) {
    throw new AppError({
      status: 422,
      code: "storyboard_image_required",
      userMessage: "请先为这条分镜确认正式图片，再生成视频候选。",
    });
  }

  const video = await createStoryboardVideoRecord({
    projectId: input.projectId,
    sceneId: shot.sceneId,
    shotId: shot.id,
    imageId: selectedImage.id,
    prompt: buildStoryboardVideoPrompt(shot),
    provider: config.provider,
    modelName: config.model,
    actorId: input.requestedBy,
  });
  const job = await createJob({
    projectId: input.projectId,
    type: "storyboard_video_generation",
    title: `生成分镜视频：${shot.shotNumber}`,
    provider: config.provider,
    modelName: config.model,
    inputJson: {
      shotId: shot.id,
      storyboardVideoId: video.id,
      requestedBy: input.requestedBy,
    },
    createdBy: input.requestedBy,
    maxAttempts: 1,
  });
  await updateStoryboardVideoSourceJob({ id: video.id, sourceJobId: job.jobId });
  await recordStageProgress({
    projectId: input.projectId,
    stageKey: "ai_video_canvas",
    status: "in_progress",
    currentStage: "ai_video_canvas",
    projectStatus: "in_progress",
    userMessage: "视频候选生成任务已创建。若视频 provider 未配置，任务会明确阻塞并保存失败原因。",
    inputRefs: [{ type: "storyboard_shot", id: shot.id }],
    outputRefs: [{ type: "storyboard_video", id: video.id }],
    snapshot: { shotId: shot.id, storyboardVideoId: video.id },
  });

  return {
    jobId: job.jobId,
    storyboardVideoId: video.id,
    message: "分镜视频生成任务已创建。当前模块只做内部确认，不会生成甲方审核链接。",
  };
}

export async function runStoryboardVideoGenerationJob(jobId: string) {
  const job = await getJobInput<z.infer<typeof storyboardVideoJobInputSchema>>(jobId);
  if (!job) {
    throw new AppError({
      status: 404,
      code: "job_not_found",
      userMessage: "没有找到这个分镜视频生成任务。",
    });
  }
  const input = storyboardVideoJobInputSchema.parse(job.input);
  const shot = await getStoryboardShot({ projectId: job.projectId, shotId: input.shotId });
  if (!shot) {
    throw new AppError({
      status: 404,
      code: "storyboard_shot_not_found",
      userMessage: "分镜视频对应的文字分镜不存在。请刷新后重新发起生成。",
    });
  }
  const selectedImage = await getSelectedStoryboardImage({ projectId: job.projectId, shotId: input.shotId });
  if (!selectedImage?.ossUrl) {
    throw new AppError({
      status: 422,
      code: "storyboard_image_required",
      userMessage: "请先为这条分镜确认正式图片，再生成视频候选。",
    });
  }

  await markStoryboardVideoProcessing(input.storyboardVideoId);
  await updateJobStatus(jobId, {
    status: "processing",
    currentStep: "storyboard_video_generation",
    userMessage: "正在调用火山方舟 Doubao-Seedance 生成视频候选。",
  });
  await appendJobEvent(jobId, {
    type: "tool.started",
    jobId,
    projectId: job.projectId,
    callId: "ark_storyboard_video_generation",
    title: "调用火山方舟视频模型",
    userMessage: "系统正在用已确认分镜图和视频 Prompt 生成真实视频候选。",
    at: new Date().toISOString(),
  });

  try {
    const generatedVideo = await generateArkImageToVideo({
      model: env.ARK_VIDEO_GENERATION_MODEL,
      prompt: buildStoryboardVideoPrompt(shot),
      imageUrl: selectedImage.ossKey ? createReadUrl(selectedImage.ossKey, 60 * 60) : selectedImage.ossUrl,
      timeoutMs: 12 * 60_000,
      telemetry: {
        projectId: job.projectId,
        jobId,
        callId: "ark_storyboard_video_generation",
        operation: "storyboard_video_generation",
        metadata: { shotId: shot.id, storyboardVideoId: input.storyboardVideoId, selectedImageId: selectedImage.id },
      },
    });
    const objectKey = createStoryboardVideoObjectKey(job.projectId, input.storyboardVideoId, generatedVideo.extension);
    const uploaded = await uploadOssObject({
      objectKey,
      body: generatedVideo.bytes,
      contentType: generatedVideo.mimeType,
    });
    const savedVideo = await markStoryboardVideoSucceeded({
      id: input.storyboardVideoId,
      ossKey: uploaded.ossKey,
      ossUrl: uploaded.ossUrl,
    });
    if (!savedVideo) {
      throw new AppError({
        status: 500,
        code: "storyboard_video_update_failed",
        userMessage: "视频候选已生成，但保存记录失败。请刷新后检查生成历史。",
      });
    }

    const artifact = await createArtifact({
      projectId: job.projectId,
      kind: "storyboard_video",
      title: `分镜视频：${shot.shotNumber}`,
      status: "draft",
      data: {
        shotId: shot.id,
        sceneId: shot.sceneId,
        storyboardVideoId: savedVideo.id,
        prompt: savedVideo.prompt,
        imageId: selectedImage.id,
        providerTaskId: generatedVideo.providerTaskId,
        ossUrl: uploaded.ossUrl,
      },
      sourceJobId: jobId,
      ossUrl: uploaded.ossUrl,
    });
    await appendJobEvent(jobId, {
      type: "artifact.created",
      jobId,
      projectId: job.projectId,
      artifactId: artifact.id,
      title: "已创建分镜视频产物",
      userMessage: "分镜视频已保存到 OSS，并写入项目产物。",
      at: new Date().toISOString(),
    });
    await recordStageProgress({
      projectId: job.projectId,
      stageKey: "ai_video_canvas",
      status: "in_progress",
      currentStage: "ai_video_canvas",
      projectStatus: "in_progress",
      userMessage: "分镜视频生成完成，等待内部选择正式视频候选。",
      inputRefs: [
        { type: "storyboard_shot", id: shot.id },
        { type: "storyboard_image", id: selectedImage.id },
      ],
      outputRefs: [{ type: "storyboard_video", id: savedVideo.id }],
      snapshot: { shotId: shot.id, storyboardVideoId: savedVideo.id },
    });
    await updateJobStatus(jobId, {
      status: "succeeded",
      currentStep: "completed",
      userMessage: "分镜视频生成完成。",
    });
    return { jobId, storyboardVideo: savedVideo, artifact };
  } catch (error) {
    const userMessage =
      error instanceof AppError
        ? error.userMessage
        : "分镜视频生成失败。系统已保存失败状态，你可以稍后重试或调整 Prompt。";
    await markStoryboardVideoFailed({ id: input.storyboardVideoId, failureReason: userMessage });
    await recordStageProgress({
      projectId: job.projectId,
      stageKey: "ai_video_canvas",
      status: "blocked",
      currentStage: "ai_video_canvas",
      projectStatus: "blocked",
      userMessage,
      errorMessage: userMessage,
      inputRefs: [{ type: "storyboard_video", id: input.storyboardVideoId }],
    });
    await updateJobStatus(jobId, {
      status: "failed",
      currentStep: "failed",
      userMessage,
      errorCode: error instanceof AppError ? error.code : "storyboard_video_generation_failed",
    });
    throw error;
  }
}

export async function confirmStoryboardVideo(input: {
  projectId: string;
  videoId: string;
  actorId: string;
}) {
  const video = await selectStoryboardVideo(input);
  if (!video) {
    throw new AppError({
      status: 404,
      code: "storyboard_video_not_found",
      userMessage: "没有找到这个视频候选。它可能已经被删除或不属于当前项目。",
    });
  }
  await recordStageProgress({
    projectId: input.projectId,
    stageKey: "ai_video_canvas",
    status: "in_progress",
    currentStage: "ai_video_canvas",
    projectStatus: "in_progress",
    userMessage: "视频候选已内部确认。模块三不会触发甲方审核，后续会服务 A copy 粗剪。",
    outputRefs: [{ type: "storyboard_video", id: video.id }],
    snapshot: { storyboardVideoId: video.id },
  });
  return {
    video,
    message: "视频候选已设为该分镜的正式内部资产。",
  };
}

function buildStoryboardImagePrompt(shot: {
  visualDescription: string;
  shotSize: string;
  actionExpression: string;
  cameraMovement: string;
  imagePrompt: string;
  characterRefs: unknown[];
  sceneRefs: unknown[];
}) {
  return [
    "生成一张横版正式分镜图片，用于 AIGC 广告片创作。",
    "画面需要具备商业广告质感、构图清晰、主体明确、真实光影，不要出现字幕、UI、水印、Logo。",
    `画面内容：${shot.visualDescription}`,
    shot.shotSize ? `景别：${shot.shotSize}` : "",
    shot.actionExpression ? `动作与表情：${shot.actionExpression}` : "",
    shot.cameraMovement ? `机位与运镜：${shot.cameraMovement}` : "",
    shot.imagePrompt ? `分镜 Prompt：${shot.imagePrompt}` : "",
    shot.characterRefs.length ? `人物参考：${JSON.stringify(shot.characterRefs).slice(0, 1000)}` : "",
    shot.sceneRefs.length ? `场景参考：${JSON.stringify(shot.sceneRefs).slice(0, 1000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildStoryboardVideoPrompt(shot: {
  visualDescription: string;
  cameraMovement: string;
  actionExpression: string;
  videoPrompt: string;
}) {
  return [
    "根据已确认的分镜图片生成一段短视频。保持人物、场景、构图和广告质感一致。",
    `画面内容：${shot.visualDescription}`,
    shot.actionExpression ? `动作与表情：${shot.actionExpression}` : "",
    shot.cameraMovement ? `机位与运镜：${shot.cameraMovement}` : "",
    shot.videoPrompt ? `视频 Prompt：${shot.videoPrompt}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
