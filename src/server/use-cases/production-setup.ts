import { AppError } from "@/lib/errors";
import {
  listProductionEntities,
  listProductionReferenceSets,
  updateProjectProductionSetupStatus,
  updateProductionEntityStatus,
  upsertProductionEntity,
  upsertReferenceSet,
  type ProductionEntityType,
  type ProductionEntityView,
  type ProductionReferenceSetView,
  type ReferenceSetDepth,
} from "@/server/repositories/production-entities";
import { listStoryboardShots, type StoryboardShotView } from "@/server/repositories/story-production";
import { createWorkflowClientReview } from "@/server/use-cases/client-review";

export type ProductionEntityDraft = {
  entityType: ProductionEntityType;
  name: string;
  description: string;
  sourceShotIds: string[];
};

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
        prompt: buildReferencePrompt(entity),
        snapshot: {
          entityType: entity.entityType,
          name: entity.name,
          sourceShotIds: entity.sourceShotIds,
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

export async function submitProductionSetupReview(input: {
  projectId: string;
  actorId: string;
  origin: string;
}) {
  const [setup, storyboardShots] = await Promise.all([getProductionSetup(input.projectId), listStoryboardShots(input.projectId)]);
  if (setup.entities.length === 0 || storyboardShots.length === 0) {
    throw new AppError({
      status: 422,
      code: "production_setup_empty",
      userMessage: "人物和场景设定还没有生成。请先拆分文字分镜，再确认设定后提交审核。",
    });
  }
  const missingReference = setup.entities.find(
    (entity) => !setup.referenceSets.some((referenceSet) => referenceSet.entityId === entity.id && referenceSet.depth === entity.referenceDepth)
  );
  if (missingReference) {
    throw new AppError({
      status: 422,
      code: "production_reference_missing",
      userMessage: `“${missingReference.name}”还没有对应参考集。请先保存设定深度，再提交人物场景设定审核。`,
    });
  }

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

function buildReferencePrompt(entity: ProductionEntityView) {
  const label = entity.entityType === "character" ? "人物" : entity.entityType === "scene" ? "场景" : "道具";
  return `${label}设定：${entity.name}${entity.description ? `。补充说明：${entity.description}` : ""}`;
}
