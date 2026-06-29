import { AppError } from "@/lib/errors";
import { listGeneratedImagesByIds, type GeneratedImageView } from "@/server/repositories/generated-images";
import {
  confirmProductionEntities,
  listProductionEntities,
  listProductionReferenceSets,
  saveProductionReferencePrompt,
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
import { listStoryboardShots, type StoryboardShotView } from "@/server/repositories/story-production";
import { createWorkflowClientReview } from "@/server/use-cases/client-review";

export type ProductionEntityDraft = {
  entityType: ProductionEntityType;
  name: string;
  description: string;
  sourceShotIds: string[];
};

const genericCharacterNames = new Set(["路人", "路人甲", "路人乙", "群众", "人群", "背景人群", "观众", "行人", "路人群众"]);

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

export async function confirmProductionEntityList(input: { projectId: string; actorId: string }) {
  const setup = await getProductionSetup(input.projectId);
  const activeEntities = setup.entities.filter((entity) => entity.inclusionStatus !== "ignored");
  if (activeEntities.length === 0) {
    throw new AppError({
      status: 422,
      code: "production_entity_list_empty",
      userMessage: "人物和场景清单为空。请先新增需要生成设定图的人物或场景。",
    });
  }
  const confirmed = await confirmProductionEntities({ projectId: input.projectId, actorId: input.actorId });
  return { entities: confirmed, message: "人物和场景清单已确认，可以开始生成设定图。" };
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
  const imageIds = input.referenceSets.flatMap((referenceSet) => referenceSet.referenceImageIds);
  const generatedImages = await listGeneratedImagesByIds({ projectId: input.projectId, imageIds });
  const generatedImageById = new Map(generatedImages.map((image) => [image.id, image]));

  for (const entity of activeEntities) {
    const activeReference = input.referenceSets.find(
      (referenceSet) => referenceSet.entityId === entity.id && referenceSet.depth === entity.referenceDepth
    );
    const hasConfirmedReferenceImage = Boolean(
      activeReference?.referenceImageIds
        .map((imageId) => generatedImageById.get(imageId))
        .some(isConfirmedProductionReferenceImage)
    );
    if (!hasConfirmedReferenceImage) {
      throw new AppError({
        status: 422,
        code: "production_reference_image_missing",
        userMessage: `“${entity.name}”还没有已采用的设定图。请先生成设定图，并在候选图里选择“设为采用”。`,
      });
    }
  }
}

function isConfirmedProductionReferenceImage(image: GeneratedImageView | undefined) {
  return Boolean(image?.ossUrl && image.status === "succeeded" && image.reviewStatus === "confirmed");
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
