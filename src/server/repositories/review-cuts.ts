import { query, withTransaction } from "@/lib/db";
import type { StoryboardSceneView, StoryboardShotView } from "@/server/repositories/story-production";

export type ReviewCutType = "a_copy" | "b_copy";
export type ReviewCutStatus =
  | "uploaded"
  | "internal_review"
  | "internal_approved"
  | "client_reviewing"
  | "client_approved"
  | "client_rejected"
  | "revision_required"
  | "archived";

export type ReviewCutView = {
  id: string;
  projectId: string;
  cutType: ReviewCutType;
  title: string;
  description: string;
  assetId: string | null;
  videoUrl: string | null;
  durationSeconds: number | null;
  status: ReviewCutStatus;
  version: number;
  clientReviewTaskId: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReviewCutAnnotationView = {
  id: string;
  projectId: string;
  reviewCutId: string;
  reviewTaskId: string | null;
  timeSeconds: number;
  feedback: string;
  mappedSceneId: string | null;
  mappedShotId: string | null;
  mappingConfidence: number | null;
  status: string;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
};

type ReviewCutRow = {
  id: string;
  project_id: string;
  cut_type: ReviewCutType;
  title: string;
  description: string;
  asset_id: string | null;
  video_url: string | null;
  duration_seconds: string | null;
  status: ReviewCutStatus;
  version: number;
  client_review_task_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type ReviewCutAnnotationRow = {
  id: string;
  project_id: string;
  review_cut_id: string;
  review_task_id: string | null;
  time_seconds: string;
  feedback: string;
  mapped_scene_id: string | null;
  mapped_shot_id: string | null;
  mapping_confidence: string | null;
  status: string;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export async function listProjectReviewCuts(projectId: string) {
  const result = await query<ReviewCutRow>(
    `select id, project_id, cut_type, title, description, asset_id, video_url, duration_seconds,
            status, version, client_review_task_id, reviewed_by, reviewed_at, created_at, updated_at
     from review_cuts
     where project_id = $1 and status <> 'archived'
     order by cut_type, version desc, updated_at desc`,
    [projectId]
  );
  return result.rows.map(mapReviewCut);
}

export async function getReviewCut(input: { projectId: string; reviewCutId: string }) {
  const result = await query<ReviewCutRow>(
    `select id, project_id, cut_type, title, description, asset_id, video_url, duration_seconds,
            status, version, client_review_task_id, reviewed_by, reviewed_at, created_at, updated_at
     from review_cuts
     where project_id = $1 and id = $2 and status <> 'archived'
     limit 1`,
    [input.projectId, input.reviewCutId]
  );
  return result.rows[0] ? mapReviewCut(result.rows[0]) : null;
}

export async function getLatestReviewCut(input: { projectId: string; cutType: ReviewCutType }) {
  const result = await query<ReviewCutRow>(
    `select id, project_id, cut_type, title, description, asset_id, video_url, duration_seconds,
            status, version, client_review_task_id, reviewed_by, reviewed_at, created_at, updated_at
     from review_cuts
     where project_id = $1 and cut_type = $2 and status <> 'archived'
     order by version desc, updated_at desc
     limit 1`,
    [input.projectId, input.cutType]
  );
  return result.rows[0] ? mapReviewCut(result.rows[0]) : null;
}

export async function listProjectReviewCutAnnotations(projectId: string) {
  const result = await query<ReviewCutAnnotationRow>(
    `select id, project_id, review_cut_id, review_task_id, time_seconds, feedback,
            mapped_scene_id, mapped_shot_id, mapping_confidence, status, created_by_name,
            created_at, updated_at
     from review_cut_annotations
     where project_id = $1
     order by created_at desc
     limit 500`,
    [projectId]
  );
  return result.rows.map(mapAnnotation);
}

export async function createReviewCut(input: {
  projectId: string;
  cutType: ReviewCutType;
  title: string;
  description?: string;
  assetId?: string | null;
  videoUrl?: string | null;
  durationSeconds?: number | null;
  createdBy: string;
}) {
  const version = await getNextReviewCutVersion(input.projectId, input.cutType);
  const result = await query<ReviewCutRow>(
    `insert into review_cuts (
       project_id, cut_type, title, description, asset_id, video_url, duration_seconds,
       status, version, created_by
     )
     values ($1, $2, $3, $4, $5, $6, $7, 'uploaded', $8, $9)
     returning id, project_id, cut_type, title, description, asset_id, video_url, duration_seconds,
               status, version, client_review_task_id, reviewed_by, reviewed_at, created_at, updated_at`,
    [
      input.projectId,
      input.cutType,
      input.title,
      input.description ?? "",
      input.assetId ?? null,
      input.videoUrl ?? null,
      input.durationSeconds ?? null,
      version,
      input.createdBy,
    ]
  );
  return mapReviewCut(result.rows[0]);
}

export async function markReviewCutInternalApproved(input: {
  projectId: string;
  reviewCutId: string;
  actorId: string;
}) {
  const result = await query<ReviewCutRow>(
    `update review_cuts
     set status = 'internal_approved',
         reviewed_by = $3,
         reviewed_at = now(),
         updated_at = now()
     where project_id = $1 and id = $2
     returning id, project_id, cut_type, title, description, asset_id, video_url, duration_seconds,
               status, version, client_review_task_id, reviewed_by, reviewed_at, created_at, updated_at`,
    [input.projectId, input.reviewCutId, input.actorId]
  );
  return result.rows[0] ? mapReviewCut(result.rows[0]) : null;
}

export async function markReviewCutClientReviewing(input: {
  projectId: string;
  reviewCutId: string;
  reviewTaskId: string;
}) {
  const result = await query<ReviewCutRow>(
    `update review_cuts
     set status = 'client_reviewing',
         client_review_task_id = $3,
         updated_at = now()
     where project_id = $1 and id = $2
     returning id, project_id, cut_type, title, description, asset_id, video_url, duration_seconds,
               status, version, client_review_task_id, reviewed_by, reviewed_at, created_at, updated_at`,
    [input.projectId, input.reviewCutId, input.reviewTaskId]
  );
  return result.rows[0] ? mapReviewCut(result.rows[0]) : null;
}

export async function applyReviewCutClientDecision(input: {
  projectId: string;
  reviewCutId: string;
  approved: boolean;
}) {
  const status: ReviewCutStatus = input.approved ? "client_approved" : "client_rejected";
  const result = await query<ReviewCutRow>(
    `update review_cuts
     set status = $3,
         updated_at = now()
     where project_id = $1 and id = $2
     returning id, project_id, cut_type, title, description, asset_id, video_url, duration_seconds,
               status, version, client_review_task_id, reviewed_by, reviewed_at, created_at, updated_at`,
    [input.projectId, input.reviewCutId, status]
  );
  return result.rows[0] ? mapReviewCut(result.rows[0]) : null;
}

export async function createReviewCutAnnotations(input: {
  projectId: string;
  reviewCutId: string;
  reviewTaskId: string;
  reviewerName?: string | null;
  annotations: Array<{
    timeSeconds: number;
    feedback: string;
    mappedSceneId?: string | null;
    mappedShotId?: string | null;
    mappingConfidence?: number | null;
  }>;
}) {
  return withTransaction(async (tx) => {
    await tx(`delete from review_cut_annotations where project_id = $1 and review_task_id = $2`, [
      input.projectId,
      input.reviewTaskId,
    ]);
    const saved: ReviewCutAnnotationView[] = [];
    for (const annotation of input.annotations) {
      const status = annotation.mappedShotId || annotation.mappedSceneId ? "mapped" : "needs_triage";
      const result = await tx<ReviewCutAnnotationRow>(
        `insert into review_cut_annotations (
           project_id, review_cut_id, review_task_id, time_seconds, feedback,
           mapped_scene_id, mapped_shot_id, mapping_confidence, status, created_by_name
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         returning id, project_id, review_cut_id, review_task_id, time_seconds, feedback,
                   mapped_scene_id, mapped_shot_id, mapping_confidence, status, created_by_name,
                   created_at, updated_at`,
        [
          input.projectId,
          input.reviewCutId,
          input.reviewTaskId,
          annotation.timeSeconds,
          annotation.feedback,
          annotation.mappedSceneId ?? null,
          annotation.mappedShotId ?? null,
          annotation.mappingConfidence ?? null,
          status,
          input.reviewerName ?? null,
        ]
      );
      saved.push(mapAnnotation(result.rows[0]));
    }
    return saved;
  });
}

export function mapTimecodeToStoryboard(input: {
  timeSeconds: number;
  scenes: StoryboardSceneView[];
  shots: StoryboardShotView[];
}) {
  let cursor = 0;
  const orderedScenes = [...input.scenes].sort((left, right) => left.sceneNumber - right.sceneNumber);
  for (const scene of orderedScenes) {
    const sceneShots = input.shots
      .filter((shot) => shot.sceneId === scene.id)
      .sort((left, right) => left.sortOrder - right.sortOrder);
    for (const shot of sceneShots) {
      const duration = Math.max(Number(shot.durationSeconds ?? 4), 1);
      const start = cursor;
      const end = cursor + duration;
      if (input.timeSeconds >= start && input.timeSeconds < end) {
        return {
          sceneId: scene.id,
          shotId: shot.id,
          confidence: 0.72,
        };
      }
      cursor = end;
    }
  }

  const lastScene = orderedScenes.at(-1);
  const lastShot = lastScene
    ? input.shots
        .filter((shot) => shot.sceneId === lastScene.id)
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .at(-1)
    : null;

  return {
    sceneId: lastScene?.id ?? null,
    shotId: lastShot?.id ?? null,
    confidence: lastShot ? 0.38 : null,
  };
}

async function getNextReviewCutVersion(projectId: string, cutType: ReviewCutType) {
  const result = await query<{ next_version: number }>(
    `select coalesce(max(version), 0) + 1 as next_version
     from review_cuts
     where project_id = $1 and cut_type = $2`,
    [projectId, cutType]
  );
  return Number(result.rows[0]?.next_version ?? 1);
}

function mapReviewCut(row: ReviewCutRow): ReviewCutView {
  return {
    id: row.id,
    projectId: row.project_id,
    cutType: row.cut_type,
    title: row.title,
    description: row.description,
    assetId: row.asset_id,
    videoUrl: row.video_url,
    durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
    status: row.status,
    version: row.version,
    clientReviewTaskId: row.client_review_task_id,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAnnotation(row: ReviewCutAnnotationRow): ReviewCutAnnotationView {
  return {
    id: row.id,
    projectId: row.project_id,
    reviewCutId: row.review_cut_id,
    reviewTaskId: row.review_task_id,
    timeSeconds: Number(row.time_seconds),
    feedback: row.feedback,
    mappedSceneId: row.mapped_scene_id,
    mappedShotId: row.mapped_shot_id,
    mappingConfidence: row.mapping_confidence === null ? null : Number(row.mapping_confidence),
    status: row.status,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
