import { query, withTransaction } from "@/lib/db";

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

export type ScriptDirectionPackageView = {
  id: string;
  projectId: string;
  directionId: string | null;
  title: string;
  concept: string;
  fullScript: string;
  status: ScriptPackageStatus;
  version: number;
  selectedAt: string | null;
  lockedAt: string | null;
  updatedAt: string;
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

type ScriptPackageRow = {
  id: string;
  project_id: string;
  direction_id: string | null;
  title: string;
  concept: string;
  full_script: string;
  status: ScriptPackageStatus;
  version: number;
  selected_at: string | null;
  locked_at: string | null;
  updated_at: string;
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

export async function listStoryProduction(projectId: string) {
  const [packages, references, scenes, shots, storyboardImages, storyboardVideos] = await Promise.all([
    listScriptDirectionPackages(projectId),
    listScriptReferenceAssets(projectId),
    listStoryboardScenes(projectId),
    listStoryboardShots(projectId),
    listStoryboardImages(projectId),
    listStoryboardVideos(projectId),
  ]);

  return {
    scriptPackages: packages,
    scriptReferences: references,
    storyboardScenes: scenes,
    storyboardShots: shots,
    storyboardImages,
    storyboardVideos,
  };
}

export async function listScriptDirectionPackages(projectId: string) {
  const result = await query<ScriptPackageRow>(
    `select id, project_id, direction_id, title, concept, full_script, status, version,
            selected_at, locked_at, updated_at
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
    `select id, project_id, direction_id, title, concept, full_script, status, version,
            selected_at, locked_at, updated_at
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
     returning id, project_id, direction_id, title, concept, full_script, status, version,
               selected_at, locked_at, updated_at`,
    [input.projectId, input.packageId, input.status, input.actorId ?? null]
  );
  return result.rows[0] ? mapPackage(result.rows[0]) : null;
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
     returning id, project_id, direction_id, title, concept, full_script, status, version,
               selected_at, locked_at, updated_at`,
    [input.projectId, input.directionId ?? null, input.title, input.concept, input.fullScript, input.actorId]
  );

  if (result.rows[0]) return mapPackage(result.rows[0]);

  const updated = await query<ScriptPackageRow>(
    `insert into script_direction_packages (
       project_id, direction_id, title, concept, full_script, status, created_by, updated_by
     )
     values ($1, $2, $3, $4, $5, 'draft', $6, $6)
     returning id, project_id, direction_id, title, concept, full_script, status, version,
               selected_at, locked_at, updated_at`,
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

function mapPackage(row: ScriptPackageRow): ScriptDirectionPackageView {
  return {
    id: row.id,
    projectId: row.project_id,
    directionId: row.direction_id,
    title: row.title,
    concept: row.concept,
    fullScript: row.full_script,
    status: row.status,
    version: row.version,
    selectedAt: row.selected_at,
    lockedAt: row.locked_at,
    updatedAt: row.updated_at,
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
