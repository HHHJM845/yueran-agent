import { query } from "@/lib/db";
import type { JobStatus, JobType } from "@/domain/types";

type DiagnosticJob = {
  id: string;
  projectId: string;
  type: JobType | string;
  status: JobStatus | string;
  title: string;
  provider: string | null;
  modelName: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
};

type DiagnosticAiTaskLog = {
  id: string;
  provider: string;
  modelName: string;
  operation: string;
  status: "succeeded" | "failed";
  durationMs: number;
  createdAt: string;
};

export type StandaloneAiTaskLatencyDiagnostic = DiagnosticAiTaskLog & {
  projectId: string;
  callId: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  inputChars: number | null;
  outputChars: number | null;
  imageCount: number | null;
  errorCode: string | null;
  hasRequestTotal: false;
  requestTotalMs: null;
  nonModelRequestMs: null;
};

type DiagnosticInput = {
  job: DiagnosticJob;
  aiTaskLogs: DiagnosticAiTaskLog[];
  observedAt?: string;
};

export type JobLatencySegmentKey = "queue_wait" | "worker_non_model" | "model_call";

export type JobLatencySegment = {
  key: JobLatencySegmentKey;
  label: string;
  durationMs: number;
};

export type JobLatencyDiagnostic = {
  job: DiagnosticJob;
  aiTaskLogs: DiagnosticAiTaskLog[];
  totalMs: number;
  queueWaitMs: number | null;
  workerTotalMs: number | null;
  modelTotalMs: number;
  nonModelWorkerMs: number | null;
  modelShare: number | null;
  bottleneck: JobLatencySegmentKey | "unknown";
  isComplete: boolean;
  missing: string[];
  segments: JobLatencySegment[];
};

type JobDiagnosticRow = {
  id: string;
  project_id: string;
  type: string;
  status: string;
  title: string;
  provider: string | null;
  model_name: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
};

type AiTaskLogDiagnosticRow = {
  id: string;
  provider: string;
  model_name: string;
  operation: string;
  status: "succeeded" | "failed";
  duration_ms: number;
  created_at: string;
};

type StandaloneAiTaskLogDiagnosticRow = AiTaskLogDiagnosticRow & {
  project_id: string;
  call_id: string;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  input_chars: number | null;
  output_chars: number | null;
  image_count: number | null;
  error_code: string | null;
};

const segmentLabels: Record<JobLatencySegmentKey, string> = {
  queue_wait: "队列等待",
  worker_non_model: "非模型处理",
  model_call: "大模型调用",
};

export function buildJobLatencyDiagnostic(input: DiagnosticInput): JobLatencyDiagnostic {
  const observedAt = input.observedAt ?? new Date().toISOString();
  const createdAtMs = toTimestamp(input.job.createdAt);
  const startedAtMs = input.job.startedAt ? toTimestamp(input.job.startedAt) : null;
  const finishedAtValue = input.job.completedAt ?? input.job.failedAt;
  const finishedAtMs = finishedAtValue ? toTimestamp(finishedAtValue) : null;
  const observedAtMs = toTimestamp(observedAt);

  const totalEndMs = finishedAtMs ?? observedAtMs;
  const totalMs = clampDuration(totalEndMs - createdAtMs);
  const queueWaitMs = startedAtMs === null ? totalMs : clampDuration(startedAtMs - createdAtMs);
  const workerTotalMs = startedAtMs === null ? null : clampDuration((finishedAtMs ?? observedAtMs) - startedAtMs);
  const modelTotalMs = input.aiTaskLogs.reduce((sum, log) => sum + clampDuration(log.durationMs), 0);
  const nonModelWorkerMs = workerTotalMs === null ? null : Math.max(0, workerTotalMs - modelTotalMs);
  const modelShare = workerTotalMs && workerTotalMs > 0 ? roundRatio(modelTotalMs / workerTotalMs) : null;
  const missing = [
    input.job.startedAt ? null : "startedAt",
    finishedAtValue ? null : "completedAt",
  ].filter((value): value is string => Boolean(value));
  const segments = buildSegments({ queueWaitMs, nonModelWorkerMs, modelTotalMs });

  return {
    job: input.job,
    aiTaskLogs: input.aiTaskLogs,
    totalMs,
    queueWaitMs,
    workerTotalMs,
    modelTotalMs,
    nonModelWorkerMs,
    modelShare,
    bottleneck: resolveBottleneck(segments),
    isComplete: missing.length === 0 && (input.job.status === "succeeded" || input.job.status === "failed"),
    missing,
    segments,
  };
}

export async function getJobLatencyDiagnostic(jobId: string): Promise<JobLatencyDiagnostic | null> {
  const jobResult = await query<JobDiagnosticRow>(
    `select id, project_id, type, status, title, provider, model_name,
            created_at, started_at, completed_at, failed_at
       from jobs
      where id = $1
      limit 1`,
    [jobId]
  );
  const job = jobResult.rows[0];
  if (!job) return null;

  const logResult = await query<AiTaskLogDiagnosticRow>(
    `select id, provider, model_name, operation, status, duration_ms, created_at
       from ai_task_logs
      where job_id = $1
      order by created_at asc`,
    [jobId]
  );

  return buildJobLatencyDiagnostic({
    job: mapJobDiagnosticRow(job),
    aiTaskLogs: logResult.rows.map(mapAiTaskLogDiagnosticRow),
  });
}

export async function listProjectJobLatencyDiagnostics(input: {
  projectId: string;
  limit?: number;
  type?: string | null;
}): Promise<JobLatencyDiagnostic[]> {
  const limit = Math.max(1, Math.min(50, Math.floor(input.limit ?? 20)));
  const params: unknown[] = [input.projectId, limit];
  const typeFilter = input.type ? "and type = $3" : "";
  if (input.type) params.push(input.type);

  const jobResult = await query<JobDiagnosticRow>(
    `select id, project_id, type, status, title, provider, model_name,
            created_at, started_at, completed_at, failed_at
       from jobs
      where project_id = $1
        ${typeFilter}
      order by created_at desc
      limit $2`,
    params
  );

  const diagnostics: JobLatencyDiagnostic[] = [];
  for (const row of jobResult.rows) {
    const diagnostic = await getJobLatencyDiagnostic(row.id);
    if (diagnostic) diagnostics.push(diagnostic);
  }
  return diagnostics;
}

export async function listProjectStandaloneAiTaskLatencyDiagnostics(input: {
  projectId: string;
  limit?: number;
  operation?: string | null;
}): Promise<StandaloneAiTaskLatencyDiagnostic[]> {
  const limit = Math.max(1, Math.min(100, Math.floor(input.limit ?? 30)));
  const params: unknown[] = [input.projectId, limit];
  const operationFilter = input.operation ? "and operation = $3" : "";
  if (input.operation) params.push(input.operation);

  const result = await query<StandaloneAiTaskLogDiagnosticRow>(
    `select id, project_id, call_id, provider, model_name, operation, status,
            input_tokens, output_tokens, total_tokens, input_chars, output_chars,
            image_count, duration_ms, error_code, created_at
       from ai_task_logs
      where project_id = $1
        and job_id is null
        ${operationFilter}
      order by created_at desc
      limit $2`,
    params
  );

  return result.rows.map(mapStandaloneAiTaskLogDiagnosticRow);
}

function buildSegments(input: {
  queueWaitMs: number | null;
  nonModelWorkerMs: number | null;
  modelTotalMs: number;
}): JobLatencySegment[] {
  const rawSegments: Array<{ key: JobLatencySegmentKey; durationMs: number | null }> = [
    { key: "queue_wait", durationMs: input.queueWaitMs },
    { key: "worker_non_model", durationMs: input.nonModelWorkerMs },
    { key: "model_call", durationMs: input.modelTotalMs },
  ];

  return rawSegments
    .filter((segment): segment is { key: JobLatencySegmentKey; durationMs: number } => typeof segment.durationMs === "number")
    .map((segment) => ({
      key: segment.key,
      label: segmentLabels[segment.key],
      durationMs: clampDuration(segment.durationMs),
    }));
}

function resolveBottleneck(segments: JobLatencySegment[]) {
  if (segments.length === 0) return "unknown";
  return segments.reduce((largest, segment) => (segment.durationMs > largest.durationMs ? segment : largest)).key;
}

function toTimestamp(value: string) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Date.now();
}

function clampDuration(value: number) {
  return Math.max(0, Math.round(value));
}

function roundRatio(value: number) {
  return Math.round(value * 100) / 100;
}

function mapJobDiagnosticRow(row: JobDiagnosticRow): DiagnosticJob {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type,
    status: row.status,
    title: row.title,
    provider: row.provider,
    modelName: row.model_name,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    failedAt: row.failed_at,
  };
}

function mapAiTaskLogDiagnosticRow(row: AiTaskLogDiagnosticRow): DiagnosticAiTaskLog {
  return {
    id: row.id,
    provider: row.provider,
    modelName: row.model_name,
    operation: row.operation,
    status: row.status,
    durationMs: row.duration_ms,
    createdAt: row.created_at,
  };
}

function mapStandaloneAiTaskLogDiagnosticRow(row: StandaloneAiTaskLogDiagnosticRow): StandaloneAiTaskLatencyDiagnostic {
  return {
    ...mapAiTaskLogDiagnosticRow(row),
    projectId: row.project_id,
    callId: row.call_id,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    totalTokens: row.total_tokens,
    inputChars: row.input_chars,
    outputChars: row.output_chars,
    imageCount: row.image_count,
    errorCode: row.error_code,
    hasRequestTotal: false,
    requestTotalMs: null,
    nonModelRequestMs: null,
  };
}
