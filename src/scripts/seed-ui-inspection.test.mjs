import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("UI inspection seed script is wired and avoids real external providers", async () => {
  const pkg = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
  const source = await readFile(new URL("./seed-ui-inspection.ts", import.meta.url), "utf8").catch(() => "");

  assert.equal(pkg.scripts["seed:ui-inspection"], "tsx src/scripts/seed-ui-inspection.ts");
  assert.match(source, /UI_INSPECTION_MARKER/);
  assert.match(source, /ui_inspection_sample/);
  assert.match(source, /ensureUiInspectionProject/);
  assert.match(source, /seedStageStates/);
  assert.match(source, /seedBriefAndRisk/);
  assert.match(source, /seedCreativeAndCommercial/);
  assert.match(source, /seedScriptSetupAndStoryboard/);
  assert.match(source, /seedReviewCutsAndArchive/);
  assert.match(source, /storyboard_images/);
  assert.match(source, /storyboard_image_batches/);
  assert.match(source, /storyboard_image_batch_items/);
  assert.match(source, /storyboard_videos/);
  assert.match(source, /storyboard_video_generation_inputs/);
  assert.match(source, /review_cuts/);
  assert.match(source, /archive_records/);
  assert.match(source, /SAMPLE_VIDEO_URL/);
  assert.match(source, /from change_requests/);
  assert.doesNotMatch(source, /insert into change_requests[\s\S]*on conflict do nothing/);
  assert.match(source, /from review_cuts/);
  assert.doesNotMatch(source, /on conflict \(project_id, cut_type, version\)/);
  assert.match(source, /risk_check_cards/);
  assert.match(source, /creative_directions/);
  assert.match(source, /creative_proposal_rounds/);
  assert.match(source, /workload_estimates/);
  assert.match(source, /quotes/);
  assert.match(source, /contracts/);
  assert.match(source, /script_direction_packages/);
  assert.match(source, /production_entities/);
  assert.match(source, /production_reference_sets/);
  assert.match(source, /storyboard_scenes/);
  assert.match(source, /storyboard_shots/);
  assert.match(source, /current_stage = 'settlement_delivery_archive'/);
  assert.doesNotMatch(source, /generateOpenAIImage/);
  assert.doesNotMatch(source, /callArk/);
  assert.doesNotMatch(source, /deliverToFeishu/);
});

test("UI inspection seed script only uses supported delivery checklist item kinds", async () => {
  const source = await readFile(new URL("./seed-ui-inspection.ts", import.meta.url), "utf8");

  assert.doesNotMatch(source, /\["(?:proposal|quote|contract|script|review)",/);
});

test("UI inspection seed script does not broadly delete editable child collections", async () => {
  const source = await readFile(new URL("./seed-ui-inspection.ts", import.meta.url), "utf8");

  assert.match(source, /delete from creative_scene_images[\s\S]*?prompt like \$3/);
  assert.doesNotMatch(source, /delete from delivery_checklist_items where project_id = \$1 and checklist_id = \$2/);
  assert.doesNotMatch(source, /delete from storyboard_shots where project_id = \$1 and scene_id = \$2/);
  assert.match(source, /delete from client_review_items[\s\S]*?item_type = 'storyboard_shot_image'[\s\S]*?metadata_json->>'marker' = \$3/);
  assert.match(source, /delete from client_review_items[\s\S]*?item_type = 'review_cut_video'[\s\S]*?metadata_json->>'marker' = \$3/);
  assert.match(source, /delete from storyboard_image_batch_items[\s\S]*?feedback_payload_json->>'marker' = \$3/);
  assert.match(source, /delete from storyboard_video_generation_inputs[\s\S]*?metadata_json->>'marker' = \$3/);
  assert.doesNotMatch(source, /delete from review_cut_annotations where project_id = \$1 and review_cut_id = \$2/);
  assert.match(source, /metadata_json->>'marker' = \$\d+/);
});
