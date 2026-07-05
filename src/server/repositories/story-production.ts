import { AppError } from "@/lib/errors";
import { query, withTransaction, type TransactionQuery } from "@/lib/db";

export type ScriptPackageStatus =
  | "draft"
  | "internal_review"
  | "client_reviewing"
  | "client_approved"
  | "client_rejected"
  | "locked"
  | "archived";

export type ScriptReferenceType = "character" | "scene";
export type StoryboardSceneStatus =
  | "draft"
  | "image_generating"
  | "internal_review"
  | "ready_for_client_review"
  | "client_reviewing"
  | "client_approved"
  | "client_rejected"
  | "revision_required"
  | "locked"
  | "video_generating"
  | "video_internal_review"
  | "video_confirmed";

export type StoryboardShotStatus =
  | "draft"
  | "internal_review"
  | "client_reviewing"
  | "client_approved"
  | "client_rejected"
  | "image_generating"
  | "image_ready"
  | "image_selected"
  | "video_generating"
  | "video_ready"
  | "video_selected"
  | "locked";

export type StoryboardImageStatus = "queued" | "processing" | "succeeded" | "failed" | "retrying" | "cancelled";
export type InternalReviewStatus = "pending" | "confirmed" | "discarded" | "needs_revision";
export type StoryboardVideoInputMode = "single_image" | "start_end_frame" | "multi_reference";
export type ScriptRevisionRole = "user" | "assistant";
export type ScriptRevisionInputMode = "text" | "voice";

export type ScriptDirectionPackageView = {
  id: string;
  projectId: string;
  directionId: string | null;
  title: string;
  concept: string;
  fullScript: string;
  plainScript: string;
  standardizedScript: string;
  status: ScriptPackageStatus;
  version: number;
  selectedAt: string | null;
  lockedAt: string | null;
  updatedAt: string;
};

export type ScriptRevisionMessageView = {
  id: string;
  projectId: string;
  packageId: string;
  role: ScriptRevisionRole;
  inputMode: ScriptRevisionInputMode;
  content: string;
  createdBy: string | null;
  createdAt: string;
};

export type ScriptReferenceAssetView = {
  id: string;
  projectId: string;
  packageId: string;
  referenceType: ScriptReferenceType;
  title: string;
  styleLabel: string;
  prompt: string;
  assetId: string | null;
  generatedImageId: string | null;
  ossUrl: string | null;
  sortOrder: number;
  status: string;
  updatedAt: string;
};

export type StoryboardSceneView = {
  id: string;
  projectId: string;
  packageId: string | null;
  sceneNumber: number;
  title: string;
  description: string;
  status: StoryboardSceneStatus;
  lockedVersion: number | null;
  updatedAt: string;
};

export type StoryboardShotView = {
  id: string;
  projectId: string;
  sceneId: string;
  packageId: string | null;
  shotNumber: string;
  visualDescription: string;
  shotSize: string;
  actionExpression: string;
  cameraMovement: string;
  durationSeconds: number | null;
  soundTransition: string;
  notes: string;
  characterRefs: unknown[];
  sceneRefs: unknown[];
  imagePrompt: string;
  videoPrompt: string;
  status: StoryboardShotStatus;
  version: number;
  sortOrder: number;
  updatedAt: string;
};

export type StoryboardImageView = {
  id: string;
  projectId: string;
  sceneId: string;
  shotId: string;
  prompt: string;
  provider: string;
  modelName: string;
  generationStatus: StoryboardImageStatus;
  ossKey: string | null;
  ossUrl: string | null;
  assetId: string | null;
  isSelected: boolean;
  internalReviewStatus: InternalReviewStatus;
  failureReason: string | null;
  retryCount: number;
  annotations: unknown[];
  reference: Record<string, unknown>;
  sourceJobId: string | null;
  version: number;
  reviewedBy: string | null;
  reviewedAt: string | null;
  updatedAt: string;
};

export type StoryboardVideoView = {
  id: string;
  projectId: string;
  sceneId: string;
  shotId: string;
  imageId: string | null;
  prompt: string;
  provider: string;
  modelName: string;
  generationStatus: StoryboardImageStatus;
  ossKey: string | null;
  ossUrl: string | null;
  assetId: string | null;
  isSelected: boolean;
  internalReviewStatus: InternalReviewStatus;
  failureReason: string | null;
  retryCount: number;
  sourceJobId: string | null;
  version: number;
  reviewedBy: string | null;
  reviewedAt: string | null;
  updatedAt: string;
};

export type StoryboardVideoGenerationInputView = {
  id: string;
  projectId: string;
  storyboardVideoId: string | null;
  shotId: string | null;
  mode: StoryboardVideoInputMode;
  inputImageIds: string[];
  prompt: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type StoryboardSceneVideoBundleItem = {
  shotNumber: string;
  ossUrl: string;
  fileName: string;
};

type ScriptPackageRow = {
  id: string;
  project_id: string;
  direction_id: string | null;
  title: string;
  concept: string;
  full_script: string;
  plain_script: string;
  standardized_script: string;
  status: ScriptPackageStatus;
  version: number;
  selected_at: string | null;
  locked_at: string | null;
  updated_at: string;
};

type ScriptRevisionMessageRow = {
  id: string;
  project_id: string;
  package_id: string;
  role: ScriptRevisionRole;
  input_mode: ScriptRevisionInputMode;
  content: string;
  created_by: string | null;
  created_at: string;
};

type ReferenceRow = {
  id: string;
  project_id: string;
  package_id: string;
  reference_type: ScriptReferenceType;
  title: string;
  style_label: string;
  prompt: string;
  asset_id: string | null;
  generated_image_id: string | null;
  oss_url: string | null;
  sort_order: number;
  status: string;
  updated_at: string;
};

type SceneRow = {
  id: string;
  project_id: string;
  package_id: string | null;
  scene_number: number;
  title: string;
  description: string;
  status: StoryboardSceneStatus;
  locked_version: number | null;
  updated_at: string;
};

type ShotRow = {
  id: string;
  project_id: string;
  scene_id: string;
  package_id: string | null;
  shot_number: string;
  visual_description: string;
  shot_size: string;
  action_expression: string;
  camera_movement: string;
  duration_seconds: string | null;
  sound_transition: string;
  notes: string;
  character_refs: unknown;
  scene_refs: unknown;
  image_prompt: string;
  video_prompt: string;
  status: StoryboardShotStatus;
  version: number;
  sort_order: number;
  updated_at: string;
};

type StoryboardImageRow = {
  id: string;
  project_id: string;
  scene_id: string;
  shot_id: string;
  prompt: string;
  provider: string;
  model_name: string;
  generation_status: StoryboardImageStatus;
  oss_key: string | null;
  oss_url: string | null;
  asset_id: string | null;
  is_selected: boolean;
  internal_review_status: InternalReviewStatus;
  failure_reason: string | null;
  retry_count: number;
  annotations_json: unknown;
  reference_json: unknown;
  source_job_id: string | null;
  version: number;
  reviewed_by: string | null;
  reviewed_at: string | null;
  updated_at: string;
};

type StoryboardVideoRow = {
  id: string;
  project_id: string;
  scene_id: string;
  shot_id: string;
  image_id: string | null;
  prompt: string;
  provider: string;
  model_name: string;
  generation_status: StoryboardImageStatus;
  oss_key: string | null;
  oss_url: string | null;
  asset_id: string | null;
  is_selected: boolean;
  internal_review_status: InternalReviewStatus;
  failure_reason: string | null;
  retry_count: number;
  source_job_id: string | null;
  version: number;
  reviewed_by: string | null;
  reviewed_at: string | null;
  updated_at: string;
};

type StoryboardVideoGenerationInputRow = {
  id: string;
  project_id: string;
  storyboard_video_id: string | null;
  shot_id: string | null;
  mode: StoryboardVideoInputMode;
  input_image_ids: unknown;
  prompt: string;
  metadata_json: unknown;
  created_at: string;
  updated_at: string;
};

type StoryboardSceneVideoBundleRow = {
  shot_number: string;
  oss_url: string;
  file_name: string | null;
};

const SCRIPT_PACKAGE_COLUMNS = `id, project_id, direction_id, title, concept, full_script,
            plain_script, standardized_script, status, version,
            selected_at, locked_at, updated_at`;

export async function listStoryProduction(projectId: string) {
  const [packages, references, revisionMessages, scenes, shots, storyboardImages, storyboardVideos] = await Promise.all([
    listScriptDirectionPackages(projectId),
    listScriptReferenceAssets(projectId),
    listScriptRevisionMessages(projectId),
    listStoryboardScenes(projectId),
    listStoryboardShots(projectId),
    listStoryboardImages(projectId),
    listStoryboardVideos(projectId),
  ]);

  return {
    scriptPackages: packages,
    scriptReferences: references,
    scriptRevisionMessages: revisionMessages,
    storyboardScenes: scenes,
    storyboardShots: shots,
    storyboardImages,
    storyboardVideos,
  };
}

export async function listScriptDirectionPackages(projectId: string) {
  const result = await query<ScriptPackageRow>(
    `select ${SCRIPT_PACKAGE_COLUMNS}
     from script_direction_packages
     where project_id = $1
       and status <> 'archived'
     order by updated_at desc
     limit 50`,
    [projectId]
  );
  return result.rows.map(mapPackage);
}

export async function getScriptDirectionPackage(input: { projectId: string; packageId: string }) {
  const result = await query<ScriptPackageRow>(
    `select ${SCRIPT_PACKAGE_COLUMNS}
     from script_direction_packages
     where project_id = $1
       and id = $2
       and status <> 'archived'
     limit 1`,
    [input.projectId, input.packageId]
  );
  return result.rows[0] ? mapPackage(result.rows[0]) : null;
}

export async function updateScriptDirectionPackageStatus(input: {
  projectId: string;
  packageId: string;
  status: ScriptPackageStatus;
  actorId?: string | null;
}) {
  const result = await query<ScriptPackageRow>(
    `update script_direction_packages
     set status = $3,
         locked_at = case when $3 = 'locked' then now() else locked_at end,
         updated_by = coalesce($4, updated_by),
         updated_at = now()
     where project_id = $1
       and id = $2
       and status <> 'archived'
     returning ${SCRIPT_PACKAGE_COLUMNS}`,
    [input.projectId, input.packageId, input.status, input.actorId ?? null]
  );
  return result.rows[0] ? mapPackage(result.rows[0]) : null;
}

export async function updateScriptDirectionPackageScript(input: {
  projectId: string;
  packageId: string;
  title?: string | null;
  concept?: string | null;
  fullScript: string;
  status?: ScriptPackageStatus;
  actorId?: string | null;
}) {
  const result = await query<ScriptPackageRow>(
    `update script_direction_packages
     set title = coalesce(nullif($3, ''), title),
         concept = coalesce(nullif($4, ''), concept),
         full_script = $5,
         status = coalesce($6, status),
         version = version + 1,
         updated_by = coalesce($7, updated_by),
         updated_at = now()
     where project_id = $1
       and id = $2
       and status <> 'archived'
     returning ${SCRIPT_PACKAGE_COLUMNS}`,
    [
      input.projectId,
      input.packageId,
      input.title ?? null,
      input.concept ?? null,
      input.fullScript,
      input.status ?? null,
      input.actorId ?? null,
    ]
  );
  return result.rows[0] ? mapPackage(result.rows[0]) : null;
}

export async function createScriptPackageWithPlainScript(input: {
  projectId: string;
  directionId?: string | null;
  title: string;
  concept: string;
  plainScript: string;
  actorId: string;
}) {
  const result = await query<ScriptPackageRow>(
    `insert into script_direction_packages (
       project_id, direction_id, title, concept, plain_script, full_script, status, created_by, updated_by
     )
     values ($1, $2, $3, $4, $5, $5, 'draft', $6, $6)
     returning ${SCRIPT_PACKAGE_COLUMNS}`,
    [input.projectId, input.directionId ?? null, input.title, input.concept, input.plainScript, input.actorId]
  );
  return mapPackage(result.rows[0]);
}

export async function updateScriptPackagePlainAndFullScript(input: {
  projectId: string;
  packageId: string;
  plainScript: string;
  title?: string | null;
  concept?: string | null;
  status?: ScriptPackageStatus;
  actorId?: string | null;
}) {
  const result = await query<ScriptPackageRow>(
    `update script_direction_packages
     set title = coalesce(nullif($4, ''), title),
         concept = coalesce(nullif($5, ''), concept),
         plain_script = $3,
         full_script = $3,
         status = coalesce($6, status),
         version = version + 1,
         updated_by = coalesce($7, updated_by),
         updated_at = now()
     where project_id = $1
       and id = $2
       and status <> 'archived'
     returning ${SCRIPT_PACKAGE_COLUMNS}`,
    [
      input.projectId,
      input.packageId,
      input.plainScript,
      input.title ?? null,
      input.concept ?? null,
      input.status ?? null,
      input.actorId ?? null,
    ]
  );
  return result.rows[0] ? mapPackage(result.rows[0]) : null;
}

export async function updateScriptPackageStandardizedAndFullScript(input: {
  projectId: string;
  packageId: string;
  standardizedScript: string;
  title?: string | null;
  concept?: string | null;
  status?: ScriptPackageStatus;
  actorId?: string | null;
}) {
  const result = await query<ScriptPackageRow>(
    `update script_direction_packages
     set title = coalesce(nullif($4, ''), title),
         concept = coalesce(nullif($5, ''), concept),
         standardized_script = $3,
         full_script = $3,
         status = coalesce($6, status),
         version = version + 1,
         updated_by = coalesce($7, updated_by),
         updated_at = now()
     where project_id = $1
       and id = $2
       and status <> 'archived'
     returning ${SCRIPT_PACKAGE_COLUMNS}`,
    [
      input.projectId,
      input.packageId,
      input.standardizedScript,
      input.title ?? null,
      input.concept ?? null,
      input.status ?? null,
      input.actorId ?? null,
    ]
  );
  return result.rows[0] ? mapPackage(result.rows[0]) : null;
}

export async function updateScriptPackagePlainScript(input: {
  projectId: string;
  packageId: string;
  plainScript: string;
  actorId?: string | null;
}) {
  const result = await query<ScriptPackageRow>(
    `update script_direction_packages
     set plain_script = $3,
         version = version + 1,
         updated_by = coalesce($4, updated_by),
         updated_at = now()
     where project_id = $1
       and id = $2
       and status <> 'archived'
     returning ${SCRIPT_PACKAGE_COLUMNS}`,
    [input.projectId, input.packageId, input.plainScript, input.actorId ?? null]
  );
  return result.rows[0] ? mapPackage(result.rows[0]) : null;
}

export async function updateScriptPackageStandardizedScript(input: {
  projectId: string;
  packageId: string;
  standardizedScript: string;
  actorId?: string | null;
}) {
  const result = await query<ScriptPackageRow>(
    `update script_direction_packages
     set standardized_script = $3,
         version = version + 1,
         updated_by = coalesce($4, updated_by),
         updated_at = now()
     where project_id = $1
       and id = $2
       and status <> 'archived'
     returning ${SCRIPT_PACKAGE_COLUMNS}`,
    [input.projectId, input.packageId, input.standardizedScript, input.actorId ?? null]
  );
  return result.rows[0] ? mapPackage(result.rows[0]) : null;
}

export async function appendScriptRevisionMessage(input: {
  projectId: string;
  packageId: string;
  role: ScriptRevisionRole;
  inputMode?: ScriptRevisionInputMode;
  content: string;
  actorId?: string | null;
}) {
  const result = await query<ScriptRevisionMessageRow>(
    `insert into script_revision_messages (
       project_id, package_id, role, input_mode, content, created_by
     )
     select package.project_id, package.id, $3, $4, $5, $6
     from script_direction_packages package
     where package.project_id = $1
       and package.id = $2
       and package.status <> 'archived'
     returning id, project_id, package_id, role, input_mode, content, created_by, created_at`,
    [
      input.projectId,
      input.packageId,
      input.role,
      input.inputMode ?? "text",
      input.content,
      input.actorId ?? null,
    ]
  );
  if (!result.rows[0]) {
    throw new AppError({
      status: 404,
      code: "script_revision_package_not_found",
      userMessage: "没有找到可编辑的脚本包。请刷新项目后重试，或确认这个脚本包还未归档。",
    });
  }
  return mapScriptRevisionMessage(result.rows[0]);
}

export async function listScriptRevisionMessages(projectId: string) {
  const result = await query<ScriptRevisionMessageRow>(
    `select id, project_id, package_id, role, input_mode, content, created_by, created_at
     from script_revision_messages
     where project_id = $1
     order by created_at asc
     limit 300`,
    [projectId]
  );
  return result.rows.map(mapScriptRevisionMessage);
}

export async function listScriptReferenceAssets(projectId: string) {
  const result = await query<ReferenceRow>(
    `select id, project_id, package_id, reference_type, title, style_label, prompt,
            asset_id, generated_image_id, oss_url, sort_order, status, updated_at
     from script_reference_assets
     where project_id = $1
     order by package_id, reference_type, sort_order`,
    [projectId]
  );
  return result.rows.map(mapReference);
}

export async function listStoryboardScenes(projectId: string) {
  const result = await query<SceneRow>(
    `select id, project_id, package_id, scene_number, title, description, status, locked_version, updated_at
     from storyboard_scenes
     where project_id = $1
     order by scene_number asc`,
    [projectId]
  );
  return result.rows.map(mapScene);
}

export async function listStoryboardShots(projectId: string) {
  const result = await query<ShotRow>(
    `select id, project_id, scene_id, package_id, shot_number, visual_description, shot_size,
            action_expression, camera_movement, duration_seconds, sound_transition, notes,
            character_refs, scene_refs, image_prompt, video_prompt, status, version, sort_order, updated_at
     from storyboard_shots
     where project_id = $1
     order by scene_id, sort_order asc, shot_number asc`,
    [projectId]
  );
  return result.rows.map(mapShot);
}

export async function createStoryboardShot(input: {
  projectId: string;
  sceneId: string;
  packageId?: string | null;
  shotNumber: string;
  visualDescription: string;
  shotSize?: string;
  actionExpression?: string;
  cameraMovement?: string;
  durationSeconds?: number | null;
  soundTransition?: string;
  notes?: string;
  characterRefs?: unknown[];
  sceneRefs?: unknown[];
  imagePrompt?: string;
  videoPrompt?: string;
  sortOrder: number;
  actorId?: string | null;
}) {
  const result = await query<ShotRow>(
    `insert into storyboard_shots (
       project_id, scene_id, package_id, shot_number, visual_description, shot_size,
       action_expression, camera_movement, duration_seconds, sound_transition, notes,
       character_refs, scene_refs, image_prompt, video_prompt, status, sort_order, created_by, updated_by
     )
     values (
       $1, $2, $3, $4, $5, $6,
       $7, $8, $9, $10, $11,
       $12::jsonb, $13::jsonb, $14, $15, 'draft', $16, $17, $17
     )
     returning id, project_id, scene_id, package_id, shot_number, visual_description, shot_size,
               action_expression, camera_movement, duration_seconds, sound_transition, notes,
               character_refs, scene_refs, image_prompt, video_prompt, status, version, sort_order, updated_at`,
    [
      input.projectId,
      input.sceneId,
      input.packageId ?? null,
      input.shotNumber,
      input.visualDescription,
      input.shotSize ?? "",
      input.actionExpression ?? "",
      input.cameraMovement ?? "",
      input.durationSeconds ?? null,
      input.soundTransition ?? "",
      input.notes ?? "",
      JSON.stringify(input.characterRefs ?? []),
      JSON.stringify(input.sceneRefs ?? []),
      input.imagePrompt ?? "",
      input.videoPrompt ?? "",
      input.sortOrder,
      input.actorId ?? null,
    ]
  );
  return mapShot(result.rows[0]);
}

export async function updateStoryboardShotOrder(input: {
  projectId: string;
  shotId: string;
  sceneId: string;
  sortOrder: number;
  actorId?: string | null;
}) {
  const result = await query<ShotRow>(
    `update storyboard_shots
     set scene_id = $3,
         sort_order = $4,
         status = 'draft',
         updated_by = coalesce($5, updated_by),
         updated_at = now()
     where project_id = $1 and id = $2
     returning id, project_id, scene_id, package_id, shot_number, visual_description, shot_size,
               action_expression, camera_movement, duration_seconds, sound_transition, notes,
               character_refs, scene_refs, image_prompt, video_prompt, status, version, sort_order, updated_at`,
    [input.projectId, input.shotId, input.sceneId, input.sortOrder, input.actorId ?? null]
  );
  return result.rows[0] ? mapShot(result.rows[0]) : null;
}

export async function updateStoryboardShotContent(input: {
  projectId: string;
  shotId: string;
  sceneId: string;
  shotNumber: string;
  visualDescription: string;
  shotSize?: string;
  actionExpression?: string;
  cameraMovement?: string;
  durationSeconds?: number | null;
  soundTransition?: string;
  notes?: string;
  characterRefs?: unknown[];
  sceneRefs?: unknown[];
  imagePrompt?: string;
  videoPrompt?: string;
  sortOrder: number;
  actorId?: string | null;
}) {
  const result = await query<ShotRow>(
    `update storyboard_shots
     set scene_id = $3,
         shot_number = $4,
         visual_description = $5,
         shot_size = $6,
         action_expression = $7,
         camera_movement = $8,
         duration_seconds = $9,
         sound_transition = $10,
         notes = $11,
         character_refs = $12::jsonb,
         scene_refs = $13::jsonb,
         image_prompt = $14,
         video_prompt = $15,
         sort_order = $16,
         status = 'draft',
         version = version + 1,
         updated_by = coalesce($17, updated_by),
         updated_at = now()
     where project_id = $1 and id = $2
     returning id, project_id, scene_id, package_id, shot_number, visual_description, shot_size,
               action_expression, camera_movement, duration_seconds, sound_transition, notes,
               character_refs, scene_refs, image_prompt, video_prompt, status, version, sort_order, updated_at`,
    [
      input.projectId,
      input.shotId,
      input.sceneId,
      input.shotNumber,
      input.visualDescription,
      input.shotSize ?? "",
      input.actionExpression ?? "",
      input.cameraMovement ?? "",
      input.durationSeconds ?? null,
      input.soundTransition ?? "",
      input.notes ?? "",
      JSON.stringify(input.characterRefs ?? []),
      JSON.stringify(input.sceneRefs ?? []),
      input.imagePrompt ?? "",
      input.videoPrompt ?? "",
      input.sortOrder,
      input.actorId ?? null,
    ]
  );
  return result.rows[0] ? mapShot(result.rows[0]) : null;
}

export async function updateStoryboardShotsStatus(input: {
  projectId: string;
  status: StoryboardShotStatus;
  actorId?: string | null;
}) {
  const result = await query<ShotRow>(
    `update storyboard_shots
     set status = $2,
         updated_by = coalesce($3, updated_by),
         updated_at = now()
     where project_id = $1
       and status not in ('client_approved', 'image_selected', 'video_selected', 'locked')
     returning id, project_id, scene_id, package_id, shot_number, visual_description, shot_size,
               action_expression, camera_movement, duration_seconds, sound_transition, notes,
               character_refs, scene_refs, image_prompt, video_prompt, status, version, sort_order, updated_at`,
    [input.projectId, input.status, input.actorId ?? null]
  );
  return result.rows.map(mapShot);
}

export async function deleteStoryboardShotIfUnused(input: {
  projectId: string;
  shotId: string;
  actorId?: string | null;
}) {
  return withTransaction(async (tx) => deleteStoryboardShotIfUnusedTx(tx, input));
}

async function deleteStoryboardShotIfUnusedTx(
  tx: TransactionQuery,
  input: { projectId: string; shotId: string; actorId?: string | null }
) {
  const usage = await tx<{ image_count: string; video_count: string }>(
    `select
       (select count(*) from storyboard_images where project_id = $1 and shot_id = $2)::text as image_count,
       (select count(*) from storyboard_videos where project_id = $1 and shot_id = $2)::text as video_count`,
    [input.projectId, input.shotId]
  );
  const counts = usage.rows[0];
  if (Number(counts?.image_count ?? 0) > 0 || Number(counts?.video_count ?? 0) > 0) {
    throw new AppError({
      status: 422,
      code: "storyboard_shot_has_assets",
      userMessage: "这条分镜已经生成过图片或视频，不能直接删除。请先处理相关生产资产，再调整分镜序列。",
    });
  }

  const result = await tx<ShotRow>(
    `delete from storyboard_shots
     where project_id = $1 and id = $2
     returning id, project_id, scene_id, package_id, shot_number, visual_description, shot_size,
               action_expression, camera_movement, duration_seconds, sound_transition, notes,
               character_refs, scene_refs, image_prompt, video_prompt, status, version, sort_order, updated_at`,
    [input.projectId, input.shotId]
  );
  return result.rows[0] ? mapShot(result.rows[0]) : null;
}

export async function listStoryboardImages(projectId: string) {
  const result = await query<StoryboardImageRow>(
    `select id, project_id, scene_id, shot_id, prompt, provider, model_name, generation_status,
            oss_key, oss_url, asset_id, is_selected, internal_review_status, failure_reason,
            retry_count, annotations_json, reference_json, source_job_id, version, reviewed_by,
            reviewed_at, updated_at
     from storyboard_images
     where project_id = $1
     order by scene_id, shot_id, updated_at desc
     limit 300`,
    [projectId]
  );
  return result.rows.map(mapStoryboardImage);
}

export async function listStoryboardImagesByIds(input: { projectId: string; imageIds: string[] }) {
  if (input.imageIds.length === 0) return [];
  const result = await query<StoryboardImageRow>(
    `select id, project_id, scene_id, shot_id, prompt, provider, model_name, generation_status,
            oss_key, oss_url, asset_id, is_selected, internal_review_status, failure_reason,
            retry_count, annotations_json, reference_json, source_job_id, version, reviewed_by,
            reviewed_at, updated_at
     from storyboard_images
     where project_id = $1
       and id = any($2::uuid[])
     order by array_position($2::uuid[], id)`,
    [input.projectId, input.imageIds]
  );
  return result.rows.map(mapStoryboardImage);
}

export async function listStoryboardVideos(projectId: string) {
  const result = await query<StoryboardVideoRow>(
    `select id, project_id, scene_id, shot_id, image_id, prompt, provider, model_name, generation_status,
            oss_key, oss_url, asset_id, is_selected, internal_review_status, failure_reason,
            retry_count, source_job_id, version, reviewed_by, reviewed_at, updated_at
     from storyboard_videos
     where project_id = $1
     order by scene_id, shot_id, updated_at desc
     limit 300`,
    [projectId]
  );
  return result.rows.map(mapStoryboardVideo);
}

export async function listStoryboardVideosByIds(input: { projectId: string; videoIds: string[] }) {
  if (input.videoIds.length === 0) return [];
  const result = await query<StoryboardVideoRow>(
    `select id, project_id, scene_id, shot_id, image_id, prompt, provider, model_name, generation_status,
            oss_key, oss_url, asset_id, is_selected, internal_review_status, failure_reason,
            retry_count, source_job_id, version, reviewed_by, reviewed_at, updated_at
     from storyboard_videos
     where project_id = $1
       and id = any($2::uuid[])
     order by scene_id, shot_id, updated_at desc
     limit 100`,
    [input.projectId, input.videoIds]
  );
  return result.rows.map(mapStoryboardVideo);
}

export async function listStoryboardShotsByIds(input: { projectId: string; shotIds: string[] }) {
  if (input.shotIds.length === 0) return [];
  const result = await query<ShotRow>(
    `select id, project_id, scene_id, package_id, shot_number, visual_description, shot_size,
            action_expression, camera_movement, duration_seconds, sound_transition, notes,
            character_refs, scene_refs, image_prompt, video_prompt, status, version, sort_order, updated_at
     from storyboard_shots
     where project_id = $1
       and id = any($2::uuid[])
     order by sort_order asc, shot_number asc`,
    [input.projectId, input.shotIds]
  );
  return result.rows.map(mapShot);
}

export async function createOrUpdateScriptPackage(input: {
  projectId: string;
  directionId?: string | null;
  title: string;
  concept: string;
  fullScript: string;
  actorId: string;
}) {
  const result = await query<ScriptPackageRow>(
    `insert into script_direction_packages (
       project_id, direction_id, title, concept, full_script, status, created_by, updated_by
     )
     values ($1, $2, $3, $4, $5, 'draft', $6, $6)
     on conflict do nothing
     returning ${SCRIPT_PACKAGE_COLUMNS}`,
    [input.projectId, input.directionId ?? null, input.title, input.concept, input.fullScript, input.actorId]
  );

  if (result.rows[0]) return mapPackage(result.rows[0]);

  const updated = await query<ScriptPackageRow>(
    `insert into script_direction_packages (
       project_id, direction_id, title, concept, full_script, status, created_by, updated_by
     )
     values ($1, $2, $3, $4, $5, 'draft', $6, $6)
     returning ${SCRIPT_PACKAGE_COLUMNS}`,
    [input.projectId, input.directionId ?? null, input.title, input.concept, input.fullScript, input.actorId]
  );
  return mapPackage(updated.rows[0]);
}

export async function createScriptReferenceAssets(input: {
  projectId: string;
  packageId: string;
  actorId: string;
  references: Array<{
    referenceType: ScriptReferenceType;
    title: string;
    styleLabel?: string;
    prompt?: string;
    ossUrl?: string | null;
    sortOrder?: number;
  }>;
}) {
  const saved: ScriptReferenceAssetView[] = [];
  for (const item of input.references) {
    const result = await query<ReferenceRow>(
      `insert into script_reference_assets (
         project_id, package_id, reference_type, title, style_label, prompt, oss_url, sort_order, created_by
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       returning id, project_id, package_id, reference_type, title, style_label, prompt,
                 asset_id, generated_image_id, oss_url, sort_order, status, updated_at`,
      [
        input.projectId,
        input.packageId,
        item.referenceType,
        item.title,
        item.styleLabel ?? "",
        item.prompt ?? "",
        item.ossUrl ?? null,
        item.sortOrder ?? saved.length,
        input.actorId,
      ]
    );
    saved.push(mapReference(result.rows[0]));
  }
  return saved;
}

export async function createStoryboardDraft(input: {
  projectId: string;
  packageId: string;
  actorId: string;
  scenes: Array<{
    sceneNumber: number;
    title: string;
    description: string;
    shots: Array<{
      shotNumber: string;
      visualDescription: string;
      shotSize?: string;
      actionExpression?: string;
      cameraMovement?: string;
      durationSeconds?: number | null;
      soundTransition?: string;
      notes?: string;
      characterRefs?: unknown[];
      sceneRefs?: unknown[];
      imagePrompt?: string;
      videoPrompt?: string;
      sortOrder?: number;
    }>;
  }>;
}) {
  return withTransaction(async (tx) => {
    const createdScenes: StoryboardSceneView[] = [];
    const createdShots: StoryboardShotView[] = [];

    for (const scene of input.scenes) {
      const sceneResult = await tx<SceneRow>(
        `insert into storyboard_scenes (
           project_id, package_id, scene_number, title, description, status, created_by, updated_by
         )
         values ($1, $2, $3, $4, $5, 'draft', $6, $6)
         on conflict (project_id, scene_number)
         do update set
           package_id = excluded.package_id,
           title = excluded.title,
           description = excluded.description,
           updated_by = excluded.updated_by,
           updated_at = now()
         returning id, project_id, package_id, scene_number, title, description, status, locked_version, updated_at`,
        [input.projectId, input.packageId, scene.sceneNumber, scene.title, scene.description, input.actorId]
      );
      const savedScene = mapScene(sceneResult.rows[0]);
      createdScenes.push(savedScene);

      await tx(`delete from storyboard_shots where project_id = $1 and scene_id = $2`, [input.projectId, savedScene.id]);
      for (const [index, shot] of scene.shots.entries()) {
        const shotResult = await tx<ShotRow>(
          `insert into storyboard_shots (
             project_id, scene_id, package_id, shot_number, visual_description, shot_size,
             action_expression, camera_movement, duration_seconds, sound_transition, notes,
             character_refs, scene_refs, image_prompt, video_prompt, status, sort_order, created_by, updated_by
           )
           values (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
             $12::jsonb, $13::jsonb, $14, $15, 'draft', $16, $17, $17
           )
           returning id, project_id, scene_id, package_id, shot_number, visual_description, shot_size,
                     action_expression, camera_movement, duration_seconds, sound_transition, notes,
                     character_refs, scene_refs, image_prompt, video_prompt, status, version, sort_order, updated_at`,
          [
            input.projectId,
            savedScene.id,
            input.packageId,
            shot.shotNumber,
            shot.visualDescription,
            shot.shotSize ?? "",
            shot.actionExpression ?? "",
            shot.cameraMovement ?? "",
            shot.durationSeconds ?? null,
            shot.soundTransition ?? "",
            shot.notes ?? "",
            JSON.stringify(shot.characterRefs ?? []),
            JSON.stringify(shot.sceneRefs ?? []),
            shot.imagePrompt ?? "",
            shot.videoPrompt ?? "",
            shot.sortOrder ?? index,
            input.actorId,
          ]
        );
        createdShots.push(mapShot(shotResult.rows[0]));
      }
    }

    return { scenes: createdScenes, shots: createdShots };
  });
}

export async function createStoryboardImageRecord(input: {
  projectId: string;
  sceneId: string;
  shotId: string;
  prompt: string;
  provider: string;
  modelName: string;
  reference?: Record<string, unknown>;
  sourceJobId?: string | null;
  actorId: string;
}) {
  const result = await query<StoryboardImageRow>(
    `insert into storyboard_images (
       project_id, scene_id, shot_id, prompt, provider, model_name, reference_json, source_job_id, created_by
     )
     values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
     returning id, project_id, scene_id, shot_id, prompt, provider, model_name, generation_status,
               oss_key, oss_url, asset_id, is_selected, internal_review_status, failure_reason,
               retry_count, annotations_json, reference_json, source_job_id, version, reviewed_by,
               reviewed_at, updated_at`,
    [
      input.projectId,
      input.sceneId,
      input.shotId,
      input.prompt,
      input.provider,
      input.modelName,
      JSON.stringify(input.reference ?? {}),
      input.sourceJobId ?? null,
      input.actorId,
    ]
  );
  return mapStoryboardImage(result.rows[0]);
}

export async function updateStoryboardImageSourceJob(input: { id: string; sourceJobId: string }) {
  await query(`update storyboard_images set source_job_id = $2, updated_at = now() where id = $1`, [
    input.id,
    input.sourceJobId,
  ]);
}

export async function markStoryboardImageProcessing(id: string) {
  await query(
    `update storyboard_images
     set generation_status = 'processing', failure_reason = null, updated_at = now()
     where id = $1`,
    [id]
  );
}

export async function markStoryboardImageSucceeded(input: { id: string; ossKey: string; ossUrl: string }) {
  const result = await query<StoryboardImageRow>(
    `update storyboard_images
     set generation_status = 'succeeded', oss_key = $2, oss_url = $3, failure_reason = null, updated_at = now()
     where id = $1
     returning id, project_id, scene_id, shot_id, prompt, provider, model_name, generation_status,
               oss_key, oss_url, asset_id, is_selected, internal_review_status, failure_reason,
               retry_count, annotations_json, reference_json, source_job_id, version, reviewed_by,
               reviewed_at, updated_at`,
    [input.id, input.ossKey, input.ossUrl]
  );
  return result.rows[0] ? mapStoryboardImage(result.rows[0]) : null;
}

export async function markStoryboardImageFailed(input: { id: string; failureReason: string }) {
  await query(
    `update storyboard_images
     set generation_status = 'failed', failure_reason = $2, retry_count = retry_count + 1, updated_at = now()
     where id = $1`,
    [input.id, input.failureReason]
  );
}

export async function selectStoryboardImage(input: {
  projectId: string;
  imageId: string;
  actorId: string;
}) {
  return withTransaction(async (tx) => {
    const current = await tx<StoryboardImageRow>(
      `select id, project_id, scene_id, shot_id, prompt, provider, model_name, generation_status,
              oss_key, oss_url, asset_id, is_selected, internal_review_status, failure_reason,
              retry_count, annotations_json, reference_json, source_job_id, version, reviewed_by,
              reviewed_at, updated_at
       from storyboard_images
       where project_id = $1 and id = $2
       for update`,
      [input.projectId, input.imageId]
    );
    const row = current.rows[0];
    if (!row) return null;

    await tx(`update storyboard_images set is_selected = false where project_id = $1 and shot_id = $2`, [
      input.projectId,
      row.shot_id,
    ]);
    const updated = await tx<StoryboardImageRow>(
      `update storyboard_images
       set is_selected = true,
           internal_review_status = 'confirmed',
           reviewed_by = $3,
           reviewed_at = now(),
           updated_at = now()
       where project_id = $1 and id = $2
       returning id, project_id, scene_id, shot_id, prompt, provider, model_name, generation_status,
                 oss_key, oss_url, asset_id, is_selected, internal_review_status, failure_reason,
                 retry_count, annotations_json, reference_json, source_job_id, version, reviewed_by,
                 reviewed_at, updated_at`,
      [input.projectId, input.imageId, input.actorId]
    );
    await tx(
      `update storyboard_shots
       set status = 'image_selected',
           updated_by = $3,
           updated_at = now()
       where project_id = $1 and id = $2`,
      [input.projectId, row.shot_id, input.actorId]
    );
    return mapStoryboardImage(updated.rows[0]);
  });
}

export async function updateStoryboardSceneStatus(input: {
  projectId: string;
  sceneId: string;
  status: StoryboardSceneStatus;
  actorId?: string | null;
}) {
  const result = await query<SceneRow>(
    `update storyboard_scenes
     set status = $3,
         locked_version = case when $3 in ('client_approved', 'locked') then coalesce(locked_version, 1) else locked_version end,
         updated_by = coalesce($4, updated_by),
         updated_at = now()
     where project_id = $1 and id = $2
     returning id, project_id, package_id, scene_number, title, description, status, locked_version, updated_at`,
    [input.projectId, input.sceneId, input.status, input.actorId ?? null]
  );
  return result.rows[0] ? mapScene(result.rows[0]) : null;
}

export async function updateStoryboardShotClientDecision(input: {
  projectId: string;
  shotId: string;
  approved: boolean;
}) {
  const status: StoryboardShotStatus = input.approved ? "client_approved" : "client_rejected";
  await query(
    `update storyboard_shots
     set status = $3,
         updated_at = now()
     where project_id = $1 and id = $2`,
    [input.projectId, input.shotId, status]
  );
}

export async function createStoryboardVideoRecord(input: {
  projectId: string;
  sceneId: string;
  shotId: string;
  imageId?: string | null;
  prompt: string;
  provider: string;
  modelName: string;
  sourceJobId?: string | null;
  actorId: string;
}) {
  const result = await query<StoryboardVideoRow>(
    `insert into storyboard_videos (
       project_id, scene_id, shot_id, image_id, prompt, provider, model_name, source_job_id, created_by
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning id, project_id, scene_id, shot_id, image_id, prompt, provider, model_name, generation_status,
               oss_key, oss_url, asset_id, is_selected, internal_review_status, failure_reason,
               retry_count, source_job_id, version, reviewed_by, reviewed_at, updated_at`,
    [
      input.projectId,
      input.sceneId,
      input.shotId,
      input.imageId ?? null,
      input.prompt,
      input.provider,
      input.modelName,
      input.sourceJobId ?? null,
      input.actorId,
    ]
  );
  return mapStoryboardVideo(result.rows[0]);
}

export async function createStoryboardVideoGenerationInput(input: {
  projectId: string;
  storyboardVideoId: string;
  shotId: string;
  mode: StoryboardVideoInputMode;
  imageIds: string[];
  prompt: string;
  metadata?: Record<string, unknown>;
  actorId: string;
}) {
  const result = await query<StoryboardVideoGenerationInputRow>(
    `insert into storyboard_video_generation_inputs (
       project_id, storyboard_video_id, shot_id, mode, input_image_ids, prompt, metadata_json, created_by
     )
     values ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8)
     returning id, project_id, storyboard_video_id, shot_id, mode, input_image_ids, prompt, metadata_json, created_at, updated_at`,
    [
      input.projectId,
      input.storyboardVideoId,
      input.shotId,
      input.mode,
      JSON.stringify(input.imageIds),
      input.prompt,
      JSON.stringify(input.metadata ?? {}),
      input.actorId,
    ]
  );
  return mapStoryboardVideoGenerationInput(result.rows[0]);
}

export async function getLatestStoryboardVideoGenerationInput(input: {
  projectId: string;
  storyboardVideoId: string;
}) {
  const result = await query<StoryboardVideoGenerationInputRow>(
    `select id, project_id, storyboard_video_id, shot_id, mode, input_image_ids, prompt, metadata_json, created_at, updated_at
     from storyboard_video_generation_inputs
     where project_id = $1
       and storyboard_video_id = $2
     order by created_at desc
     limit 1`,
    [input.projectId, input.storyboardVideoId]
  );
  return result.rows[0] ? mapStoryboardVideoGenerationInput(result.rows[0]) : null;
}

export async function updateStoryboardVideoSourceJob(input: { id: string; sourceJobId: string }) {
  await query(`update storyboard_videos set source_job_id = $2, updated_at = now() where id = $1`, [
    input.id,
    input.sourceJobId,
  ]);
}

export async function markStoryboardVideoProcessing(id: string) {
  await query(
    `update storyboard_videos
     set generation_status = 'processing', failure_reason = null, updated_at = now()
     where id = $1`,
    [id]
  );
}

export async function markStoryboardVideoFailed(input: { id: string; failureReason: string }) {
  await query(
    `update storyboard_videos
     set generation_status = 'failed', failure_reason = $2, retry_count = retry_count + 1, updated_at = now()
     where id = $1`,
    [input.id, input.failureReason]
  );
}

export async function markStoryboardVideoSucceeded(input: { id: string; ossKey: string; ossUrl: string }) {
  const result = await query<StoryboardVideoRow>(
    `update storyboard_videos
     set generation_status = 'succeeded', oss_key = $2, oss_url = $3, failure_reason = null, updated_at = now()
     where id = $1
     returning id, project_id, scene_id, shot_id, image_id, prompt, provider, model_name, generation_status,
               oss_key, oss_url, asset_id, is_selected, internal_review_status, failure_reason,
               retry_count, source_job_id, version, reviewed_by, reviewed_at, updated_at`,
    [input.id, input.ossKey, input.ossUrl]
  );
  return result.rows[0] ? mapStoryboardVideo(result.rows[0]) : null;
}

export async function selectStoryboardVideo(input: {
  projectId: string;
  videoId: string;
  actorId: string;
}) {
  return withTransaction(async (tx) => {
    const current = await tx<StoryboardVideoRow>(
      `select id, project_id, scene_id, shot_id, image_id, prompt, provider, model_name, generation_status,
              oss_key, oss_url, asset_id, is_selected, internal_review_status, failure_reason,
              retry_count, source_job_id, version, reviewed_by, reviewed_at, updated_at
       from storyboard_videos
       where project_id = $1 and id = $2
       for update`,
      [input.projectId, input.videoId]
    );
    const row = current.rows[0];
    if (!row) return null;

    await tx(`update storyboard_videos set is_selected = false where project_id = $1 and shot_id = $2`, [
      input.projectId,
      row.shot_id,
    ]);
    const updated = await tx<StoryboardVideoRow>(
      `update storyboard_videos
       set is_selected = true,
           internal_review_status = 'confirmed',
           reviewed_by = $3,
           reviewed_at = now(),
           updated_at = now()
       where project_id = $1 and id = $2
       returning id, project_id, scene_id, shot_id, image_id, prompt, provider, model_name, generation_status,
                 oss_key, oss_url, asset_id, is_selected, internal_review_status, failure_reason,
                 retry_count, source_job_id, version, reviewed_by, reviewed_at, updated_at`,
      [input.projectId, input.videoId, input.actorId]
    );
    await tx(
      `update storyboard_shots
       set status = 'video_selected',
           updated_by = $3,
           updated_at = now()
       where project_id = $1 and id = $2`,
      [input.projectId, row.shot_id, input.actorId]
    );
    return mapStoryboardVideo(updated.rows[0]);
  });
}

export async function getStoryboardShot(input: { projectId: string; shotId: string }) {
  const result = await query<ShotRow>(
    `select id, project_id, scene_id, package_id, shot_number, visual_description, shot_size,
            action_expression, camera_movement, duration_seconds, sound_transition, notes,
            character_refs, scene_refs, image_prompt, video_prompt, status, version, sort_order, updated_at
     from storyboard_shots
     where project_id = $1 and id = $2
     limit 1`,
    [input.projectId, input.shotId]
  );
  return result.rows[0] ? mapShot(result.rows[0]) : null;
}

export async function getSelectedStoryboardImage(input: { projectId: string; shotId: string }) {
  const result = await query<StoryboardImageRow>(
    `select id, project_id, scene_id, shot_id, prompt, provider, model_name, generation_status,
            oss_key, oss_url, asset_id, is_selected, internal_review_status, failure_reason,
            retry_count, annotations_json, reference_json, source_job_id, version, reviewed_by,
            reviewed_at, updated_at
     from storyboard_images
     where project_id = $1 and shot_id = $2 and is_selected = true
     order by updated_at desc
     limit 1`,
    [input.projectId, input.shotId]
  );
  return result.rows[0] ? mapStoryboardImage(result.rows[0]) : null;
}

export async function listSelectedStoryboardVideosForScene(input: { projectId: string; sceneId: string }) {
  const result = await query<StoryboardSceneVideoBundleRow>(
    `select s.shot_number,
            v.oss_url,
            regexp_replace(coalesce(v.oss_key, ''), '^.*/', '') as file_name
     from storyboard_shots s
     join storyboard_videos v
       on v.project_id = s.project_id
      and v.shot_id = s.id
      and v.is_selected = true
      and v.oss_url is not null
     where s.project_id = $1
       and s.scene_id = $2
     order by s.sort_order asc, s.shot_number asc`,
    [input.projectId, input.sceneId]
  );
  return result.rows.map((row) => ({
    shotNumber: row.shot_number,
    ossUrl: row.oss_url,
    fileName: row.file_name || `${row.shot_number}.mp4`,
  }));
}

function mapPackage(row: ScriptPackageRow): ScriptDirectionPackageView {
  return {
    id: row.id,
    projectId: row.project_id,
    directionId: row.direction_id,
    title: row.title,
    concept: row.concept,
    fullScript: row.full_script,
    plainScript: row.plain_script,
    standardizedScript: row.standardized_script,
    status: row.status,
    version: row.version,
    selectedAt: row.selected_at,
    lockedAt: row.locked_at,
    updatedAt: row.updated_at,
  };
}

function mapScriptRevisionMessage(row: ScriptRevisionMessageRow): ScriptRevisionMessageView {
  return {
    id: row.id,
    projectId: row.project_id,
    packageId: row.package_id,
    role: row.role,
    inputMode: row.input_mode,
    content: row.content,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function mapReference(row: ReferenceRow): ScriptReferenceAssetView {
  return {
    id: row.id,
    projectId: row.project_id,
    packageId: row.package_id,
    referenceType: row.reference_type,
    title: row.title,
    styleLabel: row.style_label,
    prompt: row.prompt,
    assetId: row.asset_id,
    generatedImageId: row.generated_image_id,
    ossUrl: row.oss_url,
    sortOrder: row.sort_order,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

function mapScene(row: SceneRow): StoryboardSceneView {
  return {
    id: row.id,
    projectId: row.project_id,
    packageId: row.package_id,
    sceneNumber: row.scene_number,
    title: row.title,
    description: row.description,
    status: row.status,
    lockedVersion: row.locked_version,
    updatedAt: row.updated_at,
  };
}

function mapShot(row: ShotRow): StoryboardShotView {
  return {
    id: row.id,
    projectId: row.project_id,
    sceneId: row.scene_id,
    packageId: row.package_id,
    shotNumber: row.shot_number,
    visualDescription: row.visual_description,
    shotSize: row.shot_size,
    actionExpression: row.action_expression,
    cameraMovement: row.camera_movement,
    durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
    soundTransition: row.sound_transition,
    notes: row.notes,
    characterRefs: Array.isArray(row.character_refs) ? row.character_refs : [],
    sceneRefs: Array.isArray(row.scene_refs) ? row.scene_refs : [],
    imagePrompt: row.image_prompt,
    videoPrompt: row.video_prompt,
    status: row.status,
    version: row.version,
    sortOrder: row.sort_order,
    updatedAt: row.updated_at,
  };
}

function mapStoryboardImage(row: StoryboardImageRow): StoryboardImageView {
  return {
    id: row.id,
    projectId: row.project_id,
    sceneId: row.scene_id,
    shotId: row.shot_id,
    prompt: row.prompt,
    provider: row.provider,
    modelName: row.model_name,
    generationStatus: row.generation_status,
    ossKey: row.oss_key,
    ossUrl: row.oss_url,
    assetId: row.asset_id,
    isSelected: row.is_selected,
    internalReviewStatus: row.internal_review_status,
    failureReason: row.failure_reason,
    retryCount: row.retry_count,
    annotations: Array.isArray(row.annotations_json) ? row.annotations_json : [],
    reference:
      row.reference_json && typeof row.reference_json === "object" && !Array.isArray(row.reference_json)
        ? (row.reference_json as Record<string, unknown>)
        : {},
    sourceJobId: row.source_job_id,
    version: row.version,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    updatedAt: row.updated_at,
  };
}

function mapStoryboardVideo(row: StoryboardVideoRow): StoryboardVideoView {
  return {
    id: row.id,
    projectId: row.project_id,
    sceneId: row.scene_id,
    shotId: row.shot_id,
    imageId: row.image_id,
    prompt: row.prompt,
    provider: row.provider,
    modelName: row.model_name,
    generationStatus: row.generation_status,
    ossKey: row.oss_key,
    ossUrl: row.oss_url,
    assetId: row.asset_id,
    isSelected: row.is_selected,
    internalReviewStatus: row.internal_review_status,
    failureReason: row.failure_reason,
    retryCount: row.retry_count,
    sourceJobId: row.source_job_id,
    version: row.version,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    updatedAt: row.updated_at,
  };
}

function mapStoryboardVideoGenerationInput(row: StoryboardVideoGenerationInputRow): StoryboardVideoGenerationInputView {
  return {
    id: row.id,
    projectId: row.project_id,
    storyboardVideoId: row.storyboard_video_id,
    shotId: row.shot_id,
    mode: row.mode,
    inputImageIds: Array.isArray(row.input_image_ids) ? row.input_image_ids.filter((item): item is string => typeof item === "string") : [],
    prompt: row.prompt,
    metadata:
      row.metadata_json && typeof row.metadata_json === "object" && !Array.isArray(row.metadata_json)
        ? (row.metadata_json as Record<string, unknown>)
        : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
