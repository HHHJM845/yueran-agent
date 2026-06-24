import { AppError } from "@/lib/errors";
import { query, withTransaction } from "@/lib/db";

export type GeneratedImageReviewStatus = "pending" | "confirmed" | "discarded";

export type GeneratedImageView = {
  id: string;
  projectId: string;
  directionId: string | null;
  expansionId: string | null;
  prompt: string;
  provider: string;
  modelName: string;
  status: string;
  ossKey: string | null;
  ossUrl: string | null;
  failureReason: string | null;
  retryCount: number;
  reviewStatus: GeneratedImageReviewStatus;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  sourceJobId: string | null;
  updatedAt: string;
};

type GeneratedImageRow = {
  id: string;
  project_id: string;
  direction_id: string | null;
  expansion_id: string | null;
  prompt: string;
  provider: string;
  model_name: string;
  status: string;
  oss_key: string | null;
  oss_url: string | null;
  failure_reason: string | null;
  retry_count: number;
  review_status: GeneratedImageReviewStatus;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  source_job_id: string | null;
  updated_at: string;
};

export async function listProjectGeneratedImages(projectId: string) {
  const result = await query<GeneratedImageRow>(
    `select id, project_id, direction_id, expansion_id, prompt, provider, model_name,
            status, oss_key, oss_url, failure_reason, retry_count, review_status, review_note,
            reviewed_by, reviewed_at, source_job_id, updated_at
     from generated_images
     where project_id = $1
     order by updated_at desc
     limit 100`,
    [projectId]
  );

  return result.rows.map(mapGeneratedImage);
}

export async function createGeneratedImage(input: {
  projectId: string;
  directionId?: string | null;
  expansionId?: string | null;
  prompt: string;
  provider: string;
  modelName: string;
  status?: string;
  sourceJobId?: string | null;
  createdBy?: string | null;
}) {
  const result = await query<GeneratedImageRow>(
    `insert into generated_images (
       project_id, direction_id, expansion_id, prompt, provider, model_name,
       status, source_job_id, created_by
     )
     values (
       $1, $2, $3, $4, $5, $6, $7, $8,
       case when exists (select 1 from users where id = $9::uuid) then $9::uuid else null end
     )
     returning id, project_id, direction_id, expansion_id, prompt, provider, model_name,
               status, oss_key, oss_url, failure_reason, retry_count, review_status, review_note,
               reviewed_by, reviewed_at, source_job_id, updated_at`,
    [
      input.projectId,
      input.directionId ?? null,
      input.expansionId ?? null,
      input.prompt,
      input.provider,
      input.modelName,
      input.status ?? "queued",
      input.sourceJobId ?? null,
      input.createdBy ?? null,
    ]
  );

  return mapGeneratedImage(result.rows[0]);
}

export async function updateGeneratedImageSourceJob(input: { id: string; sourceJobId: string }) {
  await query(
    `update generated_images
     set source_job_id = $2,
         updated_at = now()
     where id = $1`,
    [input.id, input.sourceJobId]
  );
}

export async function markGeneratedImageProcessing(input: { id: string }) {
  await query(
    `update generated_images
     set status = 'processing',
         failure_reason = null,
         updated_at = now()
     where id = $1`,
    [input.id]
  );
}

export async function markGeneratedImageSucceeded(input: { id: string; ossKey: string; ossUrl: string }) {
  const result = await query<GeneratedImageRow>(
    `update generated_images
     set status = 'succeeded',
         oss_key = $2,
         oss_url = $3,
         failure_reason = null,
         updated_at = now()
     where id = $1
     returning id, project_id, direction_id, expansion_id, prompt, provider, model_name,
               status, oss_key, oss_url, failure_reason, retry_count, review_status, review_note,
               reviewed_by, reviewed_at, source_job_id, updated_at`,
    [input.id, input.ossKey, input.ossUrl]
  );

  return result.rows[0] ? mapGeneratedImage(result.rows[0]) : null;
}

export async function markGeneratedImageFailed(input: { id: string; failureReason: string }) {
  await query(
    `update generated_images
     set status = 'failed',
         failure_reason = $2,
         retry_count = retry_count + 1,
         updated_at = now()
     where id = $1`,
    [input.id, input.failureReason]
  );
}

export async function reviewGeneratedImageRecord(input: {
  projectId: string;
  imageId: string;
  reviewStatus: Exclude<GeneratedImageReviewStatus, "pending">;
  reviewNote: string | null;
  actorId: string;
}) {
  return withTransaction(async (transactionQuery) => {
    const currentResult = await transactionQuery<GeneratedImageRow>(
      `select id, project_id, direction_id, expansion_id, prompt, provider, model_name,
              status, oss_key, oss_url, failure_reason, retry_count, review_status, review_note,
              reviewed_by, reviewed_at, source_job_id, updated_at
       from generated_images
       where project_id = $1
         and id = $2
       for update`,
      [input.projectId, input.imageId]
    );
    const current = currentResult.rows[0];

    if (!current) {
      throw new AppError({
        status: 404,
        code: "generated_image_not_found",
        userMessage: "没有找到这张氛围图。它可能已被删除，或不属于当前项目。",
      });
    }

    assertGeneratedImageReviewable(current.status);

    const updatedResult = await transactionQuery<GeneratedImageRow>(
      `update generated_images
       set review_status = $3,
           review_note = $4,
           reviewed_by = $5,
           reviewed_at = now(),
           updated_at = now()
       where project_id = $1
         and id = $2
       returning id, project_id, direction_id, expansion_id, prompt, provider, model_name,
                 status, oss_key, oss_url, failure_reason, retry_count, review_status, review_note,
                 reviewed_by, reviewed_at, source_job_id, updated_at`,
      [input.projectId, input.imageId, input.reviewStatus, input.reviewNote, input.actorId]
    );
    const updated = updatedResult.rows[0];

    await transactionQuery(
      `insert into audit_logs (actor_id, project_id, action, object_type, object_id, before_json, after_json)
       values ($1, $2, 'generated_image.review_updated', 'generated_image', $3, $4::jsonb, $5::jsonb)`,
      [
        input.actorId,
        input.projectId,
        input.imageId,
        JSON.stringify({
          reviewStatus: current.review_status,
          reviewNote: current.review_note,
          reviewedBy: current.reviewed_by,
          reviewedAt: current.reviewed_at,
        }),
        JSON.stringify({
          projectId: input.projectId,
          reviewStatus: updated.review_status,
          reviewNote: updated.review_note,
          reviewedBy: updated.reviewed_by,
          reviewedAt: updated.reviewed_at,
        }),
      ]
    );

    return mapGeneratedImage(updated);
  });
}

export function assertGeneratedImageReviewable(status: string) {
  if (status !== "succeeded") {
    throw new AppError({
      status: 422,
      code: "generated_image_not_ready_for_review",
      userMessage: "这张氛围图尚未生成成功，暂时不能确认或废弃。请等待生成完成，失败时可重新发起生成。",
    });
  }
}

function mapGeneratedImage(row: GeneratedImageRow): GeneratedImageView {
  return {
    id: row.id,
    projectId: row.project_id,
    directionId: row.direction_id,
    expansionId: row.expansion_id,
    prompt: row.prompt,
    provider: row.provider,
    modelName: row.model_name,
    status: row.status,
    ossKey: row.oss_key,
    ossUrl: row.oss_url,
    failureReason: row.failure_reason,
    retryCount: row.retry_count,
    reviewStatus: row.review_status,
    reviewNote: row.review_note,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    sourceJobId: row.source_job_id,
    updatedAt: row.updated_at,
  };
}
