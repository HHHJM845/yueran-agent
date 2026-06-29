import { query } from "@/lib/db";

export type ProductionEntityType = "character" | "scene" | "prop";
export type ReferenceSetDepth = "basic" | "full";
export type ProductionEntityInclusionStatus = "active" | "ignored";
export type ProductionImageRatio = "1:1" | "3:4" | "4:3" | "16:9" | "9:16";
export type ProductionEntityStatus =
  | "draft"
  | "generating"
  | "internal_confirmed"
  | "client_reviewing"
  | "client_rejected"
  | "client_approved"
  | "locked";

export type ProductionEntityView = {
  id: string;
  projectId: string;
  entityType: ProductionEntityType;
  name: string;
  description: string;
  importance: "normal" | "important" | "key";
  referenceDepth: ReferenceSetDepth;
  sourceShotIds: string[];
  status: ProductionEntityStatus;
  inclusionStatus: ProductionEntityInclusionStatus;
  ignoreReason: string;
  confirmedAt: string | null;
  version: number;
  lockedAt: string | null;
  updatedAt: string;
};

export type ProductionReferenceSetView = {
  id: string;
  projectId: string;
  entityId: string;
  depth: ReferenceSetDepth;
  status: ProductionEntityStatus;
  prompt: string;
  currentPrompt: string;
  referenceImageIds: string[];
  selectedImageId: string | null;
  defaultRatio: ProductionImageRatio;
  lastGenerationCount: number;
  snapshot: Record<string, unknown>;
  version: number;
  updatedAt: string;
};

export type UpsertProductionEntityInput = {
  projectId: string;
  entityType: ProductionEntityType;
  name: string;
  description?: string;
  importance?: "normal" | "important" | "key";
  referenceDepth?: ReferenceSetDepth;
  sourceShotIds?: string[];
  status?: ProductionEntityStatus;
  actorId?: string | null;
};

export type UpsertReferenceSetInput = {
  projectId: string;
  entityId: string;
  depth: ReferenceSetDepth;
  status?: ProductionEntityStatus;
  prompt?: string;
  referenceImageIds?: string[];
  defaultRatio?: ProductionImageRatio;
  lastGenerationCount?: number;
  snapshot?: Record<string, unknown>;
  actorId?: string | null;
};

export type UpdateProductionEntityStatusInput = {
  projectId: string;
  entityId: string;
  status: ProductionEntityStatus;
  actorId?: string | null;
};

type ProductionEntityRow = {
  id: string;
  project_id: string;
  entity_type: ProductionEntityType;
  name: string;
  description: string;
  importance: "normal" | "important" | "key";
  reference_depth: ReferenceSetDepth;
  source_shot_ids: unknown;
  status: ProductionEntityStatus;
  inclusion_status: ProductionEntityInclusionStatus;
  ignore_reason: string;
  confirmed_at: string | null;
  version: number;
  locked_at: string | null;
  updated_at: string;
};

type ProductionReferenceSetRow = {
  id: string;
  project_id: string;
  entity_id: string;
  depth: ReferenceSetDepth;
  status: ProductionEntityStatus;
  prompt: string;
  current_prompt: string;
  reference_image_ids: unknown;
  selected_image_id: string | null;
  default_ratio: ProductionImageRatio;
  last_generation_count: number;
  snapshot_json: unknown;
  version: number;
  updated_at: string;
};

export async function listProductionEntities(projectId: string): Promise<ProductionEntityView[]> {
  const result = await query<ProductionEntityRow>(
    `select id, project_id, entity_type, name, description, importance, reference_depth,
            source_shot_ids, status, inclusion_status, ignore_reason, confirmed_at,
            version, locked_at, updated_at
     from production_entities
     where project_id = $1
     order by entity_type, name asc, updated_at desc`,
    [projectId]
  );
  return result.rows.map(mapEntity);
}

export async function listProductionReferenceSets(projectId: string): Promise<ProductionReferenceSetView[]> {
  const result = await query<ProductionReferenceSetRow>(
    `select id, project_id, entity_id, depth, status, prompt, reference_image_ids,
            current_prompt, selected_image_id, default_ratio, last_generation_count,
            snapshot_json, version, updated_at
     from production_reference_sets
     where project_id = $1
     order by entity_id, depth, version desc`,
    [projectId]
  );
  return result.rows.map(mapReferenceSet);
}

export async function upsertProductionEntity(input: UpsertProductionEntityInput): Promise<ProductionEntityView> {
  const existing = await query<{ id: string }>(
    `select id
     from production_entities
     where project_id = $1
       and entity_type = $2
       and lower(name) = lower($3)
     order by updated_at desc
     limit 1`,
    [input.projectId, input.entityType, input.name]
  );

  if (existing.rows[0]) {
    const updated = await query<ProductionEntityRow>(
      `update production_entities
     set description = case when $4 <> '' then $4 else description end,
         importance = $5,
         reference_depth = coalesce($6, reference_depth),
         status = coalesce($9, status),
         source_shot_ids = coalesce((
           select jsonb_agg(distinct value)
           from jsonb_array_elements_text(source_shot_ids || $7::jsonb) as value
         ), '[]'::jsonb),
         updated_by = coalesce($8, updated_by),
         updated_at = now()
     where project_id = $1
       and entity_type = $2
       and lower(name) = lower($3)
     returning id, project_id, entity_type, name, description, importance, reference_depth,
               source_shot_ids, status, inclusion_status, ignore_reason, confirmed_at,
               version, locked_at, updated_at`,
      [
        input.projectId,
        input.entityType,
        input.name,
        input.description ?? "",
        input.importance ?? "normal",
        input.referenceDepth ?? null,
        JSON.stringify(input.sourceShotIds ?? []),
        input.actorId ?? null,
        input.status ?? null,
      ]
    );
    return mapEntity(updated.rows[0]);
  }

  const inserted = await query<ProductionEntityRow>(
    `insert into production_entities (
       project_id, entity_type, name, description, importance, reference_depth,
       source_shot_ids, status, created_by, updated_by
     )
     values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $9)
     returning id, project_id, entity_type, name, description, importance, reference_depth,
               source_shot_ids, status, inclusion_status, ignore_reason, confirmed_at,
               version, locked_at, updated_at`,
    [
      input.projectId,
      input.entityType,
      input.name,
      input.description ?? "",
      input.importance ?? "normal",
      input.referenceDepth ?? "basic",
      JSON.stringify(input.sourceShotIds ?? []),
      input.status ?? "draft",
      input.actorId ?? null,
    ]
  );
  return mapEntity(inserted.rows[0]);
}

export async function upsertReferenceSet(input: UpsertReferenceSetInput): Promise<ProductionReferenceSetView> {
  const existing = await query<{ id: string }>(
    `select id
     from production_reference_sets
     where project_id = $1
       and entity_id = $2
       and depth = $3
     order by version desc, updated_at desc
     limit 1`,
    [input.projectId, input.entityId, input.depth]
  );

  if (existing.rows[0]) {
    const updated = await query<ProductionReferenceSetRow>(
      `update production_reference_sets
       set status = $1,
           prompt = case when $2 <> '' then $2 else prompt end,
           current_prompt = case when $2 <> '' then $2 else current_prompt end,
           reference_image_ids = coalesce($3::jsonb, reference_image_ids),
           snapshot_json = $4::jsonb,
           default_ratio = coalesce($5, default_ratio),
           last_generation_count = coalesce($6, last_generation_count),
           version = version + 1,
           updated_by = coalesce($7, updated_by),
           updated_at = now()
       where id = $8
       returning id, project_id, entity_id, depth, status, prompt, reference_image_ids,
                 current_prompt, selected_image_id, default_ratio, last_generation_count,
                 snapshot_json, version, updated_at`,
      [
        input.status ?? "draft",
        input.prompt ?? "",
        input.referenceImageIds ? JSON.stringify(input.referenceImageIds) : null,
        JSON.stringify(input.snapshot ?? {}),
        input.defaultRatio ?? null,
        input.lastGenerationCount ?? null,
        input.actorId ?? null,
        existing.rows[0].id,
      ]
    );
    return mapReferenceSet(updated.rows[0]);
  }

  const result = await query<ProductionReferenceSetRow>(
    `insert into production_reference_sets (
       project_id, entity_id, depth, status, prompt, reference_image_ids,
       current_prompt, default_ratio, last_generation_count, snapshot_json, created_by, updated_by
     )
     values ($1, $2, $3, $4, $5, $6::jsonb, $5, $7, $8, $9::jsonb, $10, $10)
     returning id, project_id, entity_id, depth, status, prompt, reference_image_ids,
               current_prompt, selected_image_id, default_ratio, last_generation_count,
               snapshot_json, version, updated_at`,
    [
      input.projectId,
      input.entityId,
      input.depth,
      input.status ?? "draft",
      input.prompt ?? "",
      JSON.stringify(input.referenceImageIds ?? []),
      input.defaultRatio ?? "1:1",
      input.lastGenerationCount ?? 1,
      JSON.stringify(input.snapshot ?? {}),
      input.actorId ?? null,
    ]
  );
  return mapReferenceSet(result.rows[0]);
}

export async function selectProductionReferenceImage(input: {
  projectId: string;
  referenceSetId: string;
  imageId: string;
  actorId?: string | null;
}): Promise<ProductionReferenceSetView | null> {
  const result = await query<ProductionReferenceSetRow>(
    `update production_reference_sets
     set selected_image_id = $3,
         reference_image_ids = coalesce((
           select jsonb_agg(distinct value)
           from jsonb_array_elements_text(reference_image_ids || jsonb_build_array($3::text)) as value
         ), jsonb_build_array($3::text)),
         status = 'internal_confirmed',
         updated_by = coalesce($4, updated_by),
         updated_at = now()
     where project_id = $1 and id = $2
     returning id, project_id, entity_id, depth, status, prompt, current_prompt,
               reference_image_ids, selected_image_id, default_ratio, last_generation_count,
               snapshot_json, version, updated_at`,
    [input.projectId, input.referenceSetId, input.imageId, input.actorId ?? null]
  );
  return result.rows[0] ? mapReferenceSet(result.rows[0]) : null;
}

export async function saveProductionReferencePrompt(input: {
  projectId: string;
  referenceSetId: string;
  prompt: string;
  ratio: ProductionImageRatio;
  generationCount: number;
  actorId?: string | null;
}): Promise<ProductionReferenceSetView | null> {
  const result = await query<ProductionReferenceSetRow>(
    `update production_reference_sets
     set prompt = $3,
         current_prompt = $3,
         default_ratio = $4,
         last_generation_count = $5,
         updated_by = coalesce($6, updated_by),
         updated_at = now()
     where project_id = $1 and id = $2
     returning id, project_id, entity_id, depth, status, prompt, current_prompt,
               reference_image_ids, selected_image_id, default_ratio, last_generation_count,
               snapshot_json, version, updated_at`,
    [input.projectId, input.referenceSetId, input.prompt.trim(), input.ratio, input.generationCount, input.actorId ?? null]
  );
  return result.rows[0] ? mapReferenceSet(result.rows[0]) : null;
}

export async function updateProductionEntityDetails(input: {
  projectId: string;
  entityId: string;
  name: string;
  description: string;
  actorId?: string | null;
}): Promise<ProductionEntityView | null> {
  const result = await query<ProductionEntityRow>(
    `update production_entities
     set name = $3,
         description = $4,
         updated_by = coalesce($5, updated_by),
         updated_at = now()
     where project_id = $1 and id = $2
     returning id, project_id, entity_type, name, description, importance, reference_depth,
               source_shot_ids, status, inclusion_status, ignore_reason, confirmed_at,
               version, locked_at, updated_at`,
    [input.projectId, input.entityId, input.name.trim(), input.description.trim(), input.actorId ?? null]
  );
  return result.rows[0] ? mapEntity(result.rows[0]) : null;
}

export async function setProductionEntityInclusion(input: {
  projectId: string;
  entityId: string;
  inclusionStatus: ProductionEntityInclusionStatus;
  ignoreReason?: string;
  actorId?: string | null;
}): Promise<ProductionEntityView | null> {
  const result = await query<ProductionEntityRow>(
    `update production_entities
     set inclusion_status = $3,
         ignore_reason = case when $3 = 'ignored' then $4 else '' end,
         updated_by = coalesce($5, updated_by),
         updated_at = now()
     where project_id = $1 and id = $2
     returning id, project_id, entity_type, name, description, importance, reference_depth,
               source_shot_ids, status, inclusion_status, ignore_reason, confirmed_at,
               version, locked_at, updated_at`,
    [input.projectId, input.entityId, input.inclusionStatus, input.ignoreReason ?? "", input.actorId ?? null]
  );
  return result.rows[0] ? mapEntity(result.rows[0]) : null;
}

export async function confirmProductionEntities(input: {
  projectId: string;
  actorId?: string | null;
}): Promise<ProductionEntityView[]> {
  const result = await query<ProductionEntityRow>(
    `update production_entities
     set confirmed_at = now(),
         updated_by = coalesce($2, updated_by),
         updated_at = now()
     where project_id = $1
       and inclusion_status = 'active'
     returning id, project_id, entity_type, name, description, importance, reference_depth,
               source_shot_ids, status, inclusion_status, ignore_reason, confirmed_at,
               version, locked_at, updated_at`,
    [input.projectId, input.actorId ?? null]
  );
  return result.rows.map(mapEntity);
}

export async function updateProductionEntityStatus(input: UpdateProductionEntityStatusInput): Promise<ProductionEntityView | null> {
  const result = await query<ProductionEntityRow>(
    `update production_entities
     set status = $3,
         locked_at = case when $3 = 'locked' then now() else locked_at end,
         updated_by = coalesce($4, updated_by),
         updated_at = now()
     where project_id = $1 and id = $2
     returning id, project_id, entity_type, name, description, importance, reference_depth,
               source_shot_ids, status, inclusion_status, ignore_reason, confirmed_at,
               version, locked_at, updated_at`,
    [input.projectId, input.entityId, input.status, input.actorId ?? null]
  );
  return result.rows[0] ? mapEntity(result.rows[0]) : null;
}

export async function updateProjectProductionSetupStatus(input: {
  projectId: string;
  status: ProductionEntityStatus;
  actorId?: string | null;
}) {
  await query(
    `update production_entities
     set status = $2,
         locked_at = case when $2 = 'locked' then now() else locked_at end,
         updated_by = coalesce($3, updated_by),
         updated_at = now()
     where project_id = $1`,
    [input.projectId, input.status, input.actorId ?? null]
  );
  await query(
    `update production_reference_sets
     set status = $2,
         updated_by = coalesce($3, updated_by),
         updated_at = now()
     where project_id = $1`,
    [input.projectId, input.status, input.actorId ?? null]
  );
}

function mapEntity(row: ProductionEntityRow): ProductionEntityView {
  return {
    id: row.id,
    projectId: row.project_id,
    entityType: row.entity_type,
    name: row.name,
    description: row.description,
    importance: row.importance,
    referenceDepth: row.reference_depth,
    sourceShotIds: normalizeStringArray(row.source_shot_ids),
    status: row.status,
    inclusionStatus: row.inclusion_status,
    ignoreReason: row.ignore_reason,
    confirmedAt: row.confirmed_at,
    version: row.version,
    lockedAt: row.locked_at,
    updatedAt: row.updated_at,
  };
}

function mapReferenceSet(row: ProductionReferenceSetRow): ProductionReferenceSetView {
  return {
    id: row.id,
    projectId: row.project_id,
    entityId: row.entity_id,
    depth: row.depth,
    status: row.status,
    prompt: row.prompt,
    currentPrompt: row.current_prompt || row.prompt,
    referenceImageIds: normalizeStringArray(row.reference_image_ids),
    selectedImageId: row.selected_image_id,
    defaultRatio: row.default_ratio,
    lastGenerationCount: row.last_generation_count,
    snapshot: normalizeRecord(row.snapshot_json),
    version: row.version,
    updatedAt: row.updated_at,
  };
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
