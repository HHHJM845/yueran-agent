import { query, withTransaction } from "@/lib/db";

export type StoryboardImageBatchStatus =
  | "draft"
  | "internal_ready"
  | "client_reviewing"
  | "client_rejected"
  | "client_approved"
  | "locked";

export type StoryboardImageBatchItemStatus = "pending" | "approved" | "rejected" | "needs_revision" | "locked";
export type StoryboardImageVersionStatus = "draft" | "selected" | "client_reviewing" | "client_rejected" | "client_approved" | "locked";
export type StoryboardImageBatchNumber = number;

export type StoryboardImageBatchItemView = {
  id: string;
  projectId: string;
  batchId: string;
  sceneId: string | null;
  shotId: string | null;
  status: StoryboardImageBatchItemStatus;
  selectedImageIds: string[];
  feedback: string;
  feedbackPayload: Record<string, unknown>;
  version: number;
  sortOrder: number;
  updatedAt: string;
};

export type StoryboardImageBatchView = {
  id: string;
  projectId: string;
  batchNumber: StoryboardImageBatchNumber;
  status: StoryboardImageBatchStatus;
  version: number;
  sceneIds: string[];
  clientReviewTaskId: string | null;
  snapshot: Record<string, unknown>;
  submittedAt: string | null;
  approvedAt: string | null;
  updatedAt: string;
  items: StoryboardImageBatchItemView[];
};

export type StoryboardImageVersionView = {
  id: string;
  projectId: string;
  sceneId: string | null;
  shotId: string;
  storyboardImageId: string | null;
  version: number;
  selectedImageIds: string[];
  status: StoryboardImageVersionStatus;
  snapshot: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CreateStoryboardImageBatchInput = {
  projectId: string;
  batchNumber?: StoryboardImageBatchNumber | null;
  sceneIds?: string[];
  actorId: string;
};

export type UpdateStoryboardImageBatchStatusInput = {
  projectId: string;
  batchId: string;
  status: StoryboardImageBatchStatus;
  actorId?: string | null;
  clientReviewTaskId?: string | null;
  snapshot?: Record<string, unknown> | null;
};

export type CreateStoryboardImageVersionInput = {
  projectId: string;
  sceneId?: string | null;
  shotId: string;
  storyboardImageId?: string | null;
  selectedImageIds: string[];
  status?: StoryboardImageVersionStatus;
  snapshot: Record<string, unknown>;
  actorId: string;
};

type BatchRow = {
  id: string;
  project_id: string;
  batch_number: number;
  status: StoryboardImageBatchStatus;
  version: number;
  scene_ids: unknown;
  client_review_task_id: string | null;
  snapshot_json: unknown;
  submitted_at: string | null;
  approved_at: string | null;
  updated_at: string;
};

type BatchItemRow = {
  id: string;
  project_id: string;
  batch_id: string;
  scene_id: string | null;
  shot_id: string | null;
  status: StoryboardImageBatchItemStatus;
  selected_image_ids: unknown;
  feedback: string;
  feedback_payload_json: unknown;
  version: number;
  sort_order: number;
  updated_at: string;
};

type VersionRow = {
  id: string;
  project_id: string;
  scene_id: string | null;
  shot_id: string;
  storyboard_image_id: string | null;
  version: number;
  selected_image_ids: unknown;
  status: StoryboardImageVersionStatus;
  snapshot_json: unknown;
  created_at: string;
  updated_at: string;
};

export async function listStoryboardImageBatches(projectId: string): Promise<StoryboardImageBatchView[]> {
  const [batches, items] = await Promise.all([
    query<BatchRow>(
      `select id, project_id, batch_number, status, version, scene_ids, client_review_task_id,
              snapshot_json, submitted_at, approved_at, updated_at
       from storyboard_image_batches
       where project_id = $1
       order by batch_number asc, version desc`,
      [projectId]
    ),
    query<BatchItemRow>(
      `select id, project_id, batch_id, scene_id, shot_id, status, selected_image_ids,
              feedback, feedback_payload_json, version, sort_order, updated_at
       from storyboard_image_batch_items
       where project_id = $1
       order by batch_id, sort_order asc, updated_at desc`,
      [projectId]
    ),
  ]);
  const itemsByBatch = new Map<string, StoryboardImageBatchItemView[]>();
  for (const item of items.rows.map(mapBatchItem)) {
    itemsByBatch.set(item.batchId, [...(itemsByBatch.get(item.batchId) ?? []), item]);
  }
  return batches.rows.map((row) => mapBatch(row, itemsByBatch.get(row.id) ?? []));
}

export async function listStoryboardImageVersions(projectId: string): Promise<StoryboardImageVersionView[]> {
  const result = await query<VersionRow>(
    `select id, project_id, scene_id, shot_id, storyboard_image_id, version, selected_image_ids,
            status, snapshot_json, created_at, updated_at
     from storyboard_image_versions
     where project_id = $1
     order by shot_id, version desc`,
    [projectId]
  );
  return result.rows.map(mapVersion);
}

export async function getStoryboardImageBatch(input: { projectId: string; batchId: string }) {
  const batches = await listStoryboardImageBatches(input.projectId);
  return batches.find((batch) => batch.id === input.batchId) ?? null;
}

export async function createStoryboardImageBatch(input: CreateStoryboardImageBatchInput): Promise<StoryboardImageBatchView> {
  return withTransaction(async (tx) => {
    const nextBatchNumber = await tx<{ next_batch_number: number }>(
      `select coalesce(max(batch_number), 0) + 1 as next_batch_number
       from storyboard_image_batches
       where project_id = $1`,
      [input.projectId]
    );
    const batchNumber = input.batchNumber ?? Number(nextBatchNumber.rows[0]?.next_batch_number ?? 1);
    const sceneResult = await tx<{ id: string }>(
      `select id
       from storyboard_scenes
       where project_id = $1
       order by scene_number asc, updated_at asc`,
      [input.projectId]
    );
    const sceneIds = input.sceneIds && input.sceneIds.length > 0 ? input.sceneIds : sceneResult.rows.map((scene) => scene.id);
    const version = 1;
    const snapshot = {
      batchNumber,
      sceneIds,
      createdAt: new Date().toISOString(),
    };
    const batchResult = await tx<BatchRow>(
      `insert into storyboard_image_batches (
         project_id, batch_number, status, version, scene_ids, snapshot_json, created_by, updated_by
       )
       values ($1, $2, 'draft', $3, $4::jsonb, $5::jsonb, $6, $6)
       returning id, project_id, batch_number, status, version, scene_ids, client_review_task_id,
                 snapshot_json, submitted_at, approved_at, updated_at`,
      [input.projectId, batchNumber, version, JSON.stringify(sceneIds), JSON.stringify(snapshot), input.actorId]
    );
    const batch = mapBatch(batchResult.rows[0], []);
    const shotResult = await tx<{ id: string; scene_id: string; sort_order: number }>(
      `select id, scene_id, sort_order
       from storyboard_shots
       where project_id = $1
         and scene_id = any($2::uuid[])
       order by scene_id, sort_order asc`,
      [input.projectId, sceneIds]
    );
    const items: StoryboardImageBatchItemView[] = [];
    for (const [index, shot] of shotResult.rows.entries()) {
      const itemResult = await tx<BatchItemRow>(
        `insert into storyboard_image_batch_items (
           project_id, batch_id, scene_id, shot_id, status, selected_image_ids, version, sort_order, created_by, updated_by
         )
         values ($1, $2, $3, $4, 'pending', '[]'::jsonb, $5, $6, $7, $7)
         returning id, project_id, batch_id, scene_id, shot_id, status, selected_image_ids,
                   feedback, feedback_payload_json, version, sort_order, updated_at`,
        [input.projectId, batch.id, shot.scene_id, shot.id, version, shot.sort_order ?? index, input.actorId]
      );
      items.push(mapBatchItem(itemResult.rows[0]));
    }
    return { ...batch, items };
  });
}

export async function updateStoryboardImageBatchStatus(input: UpdateStoryboardImageBatchStatusInput): Promise<StoryboardImageBatchView | null> {
  const result = await query<BatchRow>(
    `update storyboard_image_batches
     set status = $3,
         client_review_task_id = coalesce($4, client_review_task_id),
         snapshot_json = coalesce($5::jsonb, snapshot_json),
         submitted_at = case when $3 = 'client_reviewing' then now() else submitted_at end,
         approved_at = case when $3 = 'client_approved' then now() else approved_at end,
         updated_by = coalesce($6, updated_by),
         updated_at = now()
     where project_id = $1 and id = $2
     returning id, project_id, batch_number, status, version, scene_ids, client_review_task_id,
               snapshot_json, submitted_at, approved_at, updated_at`,
    [
      input.projectId,
      input.batchId,
      input.status,
      input.clientReviewTaskId ?? null,
      input.snapshot ? JSON.stringify(input.snapshot) : null,
      input.actorId ?? null,
    ]
  );
  return result.rows[0] ? mapBatch(result.rows[0], []) : null;
}

export async function updateStoryboardImageBatchItemDecisions(input: {
  projectId: string;
  batchId: string;
  decisions: Array<{
    shotId: string;
    approved: boolean;
    selectedImageIds?: string[];
    feedback?: string | null;
    feedbackPayload?: Record<string, unknown>;
  }>;
}) {
  for (const decision of input.decisions) {
    await query(
      `update storyboard_image_batch_items
       set status = $4,
           selected_image_ids = coalesce($5::jsonb, selected_image_ids),
           feedback = $6,
           feedback_payload_json = $7::jsonb,
           updated_at = now()
       where project_id = $1 and batch_id = $2 and shot_id = $3`,
      [
        input.projectId,
        input.batchId,
        decision.shotId,
        decision.approved ? "approved" : "rejected",
        decision.selectedImageIds ? JSON.stringify(decision.selectedImageIds) : null,
        decision.feedback ?? "",
        JSON.stringify(decision.feedbackPayload ?? {}),
      ]
    );
  }
}

export async function createStoryboardImageVersion(input: CreateStoryboardImageVersionInput): Promise<StoryboardImageVersionView> {
  const nextVersion = await query<{ next_version: number }>(
    `select coalesce(max(version), 0) + 1 as next_version
     from storyboard_image_versions
     where project_id = $1 and shot_id = $2`,
    [input.projectId, input.shotId]
  );
  const version = Number(nextVersion.rows[0]?.next_version ?? 1);
  const result = await query<VersionRow>(
    `insert into storyboard_image_versions (
       project_id, scene_id, shot_id, storyboard_image_id, version, selected_image_ids, status, snapshot_json, created_by
     )
     values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::jsonb, $9)
     returning id, project_id, scene_id, shot_id, storyboard_image_id, version, selected_image_ids,
               status, snapshot_json, created_at, updated_at`,
    [
      input.projectId,
      input.sceneId ?? null,
      input.shotId,
      input.storyboardImageId ?? null,
      version,
      JSON.stringify(input.selectedImageIds),
      input.status ?? "selected",
      JSON.stringify(input.snapshot),
      input.actorId,
    ]
  );
  return mapVersion(result.rows[0]);
}

export function mapBatch(row: BatchRow, items: StoryboardImageBatchItemView[]): StoryboardImageBatchView {
  return {
    id: row.id,
    projectId: row.project_id,
    batchNumber: row.batch_number as StoryboardImageBatchNumber,
    status: row.status,
    version: row.version,
    sceneIds: mapStringArray(row.scene_ids),
    clientReviewTaskId: row.client_review_task_id,
    snapshot: mapObject(row.snapshot_json),
    submittedAt: row.submitted_at,
    approvedAt: row.approved_at,
    updatedAt: row.updated_at,
    items,
  };
}

function mapBatchItem(row: BatchItemRow): StoryboardImageBatchItemView {
  return {
    id: row.id,
    projectId: row.project_id,
    batchId: row.batch_id,
    sceneId: row.scene_id,
    shotId: row.shot_id,
    status: row.status,
    selectedImageIds: mapStringArray(row.selected_image_ids),
    feedback: row.feedback,
    feedbackPayload: mapObject(row.feedback_payload_json),
    version: row.version,
    sortOrder: row.sort_order,
    updatedAt: row.updated_at,
  };
}

function mapVersion(row: VersionRow): StoryboardImageVersionView {
  return {
    id: row.id,
    projectId: row.project_id,
    sceneId: row.scene_id,
    shotId: row.shot_id,
    storyboardImageId: row.storyboard_image_id,
    version: row.version,
    selectedImageIds: mapStringArray(row.selected_image_ids),
    status: row.status,
    snapshot: mapObject(row.snapshot_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function mapObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
