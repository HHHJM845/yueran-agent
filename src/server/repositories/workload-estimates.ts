import { query } from "@/lib/db";

export type WorkloadEstimateView = {
  id: string;
  projectId: string;
  status: "draft" | "generated" | "confirmed" | "archived";
  roleCount: number;
  sceneCount: number;
  shotCount: number;
  imageCount: number;
  videoCount: number;
  revisionRounds: number;
  deliverableVersions: string[];
  complexity: "low" | "medium" | "high";
  priceRange: { minCny: number; maxCny: number };
  rationale: string;
  riskNotes: string;
  sourceRoundId: string | null;
  sourceJobId: string | null;
  updatedAt: string;
};

export type SaveWorkloadEstimateInput = {
  projectId: string;
  status?: "draft" | "generated" | "confirmed" | "archived";
  roleCount: number;
  sceneCount: number;
  shotCount: number;
  imageCount: number;
  videoCount: number;
  revisionRounds: number;
  deliverableVersions: string[];
  complexity: "low" | "medium" | "high";
  minPriceCny: number;
  maxPriceCny: number;
  rationale: string;
  riskNotes: string;
  sourceRoundId?: string | null;
  sourceJobId?: string | null;
  actorId?: string | null;
};

type WorkloadEstimateRow = {
  id: string;
  project_id: string;
  status: WorkloadEstimateView["status"];
  role_count: number;
  scene_count: number;
  shot_count: number;
  image_count: number;
  video_count: number;
  revision_rounds: number;
  deliverable_versions: unknown;
  complexity: WorkloadEstimateView["complexity"];
  min_price_cny: string | number;
  max_price_cny: string | number;
  rationale: string;
  risk_notes: string;
  source_round_id: string | null;
  source_job_id: string | null;
  updated_at: string;
};

export async function getProjectWorkloadEstimate(projectId: string): Promise<WorkloadEstimateView | null> {
  const result = await query<WorkloadEstimateRow>(
    `select id, project_id, status, role_count, scene_count, shot_count, image_count,
            video_count, revision_rounds, deliverable_versions, complexity,
            min_price_cny, max_price_cny, rationale, risk_notes, source_round_id,
            source_job_id, updated_at
       from workload_estimates
      where project_id = $1
      limit 1`,
    [projectId]
  );

  return result.rows[0] ? mapWorkloadEstimate(result.rows[0]) : null;
}

export async function saveWorkloadEstimateDraft(input: SaveWorkloadEstimateInput): Promise<WorkloadEstimateView> {
  const result = await query<WorkloadEstimateRow>(
    `insert into workload_estimates (
       project_id, status, role_count, scene_count, shot_count, image_count,
       video_count, revision_rounds, deliverable_versions, complexity,
       min_price_cny, max_price_cny, rationale, risk_notes, source_round_id,
       source_job_id, created_by, updated_by
     )
     values (
       $1, $2, $3, $4, $5, $6,
       $7, $8, $9::jsonb, $10,
       $11, $12, $13, $14, $15,
       $16,
       case when exists (select 1 from users where id = $17::uuid) then $17::uuid else null end,
       case when exists (select 1 from users where id = $17::uuid) then $17::uuid else null end
     )
     on conflict (project_id)
     do update set
       status = excluded.status,
       role_count = excluded.role_count,
       scene_count = excluded.scene_count,
       shot_count = excluded.shot_count,
       image_count = excluded.image_count,
       video_count = excluded.video_count,
       revision_rounds = excluded.revision_rounds,
       deliverable_versions = excluded.deliverable_versions,
       complexity = excluded.complexity,
       min_price_cny = excluded.min_price_cny,
       max_price_cny = excluded.max_price_cny,
       rationale = excluded.rationale,
       risk_notes = excluded.risk_notes,
       source_round_id = excluded.source_round_id,
       source_job_id = excluded.source_job_id,
       updated_by = excluded.updated_by,
       updated_at = now()
     returning id, project_id, status, role_count, scene_count, shot_count, image_count,
               video_count, revision_rounds, deliverable_versions, complexity,
               min_price_cny, max_price_cny, rationale, risk_notes, source_round_id,
               source_job_id, updated_at`,
    [
      input.projectId,
      input.status ?? "draft",
      input.roleCount,
      input.sceneCount,
      input.shotCount,
      input.imageCount,
      input.videoCount,
      input.revisionRounds,
      JSON.stringify(input.deliverableVersions),
      input.complexity,
      input.minPriceCny,
      input.maxPriceCny,
      input.rationale,
      input.riskNotes,
      input.sourceRoundId ?? null,
      input.sourceJobId ?? null,
      input.actorId ?? null,
    ]
  );

  return mapWorkloadEstimate(result.rows[0]);
}

function mapWorkloadEstimate(row: WorkloadEstimateRow): WorkloadEstimateView {
  return {
    id: row.id,
    projectId: row.project_id,
    status: row.status,
    roleCount: row.role_count,
    sceneCount: row.scene_count,
    shotCount: row.shot_count,
    imageCount: row.image_count,
    videoCount: row.video_count,
    revisionRounds: row.revision_rounds,
    deliverableVersions: normalizeStringArray(row.deliverable_versions),
    complexity: row.complexity,
    priceRange: {
      minCny: Number(row.min_price_cny),
      maxCny: Number(row.max_price_cny),
    },
    rationale: row.rationale,
    riskNotes: row.risk_notes,
    sourceRoundId: row.source_round_id,
    sourceJobId: row.source_job_id,
    updatedAt: row.updated_at,
  };
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}
