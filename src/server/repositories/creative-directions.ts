import { query } from "@/lib/db";

export type CreativeDirectionView = {
  id: string;
  projectId: string;
  title: string;
  coreIdea: string;
  fitReason: string;
  riskNotes: string;
  referenceTags: string[];
  score: number;
  costEstimate: string;
  cycleEstimate: string;
  technicalDifficulty: string;
  atmospherePrompt: string;
  detail: unknown;
  isSelected: boolean;
  selectedAt: string | null;
  status: string;
  sortOrder: number;
  sourceJobId: string | null;
  updatedAt: string;
};

type CreativeDirectionRow = {
  id: string;
  project_id: string;
  title: string;
  core_idea: string;
  fit_reason: string;
  risk_notes: string;
  reference_tags: unknown;
  score: string;
  cost_estimate: string;
  cycle_estimate: string;
  technical_difficulty: string;
  atmosphere_prompt: string;
  detail_json: unknown;
  is_selected: boolean;
  selected_at: string | null;
  status: string;
  sort_order: number;
  source_job_id: string | null;
  updated_at: string;
};

export async function listProjectCreativeDirections(projectId: string) {
  const result = await query<CreativeDirectionRow>(
    `select id, project_id, title, core_idea, fit_reason, risk_notes, reference_tags, score,
            cost_estimate, cycle_estimate, technical_difficulty, atmosphere_prompt, detail_json,
            is_selected, selected_at, status, sort_order, source_job_id, updated_at
     from creative_directions
     where project_id = $1
       and status <> 'archived'
     order by sort_order asc, updated_at desc
     limit 50`,
    [projectId]
  );

  return result.rows.map(mapDirection);
}

export async function getProjectCreativeDirection(input: { projectId: string; directionId: string }) {
  const result = await query<CreativeDirectionRow>(
    `select id, project_id, title, core_idea, fit_reason, risk_notes, reference_tags, score,
            cost_estimate, cycle_estimate, technical_difficulty, atmosphere_prompt, detail_json,
            is_selected, selected_at, status, sort_order, source_job_id, updated_at
     from creative_directions
     where project_id = $1
       and id = $2
       and status <> 'archived'`,
    [input.projectId, input.directionId]
  );

  return result.rows[0] ? mapDirection(result.rows[0]) : null;
}

export async function archiveProjectCreativeDirections(input: { projectId: string; sourceJobId: string }) {
  await query(
    `update creative_directions
     set status = 'archived',
         is_selected = false,
         selected_at = null,
         updated_at = now()
     where project_id = $1
       and status <> 'archived'
       and source_job_id is distinct from $2`,
    [input.projectId, input.sourceJobId]
  );
}

export async function createCreativeDirections(input: {
  projectId: string;
  sourceJobId: string;
  createdBy?: string | null;
  directions: Array<{
    title: string;
    coreIdea: string;
    fitReason: string;
    riskNotes: string;
    referenceTags: string[];
    score: number;
    costEstimate: string;
    cycleEstimate: string;
    technicalDifficulty: string;
    atmospherePrompt: string;
    detail: unknown;
    sortOrder: number;
  }>;
}) {
  const saved: CreativeDirectionView[] = [];

  for (const direction of input.directions) {
    const result = await query<CreativeDirectionRow>(
      `insert into creative_directions (
         project_id, title, core_idea, fit_reason, risk_notes, reference_tags, score,
         cost_estimate, cycle_estimate, technical_difficulty, atmosphere_prompt, detail_json,
         sort_order, source_job_id, created_by
       )
       values (
         $1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12::jsonb,
         $13, $14, case when exists (select 1 from users where id = $15::uuid) then $15::uuid else null end
       )
       returning id, project_id, title, core_idea, fit_reason, risk_notes, reference_tags, score,
                 cost_estimate, cycle_estimate, technical_difficulty, atmosphere_prompt, detail_json,
                 is_selected, selected_at, status, sort_order, source_job_id, updated_at`,
      [
        input.projectId,
        direction.title,
        direction.coreIdea,
        direction.fitReason,
        direction.riskNotes,
        JSON.stringify(direction.referenceTags),
        direction.score,
        direction.costEstimate,
        direction.cycleEstimate,
        direction.technicalDifficulty,
        direction.atmospherePrompt,
        JSON.stringify(direction.detail),
        direction.sortOrder,
        input.sourceJobId,
        input.createdBy ?? null,
      ]
    );
    saved.push(mapDirection(result.rows[0]));
  }

  return saved;
}

export async function updateCreativeDirectionSelection(input: {
  projectId: string;
  directionId: string;
  isSelected: boolean;
}) {
  const result = await query<CreativeDirectionRow>(
    `update creative_directions
     set is_selected = $3,
         selected_at = case when $3 = true then now() else null end,
         updated_at = now()
     where project_id = $1
       and id = $2
       and status <> 'archived'
     returning id, project_id, title, core_idea, fit_reason, risk_notes, reference_tags, score,
               cost_estimate, cycle_estimate, technical_difficulty, atmosphere_prompt, detail_json,
               is_selected, selected_at, status, sort_order, source_job_id, updated_at`,
    [input.projectId, input.directionId, input.isSelected]
  );

  return result.rows[0] ? mapDirection(result.rows[0]) : null;
}

export async function updateCreativeDirectionStatus(input: {
  projectId: string;
  directionId: string;
  status: string;
}) {
  const result = await query<CreativeDirectionRow>(
    `update creative_directions
     set status = $3,
         updated_at = now()
     where project_id = $1
       and id = $2
       and status <> 'archived'
     returning id, project_id, title, core_idea, fit_reason, risk_notes, reference_tags, score,
               cost_estimate, cycle_estimate, technical_difficulty, atmosphere_prompt, detail_json,
               is_selected, selected_at, status, sort_order, source_job_id, updated_at`,
    [input.projectId, input.directionId, input.status]
  );

  return result.rows[0] ? mapDirection(result.rows[0]) : null;
}

export async function updateCreativeDirectionContent(input: {
  projectId: string;
  directionId: string;
  title: string;
  coreIdea: string;
  fitReason: string;
  riskNotes: string;
  costEstimate: string;
  cycleEstimate: string;
  technicalDifficulty: string;
}) {
  const result = await query<CreativeDirectionRow>(
    `update creative_directions
     set title = $3,
         core_idea = $4,
         fit_reason = $5,
         risk_notes = $6,
         cost_estimate = $7,
         cycle_estimate = $8,
         technical_difficulty = $9,
         status = case when status in ('needs_revision', 'waiting_review', 'approved') then 'draft' else status end,
         updated_at = now()
     where project_id = $1
       and id = $2
       and status <> 'archived'
     returning id, project_id, title, core_idea, fit_reason, risk_notes, reference_tags, score,
               cost_estimate, cycle_estimate, technical_difficulty, atmosphere_prompt, detail_json,
               is_selected, selected_at, status, sort_order, source_job_id, updated_at`,
    [
      input.projectId,
      input.directionId,
      input.title,
      input.coreIdea,
      input.fitReason,
      input.riskNotes,
      input.costEstimate,
      input.cycleEstimate,
      input.technicalDifficulty,
    ]
  );

  return result.rows[0] ? mapDirection(result.rows[0]) : null;
}

function mapDirection(row: CreativeDirectionRow): CreativeDirectionView {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    coreIdea: row.core_idea,
    fitReason: row.fit_reason,
    riskNotes: row.risk_notes,
    referenceTags: Array.isArray(row.reference_tags) ? row.reference_tags.map(String) : [],
    score: Number(row.score),
    costEstimate: row.cost_estimate,
    cycleEstimate: row.cycle_estimate,
    technicalDifficulty: row.technical_difficulty,
    atmospherePrompt: row.atmosphere_prompt,
    detail: row.detail_json,
    isSelected: row.is_selected,
    selectedAt: row.selected_at,
    status: row.status,
    sortOrder: row.sort_order,
    sourceJobId: row.source_job_id,
    updatedAt: row.updated_at,
  };
}
