import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import {
  createClientReviewTask,
  getNextClientReviewVersion,
  getClientReviewSecretByTaskId,
  getClientReviewTaskByTokenHash,
  listClientReviewItems,
  submitClientReviewTaskRecord,
  type ClientReviewItemDecision,
  type ClientReviewItemType,
  type ClientReviewTargetScopeType,
  type ClientReviewType,
} from "@/server/repositories/client-reviews";
import { listProjectArtifacts } from "@/server/repositories/artifacts";
import { getProjectById } from "@/server/repositories/projects";
import { getCreativeProposalRound, updateCreativeProposalRoundClientDecision } from "@/server/repositories/creative-proposals";
import { getProjectProposal, updateProposalStatus } from "@/server/repositories/proposals";
import { getProjectQuote, updateQuoteStatus } from "@/server/repositories/quotes";
import { getProjectContract, updateContractStatus } from "@/server/repositories/contracts";
import {
  applyReviewCutClientDecision,
  createReviewCutAnnotations,
  getReviewCut,
  mapTimecodeToStoryboard,
  markReviewCutClientReviewing,
} from "@/server/repositories/review-cuts";
import {
  getScriptDirectionPackage,
  listScriptReferenceAssets,
  listStoryboardImages,
  listStoryboardScenes,
  listStoryboardShots,
  updateScriptDirectionPackageStatus,
  updateStoryboardSceneStatus,
  updateStoryboardShotClientDecision,
} from "@/server/repositories/story-production";
import {
  listProductionEntities,
  listProductionReferenceSets,
  updateProjectProductionSetupStatus,
} from "@/server/repositories/production-entities";
import { recordStageProgress } from "@/server/use-cases/stage-progress";

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
  const metadata = buildClientReviewTaskMetadataInput({
    reviewType: parsed.reviewType,
    sopKey: parsed.sopKey,
    reviewScene: parsed.reviewScene,
    roundNumber: parsed.roundNumber,
    batchNumber: parsed.batchNumber,
    payloadVersion: parsed.payloadVersion,
  });
  const spec = await buildWorkflowReviewSpec({
    projectId: input.projectId,
    reviewType: parsed.reviewType,
    targetScopeId: parsed.targetScopeId ?? null,
    reviewScene: parsed.reviewScene ?? null,
  });
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

  return {
    ...review,
    reviewUrl: `${getLocalReviewOrigin(input.origin)}/client-review/${credentials.token}`,
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
    summary: "请按场次整体确认分镜图片；如需打回，请逐条分镜评分并填写修改意见。",
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
    userMessage: "本场分镜图片已提交甲方审核，等待甲方按场次整体确认。",
    inputRefs: [{ type: "storyboard_scene", id: input.sceneId }],
    outputRefs: [{ type: "client_review_task", id: review.task.id }],
    snapshot: { reviewTaskId: review.task.id, reviewType: "storyboard_scene_images" },
  });

  return {
    ...review,
    reviewUrl: `${getLocalReviewOrigin(input.origin)}/client-review/${credentials.token}`,
    verificationCode: credentials.code,
  };
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

async function buildWorkflowReviewSpec(input: {
  projectId: string;
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
          },
        },
      ],
    };
  }

  if (input.reviewType === "project_proposal" && input.targetScopeId) {
    const creativeRound = await getCreativeProposalRound({ projectId: input.projectId, roundId: input.targetScopeId });
    if (creativeRound) {
      const sceneLabel = creativeRound.roundNumber === 1 ? "第一轮" : "第二轮";
      return {
        moduleKey: "creative_visual_proposal",
        reviewType: "project_proposal",
        targetScopeType: "proposal",
        targetScopeId: creativeRound.id,
        title: `${sceneLabel}创意视觉提案确认`,
        summary:
          creativeRound.roundNumber === 1
            ? "请确认 4 个创意方向的优先级、保留方向和视觉偏好；如需调整，请打回并填写方向排序与偏好说明。"
            : "请确认第二轮深化后的脚本/视觉方向是否可进入报价合同模块；如需调整，请填写具体视觉偏好和修改意见。",
        payload: {
          project,
          creativeProposalRound: creativeRound,
        },
        items: creativeRound.concepts.map((concept) => ({
          itemType: "proposal" as const,
          itemId: concept.id,
          itemLabel: concept.title,
          metadata: {
            roundNumber: creativeRound.roundNumber,
            directionId: concept.directionId,
            sceneIndex: concept.sceneIndex,
            requiredImageCount: concept.requiredImageCount,
            candidateImageCount: concept.images.filter((image) => image.status === "generated" || image.status === "selected").length,
            previewText: summarizeText(`${concept.description}\n${concept.imagePrompt}`, 800),
          },
        })),
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
            previewText: summarizeUnknown(quote),
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
      payload: { project, reviewCut },
      items: [
        {
          itemType: "review_cut_video",
          itemId: reviewCut.id,
          itemLabel: reviewCut.title,
          metadata: {
            cutType: reviewCut.cutType,
            version: reviewCut.version,
            status: reviewCut.status,
            videoUrl: reviewCut.videoUrl,
            durationSeconds: reviewCut.durationSeconds,
            previewText: reviewCut.description,
          },
        },
      ],
    };
  }

  if (input.reviewType === "script_package" && input.reviewScene === "production_setup") {
    const [entities, referenceSets] = await Promise.all([
      listProductionEntities(input.projectId),
      listProductionReferenceSets(input.projectId),
    ]);
    if (entities.length === 0) {
      throw new AppError({
        status: 422,
        code: "production_entities_empty",
        userMessage: "人物和场景设定还没有生成。请先拆分文字分镜，再提交人物场景设定审核。",
      });
    }
    return {
      moduleKey: "script_storyboard_confirmation",
      reviewType: "script_package",
      targetScopeType: "script_package",
      targetScopeId: input.targetScopeId ?? entities[0].id,
      title: "人物场景设定确认",
      summary: "请确认完整脚本拆分后抽取的人物、场景和参考设定深度；如需修改，请打回并说明调整意见。",
      payload: { project, productionEntities: entities, productionReferenceSets: referenceSets },
      items: entities.map((entity) => ({
        itemType: "reference_asset" as ClientReviewItemType,
        itemId: entity.id,
        itemLabel: `${entity.entityType === "character" ? "人物设定" : entity.entityType === "scene" ? "场景设定" : "道具设定"}｜${entity.name}`,
        metadata: {
          entityType: entity.entityType,
          referenceDepth: entity.referenceDepth,
          status: entity.status,
          sourceShotIds: entity.sourceShotIds,
          referenceSetCount: referenceSets.filter((set) => set.entityId === entity.id).length,
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
      userMessage: "请先选择一个脚本方向包，再生成甲方审核链接。",
    });
  }
  const [pkg, references] = await Promise.all([
    getScriptDirectionPackage({ projectId: input.projectId, packageId }),
    listScriptReferenceAssets(input.projectId),
  ]);
  if (!pkg) {
    throw new AppError({
      status: 404,
      code: "script_package_not_found",
      userMessage: "没有找到脚本方向包。请先保存脚本创意方向、人物参考和场景参考后再提交甲方审核。",
    });
  }
  const packageReferences = references.filter((item) => item.packageId === pkg.id);
  return {
    moduleKey: "script_storyboard_confirmation",
    reviewType: "script_package",
    targetScopeType: "script_package",
    targetScopeId: pkg.id,
    title: "脚本创意方向与人物场景设定确认",
    summary: "请确认脚本方向、人物参考、场景参考和完整剧本；如需修改，请打回并说明调整意见。",
    payload: { project, package: pkg, references: packageReferences },
    items: [
      {
        itemType: "script_direction",
        itemId: pkg.id,
        itemLabel: pkg.title,
        metadata: {
          version: pkg.version,
          concept: pkg.concept,
          previewText: summarizeText(pkg.fullScript, 1200),
        },
      },
      ...packageReferences.map((reference) => ({
        itemType: "reference_asset" as ClientReviewItemType,
        itemId: reference.id,
        itemLabel: `${reference.referenceType === "character" ? "人物参考" : "场景参考"}｜${reference.title}`,
        metadata: {
          referenceType: reference.referenceType,
          styleLabel: reference.styleLabel,
          prompt: reference.prompt,
          imageUrl: reference.ossUrl,
          previewText: reference.prompt,
        },
      })),
    ],
  };
}

export async function loadClientReviewByToken(token: string) {
  const task = await getClientReviewTaskByTokenHash(hashSecret(token));
  if (!task) {
    throw new AppError({
      status: 404,
      code: "client_review_not_found",
      userMessage: "没有找到这个审核链接。请检查链接是否完整，或联系项目团队重新发送。",
    });
  }
  const items = await listClientReviewItems(task.id);
  return { task, items };
}

export async function submitClientReviewByToken(token: string, rawInput: unknown) {
  const input = submitClientReviewSchema.parse(rawInput);
  const { task, items: existingItems } = await loadClientReviewByToken(token);
  const expectedCodeHash = await getClientReviewSecretByTaskId(task.id);
  if (!expectedCodeHash || expectedCodeHash !== hashSecret(input.verificationCode)) {
    throw new AppError({
      status: 401,
      code: "client_review_code_invalid",
      userMessage: "验证码或密钥不正确。请核对项目团队发送给你的审核密钥后再提交。",
    });
  }

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
          ? "甲方已按场次整体确认分镜图片，本场可以进入后续视频生成准备。"
          : "甲方已按场次整体打回分镜图片，场内逐分镜评分和修改意见已保存。",
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
    });
  }

  return {
    task: result.task,
    items: result.items,
    message:
      input.decision === "approved"
        ? "审核已提交：本轮内容已确认。项目团队会在内部端看到你的确认结果。"
        : "审核已提交：本轮内容已打回。项目团队会看到整体意见和逐条分镜评分。",
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
    const defaultScore = input.reviewType === "storyboard_scene_images" ? (input.decision === "approved" ? 5 : 2) : null;
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
    visualPreferenceNotes: visualNotes.join("；"),
  };
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
}) {
  const approved = input.decision === "approved";

  if (input.reviewType === "project_proposal" && input.targetScopeType === "proposal" && (input.reviewScene === "creative_round_1" || input.reviewScene === "creative_round_2")) {
    await updateCreativeProposalRoundClientDecision({
      projectId: input.projectId,
      roundId: input.targetScopeId,
      approved,
      feedback: input.feedback ?? "",
      decisionPayload: input.decisionPayload ?? {},
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
      status: approved ? "confirmed" : "needs_revision",
    });
  }
  if (input.reviewType === "contract_confirmation" && input.targetScopeType === "contract") {
    await updateContractStatus({
      projectId: input.projectId,
      contractId: input.targetScopeId,
      status: approved ? "confirmed" : "needs_revision",
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
      userMessage: "脚本方向、人物参考、场景参考和完整剧本已提交甲方审核。",
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
        currentStage: "script_storyboard_confirmation" as const,
        projectStatus: approved ? ("in_progress" as const) : ("needs_revision" as const),
        userMessage: approved
          ? "甲方已确认人物和场景设定，生产设定已锁定。后续图片阶段可以使用这些设定作为门禁依据。"
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

function summarizeUnknown(value: unknown) {
  try {
    return summarizeText(JSON.stringify(value, null, 2), 1200);
  } catch {
    return "";
  }
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
    codeHash: hashSecret(code),
  };
}

function hashSecret(value: string) {
  return createHash("sha256").update(value.trim()).digest("hex");
}

function getLocalReviewOrigin(origin: string) {
  const normalized = origin.replace(/\/$/, "");
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized)) return normalized;
  return "http://localhost:3000";
}
