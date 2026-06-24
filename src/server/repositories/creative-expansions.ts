import { query } from "@/lib/db";

export type CreativeExpansionView = {
  id: string;
  projectId: string;
  directionId: string;
  title: string;
  oneLiner: string;
  storyArc: Record<string, string>;
  visualHighlights: string[];
  visualStyle: string;
  productionDifficulty: string;
  riskNotes: string;
  status: string;
  sortOrder: number;
  sourceJobId: string | null;
  updatedAt: string;
};

type CreativeExpansionRow = {
  id: string;
  project_id: string;
  direction_id: string;
  title: string;
  one_liner: string;
  story_arc_json: unknown;
  visual_highlights: unknown;
  visual_style: string;
  production_difficulty: string;
  risk_notes: string;
  status: string;
  sort_order: number;
  source_job_id: string | null;
  updated_at: string;
};

export async function listProjectCreativeExpansions(projectId: string) {
  const result = await query<CreativeExpansionRow>(
    `select id, project_id, direction_id, title, one_liner, story_arc_json, visual_highlights,
            visual_style, production_difficulty, risk_notes, status, sort_order, source_job_id, updated_at
     from creative_expansions
     where project_id = $1
       and status <> 'archived'
     order by direction_id asc, sort_order asc, updated_at desc
     limit 200`,
    [projectId]
  );

  return result.rows.map(mapExpansion);
}

export async function getProjectCreativeExpansion(input: { projectId: string; expansionId: string }) {
  const result = await query<CreativeExpansionRow>(
    `select id, project_id, direction_id, title, one_liner, story_arc_json, visual_highlights,
            visual_style, production_difficulty, risk_notes, status, sort_order, source_job_id, updated_at
     from creative_expansions
     where project_id = $1
       and id = $2
       and status <> 'archived'
     limit 1`,
    [input.projectId, input.expansionId]
  );

  return result.rows[0] ? mapExpansion(result.rows[0]) : null;
}

export async function archiveDirectionCreativeExpansions(input: { directionId: string; sourceJobId: string }) {
  await query(
    `update creative_expansions
     set status = 'archived',
         updated_at = now()
     where direction_id = $1
       and status <> 'archived'
       and source_job_id is distinct from $2`,
    [input.directionId, input.sourceJobId]
  );
}

export async function createCreativeExpansions(input: {
  projectId: string;
  directionId: string;
  sourceJobId: string;
  createdBy?: string | null;
  expansions: Array<{
    title: string;
    oneLiner: string;
    storyArc: Record<string, string>;
    visualHighlights: string[];
    visualStyle: string;
    productionDifficulty: string;
    riskNotes: string;
    sortOrder: number;
  }>;
}) {
  const saved: CreativeExpansionView[] = [];

  for (const expansion of input.expansions) {
    const result = await query<CreativeExpansionRow>(
      `insert into creative_expansions (
         project_id, direction_id, title, one_liner, story_arc_json, visual_highlights,
         visual_style, production_difficulty, risk_notes, sort_order, source_job_id, created_by
       )
       values (
         $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11,
         case when exists (select 1 from users where id = $12::uuid) then $12::uuid else null end
       )
       returning id, project_id, direction_id, title, one_liner, story_arc_json, visual_highlights,
                 visual_style, production_difficulty, risk_notes, status, sort_order, source_job_id, updated_at`,
      [
        input.projectId,
        input.directionId,
        expansion.title,
        expansion.oneLiner,
        JSON.stringify(expansion.storyArc),
        JSON.stringify(expansion.visualHighlights),
        expansion.visualStyle,
        expansion.productionDifficulty,
        expansion.riskNotes,
        expansion.sortOrder,
        input.sourceJobId,
        input.createdBy ?? null,
      ]
    );
    saved.push(mapExpansion(result.rows[0]));
  }

  return saved;
}

function mapExpansion(row: CreativeExpansionRow): CreativeExpansionView {
  return {
    id: row.id,
    projectId: row.project_id,
    directionId: row.direction_id,
    title: row.title,
    oneLiner: row.one_liner,
    storyArc: normalizeStoryArc(row.story_arc_json),
    visualHighlights: Array.isArray(row.visual_highlights) ? row.visual_highlights.map(String) : [],
    visualStyle: row.visual_style,
    productionDifficulty: row.production_difficulty,
    riskNotes: row.risk_notes,
    status: row.status,
    sortOrder: row.sort_order,
    sourceJobId: row.source_job_id,
    updatedAt: row.updated_at,
  };
}

function normalizeStoryArc(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, String(item ?? "")]));
}
