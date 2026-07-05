import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { createReadUrlFromOssUrl } from "@/server/providers/oss";
import {
  createClientReviewTask,
  getNextClientReviewVersion,
  getClientReviewSecretByTaskId,
  getClientReviewTaskByTokenHash,
  listClientReviewItems,
  listProjectClientReviewTasks,
  submitClientReviewTaskRecord,
  type ClientReviewItemView,
  type ClientReviewItemDecision,
  type ClientReviewItemType,
  type ClientReviewTaskView,
  type ClientReviewTargetScopeType,
  type ClientReviewType,
} from "@/server/repositories/client-reviews";
import { listProjectArtifacts } from "@/server/repositories/artifacts";
import { getProjectById } from "@/server/repositories/projects";
import { getCreativeProposalRound, updateCreativeProposalRoundClientDecision } from "@/server/repositories/creative-proposals";
import { listProjectCreativeDirections, type CreativeDirectionView } from "@/server/repositories/creative-directions";
import { listProjectCreativeExpansions, type CreativeExpansionView } from "@/server/repositories/creative-expansions";
import { listGeneratedImagesByIds, listProjectGeneratedImages } from "@/server/repositories/generated-images";
import { getProjectProposal, updateProposalStatus } from "@/server/repositories/proposals";
import { getProjectQuote, updateQuoteStatus, type QuoteView } from "@/server/repositories/quotes";
import { getProjectContract, updateContractStatus } from "@/server/repositories/contracts";
import {
  applyReviewCutClientDecision,
  createReviewCutAnnotations,
  getReviewCut,
  mapTimecodeToStoryboard,
  markReviewCutClientReviewing,
} from "@/server/repositories/review-cuts";
import {
  getStoryboardImageBatch,
  listStoryboardImageBatches,
  listStoryboardImageVersions,
  updateStoryboardImageBatchItemDecisions,
  updateStoryboardImageBatchStatus,
} from "@/server/repositories/storyboard-image-batches";
import {
  getScriptDirectionPackage,
  listStoryboardImages,
  listStoryboardScenes,
  listStoryboardShots,
  type ScriptDirectionPackageView,
  type StoryboardImageView,
  updateScriptDirectionPackageStatus,
  updateStoryboardSceneStatus,
  updateStoryboardShotClientDecision,
} from "@/server/repositories/story-production";
import { ensureScriptPackageStandardizedForReview } from "@/server/use-cases/script-storyboard";
import {
  listProductionEntities,
  listProductionReferenceSets,
  updateProjectProductionSetupStatus,
} from "@/server/repositories/production-entities";
import { recordStageProgress } from "@/server/use-cases/stage-progress";
import { assertAllStoryboardShotsClientApproved } from "@/server/use-cases/storyboard-image-batches";
import { generateRiskCheckFromProject } from "@/server/use-cases/risk-check-card";

const submitItemSchema = z.object({
  itemId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  score: z.coerce.number().int().min(1).max(5).nullable().optional(),
  feedback: z.string().max(1200, "单条分镜意见不能超过 1200 个字符").optional(),
});

const submitTimecodeAnnotationSchema = z.object({
  timeSeconds: z.coerce.number().min(0, "时间戳不能为负数"),
  feedback: z.string().trim().min(1, "请填写这个时间点的批注意见").max(1200, "单条时间戳意见不能超过 1200 个字符"),
});

const unlockClientReviewSchema = z.object({
  verificationCode: z.string().trim().min(4, "请输入审核验证码或密钥"),
});

export const submitClientReviewSchema = z.object({
  verificationCode: z.string().trim().min(4, "请输入审核验证码或密钥"),
  decision: z.enum(["approved", "rejected"]),
  reviewerName: z.string().trim().max(80, "姓名不能超过 80 个字符").optional(),
  reviewerContact: z.string().trim().max(120, "联系方式不能超过 120 个字符").optional(),
  feedback: z.string().trim().max(3000, "整体反馈不能超过 3000 个字符").optional(),
  items: z.array(submitItemSchema).default([]),
  timecodeAnnotations: z.array(submitTimecodeAnnotationSchema).default([]),
});

export const clientReviewScenes = [
  "brief_confirmation",
  "creative_round_1",
  "creative_round_2",
  "production_setup",
  "storyboard_image_batch",
  "a_copy_round",
  "b_copy_final",
] as const;

export type ClientReviewScene = (typeof clientReviewScenes)[number];

export const createClientReviewInputSchema = z.object({
  reviewType: z.enum([
    "brief_confirmation",
    "project_proposal",
    "quote_confirmation",
    "contract_confirmation",
    "script_package",
    "storyboard_image_batch",
    "a_copy_review",
    "b_copy_review",
  ]),
  targetScopeId: z.string().uuid().optional(),
  sopKey: z.string().max(80).optional().nullable(),
  reviewScene: z.enum(clientReviewScenes).optional().nullable(),
  roundNumber: z.number().int().positive().optional().nullable(),
  batchNumber: z.number().int().positive().optional().nullable(),
  payloadVersion: z.number().int().positive().optional().nullable(),
});

export function normalizeClientReviewMetadata(input: {
  reviewType: ClientReviewType;
  sopKey?: string | null;
  reviewScene?: ClientReviewScene | null;
  roundNumber?: number | null;
  batchNumber?: number | null;
  payloadVersion?: number | null;
}) {
  return {
    sopKey: input.sopKey ?? null,
    reviewScene: input.reviewScene ?? null,
    roundNumber: input.roundNumber ?? null,
    batchNumber: input.batchNumber ?? null,
    payloadVersion: input.payloadVersion ?? 1,
  };
}

export function buildClientReviewTaskMetadataInput(input: {
  reviewType: ClientReviewType;
  sopKey?: string | null;
  reviewScene?: ClientReviewScene | null;
  roundNumber?: number | null;
  batchNumber?: number | null;
  payloadVersion?: number | null;
}) {
  const metadata = normalizeClientReviewMetadata(input);

  return {
    sopKey: metadata.sopKey,
    reviewScene: metadata.reviewScene,
    roundNumber: metadata.roundNumber,
    batchNumber: metadata.batchNumber,
    reviewPayloadVersion: metadata.payloadVersion,
  };
}

export async function createWorkflowClientReview(input: {
  projectId: string;
  actorId: string;
  origin: string;
  reviewType: z.infer<typeof createClientReviewInputSchema>["reviewType"];
  targetScopeId?: string | null;
  sopKey?: string | null;
  reviewScene?: ClientReviewScene | null;
  roundNumber?: number | null;
  batchNumber?: number | null;
  payloadVersion?: number | null;
}) {
  const parsed = createClientReviewInputSchema.parse({
    reviewType: input.reviewType,
    targetScopeId: input.targetScopeId ?? undefined,
    sopKey: input.sopKey ?? null,
    reviewScene: input.reviewScene ?? null,
    roundNumber: input.roundNumber ?? null,
    batchNumber: input.batchNumber ?? null,
    payloadVersion: input.payloadVersion ?? null,
  });
  let metadata = buildClientReviewTaskMetadataInput({
    reviewType: parsed.reviewType,
    sopKey: parsed.sopKey,
    reviewScene: parsed.reviewScene,
    roundNumber: parsed.roundNumber,
    batchNumber: parsed.batchNumber,
    payloadVersion: parsed.payloadVersion,
  });
  const spec = await buildWorkflowReviewSpec({
    projectId: input.projectId,
    actorId: input.actorId,
    reviewType: parsed.reviewType,
    targetScopeId: parsed.targetScopeId ?? null,
    reviewScene: parsed.reviewScene ?? null,
  });
  if (spec.targetScopeType === "review_cut") {
    const reviewCut = spec.payload.reviewCut as { cutType?: "a_copy" | "b_copy"; roundNumber?: number } | undefined;
    metadata = {
      ...metadata,
      sopKey: metadata.sopKey ?? (reviewCut?.cutType === "a_copy" ? "sop_8" : "sop_9"),
      reviewScene: metadata.reviewScene ?? (reviewCut?.cutType === "a_copy" ? "a_copy_round" : "b_copy_final"),
      roundNumber: metadata.roundNumber ?? reviewCut?.roundNumber ?? null,
    };
  }
  const credentials = createReviewCredentials();
  const version = await getNextClientReviewVersion({
    projectId: input.projectId,
    reviewType: spec.reviewType,
    targetScopeId: spec.targetScopeId,
  });
  const review = await createClientReviewTask({
    projectId: input.projectId,
    moduleKey: spec.moduleKey,
    reviewType: spec.reviewType,
    targetScopeType: spec.targetScopeType,
    targetScopeId: spec.targetScopeId,
    title: spec.title,
    summary: spec.summary,
    version,
    accessTokenHash: credentials.tokenHash,
    verificationCodeHash: credentials.codeHash,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    createdBy: input.actorId,
    sopKey: metadata.sopKey,
    reviewScene: metadata.reviewScene,
    roundNumber: metadata.roundNumber,
    batchNumber: metadata.batchNumber,
    reviewPayloadVersion: metadata.reviewPayloadVersion,
    payload: spec.payload,
    items: spec.items,
  });

  await markReviewCreatedProgress({
    projectId: input.projectId,
    actorId: input.actorId,
    reviewTaskId: review.task.id,
    reviewType: spec.reviewType,
    targetScopeType: spec.targetScopeType,
    targetScopeId: spec.targetScopeId,
    reviewScene: metadata.reviewScene,
  });
  if (spec.targetScopeType === "review_cut") {
    await markReviewCutClientReviewing({
      projectId: input.projectId,
      reviewCutId: spec.targetScopeId,
      reviewTaskId: review.task.id,
    });
  }
  if (spec.targetScopeType === "storyboard_image_batch") {
    await updateStoryboardImageBatchStatus({
      projectId: input.projectId,
      batchId: spec.targetScopeId,
      status: "client_reviewing",
      actorId: input.actorId,
      clientReviewTaskId: review.task.id,
      snapshot: spec.payload,
    });
  }

  return {
    ...review,
    reviewUrl: buildReviewUrlWithVerificationCode(input.origin, credentials.token, credentials.code),
    verificationCode: credentials.code,
  };
}

export async function createReviewForStoryboardScene(input: {
  projectId: string;
  sceneId: string;
  actorId: string;
  origin: string;
}) {
  const [shots, images] = await Promise.all([
    listStoryboardShots(input.projectId),
    listStoryboardImages(input.projectId),
  ]);
  const sceneShots = shots.filter((shot) => shot.sceneId === input.sceneId);
  const selectedImages = images.filter((image) => image.sceneId === input.sceneId && image.isSelected);

  if (sceneShots.length === 0) {
    throw new AppError({
      status: 422,
      code: "storyboard_scene_empty",
      userMessage: "这个场次还没有文字分镜，不能提交甲方审核。",
    });
  }

  const missingImage = sceneShots.find((shot) => !selectedImages.some((image) => image.shotId === shot.id));
  if (missingImage) {
    throw new AppError({
      status: 422,
      code: "storyboard_scene_images_incomplete",
      userMessage: `分镜 ${missingImage.shotNumber} 还没有内部确认的图片。请先在图片画布确认本场全部分镜图，再提交甲方审核。`,
    });
  }

  const credentials = createReviewCredentials();
  const version = await getNextClientReviewVersion({
    projectId: input.projectId,
    reviewType: "storyboard_scene_images",
    targetScopeId: input.sceneId,
  });
  const review = await createClientReviewTask({
    projectId: input.projectId,
    moduleKey: "storyboard_image_canvas",
    reviewType: "storyboard_scene_images",
    targetScopeType: "storyboard_scene",
    targetScopeId: input.sceneId,
    title: "分镜图片场次审核",
    summary: "请逐条确认分镜图片 OK 或不 OK；不 OK 请填写原因和修改意见。",
    version,
    accessTokenHash: credentials.tokenHash,
    verificationCodeHash: credentials.codeHash,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    createdBy: input.actorId,
    payload: {
      sceneId: input.sceneId,
      shots: sceneShots,
      selectedImages,
    },
    items: sceneShots.map((shot) => {
      const image = selectedImages.find((item) => item.shotId === shot.id);
      return {
        itemType: "storyboard_shot_image",
        itemId: shot.id,
        itemLabel: `${shot.shotNumber}｜${shot.visualDescription.slice(0, 60)}`,
        metadata: {
          shotId: shot.id,
          shotNumber: shot.shotNumber,
          imageId: image?.id ?? null,
          imageUrl: image?.ossUrl ?? null,
          visualDescription: shot.visualDescription,
        },
      };
    }),
  });

  await updateStoryboardSceneStatus({
    projectId: input.projectId,
    sceneId: input.sceneId,
    status: "client_reviewing",
    actorId: input.actorId,
  });
  await recordStageProgress({
    projectId: input.projectId,
    stageKey: "storyboard_image_canvas",
    status: "waiting_review",
    currentStage: "storyboard_image_canvas",
    projectStatus: "waiting_review",
    userMessage: "本场分镜图片已提交甲方审核，等待甲方逐条确认。",
    inputRefs: [{ type: "storyboard_scene", id: input.sceneId }],
    outputRefs: [{ type: "client_review_task", id: review.task.id }],
    snapshot: { reviewTaskId: review.task.id, reviewType: "storyboard_scene_images" },
  });

  return {
    ...review,
    reviewUrl: buildReviewUrlWithVerificationCode(input.origin, credentials.token, credentials.code),
    verificationCode: credentials.code,
  };
}

export async function createReviewForStoryboardImageBatch(input: {
  projectId: string;
  batchId: string;
  actorId: string;
  origin: string;
}) {
  const batch = await getStoryboardImageBatch({ projectId: input.projectId, batchId: input.batchId });
  if (!batch) {
    throw new AppError({
      status: 404,
      code: "storyboard_image_batch_not_found",
      userMessage: "没有找到这个分镜图片批次。请刷新工作台后重新选择批次。",
    });
  }
  return createWorkflowClientReview({
    projectId: input.projectId,
    actorId: input.actorId,
    origin: input.origin,
    reviewType: "storyboard_image_batch",
    targetScopeId: batch.id,
    sopKey: "sop_6",
    reviewScene: "storyboard_image_batch",
    batchNumber: batch.batchNumber,
    payloadVersion: batch.version,
  });
}

type WorkflowReviewSpec = {
  moduleKey: string;
  reviewType: ClientReviewType;
  targetScopeType: ClientReviewTargetScopeType;
  targetScopeId: string;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  items: Array<{
    itemType: ClientReviewItemType;
    itemId: string;
    itemLabel: string;
    metadata?: Record<string, unknown>;
  }>;
};

function resolveCurrentStoryboardImageForReview(images: StoryboardImageView[], shotId: string) {
  const candidates = images
    .filter((image) => image.shotId === shotId && image.ossUrl && image.generationStatus === "succeeded")
    .sort((left, right) => {
      if (left.isSelected !== right.isSelected) return left.isSelected ? -1 : 1;
      return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    });
  return candidates[0] ?? null;
}

function buildPreviousStoryboardBatchFeedback(items: Array<{
  shotId: string | null;
  status: string;
  feedback: string;
  feedbackPayload: Record<string, unknown>;
  updatedAt: string;
}>) {
  const feedbackByShotId = new Map<string, {
    status: string;
    feedback: string;
    feedbackPayload: Record<string, unknown>;
    updatedAt: string;
  }>();
  for (const item of items) {
    if (!item.shotId || item.status === "pending") continue;
    const current = feedbackByShotId.get(item.shotId);
    if (!current || Date.parse(item.updatedAt) > Date.parse(current.updatedAt)) {
      feedbackByShotId.set(item.shotId, {
        status: item.status,
        feedback: item.feedback,
        feedbackPayload: item.feedbackPayload,
        updatedAt: item.updatedAt,
      });
    }
  }
  return feedbackByShotId;
}

async function buildWorkflowReviewSpec(input: {
  projectId: string;
  actorId?: string | null;
  reviewType: Exclude<ClientReviewType, "storyboard_scene_images">;
  targetScopeId: string | null;
  reviewScene?: ClientReviewScene | null;
}): Promise<WorkflowReviewSpec> {
  const project = await getProjectById(input.projectId);
  if (!project) {
    throw new AppError({
      status: 404,
      code: "project_not_found",
      userMessage: "没有找到这个项目。请刷新项目列表后再试。",
    });
  }

  if (input.reviewType === "brief_confirmation") {
    const artifacts = await listProjectArtifacts(input.projectId);
    const structuredRequirement = artifacts.find((artifact) => artifact.kind === "structured_requirement") ?? null;
    return {
      moduleKey: "brief_to_project_proposal",
      reviewType: "brief_confirmation",
      targetScopeType: "project",
      targetScopeId: project.id,
      title: "Brief 与项目需求确认",
      summary: "请确认本轮 Brief、项目目标和已结构化需求是否准确；如需补充，请直接打回并填写意见。",
      payload: {
        project,
        structuredRequirement,
      },
      items: [
        {
          itemType: "brief",
          itemId: project.id,
          itemLabel: `${project.brandName} / ${project.projectName} Brief`,
          metadata: {
            brandName: project.brandName,
            projectName: project.projectName,
            previewText: summarizeUnknown(structuredRequirement?.data ?? project),
            brief: (structuredRequirement?.data ?? null),
          },
        },
      ],
    };
  }

  if (input.reviewType === "project_proposal" && input.targetScopeId) {
    const creativeRound = await getCreativeProposalRound({ projectId: input.projectId, roundId: input.targetScopeId });
    if (creativeRound) {
      const sceneLabel = creativeRound.roundNumber === 1 ? "第一轮" : "第二轮";
      const [generatedImages, expansions, directions] = await Promise.all([
        listProjectGeneratedImages(input.projectId),
        listProjectCreativeExpansions(input.projectId),
        listProjectCreativeDirections(input.projectId),
      ]);
      return {
        moduleKey: "creative_visual_proposal",
        reviewType: "project_proposal",
        targetScopeType: "proposal",
        targetScopeId: creativeRound.id,
        title: `${sceneLabel}创意视觉提案确认`,
        summary:
          creativeRound.roundNumber === 1
            ? "请查看第一轮完整提案包中的方向、故事卡和氛围图，确认保留方向与视觉偏好；如需调整，请打回并填写具体意见。"
            : "请确认第二轮深化后的脚本/视觉方向是否可进入报价合同模块；如需调整，请填写具体视觉偏好和修改意见。",
        payload: {
          project,
          creativeProposalRound: creativeRound,
        },
        items: buildCreativeProposalReviewItems({
          round: creativeRound,
          directions,
          generatedImages,
          expansions,
        }),
      };
    }
  }

  if (input.reviewType === "project_proposal") {
    const proposal = await getProjectProposal(input.projectId);
    if (!proposal || (input.targetScopeId && proposal.id !== input.targetScopeId)) {
      throw new AppError({
        status: 404,
        code: "proposal_not_found",
        userMessage: "还没有找到可提交甲方审核的项目提案。请先保存提案快照后再生成审核链接。",
      });
    }
    return {
      moduleKey: "brief_to_project_proposal",
      reviewType: "project_proposal",
      targetScopeType: "proposal",
      targetScopeId: proposal.id,
      title: "完整项目提案确认",
      summary: "请确认项目提案内容、创意方向、执行计划和风险提示；如需调整，请打回并填写整体意见。",
      payload: { project, proposal },
      items: [
        {
          itemType: "proposal",
          itemId: proposal.id,
          itemLabel: proposal.title,
          metadata: {
            version: proposal.version,
            status: proposal.status,
            previewText: summarizeText(proposal.content, 1200),
          },
        },
      ],
    };
  }

  if (input.reviewType === "quote_confirmation") {
    const quote = await getProjectQuote(input.projectId);
    if (!quote || (input.targetScopeId && quote.id !== input.targetScopeId)) {
      throw new AppError({
        status: 404,
        code: "quote_not_found",
        userMessage: "还没有找到可提交甲方审核的报价。请先保存报价快照后再生成审核链接。",
      });
    }
    return {
      moduleKey: "quote_contract_completion",
      reviewType: "quote_confirmation",
      targetScopeType: "quote",
      targetScopeId: quote.id,
      title: "项目报价确认",
      summary: "请确认报价明细、合计金额和备注条件；如需修改，请打回并填写意见。",
      payload: { project, quote },
      items: [
        {
          itemType: "quote",
          itemId: quote.id,
          itemLabel: quote.title,
          metadata: {
            version: quote.version,
            status: quote.status,
            currency: quote.currency,
            totalAmount: quote.totalAmount,
            quoteItems: quote.items,
            notes: quote.notes,
            previewText: formatQuoteReviewSummary(quote),
          },
        },
      ],
    };
  }

  if (input.reviewType === "contract_confirmation") {
    const contract = await getProjectContract(input.projectId);
    if (!contract || (input.targetScopeId && contract.id !== input.targetScopeId)) {
      throw new AppError({
        status: 404,
        code: "contract_not_found",
        userMessage: "还没有找到可提交甲方审核的合同。请先保存合同快照后再生成审核链接。",
      });
    }
    return {
      moduleKey: "quote_contract_completion",
      reviewType: "contract_confirmation",
      targetScopeType: "contract",
      targetScopeId: contract.id,
      title: "项目合同确认",
      summary: "请确认合同主体、交付范围、付款条款和补充约定；如需修改，请打回并填写意见。",
      payload: { project, contract },
      items: [
        {
          itemType: "contract",
          itemId: contract.id,
          itemLabel: contract.title,
          metadata: {
            version: contract.version,
            status: contract.status,
            content: contract.content,
            previewText: summarizeText(contract.content, 1200),
          },
        },
      ],
    };
  }

  if (input.reviewType === "a_copy_review" || input.reviewType === "b_copy_review") {
    const cutType = input.reviewType === "a_copy_review" ? "a_copy" : "b_copy";
    const reviewCutId = input.targetScopeId;
    if (!reviewCutId) {
      throw new AppError({
        status: 400,
        code: "review_cut_required",
        userMessage: "请先上传成片版本，再生成甲方视频审核链接。",
      });
    }
    const reviewCut = await getReviewCut({ projectId: input.projectId, reviewCutId });
    if (!reviewCut || reviewCut.cutType !== cutType) {
      throw new AppError({
        status: 404,
        code: "review_cut_not_found",
        userMessage: "没有找到可提交甲方审核的成片版本。请先上传 A copy 或 B copy 后再生成审核链接。",
      });
    }
    if (!reviewCut.videoUrl) {
      throw new AppError({
        status: 422,
        code: "review_cut_video_missing",
        userMessage: "这个成片版本还没有可播放的视频链接。请先确认上传成功后再生成审核链接。",
      });
    }
    const reviewScene = cutType === "a_copy" ? "a_copy_round" : "b_copy_final";
    const sopKey = cutType === "a_copy" ? "sop_8" : "sop_9";

    return {
      moduleKey: cutType === "a_copy" ? "a_copy_revision" : "b_copy_final_confirmation",
      reviewType: input.reviewType,
      targetScopeType: "review_cut",
      targetScopeId: reviewCut.id,
      title: cutType === "a_copy" ? "A copy 完整初版审核" : "B copy 近最终版审核",
      summary:
        cutType === "a_copy"
          ? "请观看完整初版视频，在需要修改的位置暂停并添加时间戳批注。A copy 用于确认内容、节奏和大方向。"
          : "请观看完整精剪视频，在需要修改的位置暂停并添加时间戳批注；如无问题请整体通过，系统会记录最终确认。",
      payload: { project, reviewCut, reviewScene, sopKey, roundNumber: reviewCut.roundNumber },
      items: [
        {
          itemType: "review_cut_video",
          itemId: reviewCut.id,
          itemLabel: reviewCut.title,
          metadata: {
            cutType: reviewCut.cutType,
            version: reviewCut.version,
            roundNumber: reviewCut.roundNumber,
            status: reviewCut.status,
            videoUrl: reviewCut.videoUrl,
            durationSeconds: reviewCut.durationSeconds,
            previewText: reviewCut.description,
          },
        },
      ],
    };
  }

  if (input.reviewType === "storyboard_image_batch") {
    const batchId = input.targetScopeId;
    if (!batchId) {
      throw new AppError({
        status: 400,
        code: "storyboard_image_batch_required",
        userMessage: "请先创建分镜图片批次，再生成甲方审核链接。",
      });
    }
    const [batch, batches, scenes, shots, images, imageVersions] = await Promise.all([
      getStoryboardImageBatch({ projectId: input.projectId, batchId }),
      listStoryboardImageBatches(input.projectId),
      listStoryboardScenes(input.projectId),
      listStoryboardShots(input.projectId),
      listStoryboardImages(input.projectId),
      listStoryboardImageVersions(input.projectId),
    ]);
    if (!batch) {
      throw new AppError({
        status: 404,
        code: "storyboard_image_batch_not_found",
        userMessage: "没有找到这个分镜图片批次。请刷新工作台后重新选择批次。",
      });
    }
    const batchScenes = scenes.filter((scene) => batch.sceneIds.includes(scene.id));
    const batchShots = sortStoryboardBatchReviewShots(
      shots.filter((shot) => batch.sceneIds.includes(shot.sceneId)),
      batchScenes,
      batch.sceneIds,
    );
    if (batchShots.length === 0) {
      throw new AppError({
        status: 422,
        code: "storyboard_image_batch_empty",
        userMessage: "这个批次还没有关联文字分镜，不能提交甲方审核。",
      });
    }
    const selectedImages = batchShots
      .map((shot) => resolveCurrentStoryboardImageForReview(images, shot.id))
      .filter((image): image is StoryboardImageView => Boolean(image));
    const selectedImageByShotId = new Map(selectedImages.map((image) => [image.shotId, image]));
    const missingImage = batchShots.find((shot) => !selectedImageByShotId.has(shot.id));
    if (missingImage) {
      throw new AppError({
        status: 422,
        code: "storyboard_image_batch_incomplete",
        userMessage: `分镜 ${missingImage.shotNumber} 还没有可提交的图片。请先生成图片，再保存当前批次并提交甲方审核。`,
      });
    }
    const batchImageVersions = imageVersions.filter((version) => batchShots.some((shot) => shot.id === version.shotId));
    const previousFeedbackByShotId = buildPreviousStoryboardBatchFeedback(
      batches.filter((item) => item.id !== batch.id).flatMap((item) => item.items)
    );
    return {
      moduleKey: "storyboard_image_canvas",
      reviewType: "storyboard_image_batch",
      targetScopeType: "storyboard_image_batch",
      targetScopeId: batch.id,
      title: `第 ${batch.batchNumber} 次分镜图片全量审核`,
      summary: "请逐张确认本次全量分镜图片 OK 或不 OK；上一轮未通过的图片会标红并保留对应批注。",
      payload: {
        batch,
        scenes: batchScenes,
        shots: batchShots,
        selectedImages,
        imageVersions: batchImageVersions,
      },
      items: batchShots.map((shot) => {
        const image = selectedImageByShotId.get(shot.id);
        const versions = batchImageVersions.filter((version) => version.shotId === shot.id);
        const previousFeedback = previousFeedbackByShotId.get(shot.id) ?? null;
        return {
          itemType: "storyboard_shot_image" as const,
          itemId: shot.id,
          itemLabel: `${shot.shotNumber}｜${shot.visualDescription.slice(0, 60)}`,
          metadata: {
            batchId: batch.id,
            batchNumber: batch.batchNumber,
            shotId: shot.id,
            shotNumber: shot.shotNumber,
            sceneId: shot.sceneId,
            imageId: image?.id ?? null,
            imageUrl: image?.ossUrl ?? null,
            previousDecision: previousFeedback?.status ?? null,
            previousFeedback: previousFeedback?.feedback ?? "",
            imageVersionIds: versions.map((version) => version.id),
            visualDescription: shot.visualDescription,
          },
        };
      }),
    };
  }

  if (input.reviewType === "script_package" && input.reviewScene === "production_setup") {
    const [entities, referenceSets] = await Promise.all([
      listProductionEntities(input.projectId),
      listProductionReferenceSets(input.projectId),
    ]);
    const activeEntities = entities.filter((entity) => entity.inclusionStatus !== "ignored");
    const activeEntityIds = new Set(activeEntities.map((entity) => entity.id));
    const activeReferenceSets = referenceSets.filter((set) => activeEntityIds.has(set.entityId));
    if (activeEntities.length === 0) {
      throw new AppError({
        status: 422,
        code: "production_entities_empty",
        userMessage: "人物和场景设定还没有生成。请先拆分文字分镜，再提交人物场景设定审核。",
      });
    }
    const referenceImages = await listGeneratedImagesByIds({
      projectId: input.projectId,
      imageIds: activeReferenceSets.flatMap((set) => set.referenceImageIds),
    });
    const referenceImageById = new Map(referenceImages.map((image) => [image.id, image]));
    const targetScopeId = input.targetScopeId && activeEntityIds.has(input.targetScopeId) ? input.targetScopeId : activeEntities[0].id;
    return {
      moduleKey: "script_storyboard_confirmation",
      reviewType: "script_package",
      targetScopeType: "script_package",
      targetScopeId,
      title: "人物场景设定确认",
      summary: "请确认完整脚本拆分后抽取的人物、场景和参考设定深度；如需修改，请打回并说明调整意见。",
      payload: { project, productionEntities: activeEntities, productionReferenceSets: activeReferenceSets },
      items: activeEntities.map((entity) => ({
        itemType: "reference_asset" as ClientReviewItemType,
        itemId: entity.id,
        itemLabel: `${entity.entityType === "character" ? "人物设定" : entity.entityType === "scene" ? "场景设定" : "道具设定"}｜${entity.name}`,
        metadata: {
          entityType: entity.entityType,
          referenceDepth: entity.referenceDepth,
          status: entity.status,
          sourceShotIds: entity.sourceShotIds,
          referenceSetCount: activeReferenceSets.filter((set) => set.entityId === entity.id).length,
          candidateImages: buildProductionSetupCandidateImages({
            entityId: entity.id,
            depth: entity.referenceDepth,
            referenceSets: activeReferenceSets,
            referenceImageById,
          }),
          previewText: summarizeText(entity.description || entity.name, 800),
        },
      })),
    };
  }

  const packageId = input.targetScopeId;
  if (!packageId) {
    throw new AppError({
      status: 400,
      code: "script_package_required",
      userMessage: "请先保存完整剧本，再生成甲方审核链接。",
    });
  }
  let pkg = await getScriptDirectionPackage({ projectId: input.projectId, packageId });
  if (!pkg) {
    throw new AppError({
      status: 404,
      code: "script_package_not_found",
      userMessage: "没有找到完整剧本记录。请先保存完整剧本后再提交甲方审核。",
    });
  }
  assertScriptPackageReviewReady(pkg);
  pkg = await ensureScriptPackageStandardizedForReview({
    projectId: input.projectId,
    packageId: pkg.id,
    actorId: input.actorId ?? null,
  });
  return {
    moduleKey: "script_storyboard_confirmation",
    reviewType: "script_package",
    targetScopeType: "script_package",
    targetScopeId: pkg.id,
    title: "完整剧本确认",
    summary: "请确认当前完整剧本是否可以进入文字分镜拆解；如需修改，请打回并说明调整意见。",
    payload: { project, package: pkg, references: [] },
    items: [
      {
        itemType: "script_direction",
        itemId: pkg.id,
        itemLabel: pkg.title,
        metadata: {
          version: pkg.version,
          concept: pkg.concept,
          content: pkg.standardizedScript,
          previewText: summarizeText(pkg.standardizedScript, 1200),
        },
      },
    ],
  };
}

export function assertScriptPackageReviewReady(pkg: Pick<ScriptDirectionPackageView, "standardizedScript">) {
  if (pkg.standardizedScript.trim()) return;

  throw new AppError({
    status: 422,
    code: "script_package_standardized_script_required",
    userMessage: "请先生成标准剧本，再提交甲方审核。",
  });
}

async function getClientReviewTaskForToken(token: string) {
  const task = await getClientReviewTaskByTokenHash(hashSecret(token));
  if (!task) {
    throw new AppError({
      status: 404,
      code: "client_review_not_found",
      userMessage: "没有找到这个审核链接。请检查链接是否完整，或联系项目团队重新发送。",
    });
  }
  return task;
}

export function loadClientReviewUnlockPrompt() {
  return {
    requiresVerification: true,
    message: "请输入项目团队发送给你的审核密钥。校验通过后才会展示本次审核内容。",
  };
}

export async function unlockClientReviewByToken(token: string, rawInput: unknown) {
  const input = unlockClientReviewSchema.parse(rawInput);
  const task = await getClientReviewTaskForToken(token);
  await assertClientReviewVerificationCode(task.id, input.verificationCode);
  return loadClientReviewContent(task);
}

export async function loadClientReviewByToken(token: string) {
  const task = await getClientReviewTaskForToken(token);
  return loadClientReviewContent(task);
}

async function loadClientReviewContent(task: ClientReviewTaskView) {
  const items = await listClientReviewItems(task.id);
  const creativeImageSource = await buildProjectCreativeReviewImageSource(task.projectId);
  const hydratedItems = await hydrateClientReviewItems(task, items, creativeImageSource);
  return {
    task,
    items: sortExternalReviewItemsForDisplay(task, hydratedItems),
    history: await buildClientReviewHistory(task, creativeImageSource),
  };
}

async function assertClientReviewVerificationCode(taskId: string, verificationCode: string) {
  const expectedCodeHash = await getClientReviewSecretByTaskId(taskId);
  if (!expectedCodeHash || !verifySecret(verificationCode, expectedCodeHash)) {
    throw new AppError({
      status: 401,
      code: "client_review_code_invalid",
      userMessage: "审核密钥不正确。请核对项目团队发送给你的密钥后再试。",
    });
  }
}

async function buildClientReviewHistory(currentTask: ClientReviewTaskView, creativeImageSource: CreativeReviewImageSource) {
  const tasks = await listProjectClientReviewTasks(currentTask.projectId);
  const relevantTasks = tasks
    .filter((task) => isExternallyVisibleReviewTask(task))
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());

  return Promise.all(
    relevantTasks.map(async (task) => {
      const items = await listClientReviewItems(task.id);
      const hydratedItems = await hydrateClientReviewItems(task, items, creativeImageSource);
      return {
        task: sanitizeClientReviewTaskForExternal(task),
        items: summarizeClientReviewItemsForExternal(sortExternalReviewItemsForDisplay(task, hydratedItems)),
        isCurrent: task.id === currentTask.id,
      };
    })
  );
}

function isExternallyVisibleReviewTask(task: ClientReviewTaskView) {
  return task.status !== "draft" && task.status !== "revoked";
}

function sanitizeClientReviewTaskForExternal(task: ClientReviewTaskView) {
  return {
    id: task.id,
    title: task.title,
    summary: task.summary,
    status: task.status,
    reviewType: task.reviewType,
    targetScopeType: task.targetScopeType,
    targetScopeId: task.targetScopeId,
    version: task.version,
    submittedAt: task.submittedAt,
    reviewedAt: task.reviewedAt,
    sopKey: task.sopKey,
    reviewScene: task.reviewScene,
    roundNumber: task.roundNumber,
    batchNumber: task.batchNumber,
    feedback: task.feedback,
    reviewerName: task.reviewerName,
    reviewerContact: task.reviewerContact,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

function summarizeClientReviewItemsForExternal(items: ClientReviewItemView[]) {
  return items.map((item) => ({
    id: item.id,
    itemId: item.itemId,
    itemType: item.itemType,
    itemLabel: item.itemLabel,
    decision: item.decision,
    score: item.score,
    feedback: item.feedback,
    metadata: summarizeClientReviewItemMetadata(item.metadata),
    updatedAt: item.updatedAt,
  }));
}

export function sortExternalReviewItemsForDisplay<
  Item extends { itemLabel: string; metadata: Record<string, unknown> },
>(task: Pick<ClientReviewTaskView, "reviewType">, items: Item[]) {
  if (task.reviewType !== "storyboard_image_batch" && task.reviewType !== "storyboard_scene_images") return items;
  return [...items].sort((left, right) => {
    const leftShotNumber = typeof left.metadata.shotNumber === "string" ? left.metadata.shotNumber : left.itemLabel;
    const rightShotNumber = typeof right.metadata.shotNumber === "string" ? right.metadata.shotNumber : right.itemLabel;
    return leftShotNumber.localeCompare(rightShotNumber, "zh-Hans-CN", { numeric: true, sensitivity: "base" });
  });
}

function summarizeClientReviewItemMetadata(metadata: Record<string, unknown>) {
  const summary: Record<string, unknown> = {};
  for (const key of [
    "directionTitle",
    "sceneIndex",
    "sortOrder",
    "previewText",
    "visualDescription",
    "concept",
    "styleLabel",
    "imageUrl",
    "videoUrl",
    "durationSeconds",
    "candidateImages",
    "storyContent",
    "quoteItems",
    "content",
    "notes",
    "currency",
    "totalAmount",
    "status",
    "version",
  ]) {
    if (metadata[key] !== undefined) summary[key] = metadata[key];
  }
  return summary;
}

async function hydrateClientReviewItems(task: {
  reviewType: ClientReviewType;
  reviewScene: string | null;
  targetScopeType: ClientReviewTargetScopeType;
  targetScopeId: string;
  projectId: string;
}, items: Awaited<ReturnType<typeof listClientReviewItems>>, imageSource?: CreativeReviewImageSource) {
  if (task.reviewType === "script_package" && task.reviewScene === "production_setup") {
    const entities = await listProductionEntities(task.projectId);
    const activeEntityIds = new Set(entities.filter((entity) => entity.inclusionStatus !== "ignored").map((entity) => entity.id));
    return items.filter((item) => activeEntityIds.has(item.itemId));
  }

  if (
    task.reviewType !== "project_proposal" ||
    task.targetScopeType !== "proposal" ||
    (task.reviewScene !== "creative_round_1" && task.reviewScene !== "creative_round_2")
  ) {
    return items;
  }

  const round = await getCreativeProposalRound({ projectId: task.projectId, roundId: task.targetScopeId });
  if (!round) return items;

  const resolvedImageSource = imageSource ?? (await buildProjectCreativeReviewImageSource(task.projectId));
  const conceptsById = new Map(round.concepts.map((concept) => [concept.id, concept]));
  return items.map((item) => {
    if (item.itemType !== "proposal") return item;
    const concept = conceptsById.get(item.itemId);
    if (!concept) return item;
    const existingImages = readCandidateImages(item.metadata.candidateImages);
    const freshImages = buildCreativeReviewCandidateImages(getConceptReviewImages(concept, resolvedImageSource));
    const candidateImages = freshImages.length > 0 ? freshImages : existingImages;
    return {
      ...item,
      metadata: {
        ...item.metadata,
        directionTitle: item.metadata.directionTitle ?? readStringField(concept.snapshot, "directionTitle"),
        candidateImageCount: candidateImages.length,
        candidateImages,
      },
    };
  });
}

async function buildProjectCreativeReviewImageSource(projectId: string) {
  const [generatedImages, expansions] = await Promise.all([
    listProjectGeneratedImages(projectId),
    listProjectCreativeExpansions(projectId),
  ]);
  return buildCreativeReviewImageSource({ generatedImages, expansions });
}

function getConceptReviewImages(
  concept: {
    directionId: string | null;
    sceneIndex: number;
    images: Array<{ id: string; ossUrl: string | null; prompt: string; status: string; isSelected?: boolean; sortOrder?: number | null }>;
    snapshot: Record<string, unknown>;
  },
  imageSource: CreativeReviewImageSource
) {
  const expansionId = readStringField(concept.snapshot, "expansionId");
  const fallbackExpansionId = concept.directionId ? imageSource.expansionIdByDirectionScene.get(`${concept.directionId}:${concept.sceneIndex}`) : "";
  const matchedExpansionId = expansionId || fallbackExpansionId;
  const generatedImages = matchedExpansionId ? imageSource.generatedImagesByExpansion.get(matchedExpansionId) ?? [] : [];
  return generatedImages.length > 0 ? generatedImages : concept.images;
}

type CreativeReviewGeneratedImage = {
  id: string;
  directionId: string | null;
  expansionId: string | null;
  ossUrl: string | null;
  prompt: string;
  status: string;
  reviewStatus: string | null;
  updatedAt: string;
};

type CreativeReviewImageSource = {
  generatedImagesByExpansion: Map<string, CreativeReviewGeneratedImage[]>;
  expansionIdByDirectionScene: Map<string, string>;
};

function buildCreativeReviewImageSource(input: {
  generatedImages: CreativeReviewGeneratedImage[];
  expansions: CreativeExpansionView[];
}): CreativeReviewImageSource {
  return {
    generatedImagesByExpansion: groupGeneratedImagesByExpansion(input.generatedImages),
    expansionIdByDirectionScene: groupExpansionIdsByDirectionScene(input.expansions),
  };
}

function groupGeneratedImagesByExpansion(
  images: CreativeReviewGeneratedImage[]
) {
  const grouped = new Map<string, CreativeReviewGeneratedImage[]>();
  for (const image of images) {
    if (!image.expansionId) continue;
    grouped.set(image.expansionId, [...(grouped.get(image.expansionId) ?? []), image]);
  }
  return grouped;
}

function groupExpansionIdsByDirectionScene(expansions: CreativeExpansionView[]) {
  const grouped = new Map<string, string>();
  const seenByDirection = new Map<string, number>();
  for (const expansion of expansions) {
    const sceneIndex = (seenByDirection.get(expansion.directionId) ?? 0) + 1;
    seenByDirection.set(expansion.directionId, sceneIndex);
    grouped.set(`${expansion.directionId}:${sceneIndex}`, expansion.id);
  }
  return grouped;
}

function buildCreativeReviewCandidateImages(
  images: Array<{
    id: string;
    ossUrl: string | null;
    prompt: string;
    status: string;
    isSelected?: boolean;
    sortOrder?: number | null;
    reviewStatus?: string | null;
  }>
) {
  return images
    .filter((image) => image.ossUrl && (image.status === "generated" || image.status === "selected" || image.status === "succeeded"))
    .slice(0, 4)
    .map((image, index) => ({
      id: image.id,
      imageUrl: createReadUrlFromOssUrl(image.ossUrl ?? "", 60 * 60, {
        disposition: "inline",
        fileName: `creative-candidate-${image.sortOrder ?? index + 1}.png`,
      }),
      prompt: image.prompt,
      status: image.status,
      isSelected: image.isSelected ?? image.reviewStatus === "confirmed",
      sortOrder: image.sortOrder ?? index + 1,
    }));
}

function buildProductionSetupCandidateImages(input: {
  entityId: string;
  depth: string;
  referenceSets: Array<{ entityId: string; depth: string; referenceImageIds: string[] }>;
  referenceImageById: Map<
    string,
    {
      id: string;
      ossUrl: string | null;
      prompt: string;
      status: string;
      reviewStatus: string | null;
      updatedAt: string;
    }
  >;
}) {
  const activeReference =
    input.referenceSets.find((set) => set.entityId === input.entityId && set.depth === input.depth) ??
    input.referenceSets.find((set) => set.entityId === input.entityId);

  return (activeReference?.referenceImageIds ?? [])
    .map((imageId) => input.referenceImageById.get(imageId))
    .filter((image): image is NonNullable<typeof image> => Boolean(image?.ossUrl && image.status === "succeeded"))
    .slice(0, 4)
    .map((image, index) => ({
      id: image.id,
      imageUrl: createReadUrlFromOssUrl(image.ossUrl ?? "", 60 * 60, {
        disposition: "inline",
        fileName: `production-reference-${index + 1}.png`,
      }),
      prompt: image.prompt,
      status: image.status,
      isSelected: image.reviewStatus === "confirmed",
      sortOrder: index + 1,
    }));
}

function readCandidateImages(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : null))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .filter((item) => typeof item.imageUrl === "string" && item.imageUrl.trim());
}

function readStringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

export async function submitClientReviewByToken(token: string, rawInput: unknown) {
  const input = submitClientReviewSchema.parse(rawInput);
  const baseTask = await getClientReviewTaskForToken(token);
  await assertClientReviewVerificationCode(baseTask.id, input.verificationCode);
  const { task, items: existingItems } = await loadClientReviewContent(baseTask);

  const normalizedItems = normalizeReviewItemsForSubmission({
    reviewType: task.reviewType,
    decision: input.decision,
    submittedItems: input.items,
    existingItems,
  });
  const creativeReviewFeedback =
    task.reviewScene === "creative_round_1" || task.reviewScene === "creative_round_2"
      ? formatCreativeReviewDecisionPayload({
          overallFeedback: input.feedback,
          items: normalizedItems.map((item) => {
            const existingItem = existingItems.find((candidate) => candidate.itemId === item.itemId);
            return {
              ...item,
              itemLabel: existingItem?.itemLabel ?? item.itemId,
              metadata: existingItem?.metadata ?? {},
            };
          }),
        })
      : {};
  if (task.reviewScene === "creative_round_1" || task.reviewScene === "creative_round_2") {
    assertCreativeRoundApprovalHasRetainedDirections({
      decision: input.decision,
      retainedDirectionIds: readRetainedDirectionIdsFromPayload(creativeReviewFeedback),
    });
  }

  const result = await submitClientReviewTaskRecord({
    taskId: task.id,
    decision: input.decision,
    reviewerName: input.reviewerName,
    reviewerContact: input.reviewerContact,
    feedback: input.feedback,
    decisionPayload: {
      submittedAt: new Date().toISOString(),
      decision: input.decision,
      itemDecisionCount: normalizedItems.length,
      ...creativeReviewFeedback,
    },
    items: normalizedItems,
  });

  if (task.reviewType === "storyboard_scene_images" && task.targetScopeType === "storyboard_scene") {
    await Promise.all(
      normalizedItems.map((item) =>
        updateStoryboardShotClientDecision({
          projectId: task.projectId,
          shotId: item.itemId,
          approved: item.decision === "approved",
        })
      )
    );
    await updateStoryboardSceneStatus({
      projectId: task.projectId,
      sceneId: task.targetScopeId,
      status: input.decision === "approved" ? "client_approved" : "client_rejected",
    });
    await recordStageProgress({
      projectId: task.projectId,
      stageKey: "storyboard_image_canvas",
      status: input.decision === "approved" ? "approved" : "needs_revision",
      currentStage: "storyboard_image_canvas",
      projectStatus: input.decision === "approved" ? "approved" : "needs_revision",
      userMessage:
        input.decision === "approved"
          ? "甲方已逐条确认本场分镜图片，本场可以进入后续视频生成准备。"
          : "甲方已逐条打回本场部分分镜图片，场内逐分镜修改意见已保存。",
      inputRefs: [{ type: "client_review_task", id: task.id }],
      outputRefs: [{ type: "storyboard_scene", id: task.targetScopeId }],
      snapshot: {
        reviewTaskId: task.id,
        decision: input.decision,
        itemDecisions: normalizedItems,
      },
    });
  } else {
    await applyWorkflowReviewDecision({
      projectId: task.projectId,
      reviewTaskId: task.id,
      reviewType: task.reviewType,
      targetScopeType: task.targetScopeType,
      targetScopeId: task.targetScopeId,
      decision: input.decision,
      reviewScene: task.reviewScene as ClientReviewScene | null,
      itemDecisions: normalizedItems,
      timecodeAnnotations: input.timecodeAnnotations,
      reviewerName: input.reviewerName,
      feedback: input.feedback,
      decisionPayload: result.task.decisionPayload,
      actorId: task.createdBy,
    });
  }

  return {
    task: result.task,
    items: result.items,
    message:
      input.decision === "approved"
        ? "审核已提交：本轮内容已确认。项目团队会在内部端看到你的确认结果。"
        : "审核已提交：本轮内容已打回。项目团队会看到原因和逐条修改意见。",
  };
}

export function normalizeReviewItemsForSubmission(input: {
  reviewType: ClientReviewType;
  decision: "approved" | "rejected";
  submittedItems: Array<{
    itemId: string;
    decision: Exclude<ClientReviewItemDecision, "pending">;
    score?: number | null;
    feedback?: string | null;
  }>;
  existingItems: Array<{ itemId: string }>;
}) {
  const byItemId = new Map(input.submittedItems.map((item) => [item.itemId, item]));
  return input.existingItems.map((item) => {
    const submitted = byItemId.get(item.itemId);
    if (input.reviewType === "storyboard_image_batch") {
      if (!submitted) {
        throw new AppError({
          status: 422,
          code: "storyboard_image_batch_item_decision_required",
          userMessage: "请逐张分镜选择 OK 或不 OK 后再提交审核。",
        });
      }
      if (submitted.decision === "rejected" && !submitted.feedback?.trim()) {
        throw new AppError({
          status: 422,
          code: "storyboard_image_batch_item_feedback_required",
          userMessage: "请为不 OK 的分镜填写原因和修改意见。",
        });
      }
      return {
        itemId: item.itemId,
        decision: submitted.decision,
        score: null,
        feedback: submitted.feedback ?? "",
      };
    }
    const defaultScore =
      input.reviewType === "storyboard_scene_images"
        ? input.decision === "approved"
          ? 5
          : 2
        : null;
    return {
      itemId: item.itemId,
      decision: submitted?.decision ?? input.decision,
      score: submitted?.score ?? defaultScore,
      feedback: submitted?.feedback ?? "",
    };
  });
}

export function formatCreativeReviewDecisionPayload(input: {
  overallFeedback?: string | null;
  items: Array<{
    itemId: string;
    itemLabel?: string | null;
    decision: Exclude<ClientReviewItemDecision, "pending">;
    score?: number | null;
    feedback?: string | null;
    metadata?: Record<string, unknown> | null;
  }>;
}) {
  const directionPriority = buildCreativeDirectionPriority(input.items);
  const retainedDirectionIds = buildRetainedCreativeDirectionIds(input.items);
  const selectedDirectionStyles = buildSelectedCreativeDirectionStyles(input.items);
  const visualNotes = [
    ...input.items
      .map((item) => {
        const feedback = item.feedback?.trim();
        if (!feedback) return "";
        return `${getReviewFeedbackItemLabel(item)}：${feedback}`;
      })
      .filter(Boolean),
    input.overallFeedback?.trim() ?? "",
  ].filter(Boolean);

  return {
    directionPriority,
    retainedDirectionIds,
    selectedDirectionStyles,
    visualPreferenceNotes: visualNotes.join("；"),
  };
}

export function buildCreativeProposalReviewItems(input: {
  round: {
    roundNumber: 1 | 2;
    directionIds: string[];
      concepts: Array<{
      id: string;
      title: string;
      directionId: string | null;
      sceneIndex: number;
      requiredImageCount: number;
      description: string;
      sourceText: string;
      imagePrompt: string;
      snapshot: Record<string, unknown>;
      images: Array<{
        id: string;
        ossUrl: string | null;
        prompt: string;
        status: string;
        isSelected?: boolean;
        sortOrder?: number | null;
      }>;
    }>;
  };
  directions: Array<Pick<CreativeDirectionView, "id" | "title" | "coreIdea" | "fitReason" | "riskNotes" | "sortOrder">>;
  generatedImages: CreativeReviewGeneratedImage[];
  expansions: CreativeExpansionView[];
}): WorkflowReviewSpec["items"] {
  const imageSource = buildCreativeReviewImageSource({
    generatedImages: input.generatedImages,
    expansions: input.expansions,
  });
  return input.round.concepts.map((concept) => {
    const storyContent = resolveCreativeReviewStoryContent(concept, input.expansions);
    return {
      itemType: "proposal" as const,
      itemId: concept.id,
      itemLabel: concept.title,
      metadata: {
        roundNumber: input.round.roundNumber,
        directionId: concept.directionId,
        directionTitle: readStringField(concept.snapshot, "directionTitle"),
        sceneIndex: concept.sceneIndex,
        requiredImageCount: concept.requiredImageCount,
        candidateImages: buildCreativeReviewCandidateImages(getConceptReviewImages(concept, imageSource)),
        storyContent,
        previewText: summarizeText(`${concept.description}\n${storyContent}\n${concept.sourceText || ""}\n${concept.imagePrompt}`, 1200),
      },
    };
  });
}

function resolveCreativeReviewStoryContent(
  concept: { directionId: string | null; snapshot: Record<string, unknown>; sourceText?: string },
  expansions: CreativeExpansionView[],
) {
  const snapshotStory = readStringField(concept.snapshot, "storyContent");
  if (snapshotStory) return snapshotStory;
  const expansionId = readStringField(concept.snapshot, "expansionId") || "";
  const matchedExpansion =
    (expansionId ? expansions.find((expansion) => expansion.id === expansionId) : null) ??
    (concept.directionId ? expansions.filter((expansion) => expansion.directionId === concept.directionId).sort((left, right) => left.sortOrder - right.sortOrder)[0] : null);
  if (matchedExpansion) {
    return [
      matchedExpansion.title,
      matchedExpansion.oneLiner,
      ...Object.values(matchedExpansion.storyArc),
      matchedExpansion.visualHighlights.length > 0 ? `视觉重点：${matchedExpansion.visualHighlights.join("、")}` : "",
      matchedExpansion.visualStyle ? `风格：${matchedExpansion.visualStyle}` : "",
    ].filter(Boolean).join("；");
  }
  return concept.sourceText?.trim() ?? "";
}

export function sortStoryboardBatchReviewShots<
  Shot extends { sceneId: string; sortOrder: number; shotNumber: string },
  Scene extends { id: string; sceneNumber: number },
>(shots: Shot[], scenes: Scene[], sceneIds: string[]): Shot[] {
  const sceneOrderById = new Map(
    scenes.map((scene) => [
      scene.id,
      {
        sceneNumber: scene.sceneNumber,
        batchIndex: sceneIds.indexOf(scene.id),
      },
    ]),
  );
  return [...shots].sort((left, right) => {
    const leftScene = sceneOrderById.get(left.sceneId);
    const rightScene = sceneOrderById.get(right.sceneId);
    return (
      (leftScene?.sceneNumber ?? Number.MAX_SAFE_INTEGER) - (rightScene?.sceneNumber ?? Number.MAX_SAFE_INTEGER) ||
      normalizedBatchSceneIndex(leftScene?.batchIndex) - normalizedBatchSceneIndex(rightScene?.batchIndex) ||
      left.sortOrder - right.sortOrder ||
      left.shotNumber.localeCompare(right.shotNumber, "zh-Hans-CN", { numeric: true, sensitivity: "base" })
    );
  });
}

function normalizedBatchSceneIndex(index: number | undefined) {
  return typeof index === "number" && index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}

export function assertCreativeRoundApprovalHasRetainedDirections(input: {
  decision: "approved" | "rejected";
  retainedDirectionIds: string[];
}) {
  if (input.decision === "approved" && input.retainedDirectionIds.length === 0) {
    throw new AppError({
      status: 422,
      code: "creative_round_retained_direction_required",
      userMessage: "请至少保留一个创意方向后再通过本轮审核；如果没有方向可用，请选择打回并填写修改意见。",
    });
  }
}

type CreativeReviewItemForSummary = {
  itemId: string;
  itemLabel?: string | null;
  decision: Exclude<ClientReviewItemDecision, "pending">;
  score?: number | null;
  metadata?: Record<string, unknown> | null;
};

type CreativeDirectionSummary = {
  directionId: string;
  label: string;
  items: CreativeReviewItemForSummary[];
  approvedCount: number;
  scoreCount: number;
  averageScore: number | null;
  maxScore: number | null;
  sortIndex: number;
};

function buildCreativeDirectionPriority(items: CreativeReviewItemForSummary[]) {
  return summarizeCreativeDirections(items).sort(compareCreativeDirectionSummaries).map(formatCreativeDirectionSummary).join("；");
}

function buildRetainedCreativeDirectionIds(items: CreativeReviewItemForSummary[]) {
  return summarizeCreativeDirections(items)
    .filter((summary) => summary.approvedCount > 0)
    .sort(compareCreativeDirectionSummaries)
    .map((summary) => summary.directionId);
}

function buildSelectedCreativeDirectionStyles(items: CreativeReviewItemForSummary[]) {
  const selections = new Map<
    string,
    {
      directionId: string;
      directionTitle: string;
      styleVariant: string;
      styleLabel: string;
      selectedImageId: string | null;
      itemId: string;
      sortIndex: number;
    }
  >();

  items.forEach((item, index) => {
    if (item.decision !== "approved") return;
    if (readNumberMetadata(item.metadata, "roundNumber") !== 1) return;

    const styleVariant = readStringMetadata(item.metadata, "styleVariant");
    if (!styleVariant) return;

    const directionId = getCreativeDirectionId(item);
    const existing = selections.get(directionId);
    if (existing && existing.styleVariant !== styleVariant) {
      throw new AppError({
        status: 422,
        code: "creative_round_direction_style_single_choice_required",
        userMessage: `创意方向「${existing.directionTitle}」只能选择一个视觉风格。请取消多余风格后再提交。`,
      });
    }

    selections.set(directionId, {
      directionId,
      directionTitle: getCreativeDirectionLabel(item),
      styleVariant,
      styleLabel: readStringMetadata(item.metadata, "styleLabel") || styleVariant,
      selectedImageId: readFirstCandidateImageId(item.metadata),
      itemId: item.itemId,
      sortIndex: getReviewItemSortIndex(item.metadata, index),
    });
  });

  return [...selections.values()]
    .sort((left, right) => left.sortIndex - right.sortIndex)
    .map((selection) => ({
      directionId: selection.directionId,
      directionTitle: selection.directionTitle,
      styleVariant: selection.styleVariant,
      styleLabel: selection.styleLabel,
      selectedImageId: selection.selectedImageId,
      itemId: selection.itemId,
    }));
}

function summarizeCreativeDirections(items: CreativeReviewItemForSummary[]) {
  const directions = new Map<string, CreativeDirectionSummary>();

  items.forEach((item, index) => {
    const directionId = getCreativeDirectionId(item);
    const existing = directions.get(directionId);
    const summary =
      existing ??
      {
        directionId,
        label: getCreativeDirectionLabel(item),
        items: [],
        approvedCount: 0,
        scoreCount: 0,
        averageScore: null,
        maxScore: null,
        sortIndex: getReviewItemSortIndex(item.metadata, index),
      };

    summary.items.push(item);
    summary.approvedCount += item.decision === "approved" ? 1 : 0;
    summary.sortIndex = Math.min(summary.sortIndex, getReviewItemSortIndex(item.metadata, index));

    if (!existing) directions.set(directionId, summary);
  });

  for (const summary of directions.values()) {
    const scores = summary.items.map((item) => item.score).filter((score): score is number => typeof score === "number" && Number.isFinite(score));
    summary.scoreCount = scores.length;
    summary.averageScore = scores.length > 0 ? scores.reduce((total, score) => total + score, 0) / scores.length : null;
    summary.maxScore = scores.length > 0 ? Math.max(...scores) : null;
  }

  return [...directions.values()];
}

function compareCreativeDirectionSummaries(a: CreativeDirectionSummary, b: CreativeDirectionSummary) {
  const aApproved = a.approvedCount > 0;
  const bApproved = b.approvedCount > 0;
  if (aApproved !== bApproved) return aApproved ? -1 : 1;
  if (a.maxScore !== null || b.maxScore !== null) {
    const maxScoreDiff = (b.maxScore ?? -1) - (a.maxScore ?? -1);
    if (maxScoreDiff !== 0) return maxScoreDiff;
    const averageScoreDiff = (b.averageScore ?? -1) - (a.averageScore ?? -1);
    if (averageScoreDiff !== 0) return averageScoreDiff;
  }
  return a.sortIndex - b.sortIndex;
}

function formatCreativeDirectionSummary(summary: CreativeDirectionSummary) {
  const scoreLabel = summary.averageScore !== null ? `，平均评分 ${formatReviewScore(summary.averageScore)} 分` : "";
  return `${summary.label}（通过 ${summary.approvedCount}/${summary.items.length}${scoreLabel}）`;
}

function getCreativeDirectionId(item: CreativeReviewItemForSummary) {
  const directionId = item.metadata?.directionId;
  return typeof directionId === "string" && directionId.trim() ? directionId.trim() : item.itemId;
}

function getCreativeDirectionLabel(item: CreativeReviewItemForSummary) {
  const directionTitle = item.metadata?.directionTitle;
  if (typeof directionTitle === "string" && directionTitle.trim()) return directionTitle.trim();
  const itemLabel = getReviewItemLabel(item);
  return removeSceneSuffix(itemLabel) ?? itemLabel;
}

function removeSceneSuffix(label: string) {
  const trimmed = label.trim();
  const withoutSuffix = trimmed.replace(/\s*(?:[-—–｜|]\s*)?(?:视觉)?场景\s*\d+\s*$/u, "").trim();
  return withoutSuffix && withoutSuffix !== trimmed ? withoutSuffix : null;
}

function formatReviewScore(score: number) {
  return Number.isInteger(score) ? String(score) : score.toFixed(1).replace(/\.0$/, "");
}

function getReviewItemLabel(item: { itemId: string; itemLabel?: string | null; metadata?: Record<string, unknown> | null }) {
  const directionTitle = item.metadata?.directionTitle;
  if (typeof directionTitle === "string" && directionTitle.trim()) return directionTitle.trim();
  if (item.itemLabel?.trim()) return item.itemLabel.trim();
  return `方向 ${item.itemId}`;
}

function getReviewFeedbackItemLabel(item: { itemId: string; itemLabel?: string | null; metadata?: Record<string, unknown> | null }) {
  if (item.itemLabel?.trim()) return item.itemLabel.trim();
  return getReviewItemLabel(item);
}

function getReviewItemSortIndex(metadata?: Record<string, unknown> | null, fallback = Number.MAX_SAFE_INTEGER) {
  const sortOrder = metadata?.sortOrder;
  if (typeof sortOrder === "number" && Number.isFinite(sortOrder)) return sortOrder;
  const sceneIndex = metadata?.sceneIndex;
  return typeof sceneIndex === "number" && Number.isFinite(sceneIndex) ? sceneIndex : fallback;
}

function readStringMetadata(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function readNumberMetadata(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readFirstCandidateImageId(metadata: Record<string, unknown> | null | undefined) {
  const value = metadata?.candidateImages;
  if (!Array.isArray(value)) return null;
  const first = value.find((item) => item && typeof item === "object") as Record<string, unknown> | undefined;
  const id = first?.id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

async function markReviewCreatedProgress(input: {
  projectId: string;
  actorId: string;
  reviewTaskId: string;
  reviewType: ClientReviewType;
  targetScopeType: ClientReviewTargetScopeType;
  targetScopeId: string;
  reviewScene?: ClientReviewScene | null;
}) {
  if (input.reviewType === "project_proposal" && input.targetScopeType === "proposal") {
    await updateProposalStatus({
      projectId: input.projectId,
      proposalId: input.targetScopeId,
      status: "waiting_review",
      actorId: input.actorId,
    });
  }
  if (input.reviewType === "quote_confirmation" && input.targetScopeType === "quote") {
    await updateQuoteStatus({
      projectId: input.projectId,
      quoteId: input.targetScopeId,
      status: "waiting_review",
      actorId: input.actorId,
    });
  }
  if (input.reviewType === "contract_confirmation" && input.targetScopeType === "contract") {
    await updateContractStatus({
      projectId: input.projectId,
      contractId: input.targetScopeId,
      status: "waiting_review",
      actorId: input.actorId,
    });
  }
  if (input.reviewType === "script_package" && input.targetScopeType === "script_package" && input.reviewScene !== "production_setup") {
    if (input.targetScopeId) {
      await updateScriptDirectionPackageStatus({
        projectId: input.projectId,
        packageId: input.targetScopeId,
        status: "client_reviewing",
        actorId: input.actorId,
      });
    }
  }

  const stage = reviewCreatedStage(input.reviewType, input.reviewScene ?? null);
  await recordStageProgress({
    projectId: input.projectId,
    stageKey: stage.stageKey,
    status: "waiting_review",
    currentStage: stage.stageKey,
    projectStatus: "waiting_review",
    userMessage: stage.userMessage,
    inputRefs: [{ type: input.targetScopeType, id: input.targetScopeId }],
    outputRefs: [{ type: "client_review_task", id: input.reviewTaskId }],
    snapshot: {
      reviewTaskId: input.reviewTaskId,
      reviewType: input.reviewType,
      targetScopeType: input.targetScopeType,
      targetScopeId: input.targetScopeId,
    },
  });
}

async function applyWorkflowReviewDecision(input: {
  projectId: string;
  reviewTaskId: string;
  reviewType: ClientReviewType;
  targetScopeType: ClientReviewTargetScopeType;
  targetScopeId: string;
  decision: "approved" | "rejected";
  reviewScene?: ClientReviewScene | null;
  itemDecisions: Array<{
    itemId: string;
    decision: Exclude<ClientReviewItemDecision, "pending">;
    score?: number | null;
    feedback?: string | null;
  }>;
  timecodeAnnotations?: Array<{ timeSeconds: number; feedback: string }>;
  reviewerName?: string | null;
  feedback?: string | null;
  decisionPayload?: Record<string, unknown>;
  actorId: string;
}) {
  const approved = input.decision === "approved";

  if (input.reviewType === "project_proposal" && input.targetScopeType === "proposal" && (input.reviewScene === "creative_round_1" || input.reviewScene === "creative_round_2")) {
    await updateCreativeProposalRoundClientDecision({
      projectId: input.projectId,
      roundId: input.targetScopeId,
      approved,
      feedback: input.feedback ?? "",
      decisionPayload: input.decisionPayload ?? {},
      retainedDirectionIds: approved ? readRetainedDirectionIdsFromPayload(input.decisionPayload) : [],
    });
  } else if (input.reviewType === "project_proposal" && input.targetScopeType === "proposal") {
    await updateProposalStatus({
      projectId: input.projectId,
      proposalId: input.targetScopeId,
      status: approved ? "confirmed" : "needs_revision",
    });
  }
  if (input.reviewType === "quote_confirmation" && input.targetScopeType === "quote") {
    await updateQuoteStatus({
      projectId: input.projectId,
      quoteId: input.targetScopeId,
      status: workflowReviewDocumentStatus(input.reviewType, approved),
    });
  }
  if (input.reviewType === "contract_confirmation" && input.targetScopeType === "contract") {
    await updateContractStatus({
      projectId: input.projectId,
      contractId: input.targetScopeId,
      status: workflowReviewDocumentStatus(input.reviewType, approved),
    });
  }
  if (input.reviewType === "script_package" && input.targetScopeType === "script_package") {
    if (input.reviewScene === "production_setup") {
      await updateProjectProductionSetupStatus({
        projectId: input.projectId,
        status: approved ? "locked" : "client_rejected",
      });
    } else {
      await updateScriptDirectionPackageStatus({
        projectId: input.projectId,
        packageId: input.targetScopeId,
        status: approved ? "client_approved" : "client_rejected",
      });
    }
  }
  if (input.reviewType === "storyboard_image_batch" && input.targetScopeType === "storyboard_image_batch") {
    const batchApproved = input.itemDecisions.every((item) => item.decision === "approved");
    await Promise.all(
      input.itemDecisions.map((item) =>
        updateStoryboardShotClientDecision({
          projectId: input.projectId,
          shotId: item.itemId,
          approved: item.decision === "approved",
        })
      )
    );
    await updateStoryboardImageBatchItemDecisions({
      projectId: input.projectId,
      batchId: input.targetScopeId,
      decisions: input.itemDecisions.map((item) => ({
        shotId: item.itemId,
        approved: item.decision === "approved",
        feedback: item.feedback ?? "",
        feedbackPayload: {},
      })),
    });
    await updateStoryboardImageBatchStatus({
      projectId: input.projectId,
      batchId: input.targetScopeId,
      status: batchApproved ? "client_approved" : "client_rejected",
      snapshot: {
        reviewTaskId: input.reviewTaskId,
        decision: batchApproved ? "approved" : "rejected",
        itemDecisions: input.itemDecisions,
      },
    });
    if (batchApproved) {
      const shots = await listStoryboardShots(input.projectId);
      try {
        assertAllStoryboardShotsClientApproved(shots);
        await recordStageProgress({
          projectId: input.projectId,
          stageKey: "storyboard_image_canvas",
          status: "approved",
          currentStage: "ai_video_canvas",
          projectStatus: "in_progress",
          userMessage: "所有分镜图片均已获得甲方确认，项目已推进到 AI 视频自由画布。",
          inputRefs: [{ type: "client_review_task", id: input.reviewTaskId }],
          outputRefs: [{ type: "storyboard_image_batch", id: input.targetScopeId }],
          snapshot: {
            reviewTaskId: input.reviewTaskId,
            decision: input.decision,
            approvedShotCount: shots.length,
          },
        });
        return;
      } catch (error) {
        if (!(error instanceof AppError) || error.code !== "storyboard_shots_not_approved") throw error;
      }
    }
  }
  if ((input.reviewType === "a_copy_review" || input.reviewType === "b_copy_review") && input.targetScopeType === "review_cut") {
    const [scenes, shots] = await Promise.all([
      listStoryboardScenes(input.projectId),
      listStoryboardShots(input.projectId),
    ]);
    const annotations = (input.timecodeAnnotations ?? []).map((annotation) => {
      const mapped = mapTimecodeToStoryboard({
        timeSeconds: annotation.timeSeconds,
        scenes,
        shots,
      });
      return {
        timeSeconds: annotation.timeSeconds,
        feedback: annotation.feedback,
        mappedSceneId: mapped.sceneId,
        mappedShotId: mapped.shotId,
        mappingConfidence: mapped.confidence,
      };
    });
    if (annotations.length > 0) {
      await createReviewCutAnnotations({
        projectId: input.projectId,
        reviewCutId: input.targetScopeId,
        reviewTaskId: input.reviewTaskId,
        reviewerName: input.reviewerName,
        annotations,
      });
    }
    await applyReviewCutClientDecision({
      projectId: input.projectId,
      reviewCutId: input.targetScopeId,
      approved,
    });
  }

  const stage = reviewSubmittedStage(input.reviewType, input.decision, input.reviewScene ?? null);
  await recordStageProgress({
    projectId: input.projectId,
    stageKey: stage.stageKey,
    status: stage.status,
    currentStage: stage.currentStage,
    projectStatus: stage.projectStatus,
    userMessage: stage.userMessage,
    errorMessage: approved ? null : stage.userMessage,
    inputRefs: [{ type: "client_review_task", id: input.reviewTaskId }],
    outputRefs: [{ type: input.targetScopeType, id: input.targetScopeId }],
    snapshot: {
      reviewTaskId: input.reviewTaskId,
      reviewType: input.reviewType,
      reviewScene: input.reviewScene ?? null,
      decision: input.decision,
      itemDecisions: input.itemDecisions,
      timecodeAnnotationCount: input.timecodeAnnotations?.length ?? 0,
    },
  });

  if (input.reviewType === "brief_confirmation" && approved) {
    await generateRiskCheckAfterBriefApproval({
      projectId: input.projectId,
      actorId: input.actorId,
      reviewTaskId: input.reviewTaskId,
    });
  }
}

async function generateRiskCheckAfterBriefApproval(input: {
  projectId: string;
  actorId: string;
  reviewTaskId: string;
}) {
  const artifacts = await listProjectArtifacts(input.projectId);
  const latestBrief = artifacts.find((artifact) => artifact.kind === "structured_requirement") ?? null;
  const openQuestionCount = countOpenQuestions((latestBrief?.data as Partial<Record<string, unknown>> | undefined)?.openQuestions);
  const inputRefs: unknown[] = [{ type: "client_review_task", id: input.reviewTaskId }];
  if (latestBrief) {
    inputRefs.push({ type: "artifact", id: latestBrief.id, kind: latestBrief.kind });
  }

  await recordStageProgress({
    projectId: input.projectId,
    stageKey: "technical_feasibility",
    status: "in_progress",
    currentStage: "technical_feasibility",
    projectStatus: "in_progress",
    title: "接单风险评估正在生成",
    userMessage: "甲方已确认 Brief，项目已进入接单风险评估环节，系统正在根据当前 Brief 自动生成接单风险评估。",
    errorMessage: null,
    inputRefs,
    snapshot: {
      reviewTaskId: input.reviewTaskId,
      sourceStage: "brand_requirement_intake",
      sourceArtifactId: latestBrief?.id ?? null,
      sourceArtifactVersion: latestBrief?.version ?? null,
      openQuestionCount,
    },
  });

  let riskCheckResult: Awaited<ReturnType<typeof generateRiskCheckFromProject>>;
  try {
    riskCheckResult = await generateRiskCheckFromProject({
      projectId: input.projectId,
      actorId: input.actorId,
    });
  } catch (error) {
    const generationMessage =
      error instanceof AppError
        ? error.userMessage
        : "甲方已确认 Brief，项目已进入接单风险评估，但接单风险评估自动生成失败。请在接单风险评估页面点击生成。";

    await recordStageProgress({
      projectId: input.projectId,
      stageKey: "technical_feasibility",
      status: "in_progress",
      currentStage: "technical_feasibility",
      projectStatus: "in_progress",
      title: "接单风险评估自动生成失败",
      userMessage: generationMessage,
      errorMessage: generationMessage,
      inputRefs,
      snapshot: {
        reviewTaskId: input.reviewTaskId,
        sourceStage: "brand_requirement_intake",
        sourceArtifactId: latestBrief?.id ?? null,
        sourceArtifactVersion: latestBrief?.version ?? null,
        openQuestionCount,
        autoGenerateFailed: true,
      },
    });

    throw new AppError({
      status: error instanceof AppError ? error.status : 500,
      code: "risk_check_auto_generation_failed",
      userMessage: generationMessage,
    });
  }

  await recordStageProgress({
    projectId: input.projectId,
    stageKey: "technical_feasibility",
    status: "in_progress",
    currentStage: "technical_feasibility",
    projectStatus: "in_progress",
    title: "接单风险评估已自动生成",
    userMessage: riskCheckResult.message,
    errorMessage: null,
    inputRefs,
    outputRefs: [{ type: "risk_check", id: riskCheckResult.riskCheck.card.id }],
    snapshot: {
      reviewTaskId: input.reviewTaskId,
      sourceStage: "brand_requirement_intake",
      sourceArtifactId: latestBrief?.id ?? null,
      sourceArtifactVersion: latestBrief?.version ?? null,
      openQuestionCount,
      riskCheckId: riskCheckResult.riskCheck.card.id,
      overallAlert: riskCheckResult.riskCheck.card.overallAlert,
    },
  });
}

function readRetainedDirectionIdsFromPayload(payload: Record<string, unknown> | undefined) {
  const value = payload?.retainedDirectionIds;
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
}

function countOpenQuestions(value: unknown) {
  if (Array.isArray(value)) return value.filter(Boolean).length;
  if (typeof value === "string" && value.trim()) return 1;
  return 0;
}

function reviewCreatedStage(reviewType: ClientReviewType, reviewScene?: ClientReviewScene | null) {
  if (reviewType === "brief_confirmation") {
    return {
      stageKey: "brand_requirement_intake" as const,
      userMessage: "Brief 确认链接已生成，正在等待甲方通过安全链接提交确认或修改意见。",
    };
  }
  if (reviewType === "project_proposal") {
    return {
      stageKey: "creative_direction_proposal" as const,
      userMessage: "完整项目提案已提交甲方审核，等待甲方确认或打回。",
    };
  }
  if (reviewType === "script_package") {
    if (reviewScene === "production_setup") {
      return {
        stageKey: "script_storyboard_confirmation" as const,
        userMessage: "人物和场景设定已提交甲方审核，等待甲方确认后锁定生产设定。",
      };
    }
    return {
      stageKey: "script_storyboard_confirmation" as const,
      userMessage: "完整剧本已提交甲方审核，等待甲方确认后再拆解详细文字分镜。",
    };
  }
  if (reviewType === "storyboard_image_batch") {
    return {
      stageKey: "storyboard_image_canvas" as const,
      userMessage: "分镜图片全量批次已提交甲方审核，等待甲方整体确认并逐镜批注。",
    };
  }
  if (reviewType === "a_copy_review") {
    return {
      stageKey: "a_copy_revision" as const,
      userMessage: "A copy 完整初版已生成本地甲方审核链接，等待甲方观看整片并提交时间戳意见。",
    };
  }
  if (reviewType === "b_copy_review") {
    return {
      stageKey: "b_copy_final_confirmation" as const,
      userMessage: "B copy 近最终版已生成本地甲方审核链接，等待甲方最终确认或提交时间戳意见。",
    };
  }
  return {
    stageKey: "selection_quote_contract" as const,
    userMessage: reviewType === "quote_confirmation" ? "报价已提交甲方审核，等待甲方确认或打回。" : "合同已提交甲方审核，等待甲方确认或打回。",
  };
}

export function reviewSubmittedStage(reviewType: ClientReviewType, decision: "approved" | "rejected", reviewScene?: ClientReviewScene | null) {
  const approved = decision === "approved";
  if (reviewType === "brief_confirmation") {
    return {
      stageKey: "brand_requirement_intake" as const,
      status: approved ? ("approved" as const) : ("needs_revision" as const),
      currentStage: approved ? ("technical_feasibility" as const) : ("brand_requirement_intake" as const),
      projectStatus: approved ? ("in_progress" as const) : ("needs_revision" as const),
      userMessage: approved ? "甲方已确认 Brief，项目可以进入技术可行性与素材标签评估。" : "甲方已打回 Brief，修改意见已回写内部端。",
    };
  }
  if (reviewType === "project_proposal") {
    if (reviewScene === "creative_round_1") {
      return {
        stageKey: "creative_direction_proposal" as const,
        status: approved ? ("waiting_review" as const) : ("needs_revision" as const),
        currentStage: "creative_direction_proposal" as const,
        projectStatus: approved ? ("in_progress" as const) : ("needs_revision" as const),
        userMessage: approved ? "甲方已确认第一轮创意视觉提案，请根据方向优先级和视觉偏好进入第二轮深化。" : "甲方已打回第一轮创意视觉提案，方向排序和视觉偏好意见已回写内部端。",
      };
    }
    return {
      stageKey: "creative_direction_proposal" as const,
      status: approved ? ("approved" as const) : ("needs_revision" as const),
      currentStage: approved ? ("selection_quote_contract" as const) : ("creative_direction_proposal" as const),
      projectStatus: approved ? ("in_progress" as const) : ("needs_revision" as const),
      userMessage: approved ? "甲方已确认完整项目提案，项目可以进入报价合同模块。" : "甲方已打回完整项目提案，修改意见已回写内部端。",
    };
  }
  if (reviewType === "script_package") {
    if (reviewScene === "production_setup") {
      return {
        stageKey: "script_storyboard_confirmation" as const,
        status: approved ? ("approved" as const) : ("needs_revision" as const),
        // On approval the setting images are locked and the project moves into storyboard image
        // production; otherwise it stays in SOP5 for revision.
        currentStage: approved ? ("storyboard_image_canvas" as const) : ("script_storyboard_confirmation" as const),
        projectStatus: approved ? ("in_progress" as const) : ("needs_revision" as const),
        userMessage: approved
          ? "甲方已确认人物和场景设定，生产设定已锁定，项目进入分镜图片生产阶段。"
          : "甲方已打回人物和场景设定，修改意见已回写内部端。",
      };
    }
    return {
      stageKey: "script_storyboard_confirmation" as const,
      status: approved ? ("approved" as const) : ("needs_revision" as const),
      currentStage: "script_storyboard_confirmation" as const,
      projectStatus: approved ? ("in_progress" as const) : ("needs_revision" as const),
      userMessage: approved ? "甲方已确认脚本创意方向和人物场景设定，可以拆分文字分镜。" : "甲方已打回脚本创意方向，修改意见已回写内部端。",
    };
  }
  if (reviewType === "storyboard_image_batch") {
    return {
      stageKey: "storyboard_image_canvas" as const,
      status: approved ? ("waiting_review" as const) : ("needs_revision" as const),
      currentStage: "storyboard_image_canvas" as const,
      projectStatus: approved ? ("waiting_review" as const) : ("needs_revision" as const),
      userMessage: approved
        ? "本次全量分镜图片已获得甲方确认，系统会检查是否所有分镜均已通过。"
        : "本次全量分镜图片存在不 OK 的分镜，逐镜原因和修改意见已保存。",
    };
  }
  if (reviewType === "a_copy_review") {
    return {
      stageKey: "a_copy_revision" as const,
      status: approved ? ("approved" as const) : ("needs_revision" as const),
      currentStage: approved ? ("b_copy_final_confirmation" as const) : ("a_copy_revision" as const),
      projectStatus: approved ? ("in_progress" as const) : ("needs_revision" as const),
      userMessage: approved ? "甲方已确认 A copy 完整初版，项目可以进入 B copy 精装阶段。" : "甲方已打回 A copy，时间戳批注已回写并定位到对应场次/分镜。",
    };
  }
  if (reviewType === "b_copy_review") {
    return {
      stageKey: "b_copy_final_confirmation" as const,
      status: approved ? ("approved" as const) : ("needs_revision" as const),
      currentStage: approved ? ("settlement_delivery_archive" as const) : ("b_copy_final_confirmation" as const),
      projectStatus: approved ? ("in_progress" as const) : ("needs_revision" as const),
      userMessage: approved ? "甲方已最终确认 B-copy，可以进入结算交付与完整归档。" : "甲方已打回 B-copy，时间戳批注已回写并定位到对应场次/分镜。",
    };
  }
  if (reviewType === "contract_confirmation") {
    return {
      stageKey: "selection_quote_contract" as const,
      status: approved ? ("in_progress" as const) : ("needs_revision" as const),
      currentStage: "selection_quote_contract" as const,
      projectStatus: approved ? ("in_progress" as const) : ("needs_revision" as const),
      userMessage: approved
        ? "甲方已确认项目合同，项目可以进入交付清单核对。"
        : "甲方已打回项目合同，修改意见已回写内部端。",
    };
  }
  return {
    stageKey: "selection_quote_contract" as const,
    status: approved ? ("approved" as const) : ("needs_revision" as const),
    currentStage: "selection_quote_contract" as const,
    projectStatus: approved ? ("in_progress" as const) : ("needs_revision" as const),
    userMessage:
      reviewType === "quote_confirmation"
        ? approved
          ? "甲方已确认项目报价，可以继续推进合同确认。"
          : "甲方已打回项目报价，修改意见已回写内部端。"
        : approved
          ? "甲方已确认项目合同，可以继续推进签署与交付。"
          : "甲方已打回项目合同，修改意见已回写内部端。",
  };
}

export function workflowReviewDocumentStatus(reviewType: ClientReviewType, approved: boolean) {
  if (!approved) return "needs_revision";
  if (reviewType === "contract_confirmation") return "signed";
  return "confirmed";
}

function summarizeUnknown(value: unknown) {
  try {
    return summarizeText(JSON.stringify(value, null, 2), 1200);
  } catch {
    return "";
  }
}

function formatQuoteReviewSummary(quote: QuoteView) {
  const items = quote.items.map((item) => {
    const subtotal = item.quantity * item.unitPrice;
    const description = item.description ? `：${item.description}` : "";
    return `${item.name}${description}，${item.quantity} 项，${formatCommercialMoney(subtotal, quote.currency)}`;
  });
  return [
    `报价总额：${formatCommercialMoney(quote.totalAmount, quote.currency)}`,
    items.length > 0 ? `报价明细：${items.join("；")}` : "",
    quote.notes ? `备注：${quote.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatCommercialMoney(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

function summarizeText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function createReviewCredentials() {
  const token = randomBytes(24).toString("base64url");
  const code = randomBytes(4).toString("hex").toUpperCase();
  return {
    token,
    code,
    tokenHash: hashSecret(token),
    codeHash: hashSecretWithSalt(code),
  };
}

function hashSecret(value: string) {
  return createHash("sha256").update(value.trim()).digest("hex");
}

function hashSecretWithSalt(value: string) {
  const salt = randomBytes(16).toString("base64url");
  return `v2:${salt}:${hashSecret(`${salt}:${value.trim()}`)}`;
}

function verifySecret(value: string, storedHash: string) {
  const normalized = value.trim();
  const parts = storedHash.split(":");
  const candidateHash =
    parts.length === 3 && parts[0] === "v2"
      ? `v2:${parts[1]}:${hashSecret(`${parts[1]}:${normalized}`)}`
      : hashSecret(normalized);
  const candidate = Buffer.from(candidateHash);
  const expected = Buffer.from(storedHash);
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function getLocalReviewOrigin(origin: string) {
  const normalized = origin.replace(/\/$/, "");
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized)) return normalized;
  return "http://localhost:3000";
}

export function buildReviewUrlWithVerificationCode(origin: string, token: string, code: string) {
  const reviewUrl = new URL(`/client-review/${token}`, getLocalReviewOrigin(origin));
  reviewUrl.hash = `key=${encodeURIComponent(code)}`;
  return reviewUrl.toString();
}
