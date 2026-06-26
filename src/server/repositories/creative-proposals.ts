import { AppError } from "@/lib/errors";
import { query, withTransaction, type TransactionQuery } from "@/lib/db";

export type CreativeProposalRoundView = {
  id: string;
  projectId: string;
  roundNumber: 1 | 2;
  status: string;
  version: number;
  directionIds: string[];
  retainedDirectionIds: string[];
  clientFeedback: Record<string, unknown>;
  clientReviewTaskId: string | null;
  snapshot: Record<string, unknown>;
  concepts: CreativeSceneConceptView[];
  updatedAt: string;
};

export type CreativeSceneConceptView = {
  id: string;
  projectId: string;
  roundId: string;
  directionId: string | null;
  sceneIndex: number;
  title: string;
  description: string;
  sourceText: string;
  imagePrompt: string;
  requiredImageCount: number;
  selectedImageIds: string[];
  status: string;
  version: number;
  snapshot: Record<string, unknown>;
  images: CreativeSceneImageView[];
  updatedAt: string;
};

export type CreativeSceneImageView = {
  id: string;
  projectId: string;
  roundId: string;
  sceneConceptId: string;
  generatedImageId: string | null;
  assetId: string | null;
  ossUrl: string | null;
  prompt: string;
  status: string;
  isSelected: boolean;
  sortOrder: number;
  failureReason: string | null;
  updatedAt: string;
};

export type CreativeProposalRoundBundleView = {
  rounds: CreativeProposalRoundView[];
};

type CreativeProposalRoundRow = {
  id: string;
  project_id: string;
  round_number: 1 | 2;
  status: string;
  version: number;
  direction_ids: unknown;
  retained_direction_ids: unknown;
  client_feedback_json: unknown;
  client_review_task_id: string | null;
  snapshot_json: unknown;
  updated_at: string;
};

type CreativeSceneConceptRow = {
  id: string;
  project_id: string;
  round_id: string;
  direction_id: string | null;
  scene_index: number;
  title: string;
  description: string;
  source_text: string;
  image_prompt: string;
  required_image_count: number;
  selected_image_ids: unknown;
  status: string;
  version: number;
  snapshot_json: unknown;
  updated_at: string;
};

type CreativeSceneImageRow = {
  id: string;
  project_id: string;
  round_id: string;
  scene_concept_id: string;
  generated_image_id: string | null;
  asset_id: string | null;
  oss_url: string | null;
  prompt: string;
  status: string;
  is_selected: boolean;
  sort_order: number;
  failure_reason: string | null;
  updated_at: string;
};

export async function listCreativeProposalRounds(projectId: string): Promise<CreativeProposalRoundBundleView> {
  const [roundResult, conceptResult, imageResult] = await Promise.all([
    query<CreativeProposalRoundRow>(
      `select id, project_id, round_number, status, version, direction_ids, retained_direction_ids,
              client_feedback_json, client_review_task_id, snapshot_json, updated_at
       from creative_proposal_rounds
       where project_id = $1
         and status <> 'archived'
       order by round_number asc, version desc, updated_at desc`,
      [projectId]
    ),
    query<CreativeSceneConceptRow>(
      `select id, project_id, round_id, direction_id, scene_index, title, description, source_text,
              image_prompt, required_image_count, selected_image_ids, status, version, snapshot_json, updated_at
       from creative_scene_concepts
       where project_id = $1
       order by scene_index asc, updated_at asc`,
      [projectId]
    ),
    query<CreativeSceneImageRow>(
      `select id, project_id, round_id, scene_concept_id, generated_image_id, asset_id, oss_url,
              prompt, status, is_selected, sort_order, failure_reason, updated_at
       from creative_scene_images
       where project_id = $1
       order by sort_order asc, updated_at asc`,
      [projectId]
    ),
  ]);

  const imagesByConcept = new Map<string, CreativeSceneImageView[]>();
  for (const image of imageResult.rows.map(mapImage)) {
    imagesByConcept.set(image.sceneConceptId, [...(imagesByConcept.get(image.sceneConceptId) ?? []), image]);
  }

  const conceptsByRound = new Map<string, CreativeSceneConceptView[]>();
  for (const conceptRow of conceptResult.rows) {
    const concept = mapConcept(conceptRow, imagesByConcept.get(conceptRow.id) ?? []);
    conceptsByRound.set(concept.roundId, [...(conceptsByRound.get(concept.roundId) ?? []), concept]);
  }

  return {
    rounds: roundResult.rows.map((round) => mapRound(round, conceptsByRound.get(round.id) ?? [])),
  };
}

export async function getCreativeProposalRound(input: { projectId: string; roundId: string }) {
  const bundle = await listCreativeProposalRounds(input.projectId);
  return bundle.rounds.find((round) => round.id === input.roundId) ?? null;
}

export async function createCreativeProposalRound(input: {
  projectId: string;
  roundNumber: 1 | 2;
  version: number;
  directionIds: string[];
  retainedDirectionIds: string[];
  actorId: string;
  snapshot: Record<string, unknown>;
  transactionQuery?: TransactionQuery;
}) {
  const runQuery = input.transactionQuery ?? query;
  const result = await runQuery<CreativeProposalRoundRow>(
    `insert into creative_proposal_rounds (
       project_id, round_number, status, version, direction_ids, retained_direction_ids,
       snapshot_json, created_by, updated_by
     )
     values (
       $1, $2, 'draft', $3, $4::jsonb, $5::jsonb, $6::jsonb,
       case when exists (select 1 from users where id = $7::uuid) then $7::uuid else null end,
       case when exists (select 1 from users where id = $7::uuid) then $7::uuid else null end
     )
     returning id, project_id, round_number, status, version, direction_ids, retained_direction_ids,
               client_feedback_json, client_review_task_id, snapshot_json, updated_at`,
    [
      input.projectId,
      input.roundNumber,
      input.version,
      JSON.stringify(input.directionIds),
      JSON.stringify(input.retainedDirectionIds),
      JSON.stringify(input.snapshot),
      input.actorId,
    ]
  );

  return mapRound(result.rows[0], []);
}

export async function createCreativeSceneConcepts(input: {
  projectId: string;
  roundId: string;
  actorId: string;
  transactionQuery?: TransactionQuery;
  concepts: Array<{
    directionId: string | null;
    sceneIndex: number;
    title: string;
    description: string;
    sourceText: string;
    imagePrompt: string;
    requiredImageCount: number;
    snapshot: Record<string, unknown>;
  }>;
}) {
  const saved: CreativeSceneConceptView[] = [];
  const runQuery = input.transactionQuery ?? query;

  for (const concept of input.concepts) {
    const result = await runQuery<CreativeSceneConceptRow>(
      `insert into creative_scene_concepts (
         project_id, round_id, direction_id, scene_index, title, description, source_text,
         image_prompt, required_image_count, snapshot_json, created_by, updated_by
       )
       values (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb,
         case when exists (select 1 from users where id = $11::uuid) then $11::uuid else null end,
         case when exists (select 1 from users where id = $11::uuid) then $11::uuid else null end
       )
       returning id, project_id, round_id, direction_id, scene_index, title, description, source_text,
                 image_prompt, required_image_count, selected_image_ids, status, version, snapshot_json, updated_at`,
      [
        input.projectId,
        input.roundId,
        concept.directionId,
        concept.sceneIndex,
        concept.title,
        concept.description,
        concept.sourceText,
        concept.imagePrompt,
        concept.requiredImageCount,
        JSON.stringify(concept.snapshot),
        input.actorId,
      ]
    );
    saved.push(mapConcept(result.rows[0], []));
  }

  return saved;
}

export async function upsertCreativeSceneImage(input: {
  projectId: string;
  roundId: string;
  sceneConceptId: string;
  generatedImageId: string | null;
  ossUrl: string | null;
  prompt: string;
  status: "queued" | "generated" | "failed" | "selected" | "discarded";
  sortOrder: number;
  actorId: string;
  transactionQuery?: TransactionQuery;
}) {
  const runQuery = input.transactionQuery ?? query;
  const result = await runQuery<CreativeSceneImageRow>(
    `insert into creative_scene_images (
       project_id, round_id, scene_concept_id, generated_image_id, oss_url, prompt, status, sort_order, created_by
     )
     values (
       $1, $2, $3, $4, $5, $6, $7, $8,
       case when exists (select 1 from users where id = $9::uuid) then $9::uuid else null end
     )
     returning id, project_id, round_id, scene_concept_id, generated_image_id, asset_id, oss_url,
               prompt, status, is_selected, sort_order, failure_reason, updated_at`,
    [
      input.projectId,
      input.roundId,
      input.sceneConceptId,
      input.generatedImageId,
      input.ossUrl,
      input.prompt,
      input.status,
      input.sortOrder,
      input.actorId,
    ]
  );

  return mapImage(result.rows[0]);
}

export async function selectCreativeSceneImages(input: {
  projectId: string;
  sceneConceptId: string;
  imageIds: string[];
  actorId: string;
}) {
  return withTransaction(async (tx) => {
    const existingResult = await tx<CreativeSceneImageRow>(
      `select id, project_id, round_id, scene_concept_id, generated_image_id, asset_id, oss_url,
              prompt, status, is_selected, sort_order, failure_reason, updated_at
       from creative_scene_images
       where project_id = $1
         and scene_concept_id = $2
       for update`,
      [input.projectId, input.sceneConceptId]
    );

    const eligibleIds = new Set(existingResult.rows.filter((image) => image.status === "generated" || image.status === "selected").map((image) => image.id));
    if (input.imageIds.some((id) => !eligibleIds.has(id))) {
      throw new AppError({
        status: 422,
        code: "creative_scene_image_selection_invalid",
        userMessage: "选中的候选图不属于这个视觉场景，或还没有生成成功。请刷新工作台后重新选择。",
      });
    }

    await tx(
      `update creative_scene_images
       set is_selected = id = any($3::uuid[]),
           status = case when id = any($3::uuid[]) then 'selected' when status = 'selected' then 'generated' else status end,
           updated_at = now()
       where project_id = $1
         and scene_concept_id = $2`,
      [input.projectId, input.sceneConceptId, input.imageIds]
    );

    const conceptResult = await tx<CreativeSceneConceptRow>(
      `update creative_scene_concepts
       set selected_image_ids = $3::jsonb,
           status = 'selected',
           updated_by = case when exists (select 1 from users where id = $4::uuid) then $4::uuid else null end,
           updated_at = now()
       where project_id = $1
         and id = $2
       returning id, project_id, round_id, direction_id, scene_index, title, description, source_text,
                 image_prompt, required_image_count, selected_image_ids, status, version, snapshot_json, updated_at`,
      [input.projectId, input.sceneConceptId, JSON.stringify(input.imageIds), input.actorId]
    );

    const concept = conceptResult.rows[0];
    if (!concept) {
      throw new AppError({
        status: 404,
        code: "creative_scene_concept_not_found",
        userMessage: "没有找到这个视觉场景。请刷新工作台后再试。",
      });
    }

    const imageResult = await tx<CreativeSceneImageRow>(
      `select id, project_id, round_id, scene_concept_id, generated_image_id, asset_id, oss_url,
              prompt, status, is_selected, sort_order, failure_reason, updated_at
       from creative_scene_images
       where project_id = $1
         and scene_concept_id = $2
       order by sort_order asc, updated_at asc`,
      [input.projectId, input.sceneConceptId]
    );

    await tx(
      `insert into audit_logs (actor_id, project_id, action, object_type, object_id, after_json)
       values ($1, $2, 'creative_scene_concept.images_selected', 'creative_scene_concept', $3, $4::jsonb)`,
      [
        input.actorId,
        input.projectId,
        input.sceneConceptId,
        JSON.stringify({
          selectedImageIds: input.imageIds,
        }),
      ]
    );

    return mapConcept(concept, imageResult.rows.map(mapImage));
  });
}

export async function linkCreativeProposalRoundClientReview(input: {
  projectId: string;
  roundId: string;
  reviewTaskId: string;
  actorId: string;
}) {
  await query(
    `update creative_proposal_rounds
     set status = 'client_reviewing',
         client_review_task_id = $3,
         updated_by = case when exists (select 1 from users where id = $4::uuid) then $4::uuid else null end,
         updated_at = now()
     where project_id = $1
       and id = $2`,
    [input.projectId, input.roundId, input.reviewTaskId, input.actorId]
  );
}

export async function updateCreativeProposalRoundClientDecision(input: {
  projectId: string;
  roundId: string;
  approved: boolean;
  feedback: string;
  decisionPayload: Record<string, unknown>;
}) {
  await query(
    `update creative_proposal_rounds
     set status = $3,
         client_feedback_json = $4::jsonb,
         updated_at = now()
     where project_id = $1
       and id = $2`,
    [
      input.projectId,
      input.roundId,
      input.approved ? "client_approved" : "client_rejected",
      JSON.stringify({
        feedback: input.feedback,
        decisionPayload: input.decisionPayload,
      }),
    ]
  );
}

function mapRound(row: CreativeProposalRoundRow, concepts: CreativeSceneConceptView[]): CreativeProposalRoundView {
  return {
    id: row.id,
    projectId: row.project_id,
    roundNumber: row.round_number,
    status: row.status,
    version: row.version,
    directionIds: readStringArray(row.direction_ids),
    retainedDirectionIds: readStringArray(row.retained_direction_ids),
    clientFeedback: readRecord(row.client_feedback_json),
    clientReviewTaskId: row.client_review_task_id,
    snapshot: readRecord(row.snapshot_json),
    concepts,
    updatedAt: row.updated_at,
  };
}

function mapConcept(row: CreativeSceneConceptRow, images: CreativeSceneImageView[]): CreativeSceneConceptView {
  return {
    id: row.id,
    projectId: row.project_id,
    roundId: row.round_id,
    directionId: row.direction_id,
    sceneIndex: row.scene_index,
    title: row.title,
    description: row.description,
    sourceText: row.source_text,
    imagePrompt: row.image_prompt,
    requiredImageCount: row.required_image_count,
    selectedImageIds: readStringArray(row.selected_image_ids),
    status: row.status,
    version: row.version,
    snapshot: readRecord(row.snapshot_json),
    images,
    updatedAt: row.updated_at,
  };
}

function mapImage(row: CreativeSceneImageRow): CreativeSceneImageView {
  return {
    id: row.id,
    projectId: row.project_id,
    roundId: row.round_id,
    sceneConceptId: row.scene_concept_id,
    generatedImageId: row.generated_image_id,
    assetId: row.asset_id,
    ossUrl: row.oss_url,
    prompt: row.prompt,
    status: row.status,
    isSelected: row.is_selected,
    sortOrder: row.sort_order,
    failureReason: row.failure_reason,
    updatedAt: row.updated_at,
  };
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
