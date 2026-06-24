import { query } from "@/lib/db";

export type AiUsageSummary = {
  totalCalls: number;
  succeededCalls: number;
  failedCalls: number;
  totalTokens: number;
  totalImages: number;
  totalEmbeddings: number;
  averageDurationMs: number;
  byProvider: Array<{
    provider: string;
    callCount: number;
    totalTokens: number;
    totalImages: number;
    averageDurationMs: number;
  }>;
  recentCalls: Array<{
    id: string;
    projectId: string;
    jobId: string | null;
    callId: string;
    provider: string;
    modelName: string;
    operation: string;
    status: "succeeded" | "failed";
    totalTokens: number | null;
    imageCount: number | null;
    embeddingDimensions: number | null;
    durationMs: number;
    errorCode: string | null;
    createdAt: string;
  }>;
};

type SummaryRow = {
  total_calls: string;
  succeeded_calls: string;
  failed_calls: string;
  total_tokens: string | null;
  total_images: string | null;
  total_embeddings: string | null;
  average_duration_ms: string | null;
};

type ProviderRow = {
  provider: string;
  call_count: string;
  total_tokens: string | null;
  total_images: string | null;
  average_duration_ms: string | null;
};

type RecentCallRow = {
  id: string;
  project_id: string;
  job_id: string | null;
  call_id: string;
  provider: string;
  model_name: string;
  operation: string;
  status: "succeeded" | "failed";
  total_tokens: number | null;
  image_count: number | null;
  embedding_dimensions: number | null;
  duration_ms: number;
  error_code: string | null;
  created_at: string;
};

export async function getAiUsageSummary(): Promise<AiUsageSummary> {
  const [summaryResult, providerResult, recentResult] = await Promise.all([
    query<SummaryRow>(
      `select
         count(*)::text as total_calls,
         count(*) filter (where status = 'succeeded')::text as succeeded_calls,
         count(*) filter (where status = 'failed')::text as failed_calls,
         coalesce(sum(total_tokens), 0)::text as total_tokens,
         coalesce(sum(image_count), 0)::text as total_images,
         count(*) filter (where embedding_dimensions is not null)::text as total_embeddings,
         coalesce(round(avg(duration_ms)), 0)::text as average_duration_ms
       from ai_task_logs`
    ),
    query<ProviderRow>(
      `select provider,
              count(*)::text as call_count,
              coalesce(sum(total_tokens), 0)::text as total_tokens,
              coalesce(sum(image_count), 0)::text as total_images,
              coalesce(round(avg(duration_ms)), 0)::text as average_duration_ms
       from ai_task_logs
       group by provider
       order by count(*) desc, provider asc
       limit 8`
    ),
    query<RecentCallRow>(
      `select id, project_id, job_id, call_id, provider, model_name, operation, status,
              total_tokens, image_count, embedding_dimensions, duration_ms, error_code, created_at
       from ai_task_logs
       order by created_at desc
       limit 20`
    ),
  ]);

  const summary = summaryResult.rows[0];
  return {
    totalCalls: Number(summary?.total_calls ?? 0),
    succeededCalls: Number(summary?.succeeded_calls ?? 0),
    failedCalls: Number(summary?.failed_calls ?? 0),
    totalTokens: Number(summary?.total_tokens ?? 0),
    totalImages: Number(summary?.total_images ?? 0),
    totalEmbeddings: Number(summary?.total_embeddings ?? 0),
    averageDurationMs: Number(summary?.average_duration_ms ?? 0),
    byProvider: providerResult.rows.map((row) => ({
      provider: row.provider,
      callCount: Number(row.call_count),
      totalTokens: Number(row.total_tokens ?? 0),
      totalImages: Number(row.total_images ?? 0),
      averageDurationMs: Number(row.average_duration_ms ?? 0),
    })),
    recentCalls: recentResult.rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      jobId: row.job_id,
      callId: row.call_id,
      provider: row.provider,
      modelName: row.model_name,
      operation: row.operation,
      status: row.status,
      totalTokens: row.total_tokens,
      imageCount: row.image_count,
      embeddingDimensions: row.embedding_dimensions,
      durationMs: row.duration_ms,
      errorCode: row.error_code,
      createdAt: row.created_at,
    })),
  };
}
