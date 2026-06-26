import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");

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
    /create table if not exists storyboard_image_batches[\s\S]*batch_number integer not null check \(batch_number in \(1, 2, 3\)\)/,
    /create table if not exists change_requests[\s\S]*impact_json jsonb not null default '\{\}'::jsonb/,
    /create table if not exists archive_records[\s\S]*case_study_permission text not null default 'pending'/,
  ]) {
    assert.match(schema, representativePattern);
  }
});
