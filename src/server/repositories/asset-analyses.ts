import { query } from "@/lib/db";

export type AssetAnalysisView = {
  id: string;
  projectId: string;
  assetId: string;
  status: string;
  summary: string;
  extractedText: string;
  labels: string[];
  metadata: unknown;
  modelName: string | null;
  sourceJobId: string | null;
  failureReason: string | null;
  updatedAt: string;
};

type AssetAnalysisRow = {
  id: string;
  project_id: string;
  asset_id: string;
  status: string;
  summary: string;
  extracted_text: string;
  labels_json: unknown;
  metadata_json: unknown;
  model_name: string | null;
  source_job_id: string | null;
  failure_reason: string | null;
  updated_at: string;
};

export async function listProjectAssetAnalyses(projectId: string) {
  const result = await query<AssetAnalysisRow>(
    `select id, project_id, asset_id, status, summary, extracted_text, labels_json, metadata_json,
            model_name, source_job_id, failure_reason, updated_at
     from asset_analyses
     where project_id = $1
     order by updated_at desc
     limit 100`,
    [projectId]
  );

  return result.rows.map(mapAnalysis);
}

export async function upsertAssetAnalysis(input: {
  projectId: string;
  assetId: string;
  status: string;
  summary: string;
  extractedText?: string;
  labels?: string[];
  metadata?: unknown;
  modelName?: string | null;
  sourceJobId?: string | null;
  failureReason?: string | null;
}) {
  const result = await query<AssetAnalysisRow>(
    `insert into asset_analyses (
       project_id, asset_id, status, summary, extracted_text, labels_json, metadata_json,
       model_name, source_job_id, failure_reason
     )
     values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10)
     on conflict (asset_id)
     do update set
       status = excluded.status,
       summary = excluded.summary,
       extracted_text = excluded.extracted_text,
       labels_json = excluded.labels_json,
       metadata_json = excluded.metadata_json,
       model_name = excluded.model_name,
       source_job_id = excluded.source_job_id,
       failure_reason = excluded.failure_reason,
       updated_at = now()
     returning id, project_id, asset_id, status, summary, extracted_text, labels_json, metadata_json,
               model_name, source_job_id, failure_reason, updated_at`,
    [
      input.projectId,
      input.assetId,
      input.status,
      input.summary,
      input.extractedText ?? "",
      JSON.stringify(input.labels ?? []),
      JSON.stringify(input.metadata ?? {}),
      input.modelName ?? null,
      input.sourceJobId ?? null,
      input.failureReason ?? null,
    ]
  );

  return mapAnalysis(result.rows[0]);
}

function mapAnalysis(row: AssetAnalysisRow): AssetAnalysisView {
  return {
    id: row.id,
    projectId: row.project_id,
    assetId: row.asset_id,
    status: row.status,
    summary: row.summary,
    extractedText: row.extracted_text,
    labels: Array.isArray(row.labels_json) ? row.labels_json.map(String) : [],
    metadata: row.metadata_json,
    modelName: row.model_name,
    sourceJobId: row.source_job_id,
    failureReason: row.failure_reason,
    updatedAt: row.updated_at,
  };
}
