import { query } from "@/lib/db";

export type ChangeRequestStatus = "draft" | "submitted" | "approved" | "rejected" | "implemented" | "cancelled";

export type ChangeRequestView = {
  id: string;
  projectId: string;
  sourceSop: string;
  sourceObjectType: string;
  sourceObjectId: string | null;
  status: ChangeRequestStatus;
  originalScope: string;
  requestedScope: string;
  impactJson: unknown;
  decisionReason: string;
  decidedBy: string | null;
  decidedAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateChangeRequestInput = {
  projectId: string;
  sourceSop: string;
  originalScope: string;
  requestedScope: string;
  impactJson: unknown;
  actorId: string;
  sourceObjectType?: string;
  sourceObjectId?: string | null;
  status?: ChangeRequestStatus;
};

export type UpdateChangeRequestStatusInput = {
  projectId: string;
  changeRequestId: string;
  status: ChangeRequestStatus;
  decisionReason?: string;
  actorId: string;
};

type ChangeRequestRow = {
  id: string;
  project_id: string;
  source_sop: string;
  source_object_type: string;
  source_object_id: string | null;
  status: ChangeRequestStatus;
  original_scope: string;
  requested_scope: string;
  impact_json: unknown;
  decision_reason: string;
  decided_by: string | null;
  decided_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

const CHANGE_REQUEST_COLUMNS = `
  id, project_id, source_sop, source_object_type, source_object_id, status,
  original_scope, requested_scope, impact_json, decision_reason, decided_by,
  decided_at, created_by, updated_by, created_at, updated_at`;

export async function listProjectChangeRequests(projectId: string): Promise<ChangeRequestView[]> {
  const result = await query<ChangeRequestRow>(
    `select ${CHANGE_REQUEST_COLUMNS}
       from change_requests
      where project_id = $1
      order by case status
                 when 'draft' then 1
                 when 'submitted' then 2
                 when 'approved' then 3
                 when 'implemented' then 4
                 when 'rejected' then 5
                 else 6
               end,
               updated_at desc`,
    [projectId]
  );
  return result.rows.map(mapChangeRequest);
}

export async function createChangeRequest(input: CreateChangeRequestInput): Promise<ChangeRequestView> {
  const result = await query<ChangeRequestRow>(
    `insert into change_requests (
       project_id, source_sop, source_object_type, source_object_id, status,
       original_scope, requested_scope, impact_json, created_by, updated_by
     )
     values (
       $1, $2, $3, $4, $5, $6, $7, $8::jsonb,
       case when exists (select 1 from users where id = $9::uuid) then $9::uuid else null end,
       case when exists (select 1 from users where id = $9::uuid) then $9::uuid else null end
     )
     returning ${CHANGE_REQUEST_COLUMNS}`,
    [
      input.projectId,
      input.sourceSop,
      input.sourceObjectType ?? "",
      input.sourceObjectId ?? null,
      input.status ?? "submitted",
      input.originalScope,
      input.requestedScope,
      JSON.stringify(input.impactJson ?? {}),
      input.actorId,
    ]
  );
  return mapChangeRequest(result.rows[0]);
}

export async function updateChangeRequestStatus(input: UpdateChangeRequestStatusInput): Promise<ChangeRequestView | null> {
  const isDecision = input.status === "approved" || input.status === "rejected" || input.status === "cancelled";
  const result = await query<ChangeRequestRow>(
    `update change_requests
        set status = $3,
            decision_reason = coalesce($4, decision_reason),
            decided_by = case
              when $5 and exists (select 1 from users where id = $6::uuid) then $6::uuid
              else decided_by
            end,
            decided_at = case when $5 then now() else decided_at end,
            updated_by = case when exists (select 1 from users where id = $6::uuid) then $6::uuid else updated_by end,
            updated_at = now()
      where project_id = $1
        and id = $2
      returning ${CHANGE_REQUEST_COLUMNS}`,
    [input.projectId, input.changeRequestId, input.status, input.decisionReason ?? null, isDecision, input.actorId]
  );
  return result.rows[0] ? mapChangeRequest(result.rows[0]) : null;
}

function mapChangeRequest(row: ChangeRequestRow): ChangeRequestView {
  return {
    id: row.id,
    projectId: row.project_id,
    sourceSop: row.source_sop,
    sourceObjectType: row.source_object_type,
    sourceObjectId: row.source_object_id,
    status: row.status,
    originalScope: row.original_scope,
    requestedScope: row.requested_scope,
    impactJson: row.impact_json,
    decisionReason: row.decision_reason,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
