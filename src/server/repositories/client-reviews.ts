import { AppError } from "@/lib/errors";
import { query, withTransaction } from "@/lib/db";

export type ClientReviewStatus = "draft" | "active" | "submitted" | "approved" | "rejected" | "expired" | "revoked";
export type ClientReviewType =
  | "brief_confirmation"
  | "project_proposal"
  | "quote_confirmation"
  | "contract_confirmation"
  | "script_package"
  | "storyboard_scene_images"
  | "storyboard_image_batch"
  | "a_copy_review"
  | "b_copy_review";
export type ClientReviewTargetScopeType = "project" | "proposal" | "quote" | "contract" | "script_package" | "storyboard_scene" | "storyboard_image_batch" | "review_cut";
export type ClientReviewItemDecision = "pending" | "approved" | "rejected";
export type ClientReviewItemType =
  | "brief"
  | "proposal"
  | "quote"
  | "contract"
  | "script_direction"
  | "reference_asset"
  | "storyboard_shot_image"
  | "review_cut_video";

export type ClientReviewTaskView = {
  id: string;
  projectId: string;
  moduleKey: string;
  reviewType: ClientReviewType;
  targetScopeType: ClientReviewTargetScopeType;
  targetScopeId: string;
  title: string;
  summary: string;
  version: number;
  status: ClientReviewStatus;
  expiresAt: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  sopKey: string | null;
  reviewScene: string | null;
  roundNumber: number | null;
  batchNumber: number | null;
  reviewPayloadVersion: number;
  payload: Record<string, unknown>;
  decisionPayload: Record<string, unknown>;
  reviewerName: string | null;
  reviewerContact: string | null;
  feedback: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ClientReviewItemView = {
  id: string;
  reviewTaskId: string;
  projectId: string;
  itemType: ClientReviewItemType;
  itemId: string;
  itemLabel: string;
  decision: ClientReviewItemDecision;
  score: number | null;
  feedback: string;
  metadata: Record<string, unknown>;
  updatedAt: string;
};

type ClientReviewTaskRow = {
  id: string;
  project_id: string;
  module_key: string;
  review_type: ClientReviewType;
  target_scope_type: ClientReviewTargetScopeType;
  target_scope_id: string;
  title: string;
  summary: string;
  version: number;
  status: ClientReviewStatus;
  expires_at: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  sop_key: string | null;
  review_scene: string | null;
  round_number: number | null;
  batch_number: number | null;
  review_payload_version: number | null;
  payload_json: unknown;
  decision_payload_json: unknown;
  reviewer_name: string | null;
  reviewer_contact: string | null;
  feedback: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type ClientReviewItemRow = {
  id: string;
  review_task_id: string;
  project_id: string;
  item_type: ClientReviewItemType;
  item_id: string;
  item_label: string;
  decision: ClientReviewItemDecision;
  score: number | null;
  feedback: string;
  metadata_json: unknown;
  updated_at: string;
};

export async function listProjectClientReviewTasks(projectId: string) {
  const result = await query<ClientReviewTaskRow>(
    `select id, project_id, module_key, review_type, target_scope_type, target_scope_id,
            title, summary, version, status, expires_at, submitted_at, reviewed_at,
            sop_key, review_scene, round_number, batch_number, review_payload_version,
            payload_json, decision_payload_json, reviewer_name, reviewer_contact, feedback,
            created_by, created_at, updated_at
     from client_review_tasks
     where project_id = $1
     order by updated_at desc
     limit 100`,
    [projectId]
  );
  return result.rows.map(mapTask);
}

export async function listClientReviewItems(reviewTaskId: string) {
  const result = await query<ClientReviewItemRow>(
    `select id, review_task_id, project_id, item_type, item_id, item_label,
            decision, score, feedback, metadata_json, updated_at
     from client_review_items
     where review_task_id = $1
     order by item_type, created_at asc`,
    [reviewTaskId]
  );
  return result.rows.map(mapItem);
}

export async function listProjectClientReviewItems(projectId: string) {
  const result = await query<ClientReviewItemRow>(
    `select id, review_task_id, project_id, item_type, item_id, item_label,
            decision, score, feedback, metadata_json, updated_at
     from client_review_items
     where project_id = $1
     order by updated_at desc
     limit 500`,
    [projectId]
  );
  return result.rows.map(mapItem);
}

export async function getNextClientReviewVersion(input: {
  projectId: string;
  reviewType: ClientReviewType;
  targetScopeId: string;
}) {
  const result = await query<{ next_version: number }>(
    `select coalesce(max(version), 0) + 1 as next_version
     from client_review_tasks
     where project_id = $1
       and review_type = $2
       and target_scope_id = $3`,
    [input.projectId, input.reviewType, input.targetScopeId]
  );
  return Number(result.rows[0]?.next_version ?? 1);
}

export async function expirePriorActiveClientReviews(input: {
  projectId: string;
  reviewType: ClientReviewType;
  targetScopeId: string;
  exceptTaskId: string;
}) {
  await query(
    `update client_review_tasks
     set status = 'expired',
         updated_at = now()
     where project_id = $1
       and review_type = $2
       and target_scope_id = $3
       and status = 'active'
       and id <> $4`,
    [input.projectId, input.reviewType, input.targetScopeId, input.exceptTaskId]
  );
}

export async function getClientReviewTaskByTokenHash(accessTokenHash: string) {
  const result = await query<ClientReviewTaskRow>(
    `select id, project_id, module_key, review_type, target_scope_type, target_scope_id,
            title, summary, version, status, expires_at, submitted_at, reviewed_at,
            sop_key, review_scene, round_number, batch_number, review_payload_version,
            payload_json, decision_payload_json, reviewer_name, reviewer_contact, feedback,
            created_by, created_at, updated_at
     from client_review_tasks
     where access_token_hash = $1
     limit 1`,
    [accessTokenHash]
  );
  return result.rows[0] ? mapTask(result.rows[0]) : null;
}

export async function getClientReviewTaskById(taskId: string) {
  const result = await query<ClientReviewTaskRow>(
    `select id, project_id, module_key, review_type, target_scope_type, target_scope_id,
            title, summary, version, status, expires_at, submitted_at, reviewed_at,
            sop_key, review_scene, round_number, batch_number, review_payload_version,
            payload_json, decision_payload_json, reviewer_name, reviewer_contact, feedback,
            created_by, created_at, updated_at
     from client_review_tasks
     where id = $1
     limit 1`,
    [taskId]
  );
  return result.rows[0] ? mapTask(result.rows[0]) : null;
}

export async function getClientReviewSecretByTaskId(taskId: string) {
  const result = await query<{ verification_code_hash: string }>(
    `select verification_code_hash
     from client_review_tasks
     where id = $1
     limit 1`,
    [taskId]
  );
  return result.rows[0]?.verification_code_hash ?? null;
}

export async function createClientReviewTask(input: {
  projectId: string;
  moduleKey: string;
  reviewType: ClientReviewType;
  targetScopeType: ClientReviewTargetScopeType;
  targetScopeId: string;
  title: string;
  summary?: string;
  version: number;
  accessTokenHash: string;
  verificationCodeHash: string;
  expiresAt?: string | null;
  sopKey?: string | null;
  reviewScene?: string | null;
  roundNumber?: number | null;
  batchNumber?: number | null;
  reviewPayloadVersion?: number | null;
  payload?: Record<string, unknown>;
  createdBy: string;
  items: Array<{
    itemType: ClientReviewItemType;
    itemId: string;
    itemLabel: string;
    metadata?: Record<string, unknown>;
  }>;
}) {
  return withTransaction(async (tx) => {
    const taskResult = await tx<ClientReviewTaskRow>(
      `insert into client_review_tasks (
         project_id, module_key, review_type, target_scope_type, target_scope_id,
         title, summary, version, status, access_token_hash, verification_code_hash,
         expires_at, sop_key, review_scene, round_number, batch_number, review_payload_version, payload_json, created_by
       )
       values (
         $1, $2, $3, $4, $5, $6, $7, $8, 'active', $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, $18
       )
       returning id, project_id, module_key, review_type, target_scope_type, target_scope_id,
                 title, summary, version, status, expires_at, submitted_at, reviewed_at,
                 sop_key, review_scene, round_number, batch_number, review_payload_version,
                 payload_json, decision_payload_json, reviewer_name, reviewer_contact, feedback,
                 created_by, created_at, updated_at`,
      [
        input.projectId,
        input.moduleKey,
        input.reviewType,
        input.targetScopeType,
        input.targetScopeId,
        input.title,
        input.summary ?? "",
        input.version,
        input.accessTokenHash,
        input.verificationCodeHash,
        input.expiresAt ?? null,
        input.sopKey ?? null,
        input.reviewScene ?? null,
        input.roundNumber ?? null,
        input.batchNumber ?? null,
        input.reviewPayloadVersion ?? 1,
        JSON.stringify(input.payload ?? {}),
        input.createdBy,
      ]
    );
    const task = mapTask(taskResult.rows[0]);
    const items: ClientReviewItemView[] = [];

    for (const item of input.items) {
      const itemResult = await tx<ClientReviewItemRow>(
        `insert into client_review_items (
           review_task_id, project_id, item_type, item_id, item_label, metadata_json
         )
         values ($1, $2, $3, $4, $5, $6::jsonb)
         returning id, review_task_id, project_id, item_type, item_id, item_label,
                   decision, score, feedback, metadata_json, updated_at`,
        [
          task.id,
          input.projectId,
          item.itemType,
          item.itemId,
          item.itemLabel,
          JSON.stringify(item.metadata ?? {}),
        ]
      );
      items.push(mapItem(itemResult.rows[0]));
    }

    await tx(
      `insert into audit_logs (actor_id, project_id, action, object_type, object_id, after_json)
       values ($1, $2, 'client_review.created', 'client_review_task', $3, $4::jsonb)`,
      [
        input.createdBy,
        input.projectId,
        task.id,
        JSON.stringify({
          reviewType: input.reviewType,
          targetScopeType: input.targetScopeType,
          targetScopeId: input.targetScopeId,
          itemCount: items.length,
        }),
      ]
    );

    return { task, items };
  });
}

export async function submitClientReviewTaskRecord(input: {
  taskId: string;
  decision: "approved" | "rejected";
  reviewerName?: string | null;
  reviewerContact?: string | null;
  feedback?: string | null;
  decisionPayload?: Record<string, unknown>;
  items: Array<{
    itemId: string;
    decision: Exclude<ClientReviewItemDecision, "pending">;
    score?: number | null;
    feedback?: string | null;
  }>;
}) {
  return withTransaction(async (tx) => {
    const currentResult = await tx<ClientReviewTaskRow>(
      `select id, project_id, module_key, review_type, target_scope_type, target_scope_id,
              title, summary, version, status, expires_at, submitted_at, reviewed_at,
              sop_key, review_scene, round_number, batch_number, review_payload_version,
              payload_json, decision_payload_json, reviewer_name, reviewer_contact, feedback,
              created_by, created_at, updated_at
       from client_review_tasks
       where id = $1
       for update`,
      [input.taskId]
    );
    const current = currentResult.rows[0];
    if (!current) {
      throw new AppError({
        status: 404,
        code: "client_review_not_found",
        userMessage: "没有找到这个甲方审核任务。请检查链接是否正确，或联系项目团队重新发送。",
      });
    }
    if (current.status !== "active") {
      throw new AppError({
        status: 409,
        code: "client_review_not_active",
        userMessage: "这个审核任务已经提交、过期或撤回，不能再次修改。你可以联系项目团队查看历史版本。",
      });
    }
    if (current.expires_at && new Date(current.expires_at).getTime() < Date.now()) {
      await tx(`update client_review_tasks set status = 'expired', updated_at = now() where id = $1`, [input.taskId]);
      throw new AppError({
        status: 410,
        code: "client_review_expired",
        userMessage: "这个审核链接已经过期。请联系项目团队重新生成审核链接。",
      });
    }

    const taskResult = await tx<ClientReviewTaskRow>(
      `update client_review_tasks
       set status = $2,
           submitted_at = now(),
           reviewed_at = now(),
           reviewer_name = $3,
           reviewer_contact = $4,
           feedback = $5,
           decision_payload_json = $6::jsonb,
           updated_at = now()
       where id = $1
       returning id, project_id, module_key, review_type, target_scope_type, target_scope_id,
                 title, summary, version, status, expires_at, submitted_at, reviewed_at,
                 sop_key, review_scene, round_number, batch_number, review_payload_version,
                 payload_json, decision_payload_json, reviewer_name, reviewer_contact, feedback,
                 created_by, created_at, updated_at`,
      [
        input.taskId,
        input.decision,
        input.reviewerName ?? null,
        input.reviewerContact ?? null,
        input.feedback ?? null,
        JSON.stringify(input.decisionPayload ?? {}),
      ]
    );

    const updatedItems: ClientReviewItemView[] = [];
    for (const item of input.items) {
      const itemResult = await tx<ClientReviewItemRow>(
        `update client_review_items
         set decision = $3,
             score = $4,
             feedback = $5,
             updated_at = now()
         where review_task_id = $1
           and item_id = $2::uuid
         returning id, review_task_id, project_id, item_type, item_id, item_label,
                   decision, score, feedback, metadata_json, updated_at`,
        [input.taskId, item.itemId, item.decision, item.score ?? null, item.feedback ?? ""]
      );
      if (itemResult.rows[0]) updatedItems.push(mapItem(itemResult.rows[0]));
    }

    await tx(
      `insert into audit_logs (actor_id, project_id, action, object_type, object_id, before_json, after_json)
       values (null, $1, 'client_review.submitted', 'client_review_task', $2, $3::jsonb, $4::jsonb)`,
      [
        current.project_id,
        input.taskId,
        JSON.stringify({ status: current.status }),
        JSON.stringify({
          status: input.decision,
          reviewerName: input.reviewerName ?? null,
          itemCount: updatedItems.length,
        }),
      ]
    );

    return { task: mapTask(taskResult.rows[0]), items: updatedItems };
  });
}

function mapTask(row: ClientReviewTaskRow): ClientReviewTaskView {
  return {
    id: row.id,
    projectId: row.project_id,
    moduleKey: row.module_key,
    reviewType: row.review_type,
    targetScopeType: row.target_scope_type,
    targetScopeId: row.target_scope_id,
    title: row.title,
    summary: row.summary,
    version: row.version,
    status: row.status,
    expiresAt: row.expires_at,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    sopKey: row.sop_key,
    reviewScene: row.review_scene,
    roundNumber: row.round_number,
    batchNumber: row.batch_number,
    reviewPayloadVersion: row.review_payload_version ?? 1,
    payload:
      row.payload_json && typeof row.payload_json === "object" && !Array.isArray(row.payload_json)
        ? (row.payload_json as Record<string, unknown>)
        : {},
    decisionPayload:
      row.decision_payload_json && typeof row.decision_payload_json === "object" && !Array.isArray(row.decision_payload_json)
        ? (row.decision_payload_json as Record<string, unknown>)
        : {},
    reviewerName: row.reviewer_name,
    reviewerContact: row.reviewer_contact,
    feedback: row.feedback,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapItem(row: ClientReviewItemRow): ClientReviewItemView {
  return {
    id: row.id,
    reviewTaskId: row.review_task_id,
    projectId: row.project_id,
    itemType: row.item_type,
    itemId: row.item_id,
    itemLabel: row.item_label,
    decision: row.decision,
    score: row.score,
    feedback: row.feedback,
    metadata:
      row.metadata_json && typeof row.metadata_json === "object" && !Array.isArray(row.metadata_json)
        ? (row.metadata_json as Record<string, unknown>)
        : {},
    updatedAt: row.updated_at,
  };
}
