import { query } from "@/lib/db";

export type MaterialEmbeddingView = {
  id: string;
  projectId: string;
  assetAnalysisId: string;
  contentText: string;
  labels: string[];
  provider: string;
  modelName: string;
  contentHash: string;
  embedding: number[];
  status: string;
  failureReason: string | null;
  updatedAt: string;
};

export type MaterialSearchMatch = {
  embeddingId: string;
  assetAnalysisId: string;
  score: number;
  contentPreview: string;
  labels: string[];
};

type MaterialEmbeddingRow = {
  id: string;
  project_id: string;
  asset_analysis_id: string;
  content_text: string;
  labels_json: unknown;
  provider: string;
  model_name: string;
  content_hash: string;
  embedding_json: unknown;
  status: string;
  failure_reason: string | null;
  updated_at: string;
};

export async function upsertMaterialEmbedding(input: {
  projectId: string;
  assetAnalysisId: string;
  contentText: string;
  labels: string[];
  provider: string;
  modelName: string;
  contentHash: string;
  embedding: number[];
  sourceJobId?: string | null;
}) {
  const result = await query<MaterialEmbeddingRow>(
    `insert into material_embeddings (
       project_id, asset_analysis_id, content_text, labels_json, provider,
       model_name, content_hash, embedding_json, status, source_job_id
     )
     values ($1, $2, $3, $4::jsonb, $5, $6, $7, $8::jsonb, 'succeeded', $9)
     on conflict (asset_analysis_id, model_name, content_hash)
     do update set
       content_text = excluded.content_text,
       labels_json = excluded.labels_json,
       provider = excluded.provider,
       embedding_json = excluded.embedding_json,
       status = 'succeeded',
       failure_reason = null,
       source_job_id = excluded.source_job_id,
       updated_at = now()
     returning ${materialEmbeddingColumns}`,
    [
      input.projectId,
      input.assetAnalysisId,
      input.contentText,
      JSON.stringify(input.labels),
      input.provider,
      input.modelName,
      input.contentHash,
      JSON.stringify(input.embedding),
      input.sourceJobId ?? null,
    ]
  );

  return mapMaterialEmbedding(result.rows[0]);
}

export async function listProjectMaterialEmbeddings(projectId: string, modelName: string) {
  const result = await query<MaterialEmbeddingRow>(
    `select ${materialEmbeddingColumns}
     from material_embeddings
     where project_id = $1 and model_name = $2 and status = 'succeeded'
     order by updated_at desc
     limit 200`,
    [projectId, modelName]
  );

  return result.rows.map(mapMaterialEmbedding);
}

export async function findMaterialEmbedding(input: {
  assetAnalysisId: string;
  modelName: string;
  contentHash: string;
}) {
  const result = await query<MaterialEmbeddingRow>(
    `select ${materialEmbeddingColumns}
     from material_embeddings
     where asset_analysis_id = $1 and model_name = $2 and content_hash = $3
     limit 1`,
    [input.assetAnalysisId, input.modelName, input.contentHash]
  );

  return result.rows[0] ? mapMaterialEmbedding(result.rows[0]) : null;
}

export async function createMaterialSearchResult(input: {
  projectId: string;
  queryText: string;
  provider: string;
  modelName: string;
  results: MaterialSearchMatch[];
  sourceJobId?: string | null;
}) {
  await query(
    `insert into material_search_results (
       project_id, query_text, provider, model_name, results_json, source_job_id
     )
     values ($1, $2, $3, $4, $5::jsonb, $6)`,
    [
      input.projectId,
      input.queryText,
      input.provider,
      input.modelName,
      JSON.stringify(input.results),
      input.sourceJobId ?? null,
    ]
  );
}

const materialEmbeddingColumns = [
  "id",
  "project_id",
  "asset_analysis_id",
  "content_text",
  "labels_json",
  "provider",
  "model_name",
  "content_hash",
  "embedding_json",
  "status",
  "failure_reason",
  "updated_at",
].join(", ");

function mapMaterialEmbedding(row: MaterialEmbeddingRow): MaterialEmbeddingView {
  return {
    id: row.id,
    projectId: row.project_id,
    assetAnalysisId: row.asset_analysis_id,
    contentText: row.content_text,
    labels: Array.isArray(row.labels_json) ? row.labels_json.map(String) : [],
    provider: row.provider,
    modelName: row.model_name,
    contentHash: row.content_hash,
    embedding: Array.isArray(row.embedding_json) ? row.embedding_json.map(Number).filter(Number.isFinite) : [],
    status: row.status,
    failureReason: row.failure_reason,
    updatedAt: row.updated_at,
  };
}
