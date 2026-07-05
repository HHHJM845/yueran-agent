import { randomUUID } from "node:crypto";
import { query } from "@/lib/db";
import type { JobEvent, JobSummary, JobType } from "@/domain/types";

type JobEventRow = {
  id: string;
  sequence: number;
  type: string;
  payload_json: JobEvent;
  created_at: string;
};

type JobRow = {
  id: string;
  project_id: string;
  type: JobType;
  status: JobSummary["status"];
  title: string;
  provider: string | null;
  model_name: string | null;
  input_json: unknown;
  current_step: string | null;
  priority: number;
  max_attempts: number;
  retry_count: number;
  user_message: string | null;
  created_at: string;
  updated_at: string;
};

export type ClaimedJob = JobSummary & {
  input: unknown;
  maxAttempts: number;
};

export async function createJob(input: {
  projectId: string;
  type: JobType;
  title: string;
  provider?: string | null;
  modelName?: string | null;
  inputJson?: unknown;
  priority?: number;
  maxAttempts?: number;
  createdBy?: string | null;
}) {
  const jobId = randomUUID();
  await query(
    `insert into jobs (
       id, project_id, type, status, title, provider, model_name, input_json,
       priority, max_attempts, available_at, created_by, created_at, updated_at
     )
     values ($1, $2, $3, 'queued', $4, $5, $6, $7::jsonb, $8, $9, now(), $10, now(), now())`,
    [
      jobId,
      input.projectId,
      input.type,
      input.title,
      input.provider ?? null,
      input.modelName ?? null,
      JSON.stringify(input.inputJson ?? {}),
      input.priority ?? 0,
      input.maxAttempts ?? 2,
      input.createdBy ?? null,
    ]
  );
  await appendJobEvent(jobId, {
    type: "job.queued",
    jobId,
    projectId: input.projectId,
    title: input.title,
    payload: { jobType: input.type, provider: input.provider ?? null, modelName: input.modelName ?? null },
    userMessage: "任务已进入队列，等待服务端开始处理。",
    at: new Date().toISOString(),
  });
  return { jobId };
}

export async function appendJobEvent(jobId: string, event: JobEvent) {
  await query(
    `insert into job_events (job_id, type, payload_json)
     values ($1, $2, $3::jsonb)`,
    [jobId, event.type, JSON.stringify(event)]
  );
}

export async function updateJobStatus(
  jobId: string,
  input: {
    status: JobSummary["status"];
    currentStep?: string | null;
    userMessage?: string | null;
    errorCode?: string | null;
  }
) {
  await query(
    `update jobs
     set status = $2,
         current_step = $3,
         user_message = $4,
         error_code = $5,
         locked_by = case when $2 in ('succeeded', 'failed', 'cancelled') then null else locked_by end,
         locked_at = case when $2 in ('succeeded', 'failed', 'cancelled') then null else locked_at end,
         lock_expires_at = case when $2 in ('succeeded', 'failed', 'cancelled') then null else lock_expires_at end,
         completed_at = case when $2 = 'succeeded' then now() else completed_at end,
         failed_at = case when $2 = 'failed' then now() else failed_at end,
         updated_at = now()
     where id = $1`,
    [jobId, input.status, input.currentStep ?? null, input.userMessage ?? null, input.errorCode ?? null]
  );
}

export async function updateJobInput(jobId: string, inputJson: unknown) {
  await query(
    `update jobs
     set input_json = $2::jsonb,
         updated_at = now()
     where id = $1`,
    [jobId, JSON.stringify(inputJson)]
  );
}

export async function getJob(jobId: string): Promise<JobSummary | null> {
  const result = await query<JobRow>(
    `select id, project_id, type, status, title, provider, model_name, current_step,
            priority, max_attempts, retry_count, user_message, created_at, updated_at
     from jobs
     where id = $1`,
    [jobId]
  );

  const row = result.rows[0];
  return row ? mapJob(row) : null;
}

export async function getJobInput<TInput>(jobId: string) {
  const result = await query<Pick<JobRow, "id" | "project_id" | "type" | "input_json">>(
    `select id, project_id, type, input_json
     from jobs
     where id = $1`,
    [jobId]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type,
    input: row.input_json as TInput,
  };
}

export async function listProjectJobs(projectId: string): Promise<JobSummary[]> {
  const result = await query<JobRow>(
    `select id, project_id, type, status, title, provider, model_name, current_step,
            priority, max_attempts, retry_count, user_message, created_at, updated_at
     from jobs
     where project_id = $1
     order by updated_at desc
     limit 50`,
    [projectId]
  );

  return result.rows.map(mapJob);
}

export async function claimNextRunnableJob(input: { workerId: string; lockSeconds?: number }): Promise<ClaimedJob | null> {
  const result = await query<JobRow>(
    `with candidate as (
       select id
       from jobs
       where status in ('queued', 'retrying')
         and available_at <= now()
       order by priority desc, created_at asc
       for update skip locked
       limit 1
     )
     update jobs
     set status = 'processing',
         locked_by = $1,
         locked_at = now(),
         lock_expires_at = now() + ($2::text || ' seconds')::interval,
         started_at = coalesce(started_at, now()),
         current_step = 'claimed_by_worker',
         user_message = '任务已被后台 worker 领取，正在准备处理。',
         updated_at = now()
     from candidate
     where jobs.id = candidate.id
     returning jobs.id, jobs.project_id, jobs.type, jobs.status, jobs.title, jobs.provider, jobs.model_name,
               jobs.input_json, jobs.current_step, jobs.priority, jobs.max_attempts, jobs.retry_count,
               jobs.user_message, jobs.created_at, jobs.updated_at`,
    [input.workerId, input.lockSeconds ?? 240]
  );

  const row = result.rows[0];
  if (!row) return null;
  return { ...mapJob(row), input: row.input_json, maxAttempts: row.max_attempts };
}

export async function extendJobLock(input: { jobId: string; workerId: string; lockSeconds?: number }) {
  await query(
    `update jobs
     set lock_expires_at = now() + ($3::text || ' seconds')::interval,
         updated_at = now()
     where id = $1 and locked_by = $2 and status = 'processing'`,
    [input.jobId, input.workerId, input.lockSeconds ?? 240]
  );
}

export async function scheduleJobRetry(input: {
  jobId: string;
  projectId: string;
  userMessage: string;
  errorCode: string;
  delaySeconds?: number;
}) {
  const result = await query<{ status: JobSummary["status"]; retry_count: number }>(
    `update jobs
     set status = case when retry_count + 1 >= max_attempts then 'failed' else 'retrying' end,
         retry_count = retry_count + 1,
         available_at = now() + ($4::text || ' seconds')::interval,
         current_step = case when retry_count + 1 >= max_attempts then 'failed' else 'waiting_retry' end,
         user_message = $2,
         error_code = $3,
         locked_by = null,
         locked_at = null,
         lock_expires_at = null,
         failed_at = case when retry_count + 1 >= max_attempts then now() else failed_at end,
         updated_at = now()
     where id = $1
     returning status, retry_count`,
    [input.jobId, input.userMessage, input.errorCode, input.delaySeconds ?? 60]
  );

  const status = result.rows[0]?.status;
  await appendJobEvent(input.jobId, {
    type: status === "failed" ? "job.failed" : "job.retrying",
    jobId: input.jobId,
    projectId: input.projectId,
    title: status === "failed" ? "任务失败" : "任务将自动重试",
    userMessage: input.userMessage,
    recoverable: status !== "failed",
    at: new Date().toISOString(),
  });

  return result.rows[0] ?? null;
}

export async function recoverExpiredProcessingJobs() {
  const result = await query<Pick<JobRow, "id" | "project_id"> & { status: JobSummary["status"] }>(
    `update jobs
     set status = case when retry_count + 1 >= max_attempts then 'failed' else 'retrying' end,
         retry_count = retry_count + 1,
         available_at = now() + interval '60 seconds',
         current_step = case when retry_count + 1 >= max_attempts then 'failed' else 'waiting_retry' end,
         user_message = case
           when retry_count + 1 >= max_attempts
             then '后台任务超过可恢复时间，系统已停止处理。请重新发起任务或联系管理员。'
           else '后台任务处理超时，系统已自动安排重试。'
         end,
         error_code = 'job_lock_expired',
         locked_by = null,
         locked_at = null,
         lock_expires_at = null,
         failed_at = case when retry_count + 1 >= max_attempts then now() else failed_at end,
         updated_at = now()
     where status = 'processing'
       and lock_expires_at is not null
       and lock_expires_at < now()
     returning id, project_id, status`,
    []
  );

  for (const row of result.rows) {
    await appendJobEvent(row.id, {
      type: row.status === "failed" ? "job.failed" : "job.retrying",
      jobId: row.id,
      projectId: row.project_id,
      title: "后台任务处理超时",
      userMessage: row.status === "failed" ? "任务处理超时并已达到最大重试次数。" : "任务处理超时，系统已自动安排重试。",
      recoverable: row.status !== "failed",
      at: new Date().toISOString(),
    });
  }

  return result.rowCount;
}

export async function retryFailedJobNow(jobId: string) {
  const result = await query<Pick<JobRow, "id" | "project_id">>(
    `update jobs
     set status = 'queued',
         available_at = now(),
         current_step = 'waiting_retry',
         user_message = '任务已重新进入队列，等待后台 worker 处理。',
         error_code = null,
         failed_at = null,
         locked_by = null,
         locked_at = null,
         lock_expires_at = null,
         updated_at = now()
     where id = $1 and status = 'failed'
     returning id, project_id`,
    [jobId]
  );

  const row = result.rows[0];
  if (!row) return false;

  await appendJobEvent(jobId, {
    type: "job.retrying",
    jobId,
    projectId: row.project_id,
    title: "任务已重新入队",
    userMessage: "任务已重新进入队列，后台 worker 会按顺序处理。",
    recoverable: true,
    at: new Date().toISOString(),
  });

  return true;
}

export async function cancelQueuedJob(jobId: string) {
  const result = await query<Pick<JobRow, "id" | "project_id">>(
    `update jobs
     set status = 'cancelled',
         current_step = 'cancelled',
         user_message = '任务已取消。已开始处理的任务不能直接取消，请等待其完成或失败后再决定是否重试。',
         locked_by = null,
         locked_at = null,
         lock_expires_at = null,
         updated_at = now()
     where id = $1 and status in ('queued', 'retrying')
     returning id, project_id`,
    [jobId]
  );

  const row = result.rows[0];
  if (!row) return false;

  await appendJobEvent(jobId, {
    type: "job.cancelled",
    jobId,
    projectId: row.project_id,
    title: "任务已取消",
    userMessage: "任务已从队列中取消，后台 worker 不会继续处理。",
    recoverable: false,
    at: new Date().toISOString(),
  });

  return true;
}

export async function listJobEvents(jobId: string, afterSequence = 0) {
  const result = await query<JobEventRow>(
    `select id, sequence, type, payload_json, created_at
     from job_events
     where job_id = $1 and sequence > $2
     order by sequence asc
     limit 200`,
    [jobId, afterSequence]
  );

  return result.rows.map((row) => ({
    id: row.sequence.toString(),
    event: { ...row.payload_json, id: row.id, sequence: row.sequence },
  }));
}

function mapJob(row: JobRow): JobSummary {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type,
    status: row.status,
    title: row.title,
    provider: row.provider,
    modelName: row.model_name,
    currentStep: row.current_step,
    retryCount: row.retry_count,
    userMessage: row.user_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
