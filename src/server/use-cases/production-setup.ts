import { z } from "zod";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { callArkResponseJson } from "@/server/providers/ark";
import { listGeneratedImagesByIds, reviewGeneratedImageRecord, type GeneratedImageView } from "@/server/repositories/generated-images";
import {
  confirmProductionEntities,
  listProductionEntities,
  listProductionReferenceSets,
  saveProductionReferencePrompt,
  selectProductionReferenceImage,
  setProductionEntityInclusion,
  updateProjectProductionSetupStatus,
  updateProductionEntityDetails,
  updateProductionEntityStatus,
  upsertProductionEntity,
  upsertReferenceSet,
  type ProductionEntityType,
  type ProductionEntityView,
  type ProductionReferenceSetView,
  type ReferenceSetDepth,
} from "@/server/repositories/production-entities";
import { listProjectCreativeDirections } from "@/server/repositories/creative-directions";
import { listScriptDirectionPackages, listStoryboardShots, type StoryboardShotView } from "@/server/repositories/story-production";
import { createWorkflowClientReview } from "@/server/use-cases/client-review";

export type ProductionEntityDraft = {
  entityType: ProductionEntityType;
  name: string;
  description: string;
  sourceShotIds: string[];
};

const genericCharacterNames = new Set(["路人", "路人甲", "路人乙", "群众", "人群", "背景人群", "观众", "行人", "路人群众"]);
const productionImageRatioSchema = z.enum(["1:1", "3:4", "4:3", "16:9", "9:16"]);
const productionReferencePromptItemSchema = z.object({
  entityId: z.string().trim().min(1),
  entityType: z.enum(["character", "scene", "prop"]),
  name: z.string().trim().min(1),
  basicPrompt: z.string().trim().min(1),
  fullPrompt: z.string().trim().min(1),
  defaultRatio: productionImageRatioSchema.optional(),
  reasoningSummary: z.string().trim().default(""),
});
const productionReferencePromptResponseSchema = z.object({
  items: z.array(productionReferencePromptItemSchema).default([]),
});

export type ProductionSetupBundle = {
  entities: ProductionEntityView[];
  referenceSets: ProductionReferenceSetView[];
};

export function extractProductionEntitiesFromStoryboard(input: { storyboardShots: StoryboardShotView[] }): ProductionEntityDraft[] {
  const drafts = new Map<string, ProductionEntityDraft>();
  for (const shot of input.storyboardShots) {
    collectRefs({
      refs: shot.characterRefs,
      entityType: "character",
      shotId: shot.id,
      drafts,
    });
    collectRefs({
      refs: shot.sceneRefs,
      entityType: "scene",
      shotId: shot.id,
      drafts,
    });
  }
  return [...drafts.values()].sort((a, b) => a.entityType.localeCompare(b.entityType) || a.name.localeCompare(b.name, "zh-Hans-CN"));
}

export async function createProductionSetupFromStoryboard(input: {
  projectId: string;
  storyboardShots: StoryboardShotView[];
  actorId: string;
}) {
  const drafts = extractProductionEntitiesFromStoryboard({ storyboardShots: input.storyboardShots });
  const creativeDirections = await listProjectCreativeDirections(input.projectId);
  const selectedStyleContext = creativeDirections
    .filter((direction) => direction.isSelected)
    .map((direction) => `${direction.title}：${direction.coreIdea}；已确认视觉风格：${direction.atmospherePrompt || direction.referenceTags.join("、")}`)
    .join("\n");
  const shotContextById = new Map(input.storyboardShots.map((shot) => [shot.id, `${shot.shotNumber}：${shot.visualDescription}`]));
  const entities: ProductionEntityView[] = [];
  const referenceSets: ProductionReferenceSetView[] = [];

  for (const draft of drafts) {
    const entity = await upsertProductionEntity({
      projectId: input.projectId,
      entityType: draft.entityType,
      name: draft.name,
      description: draft.description,
      sourceShotIds: draft.sourceShotIds,
      actorId: input.actorId,
    });
    entities.push(entity);
    referenceSets.push(
      await upsertReferenceSet({
        projectId: input.projectId,
        entityId: entity.id,
        depth: entity.referenceDepth,
        status: entity.status,
        prompt: buildReferencePrompt(entity, {
          styleContext: selectedStyleContext,
          shotContext: entity.sourceShotIds.map((shotId) => shotContextById.get(shotId)).filter(Boolean).join("\n"),
        }),
        defaultRatio: defaultRatioForEntity(entity.entityType),
        snapshot: {
          entityType: entity.entityType,
          name: entity.name,
          sourceShotIds: entity.sourceShotIds,
          styleContext: selectedStyleContext,
        },
        actorId: input.actorId,
      })
    );
  }

  return { entities, referenceSets };
}

export async function getProductionSetup(projectId: string): Promise<ProductionSetupBundle> {
  const [entities, referenceSets] = await Promise.all([
    listProductionEntities(projectId),
    listProductionReferenceSets(projectId),
  ]);
  return { entities, referenceSets };
}

export async function updateProductionEntityDepth(input: {
  projectId: string;
  entityId: string;
  depth: ReferenceSetDepth;
  actorId: string;
}) {
  const entity = await updateProductionEntityStatus({
    projectId: input.projectId,
    entityId: input.entityId,
    status: "internal_confirmed",
    actorId: input.actorId,
  });
  if (!entity) {
    throw new AppError({
      status: 404,
      code: "production_entity_not_found",
      userMessage: "没有找到这个人物或场景设定。请刷新工作台后再试。",
    });
  }
  const updatedEntity = await upsertProductionEntity({
    projectId: input.projectId,
    entityType: entity.entityType,
    name: entity.name,
    description: entity.description,
    importance: entity.importance,
    referenceDepth: input.depth,
    sourceShotIds: entity.sourceShotIds,
    status: "internal_confirmed",
    actorId: input.actorId,
  });
  const referenceSet = await upsertReferenceSet({
    projectId: input.projectId,
    entityId: updatedEntity.id,
    depth: input.depth,
    status: "internal_confirmed",
    prompt: buildReferencePrompt(updatedEntity),
    defaultRatio: defaultRatioForEntity(updatedEntity.entityType),
    snapshot: {
      entityType: updatedEntity.entityType,
      name: updatedEntity.name,
      sourceShotIds: updatedEntity.sourceShotIds,
      depth: input.depth,
    },
    actorId: input.actorId,
  });
  return {
    entity: updatedEntity,
    referenceSet,
    message: "人物场景设定深度已保存，参考集状态已更新。",
  };
}

export async function createProductionEntityManual(input: {
  projectId: string;
  entityType: Extract<ProductionEntityType, "character" | "scene">;
  name: string;
  description: string;
  actorId: string;
}) {
  const name = input.name.trim();
  if (!name) {
    throw new AppError({
      status: 422,
      code: "production_entity_name_required",
      userMessage: "请先填写人物或场景名称。",
    });
  }
  const entity = await upsertProductionEntity({
    projectId: input.projectId,
    entityType: input.entityType,
    name,
    description: input.description.trim(),
    sourceShotIds: [],
    status: "draft",
    actorId: input.actorId,
  });
  const referenceSet = await upsertReferenceSet({
    projectId: input.projectId,
    entityId: entity.id,
    depth: entity.referenceDepth,
    status: entity.status,
    prompt: buildReferencePrompt(entity),
    defaultRatio: defaultRatioForEntity(entity.entityType),
    snapshot: { entityType: entity.entityType, name: entity.name, sourceShotIds: entity.sourceShotIds },
    actorId: input.actorId,
  });
  return { entity, referenceSet, message: "已新增到设定清单。请确认提示词后再生成设定图。" };
}

export async function editProductionEntity(input: {
  projectId: string;
  entityId: string;
  name: string;
  description: string;
  actorId: string;
}) {
  const entity = await updateProductionEntityDetails(input);
  if (!entity) {
    throw new AppError({
      status: 404,
      code: "production_entity_not_found",
      userMessage: "没有找到这个人物或场景。请刷新工作台后再试。",
    });
  }
  return { entity, message: "设定清单已更新。" };
}

export async function ignoreProductionEntity(input: {
  projectId: string;
  entityId: string;
  reason: string;
  actorId: string;
}) {
  const entity = await setProductionEntityInclusion({
    projectId: input.projectId,
    entityId: input.entityId,
    inclusionStatus: "ignored",
    ignoreReason: input.reason || "用户手动移除到忽略列表",
    actorId: input.actorId,
  });
  if (!entity) {
    throw new AppError({ status: 404, code: "production_entity_not_found", userMessage: "没有找到这个人物或场景。请刷新后再试。" });
  }
  return { entity, message: "已移入忽略列表，不会参与设定图生成，也不会阻塞提交审核。" };
}

export async function restoreProductionEntity(input: {
  projectId: string;
  entityId: string;
  actorId: string;
}) {
  const entity = await setProductionEntityInclusion({
    projectId: input.projectId,
    entityId: input.entityId,
    inclusionStatus: "active",
    actorId: input.actorId,
  });
  if (!entity) {
    throw new AppError({ status: 404, code: "production_entity_not_found", userMessage: "没有找到这个人物或场景。请刷新后再试。" });
  }
  return { entity, message: "已恢复到设定清单。" };
}

export function assertStoryboardSequenceConfirmed(storyboardShots: Array<Pick<StoryboardShotView, "id" | "status">>) {
  if (storyboardShots.length === 0 || storyboardShots.some((shot) => shot.status === "draft")) {
    throw new AppError({
      status: 422,
      code: "storyboard_sequence_not_confirmed",
      userMessage: "请先确认文字分镜，再确认人物和场景设定。",
    });
  }
}

export async function confirmProductionEntityList(input: { projectId: string; actorId: string }) {
  const [setup, storyboardShots] = await Promise.all([
    getProductionSetup(input.projectId),
    listStoryboardShots(input.projectId),
  ]);
  assertStoryboardSequenceConfirmed(storyboardShots);
  const activeEntities = setup.entities.filter((entity) => entity.inclusionStatus !== "ignored");
  if (activeEntities.length === 0) {
    throw new AppError({
      status: 422,
      code: "production_entity_list_empty",
      userMessage: "人物和场景清单为空。请先新增需要生成设定图的人物或场景。",
    });
  }
  const confirmed = await confirmProductionEntities({ projectId: input.projectId, actorId: input.actorId });
  const promptResult = await generateProductionReferencePrompts({ projectId: input.projectId, actorId: input.actorId });
  return { entities: confirmed, referenceSets: promptResult.referenceSets, message: promptResult.message };
}

export async function generateProductionReferencePrompts(input: { projectId: string; actorId: string; force?: boolean }) {
  const [setup, scriptPackages, storyboardShots, creativeDirections] = await Promise.all([
    getProductionSetup(input.projectId),
    listScriptDirectionPackages(input.projectId),
    listStoryboardShots(input.projectId),
    listProjectCreativeDirections(input.projectId),
  ]);
  const activeEntities = setup.entities.filter((entity) => entity.inclusionStatus !== "ignored");
  if (activeEntities.length === 0) {
    throw new AppError({
      status: 422,
      code: "production_entity_list_empty",
      userMessage: "人物和场景清单为空。请先新增需要生成设定图的人物或场景。",
    });
  }
  const sourcePackage = scriptPackages[0] ?? null;
  const selectedDirections = creativeDirections.filter((direction) => direction.isSelected);
  const promptableItems = activeEntities
    .map((entity) => {
      const referenceSet = setup.referenceSets.find((set) => set.entityId === entity.id && set.depth === entity.referenceDepth);
      return referenceSet ? { entity, referenceSet } : null;
    })
    .filter((item): item is { entity: ProductionEntityView; referenceSet: ProductionReferenceSetView } => Boolean(item))
    .filter(({ entity, referenceSet }) => shouldRegenerateReferencePrompt(entity, referenceSet));

  if (promptableItems.length === 0) {
    return {
      referenceSets: setup.referenceSets,
      message: "人物和场景清单已确认。已锁定或甲方通过的设定不会重新生成提示词。",
    };
  }

  const shotContextById = new Map(storyboardShots.map((shot) => [shot.id, formatShotContext(shot)]));
  const selectedStyleContext = buildSelectedStyleContext(selectedDirections);
  const response = await callArkResponseJson<z.infer<typeof productionReferencePromptResponseSchema>>({
    model: env.ARK_TEXT_STRUCTURING_MODEL,
    timeoutMs: 120_000,
    maxOutputTokens: 5000,
    temperature: 0.1,
    thinking: "disabled",
    telemetry: {
      projectId: input.projectId,
      callId: "ark_production_reference_prompt_generation",
      provider: env.TEXT_STRUCTURING_PROVIDER,
      operation: "production_reference_prompt_generation",
      metadata: {
        entityCount: promptableItems.length,
        sourcePackageId: sourcePackage?.id ?? null,
        sourceCreativeDirectionIds: selectedDirections.map((direction) => direction.id),
      },
    },
    messages: [
      {
        role: "system",
        content:
          "你是 AIGC 视频美术设定提示词导演。请根据标准剧本、详细文字分镜、已确认创意视觉风格，为每个人物和场景生成可编辑的设定图 Prompt。只输出严格 JSON。顶层必须是 {\"items\":[{\"entityId\":\"\",\"entityType\":\"character|scene|prop\",\"name\":\"\",\"basicPrompt\":\"\",\"fullPrompt\":\"\",\"defaultRatio\":\"3:4|16:9|1:1|4:3|9:16\",\"reasoningSummary\":\"\"}]}。人物默认 3:4，场景默认 16:9。Prompt 必须包含外观/空间、情绪气质、材质光线、镜头参考和稳定性要求；不要写水印、文字、UI、拼贴。",
      },
      {
        role: "user",
        content: buildReferencePromptGenerationUserMessage({
          sourcePackage,
          selectedStyleContext,
          storyboardShots,
          promptableItems,
          shotContextById,
        }),
      },
    ],
  });
  const parsed = productionReferencePromptResponseSchema.parse(response);
  const aiItemByEntityId = new Map(parsed.items.map((item) => [item.entityId, item]));
  const savedReferenceSets: ProductionReferenceSetView[] = [];

  for (const { entity, referenceSet } of promptableItems) {
    const aiItem = aiItemByEntityId.get(entity.id);
    const shotContext = entity.sourceShotIds.map((shotId) => shotContextById.get(shotId)).filter(Boolean).join("\n");
    const fallbackPrompt = buildReferencePrompt(entity, { styleContext: selectedStyleContext, shotContext });
    const nextPrompt = aiItem ? (entity.referenceDepth === "full" ? aiItem.fullPrompt : aiItem.basicPrompt) : fallbackPrompt;
    const nextRatio = normalizeReferenceRatio(aiItem?.defaultRatio, entity.entityType);
    const promptSnapshot = aiItem
      ? {
          promptSource: "ai_script_context",
          reasoningSummary: aiItem.reasoningSummary,
        }
      : {
          promptSource: "template_fallback",
          reasoningSummary: "模型未返回该项，系统用剧本、分镜和风格上下文生成兜底提示词。",
        };
    const updated = await saveProductionReferencePrompt({
      projectId: input.projectId,
      referenceSetId: referenceSet.id,
      prompt: nextPrompt,
      ratio: nextRatio,
      generationCount: referenceSet.lastGenerationCount || 1,
      status: "internal_confirmed",
      actorId: input.actorId,
      snapshot: {
        ...promptSnapshot,
        sourcePackageId: sourcePackage?.id ?? null,
        sourceCreativeDirectionIds: selectedDirections.map((direction) => direction.id),
        sourceShotIds: entity.sourceShotIds,
        styleSummary: selectedStyleContext,
        generatedAt: new Date().toISOString(),
      },
    });
    if (updated) savedReferenceSets.push(updated);
  }

  const refreshedReferenceSets = await listProductionReferenceSets(input.projectId);
  const generatedCount = savedReferenceSets.length;
  return {
    referenceSets: refreshedReferenceSets,
    message: generatedCount > 0
      ? `人物和场景清单已确认，并已根据剧本、分镜和已确认风格生成 ${generatedCount} 条设定图提示词。`
      : "人物和场景清单已确认。当前没有需要重新生成提示词的设定卡片。",
  };
}

export async function updateProductionReferencePrompt(input: {
  projectId: string;
  referenceSetId: string;
  prompt: string;
  ratio: "1:1" | "3:4" | "4:3" | "16:9" | "9:16";
  generationCount: number;
  actorId: string;
}) {
  if (!input.prompt.trim()) {
    throw new AppError({
      status: 422,
      code: "production_reference_prompt_required",
      userMessage: "请先填写这个人物或场景的生成提示词。",
    });
  }
  const referenceSet = await saveProductionReferencePrompt({
    projectId: input.projectId,
    referenceSetId: input.referenceSetId,
    prompt: input.prompt,
    ratio: input.ratio,
    generationCount: input.generationCount,
    actorId: input.actorId,
    snapshot: {
      promptSource: "manual_edit",
      manualEditedAt: new Date().toISOString(),
    },
  });
  if (!referenceSet) {
    throw new AppError({
      status: 404,
      code: "production_reference_set_not_found",
      userMessage: "没有找到这个设定图卡片。请刷新工作台后再试。",
    });
  }
  return { referenceSet, message: "提示词、比例和生成数量已保存。" };
}

export async function selectProductionReferenceImageForSetup(input: {
  projectId: string;
  referenceSetId: string;
  imageId: string;
  actorId: string;
}) {
  const [images, referenceSets] = await Promise.all([
    listGeneratedImagesByIds({ projectId: input.projectId, imageIds: [input.imageId] }),
    listProductionReferenceSets(input.projectId),
  ]);
  const referenceSet = referenceSets.find((item) => item.id === input.referenceSetId);
  if (!referenceSet) {
    throw new AppError({
      status: 404,
      code: "production_reference_set_not_found",
      userMessage: "没有找到这个设定图卡片。请刷新后再试。",
    });
  }
  const image = images[0];
  if (!image || image.status !== "succeeded" || !image.ossUrl) {
    throw new AppError({
      status: 422,
      code: "production_reference_image_not_ready",
      userMessage: "这张设定图还没有生成成功，暂时不能设为采用。",
    });
  }
  const imageReferenceSetId = typeof image.metadata.referenceSetId === "string" ? image.metadata.referenceSetId : null;
  if (imageReferenceSetId && imageReferenceSetId !== referenceSet.id) {
    throw new AppError({
      status: 422,
      code: "production_reference_image_mismatch",
      userMessage: "这张设定图不属于当前人物或场景卡片，不能跨卡片设为采用。请在对应卡片的候选图中选择。",
    });
  }
  if (!imageReferenceSetId && !referenceSet.referenceImageIds.includes(image.id)) {
    throw new AppError({
      status: 422,
      code: "production_reference_image_mismatch",
      userMessage: "这张设定图不属于当前人物或场景卡片，不能跨卡片设为采用。请在对应卡片的候选图中选择。",
    });
  }
  await reviewGeneratedImageRecord({
    projectId: input.projectId,
    imageId: input.imageId,
    reviewStatus: "confirmed",
    reviewNote: "人物/场景设定图内部采用",
    actorId: input.actorId,
  });
  const updatedReferenceSet = await selectProductionReferenceImage({
    projectId: input.projectId,
    referenceSetId: input.referenceSetId,
    imageId: input.imageId,
    actorId: input.actorId,
  });
  if (!updatedReferenceSet) {
    throw new AppError({
      status: 404,
      code: "production_reference_set_not_found",
      userMessage: "没有找到这个设定图卡片。请刷新后再试。",
    });
  }
  return { referenceSet: updatedReferenceSet, message: "已设为最终采用图。" };
}

export async function submitProductionSetupReview(input: {
  projectId: string;
  actorId: string;
  origin: string;
}) {
  const [setup, storyboardShots] = await Promise.all([getProductionSetup(input.projectId), listStoryboardShots(input.projectId)]);
  const activeEntities = setup.entities.filter((entity) => entity.inclusionStatus !== "ignored");
  if (activeEntities.length === 0 || storyboardShots.length === 0) {
    throw new AppError({
      status: 422,
      code: "production_setup_empty",
      userMessage: "人物和场景设定还没有生成。请先拆分文字分镜，再确认设定后提交审核。",
    });
  }
  const missingReference = activeEntities.find(
    (entity) => !setup.referenceSets.some((referenceSet) => referenceSet.entityId === entity.id && referenceSet.depth === entity.referenceDepth)
  );
  if (missingReference) {
    throw new AppError({
      status: 422,
      code: "production_reference_missing",
      userMessage: `“${missingReference.name}”还没有对应参考集。请先保存设定深度，再提交人物场景设定审核。`,
    });
  }
  await assertProductionSetupReferenceImagesReady({
    projectId: input.projectId,
    entities: activeEntities,
    referenceSets: setup.referenceSets,
  });

  const entitySetVersion = Math.max(1, ...setup.entities.map((entity) => entity.version), ...setup.referenceSets.map((set) => set.version));
  const review = await createWorkflowClientReview({
    projectId: input.projectId,
    actorId: input.actorId,
    origin: input.origin,
    reviewType: "script_package",
    targetScopeId: setup.entities[0]?.id ?? null,
    sopKey: "sop_5",
    reviewScene: "production_setup",
    roundNumber: 1,
    payloadVersion: entitySetVersion,
  });
  await updateProjectProductionSetupStatus({
    projectId: input.projectId,
    status: "client_reviewing",
    actorId: input.actorId,
  });
  return review;
}

export async function assertProductionSetupReferenceImagesReady(input: {
  projectId: string;
  entities: ProductionEntityView[];
  referenceSets: ProductionReferenceSetView[];
}) {
  const activeEntities = input.entities.filter((entity) => entity.inclusionStatus !== "ignored");
  const imageIds = input.referenceSets.flatMap((referenceSet) => [
    ...referenceSet.referenceImageIds,
    referenceSet.selectedImageId ?? "",
  ]);
  const generatedImages = await listGeneratedImagesByIds({ projectId: input.projectId, imageIds });
  const generatedImageById = new Map(generatedImages.map((image) => [image.id, image]));

  for (const entity of activeEntities) {
    if (entity.inclusionStatus === "ignored") continue;
    const activeReference = input.referenceSets.find(
      (referenceSet) => referenceSet.entityId === entity.id && referenceSet.depth === entity.referenceDepth
    );
    const candidateIds = activeReference?.selectedImageId
      ? [activeReference.selectedImageId]
      : activeReference?.referenceImageIds ?? [];
    const hasConfirmedReferenceImage = candidateIds
      .map((imageId) => generatedImageById.get(imageId))
      .some(isConfirmedProductionReferenceImage);
    if (!hasConfirmedReferenceImage) {
      throw new AppError({
        status: 422,
        code: "production_reference_image_missing",
        userMessage: `“${entity.name}”还没有已采用的设定图。请先生成设定图，并在候选图里选择“设为采用”。`,
      });
    }
  }
}

export type ShotReferenceImage = {
  entityId: string;
  entityType: "character" | "scene";
  name: string;
  imageId: string;
  ossUrl: string;
};

export type ShotReferenceImageGap = {
  entityId: string;
  entityType: "character" | "scene";
  name: string;
};

/**
 * Resolve the locked character/scene setting images a single storyboard shot should use as
 * reference images. The shot→entity linkage is read from the existing, ID-based
 * `production_entities.source_shot_ids` (recorded when entities are extracted from the
 * storyboard), so no name re-matching happens here. Entities linked to the shot but without a
 * confirmed/usable setting image are returned in `missing`, never silently dropped.
 */
export async function resolveShotReferenceImages(input: {
  projectId: string;
  shotId: string;
}): Promise<{ references: ShotReferenceImage[]; missing: ShotReferenceImageGap[] }> {
  const [entities, referenceSets] = await Promise.all([
    listProductionEntities(input.projectId),
    listProductionReferenceSets(input.projectId),
  ]);
  const linkedEntities = entities.filter(
    (entity) =>
      entity.inclusionStatus !== "ignored" &&
      (entity.entityType === "character" || entity.entityType === "scene") &&
      entity.sourceShotIds.includes(input.shotId)
  );
  if (linkedEntities.length === 0) {
    return { references: [], missing: [] };
  }

  const activeReferenceSetFor = (entity: ProductionEntityView) =>
    referenceSets.find((set) => set.entityId === entity.id && set.depth === entity.referenceDepth) ?? null;
  const candidateImageIdsFor = (referenceSet: ProductionReferenceSetView | null) => {
    if (!referenceSet) return [];
    return referenceSet.selectedImageId ? [referenceSet.selectedImageId] : referenceSet.referenceImageIds;
  };

  const candidateImageIds = linkedEntities.flatMap((entity) => candidateImageIdsFor(activeReferenceSetFor(entity)));
  const generatedImages = await listGeneratedImagesByIds({ projectId: input.projectId, imageIds: candidateImageIds });
  const generatedImageById = new Map(generatedImages.map((image) => [image.id, image]));

  const references: ShotReferenceImage[] = [];
  const missing: ShotReferenceImageGap[] = [];
  for (const entity of linkedEntities) {
    const entityType = entity.entityType as "character" | "scene";
    const confirmedImage = candidateImageIdsFor(activeReferenceSetFor(entity))
      .map((imageId) => generatedImageById.get(imageId))
      .find(isConfirmedProductionReferenceImage);
    if (confirmedImage?.ossUrl) {
      references.push({ entityId: entity.id, entityType, name: entity.name, imageId: confirmedImage.id, ossUrl: confirmedImage.ossUrl });
    } else {
      missing.push({ entityId: entity.id, entityType, name: entity.name });
    }
  }
  // Characters before scenes so the prompt can describe roles in a stable order.
  references.sort((a, b) => a.entityType.localeCompare(b.entityType) || a.name.localeCompare(b.name, "zh-Hans-CN"));
  return { references, missing };
}

function isConfirmedProductionReferenceImage(image: GeneratedImageView | undefined) {
  return Boolean(image?.ossUrl && image.status === "succeeded" && image.reviewStatus === "confirmed");
}

function shouldRegenerateReferencePrompt(entity: ProductionEntityView, referenceSet: ProductionReferenceSetView) {
  if (entity.status === "locked" || referenceSet.status === "client_approved") return false;
  return true;
}

export function assertProductionSetupLocked(input: {
  entities: Array<Pick<ProductionEntityView, "id" | "entityType" | "status">>;
  storyboardShots: Array<Pick<StoryboardShotView, "id">>;
}): void {
  if (input.storyboardShots.length === 0) {
    throw new AppError({
      status: 422,
      code: "storyboard_required_before_image_stage",
      userMessage: "文字分镜尚未生成，暂时不能进入分镜图片阶段。",
    });
  }
  const hasUnlockedEntity = input.entities.length === 0 || input.entities.some((entity) => entity.status !== "locked");
  if (hasUnlockedEntity) {
    throw new AppError({
      status: 422,
      code: "production_setup_not_locked",
      userMessage: "人物和场景设定尚未全部锁定，暂时不能进入分镜图片阶段。请先提交甲方审核并通过。",
    });
  }
}

function collectRefs(input: {
  refs: unknown[];
  entityType: ProductionEntityType;
  shotId: string;
  drafts: Map<string, ProductionEntityDraft>;
}) {
  for (const ref of input.refs) {
    const parsed = normalizeRef(ref);
    if (!parsed.name) continue;
    if (shouldSkipEntity(input.entityType, parsed.name)) continue;
    const key = `${input.entityType}:${parsed.name.toLowerCase()}`;
    const current =
      input.drafts.get(key) ??
      ({
        entityType: input.entityType,
        name: parsed.name,
        description: parsed.description,
        sourceShotIds: [],
      } satisfies ProductionEntityDraft);
    if (parsed.description && !current.description) current.description = parsed.description;
    if (!current.sourceShotIds.includes(input.shotId)) current.sourceShotIds.push(input.shotId);
    input.drafts.set(key, current);
  }
}

function shouldSkipEntity(entityType: ProductionEntityType, name: string) {
  return entityType === "character" && genericCharacterNames.has(name.trim());
}

function normalizeRef(ref: unknown) {
  if (typeof ref === "string") return { name: ref.trim(), description: "" };
  if (typeof ref === "number" && Number.isFinite(ref)) return { name: String(ref), description: "" };
  if (ref && typeof ref === "object" && !Array.isArray(ref)) {
    const record = ref as Record<string, unknown>;
    const name = firstString(record.name, record.title, record.label, record.id, record.名称, record.角色, record.场景);
    const description = firstString(record.description, record.desc, record.note, record.描述, record.备注) ?? "";
    return { name: name ?? "", description };
  }
  return { name: "", description: "" };
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function defaultRatioForEntity(entityType: ProductionEntityType): "3:4" | "16:9" | "1:1" {
  if (entityType === "character") return "3:4";
  if (entityType === "scene") return "16:9";
  return "1:1";
}

function normalizeReferenceRatio(
  ratio: z.infer<typeof productionImageRatioSchema> | undefined,
  entityType: ProductionEntityType
): "1:1" | "3:4" | "4:3" | "16:9" | "9:16" {
  if (ratio && productionImageRatioSchema.safeParse(ratio).success) return ratio;
  return defaultRatioForEntity(entityType);
}

function buildSelectedStyleContext(
  directions: Array<{
    id: string;
    title: string;
    coreIdea: string;
    atmospherePrompt: string;
    referenceTags: string[];
  }>
) {
  if (directions.length === 0) return "延续上一轮甲方通过的创意视觉方向；若未明确，则保持真实、清晰、可用于后续分镜生产的稳定风格。";
  return directions
    .slice(0, 3)
    .map((direction) => [
      `方向：${compactText(direction.title, 80)}`,
      `核心：${compactText(direction.coreIdea, 180)}`,
      `视觉：${compactText(direction.atmospherePrompt || direction.referenceTags.join("、"), 220)}`,
    ].join("；"))
    .join("\n");
}

function buildReferencePromptGenerationUserMessage(input: {
  sourcePackage: { id: string; title: string; concept: string; fullScript: string } | null;
  selectedStyleContext: string;
  storyboardShots: StoryboardShotView[];
  promptableItems: Array<{ entity: ProductionEntityView; referenceSet: ProductionReferenceSetView }>;
  shotContextById: Map<string, string>;
}) {
  const entityBlocks = input.promptableItems.map(({ entity }) => {
    const shotContext = entity.sourceShotIds
      .map((shotId) => input.shotContextById.get(shotId))
      .filter(Boolean)
      .join("\n");
    return [
      `entityId: ${entity.id}`,
      `类型: ${entity.entityType}`,
      `名称: ${entity.name}`,
      `描述: ${entity.description || "暂无人工补充描述"}`,
      `来源分镜: ${shotContext || `${entity.sourceShotIds.length} 条，具体上下文不完整`}`,
      `目标深度: ${entity.referenceDepth}`,
      `默认比例建议: ${defaultRatioForEntity(entity.entityType)}`,
    ].join("\n");
  });

  return [
    `完整剧本记录：${input.sourcePackage ? `${input.sourcePackage.title}（${input.sourcePackage.id}）` : "暂无完整剧本记录"}`,
    `剧本说明：${input.sourcePackage?.concept ?? "暂无"}`,
    `标准剧本摘录：\n${compactText(input.sourcePackage?.fullScript ?? "", 6500) || "暂无标准剧本正文"}`,
    `已确认视觉风格：\n${input.selectedStyleContext}`,
    `文字分镜摘要：\n${input.storyboardShots.slice(0, 80).map(formatShotContext).join("\n") || "暂无文字分镜"}`,
    `需要生成提示词的人物/场景：\n${entityBlocks.join("\n\n---\n\n")}`,
    "输出要求：items 必须覆盖上面所有 entityId；basicPrompt 适合快速生成设定图，fullPrompt 适合完整设定图；每条 Prompt 保持中文、具体、可被用户编辑，不要输出解释性废话。",
  ].join("\n\n");
}

function formatShotContext(shot: StoryboardShotView) {
  return [
    `${shot.shotNumber}：${compactText(shot.visualDescription, 160)}`,
    shot.actionExpression ? `动作：${compactText(shot.actionExpression, 100)}` : "",
    shot.characterRefs.length ? `人物：${formatRefs(shot.characterRefs)}` : "",
    shot.sceneRefs.length ? `场景：${formatRefs(shot.sceneRefs)}` : "",
  ].filter(Boolean).join("；");
}

function formatRefs(refs: unknown[]) {
  return refs.map((ref) => normalizeRef(ref).name).filter(Boolean).join("、");
}

function compactText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function buildReferencePrompt(
  entity: Pick<ProductionEntityView, "entityType" | "name" | "description" | "importance" | "sourceShotIds">,
  context: { styleContext?: string; shotContext?: string } = {}
) {
  const label = entity.entityType === "character" ? "角色人物设定图" : entity.entityType === "scene" ? "场景设定图" : "道具设定图";
  const defaultRatio = defaultRatioForEntity(entity.entityType);
  return [
    `${label}：${entity.name}`,
    entity.description ? `设定说明：${entity.description}` : "设定说明：根据剧本文字分镜生成可用于后续分镜图片生产的稳定参考。",
    context.shotContext ? `剧本上下文：${context.shotContext}` : `来源分镜：${entity.sourceShotIds.length} 条`,
    context.styleContext ? `已确认视觉风格：${context.styleContext}` : "已确认视觉风格：延续上一轮甲方通过的创意视觉方向。",
    `默认比例：${defaultRatio}`,
    "生成要求：主体清晰，角色和场景特征稳定，适合后续分镜图片生产参考；不要文字水印，不要 UI 边框，不要拼贴。",
  ].join("\n");
}
