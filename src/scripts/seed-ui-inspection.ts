import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const UI_INSPECTION_MARKER = "ui_inspection_sample";
const BRAND_NAME = "流程巡检";
const PROJECT_NAME_PREFIX = "全流程界面卡片检查";
const OWNER_NAME = "UI 巡检";
const SAMPLE_IMAGE_URL =
  "https://augc-flow.oss-cn-shenzhen.aliyuncs.com/projects/de34f8aa-8c85-4005-8c60-bca30579f128/generated-images/a61cf4f6-01e1-43d8-b27e-3df668186a1c/atmosphere.png";
const SAMPLE_VIDEO_URL = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

const stageKeys = [
  "brand_requirement_intake",
  "technical_feasibility",
  "creative_direction_proposal",
  "selection_quote_contract",
  "script_storyboard_confirmation",
  "storyboard_image_canvas",
  "ai_video_canvas",
  "a_copy_revision",
  "b_copy_final_confirmation",
  "settlement_delivery_archive",
] as const;

type StageKey = (typeof stageKeys)[number];

async function getDb() {
  const { query, withTransaction } = await import("@/lib/db");
  return { query, withTransaction };
}

async function ensureSeedActor() {
  const { query } = await getDb();
  const email = "ui-inspection@local.invalid";
  const existing = await query<{ id: string }>(`select id from users where email = $1 limit 1`, [email]);
  if (existing.rows[0]) return existing.rows[0].id;

  const id = randomUUID();
  await query(
    `insert into users (id, name, email, role, is_active)
     values ($1, 'UI 巡检 Agent', $2, 'admin', true)`,
    [id, email]
  );
  return id;
}

async function ensureUiInspectionProject(actorId: string) {
  const { query } = await getDb();
  const existing = await query<{ id: string }>(
    `select id
     from projects
     where archived_at is null
       and brand_name = $1
       and project_name like $2
     order by updated_at desc
     limit 1`,
    [BRAND_NAME, `${PROJECT_NAME_PREFIX}%`]
  );
  const projectId = existing.rows[0]?.id ?? randomUUID();

  if (!existing.rows[0]) {
    await query(
      `insert into projects (id, brand_name, project_name, current_stage, owner_id, owner_name, due_date, status)
       values ($1, $2, $3, 'settlement_delivery_archive', $4, $5, current_date + interval '14 days', 'in_progress')`,
      [projectId, BRAND_NAME, `${PROJECT_NAME_PREFIX} UI 巡检样例`, actorId, OWNER_NAME]
    );
  } else {
    await query(
      `update projects
       set current_stage = 'settlement_delivery_archive',
           status = 'in_progress',
           owner_id = coalesce(owner_id, $2),
           owner_name = $3,
           updated_at = now()
       where id = $1`,
      [projectId, actorId, OWNER_NAME]
    );
  }

  await query(
    `insert into project_members (project_id, user_id, role)
     values ($1, $2, 'admin')
     on conflict (project_id, user_id) do update set role = excluded.role`,
    [projectId, actorId]
  );
  return projectId;
}

async function seedStageStates(projectId: string) {
  const { query } = await getDb();
  for (const stageKey of stageKeys) {
    const status = stageKey === "settlement_delivery_archive" ? "in_progress" : "completed";
    await query(
      `insert into project_stage_states (
         project_id, stage_key, status, owner_name, started_at, completed_at,
         input_refs, output_refs, snapshot, updated_at
       )
       values ($1, $2, $3, $4, now(), case when $3 = 'completed' then now() else null end,
               '[]'::jsonb, '[]'::jsonb, $5::jsonb, now())
       on conflict (project_id, stage_key)
       do update set
         status = excluded.status,
         owner_name = excluded.owner_name,
         started_at = coalesce(project_stage_states.started_at, excluded.started_at),
         completed_at = excluded.completed_at,
         snapshot = excluded.snapshot,
         updated_at = now()`,
      [projectId, stageKey, status, OWNER_NAME, JSON.stringify({ marker: UI_INSPECTION_MARKER, stageKey })]
    );
  }
}

async function seedBriefAndRisk(_projectId: string, _actorId: string) {
  void SAMPLE_IMAGE_URL;
}

async function seedCreativeAndCommercial(_projectId: string, _actorId: string) {
  void UI_INSPECTION_MARKER;
}

async function seedScriptSetupAndStoryboard(_projectId: string, _actorId: string) {
  void SAMPLE_VIDEO_URL;
}

async function seedReviewCutsAndArchive(_projectId: string, _actorId: string) {
  const _stageKeys: readonly StageKey[] = stageKeys;
  void _stageKeys;
}

async function main() {
  const actorId = await ensureSeedActor();
  const projectId = await ensureUiInspectionProject(actorId);
  await seedStageStates(projectId);
  await seedBriefAndRisk(projectId, actorId);
  await seedCreativeAndCommercial(projectId, actorId);
  await seedScriptSetupAndStoryboard(projectId, actorId);
  await seedReviewCutsAndArchive(projectId, actorId);
  console.log(JSON.stringify({ ok: true, projectId, marker: UI_INSPECTION_MARKER }, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "UI inspection seed failed");
  process.exit(1);
});
