import { projectStages, type ProjectStage, type StageStatus } from "@/domain/types";
import { query } from "@/lib/db";

export type ProjectStageStateView = {
  id: string;
  projectId: string;
  stageKey: ProjectStage;
  status: StageStatus;
  ownerName: string | null;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  retryCount: number;
  inputRefs: unknown[];
  outputRefs: unknown[];
  snapshot: Record<string, unknown>;
  updatedAt: string;
};

type ProjectStageStateRow = {
  id: string;
  project_id: string;
  stage_key: ProjectStage;
  status: StageStatus;
  owner_name: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  retry_count: number;
  input_refs: unknown;
  output_refs: unknown;
  snapshot: unknown;
  updated_at: string;
};

export async function listProjectStageStates(projectId: string) {
  const result = await query<ProjectStageStateRow>(
    `select id, project_id, stage_key, status, owner_name, started_at, completed_at,
            error_message, retry_count, input_refs, output_refs, snapshot, updated_at
     from project_stage_states
     where project_id = $1
     order by array_position($2::text[], stage_key) asc`,
    [projectId, projectStages]
  );

  return result.rows.map(mapProjectStageState);
}

export async function upsertProjectStageState(input: {
  projectId: string;
  stageKey: ProjectStage;
  status: StageStatus;
  ownerName?: string | null;
  errorMessage?: string | null;
  inputRefs?: unknown[];
  outputRefs?: unknown[];
  snapshot?: Record<string, unknown>;
}) {
  const result = await query<ProjectStageStateRow>(
    `insert into project_stage_states (
       project_id, stage_key, status, owner_name, started_at, completed_at,
       error_message, input_refs, output_refs, snapshot
     )
     values (
       $1, $2, $3, $4,
       case when $3 in ('in_progress', 'waiting_review', 'needs_revision', 'approved', 'completed') then now() else null end,
       case when $3 in ('completed', 'approved') then now() else null end,
       $5, $6::jsonb, $7::jsonb, $8::jsonb
     )
     on conflict (project_id, stage_key)
     do update set
       status = excluded.status,
       owner_name = coalesce(excluded.owner_name, project_stage_states.owner_name),
       started_at = coalesce(project_stage_states.started_at, excluded.started_at),
       completed_at = case when excluded.status in ('completed', 'approved') then now() else null end,
       error_message = excluded.error_message,
       retry_count = case when excluded.status in ('blocked', 'needs_revision') then project_stage_states.retry_count + 1 else project_stage_states.retry_count end,
       input_refs = excluded.input_refs,
       output_refs = excluded.output_refs,
       snapshot = excluded.snapshot,
       updated_at = now()
     returning id, project_id, stage_key, status, owner_name, started_at, completed_at,
               error_message, retry_count, input_refs, output_refs, snapshot, updated_at`,
    [
      input.projectId,
      input.stageKey,
      input.status,
      input.ownerName ?? null,
      input.errorMessage ?? null,
      JSON.stringify(input.inputRefs ?? []),
      JSON.stringify(input.outputRefs ?? []),
      JSON.stringify(input.snapshot ?? {}),
    ]
  );

  return mapProjectStageState(result.rows[0]);
}

export async function setProjectCurrentStage(input: {
  projectId: string;
  currentStage: ProjectStage;
  status: StageStatus;
}) {
  await query(
    `update projects
     set current_stage = $2,
         status = $3,
         updated_at = now()
     where id = $1`,
    [input.projectId, input.currentStage, input.status]
  );
}

export async function updateProjectStageProgress(input: {
  projectId: string;
  stageKey: ProjectStage;
  status: StageStatus;
  currentStage?: ProjectStage;
  projectStatus?: StageStatus;
  ownerName?: string | null;
  errorMessage?: string | null;
  inputRefs?: unknown[];
  outputRefs?: unknown[];
  snapshot?: Record<string, unknown>;
}) {
  const stage = await upsertProjectStageState(input);
  if (input.currentStage || input.projectStatus) {
    await setProjectCurrentStage({
      projectId: input.projectId,
      currentStage: input.currentStage ?? input.stageKey,
      status: input.projectStatus ?? input.status,
    });
  }
  return stage;
}

function mapProjectStageState(row: ProjectStageStateRow): ProjectStageStateView {
  return {
    id: row.id,
    projectId: row.project_id,
    stageKey: row.stage_key,
    status: row.status,
    ownerName: row.owner_name,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    errorMessage: row.error_message,
    retryCount: row.retry_count,
    inputRefs: Array.isArray(row.input_refs) ? row.input_refs : [],
    outputRefs: Array.isArray(row.output_refs) ? row.output_refs : [],
    snapshot:
      row.snapshot && typeof row.snapshot === "object" && !Array.isArray(row.snapshot)
        ? (row.snapshot as Record<string, unknown>)
        : {},
    updatedAt: row.updated_at,
  };
}
