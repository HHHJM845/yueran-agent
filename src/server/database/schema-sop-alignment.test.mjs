import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
const supabaseMigration = readFileSync(
  new URL("../../../supabase/migrations/20260630000000_initial_backend_schema.sql", import.meta.url),
  "utf8",
);
const supabaseMigrationDoc = readFileSync(new URL("../../../docs/SUPABASE_MIGRATION.md", import.meta.url), "utf8");

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function expectAlterTableBlock(tableName, columnFragments) {
  const blockPattern = new RegExp(
    `alter table ${tableName}\\s+([\\s\\S]*?);`,
    "i",
  );
  const blockMatch = schema.match(blockPattern);

  assert.ok(blockMatch, `Expected alter table block for ${tableName}`);

  const block = blockMatch[1];

  for (const columnFragment of columnFragments) {
    assert.match(
      block,
      new RegExp(escapeRegex(columnFragment), "i"),
      `Expected ${tableName} block to contain "${columnFragment}"`,
    );
  }
}

test("schema contains SOP alignment tables and review metadata", () => {
  for (const table of [
    "risk_check_cards",
    "risk_check_facts",
    "risk_check_dimensions",
    "creative_proposal_rounds",
    "creative_scene_concepts",
    "creative_scene_images",
    "workload_estimates",
    "delivery_checklists",
    "delivery_checklist_items",
    "production_entities",
    "production_reference_sets",
    "storyboard_image_batches",
    "storyboard_image_batch_items",
    "storyboard_image_versions",
    "storyboard_video_generation_inputs",
    "change_requests",
    "archive_records",
  ]) {
    assert.match(schema, new RegExp(`create table if not exists ${table}\\b`));
  }

  expectAlterTableBlock("client_review_tasks", [
    "add column if not exists sop_key text",
    "add column if not exists review_scene text",
    "add column if not exists round_number integer",
    "add column if not exists batch_number integer",
    "add column if not exists review_payload_version integer not null default 1",
  ]);

  expectAlterTableBlock("client_review_items", [
    "add column if not exists target_kind text",
    "add column if not exists target_version integer",
    "add column if not exists feedback_payload_json jsonb not null default '{}'::jsonb",
  ]);

  expectAlterTableBlock("review_cuts", [
    "add column if not exists round_number integer not null default 1",
    "add column if not exists snapshot_json jsonb not null default '{}'::jsonb",
    "add column if not exists change_request_hint text",
  ]);

  for (const representativePattern of [
    /create table if not exists creative_proposal_rounds[\s\S]*round_number integer not null check \(round_number in \(1, 2\)\)/,
    /create table if not exists creative_scene_concepts[\s\S]*required_image_count integer not null default 4/,
    /create table if not exists workload_estimates[\s\S]*deliverable_versions jsonb not null default '\[\]'::jsonb/,
    /create table if not exists production_entities[\s\S]*entity_type text not null check \(entity_type in \('character', 'scene', 'prop'\)\)/,
    /create table if not exists client_review_tasks[\s\S]*review_type text not null check \(review_type in \([\s\S]*'storyboard_image_batch'[\s\S]*\)\)/,
    /create table if not exists client_review_tasks[\s\S]*target_scope_type text not null check \(target_scope_type in \([\s\S]*'storyboard_image_batch'[\s\S]*\)\)/,
    /create table if not exists storyboard_image_batches[\s\S]*batch_number integer not null check \(batch_number >= 1\)/,
    /create table if not exists change_requests[\s\S]*impact_json jsonb not null default '\{\}'::jsonb/,
    /create table if not exists archive_records[\s\S]*case_study_permission text not null default 'pending'/,
  ]) {
    assert.match(schema, representativePattern);
  }
});

test("SOP5 production entity prompt pool schema is persisted", async () => {
  const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");

  assert.match(schema, /plain_script text not null default ''/);
  assert.match(schema, /standardized_script text not null default ''/);
  assert.match(schema, /create table if not exists script_revision_messages/);
  assert.match(schema, /inclusion_status text not null default 'active'/);
  assert.match(schema, /ignore_reason text not null default ''/);
  assert.match(schema, /confirmed_at timestamptz/);
  assert.match(schema, /current_prompt text not null default ''/);
  assert.match(schema, /selected_image_id uuid references generated_images\(id\) on delete set null/);
  assert.match(schema, /default_ratio text not null default '1:1'/);
  assert.match(schema, /last_generation_count integer not null default 1/);
  assert.match(schema, /metadata_json jsonb not null default '\{\}'::jsonb/);
});

test("SOP4 contracts persist source mode and signed contract proof asset", async () => {
  const contractsRepository = readFileSync(new URL("../repositories/contracts.ts", import.meta.url), "utf8");
  const projectsRepository = readFileSync(new URL("../repositories/projects.ts", import.meta.url), "utf8");
  const workspaceRoute = readFileSync(new URL("../../app/api/projects/[projectId]/workspace/route.ts", import.meta.url), "utf8");
  const modeRoutePath = new URL("../../app/api/projects/[projectId]/sop4-mode/route.ts", import.meta.url);
  const workspaceApi = readFileSync(new URL("../../components/workspace/api.ts", import.meta.url), "utf8");

  assert.doesNotMatch(schema, /sop4_contract_mode/);
  assert.match(schema, /mode text not null default 'vendor_provided' check \(mode in \('vendor_provided', 'client_provided'\)\)/);
  assert.match(schema, /signed_contract_asset_id uuid references assets\(id\) on delete set null/);
  assert.match(contractsRepository, /mode: ContractMode/);
  assert.match(contractsRepository, /signedContractAssetId: string \| null/);
  assert.match(contractsRepository, /signed_contract_asset_id/);
  assert.doesNotMatch(projectsRepository, /sop4_contract_mode/);
  assert.doesNotMatch(projectsRepository, /setSop4ContractMode/);
  assert.doesNotMatch(projectsRepository, /sop4_contract_mode_locked/);
  assert.doesNotMatch(workspaceRoute, /sop4ContractMode/);
  assert.equal(existsSync(modeRoutePath), false);
  assert.doesNotMatch(workspaceApi, /export async function setSop4ContractMode/);
  assert.doesNotMatch(workspaceApi, /\/api\/projects\/\$\{projectId\}\/sop4-mode/);
});

test("Supabase migration includes backend schema and locked-down service-role access", () => {
  assert.match(supabaseMigration, /AUGC Flow Supabase backend migration/);
  assert.match(supabaseMigration, /Target project ref: jrzyddeijiltyruiawvc/);
  assert.ok(
    supabaseMigration.includes(schema.trimEnd()),
    "Supabase migration must embed the current backend schema.sql before adding Supabase-specific policies",
  );

  for (const table of [
    "users",
    "user_sessions",
    "projects",
    "project_members",
    "assets",
    "jobs",
    "job_events",
    "ai_task_logs",
    "audit_logs",
    "archive_records",
  ]) {
    assert.match(supabaseMigration, new RegExp(`create table if not exists ${table}\\b`));
    assert.match(supabaseMigration, new RegExp(`alter table ${table} enable row level security`));
    assert.match(supabaseMigration, new RegExp(`create policy ${table}_service_role_all`));
  }

  assert.match(supabaseMigration, /create table if not exists app_settings\b/);
  assert.match(supabaseMigration, /create or replace function set_updated_at\(\)/);
  assert.match(supabaseMigration, /revoke all on table users from anon, authenticated/);
  assert.match(supabaseMigration, /grant all on all tables in schema public to service_role/);
  assert.match(supabaseMigration, /create or replace view backend_migration_health as/);
  assert.match(supabaseMigration, /Optional post-run checks:/);
  assert.match(supabaseMigration, /select \* from backend_migration_health;/);
});

test("Supabase migration documentation only maps tables and views that exist", () => {
  const schemaObjects = new Set([
    ...[...supabaseMigration.matchAll(/create table if not exists\s+([a-zA-Z_][a-zA-Z0-9_]*)\b/g)].map((match) => match[1]),
    ...[...supabaseMigration.matchAll(/create or replace view\s+([a-zA-Z_][a-zA-Z0-9_]*)\b/g)].map((match) => match[1]),
  ]);
  const mappingSection = supabaseMigrationDoc.match(/## 目标到表的覆盖映射([\s\S]*?)\n## /)?.[1] ?? "";
  const mappingRows = mappingSection
    .split("\n")
    .filter((line) => line.startsWith("|") && !line.includes("---"));
  const documentedObjects = mappingRows.flatMap((line) =>
    [...line.matchAll(/`([a-zA-Z_][a-zA-Z0-9_]*)`/g)].map((match) => match[1]),
  );
  const ignoredCodeIdentifiers = new Set(["service_role"]);
  const missing = documentedObjects.filter((objectName) => !schemaObjects.has(objectName) && !ignoredCodeIdentifiers.has(objectName));

  assert.deepEqual([...new Set(missing)].sort(), []);
});
