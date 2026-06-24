import { query } from "@/lib/db";

export type AiTaskLogInput = {
  projectId: string;
  jobId?: string | null;
  callId: string;
  provider: string;
  modelName: string;
  operation: string;
  status: "succeeded" | "failed";
  providerRequestId?: string | null;
  providerResponseId?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  inputChars?: number | null;
  outputChars?: number | null;
  imageCount?: number | null;
  embeddingDimensions?: number | null;
  durationMs: number;
  attempt?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
};

export async function createAiTaskLog(input: AiTaskLogInput) {
  const result = await query<{ id: string }>(
    `insert into ai_task_logs (
       project_id, job_id, call_id, provider, model_name, operation, status,
       provider_request_id, provider_response_id,
       input_tokens, output_tokens, total_tokens, input_chars, output_chars,
       image_count, embedding_dimensions, duration_ms, attempt,
       error_code, error_message, metadata_json, created_at
     )
     values (
       $1, $2, $3, $4, $5, $6, $7,
       $8, $9,
       $10, $11, $12, $13, $14,
       $15, $16, $17, $18,
       $19, $20, $21::jsonb, now()
     )
     returning id`,
    [
      input.projectId,
      input.jobId ?? null,
      input.callId,
      input.provider,
      input.modelName,
      input.operation,
      input.status,
      input.providerRequestId ?? null,
      input.providerResponseId ?? null,
      normalizeAiLogInteger(input.inputTokens),
      normalizeAiLogInteger(input.outputTokens),
      normalizeAiLogInteger(input.totalTokens),
      normalizeAiLogInteger(input.inputChars),
      normalizeAiLogInteger(input.outputChars),
      normalizeAiLogInteger(input.imageCount),
      normalizeAiLogInteger(input.embeddingDimensions),
      normalizeAiLogDuration(input.durationMs),
      normalizeAiLogAttempt(input.attempt),
      input.errorCode ?? null,
      normalizeAiLogErrorMessage(input.errorMessage),
      JSON.stringify(input.metadata ?? {}),
    ]
  );

  return { id: result.rows[0]?.id ?? "" };
}

export function normalizeAiLogInteger(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.round(value));
}

export function normalizeAiLogDuration(value: number) {
  return Math.max(0, Math.round(value));
}

export function normalizeAiLogAttempt(value: number | null | undefined) {
  return Math.max(1, Math.round(value ?? 1));
}

export function normalizeAiLogErrorMessage(value: string | null | undefined) {
  return value ? value.slice(0, 500) : null;
}
