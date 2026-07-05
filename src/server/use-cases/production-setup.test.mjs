import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("assertProductionSetupLocked requires locked entities before image stage", async () => {
  const source = await readFile(new URL("./production-setup.ts", import.meta.url), "utf8");

  assert.match(source, /assertProductionSetupLocked/);
  assert.match(source, /storyboard_required_before_image_stage/);
  assert.match(source, /production_setup_not_locked/);
  assert.match(source, /entity\.status !== "locked"/);
});

test("storyboard image generation is protected by the production setup lock gate", async () => {
  const source = await readFile(new URL("./storyboard-media.ts", import.meta.url), "utf8");

  assert.match(source, /assertProductionSetupLocked/);
  assert.match(source, /listProductionEntities/);
  assert.match(source, /listStoryboardShots/);
  assert.match(source, /assertProductionSetupLocked\(\{\s*entities,\s*storyboardShots/s);
});

test("upsertProductionEntity preserves reference depth when caller omits it", async () => {
  const source = await readFile(new URL("../repositories/production-entities.ts", import.meta.url), "utf8");

  assert.match(source, /reference_depth\s*=\s*coalesce\(\$6,\s*reference_depth\)/i);
  assert.match(source, /input\.referenceDepth\s*\?\?\s*null/);
  assert.doesNotMatch(source, /reference_depth\s*=\s*\$6[\s\S]*input\.referenceDepth\s*\?\?\s*"basic"/);
});

test("production setup review requires confirmed generated reference images", async () => {
  const source = await readFile(new URL("./production-setup.ts", import.meta.url), "utf8");
  const generatedImages = await readFile(new URL("../repositories/generated-images.ts", import.meta.url), "utf8");

  assert.match(generatedImages, /listGeneratedImagesByIds/);
  assert.match(source, /assertProductionSetupReferenceImagesReady/);
  assert.match(source, /reviewStatus === "confirmed"/);
  assert.match(source, /production_reference_image_missing/);
});

test("production setup review gate skips ignored entities", async () => {
  const source = await readFile(new URL("./production-setup.ts", import.meta.url), "utf8");

  assert.match(source, /const activeEntities = setup\.entities\.filter\(\(entity\) => entity\.inclusionStatus !== "ignored"\)/);
  assert.match(source, /const missingReference = activeEntities\.find\(/);
  assert.match(source, /entities: activeEntities/);
  assert.match(source, /const activeEntities = input\.entities\.filter\(\(entity\) => entity\.inclusionStatus !== "ignored"\)/);
  assert.match(source, /for \(const entity of activeEntities\)/);
});

test("production setup supports confirmable active and ignored entity lists", async () => {
  const source = await readFile(new URL("./production-setup.ts", import.meta.url), "utf8");
  const repository = await readFile(new URL("../repositories/production-entities.ts", import.meta.url), "utf8");
  const route = await readFile(new URL("../../app/api/projects/[projectId]/production-entities/route.ts", import.meta.url), "utf8");

  assert.match(source, /confirmProductionEntityList/);
  assert.match(source, /genericCharacterNames/);
  assert.match(source, /inclusionStatus !== "ignored"/);
  assert.match(repository, /setProductionEntityInclusion/);
  assert.match(repository, /updateProductionEntityDetails/);
  assert.match(route, /action: z\.literal\("create_entity"\)/);
  assert.match(route, /action: z\.literal\("ignore_entity"\)/);
  assert.match(route, /action: z\.literal\("restore_entity"\)/);
  assert.match(route, /action: z\.literal\("confirm_list"\)/);
});

test("production setup confirmation is gated by confirmed storyboard sequence", async () => {
  const source = await readFile(new URL("./production-setup.ts", import.meta.url), "utf8");

  assert.match(source, /assertStoryboardSequenceConfirmed/);
  assert.match(source, /storyboard_sequence_not_confirmed/);
  assert.match(source, /请先确认文字分镜/);
  const confirmListSource = source.match(/export async function confirmProductionEntityList[\s\S]*?export async function generateProductionReferencePrompts/)?.[0] ?? "";
  assert.ok(confirmListSource.indexOf("assertStoryboardSequenceConfirmed") < confirmListSource.indexOf("confirmProductionEntities"));
});

test("production setup prompts are visible editable and style-aware", async () => {
  const source = await readFile(new URL("./production-setup.ts", import.meta.url), "utf8");
  const repository = await readFile(new URL("../repositories/production-entities.ts", import.meta.url), "utf8");
  const route = await readFile(new URL("../../app/api/projects/[projectId]/production-entities/route.ts", import.meta.url), "utf8");

  assert.match(source, /listProjectCreativeDirections/);
  assert.match(source, /已确认视觉风格/);
  assert.match(source, /sourceShotIds/);
  assert.match(repository, /saveProductionReferencePrompt/);
  assert.match(repository, /current_prompt = \$3/);
  assert.match(repository, /default_ratio = \$4/);
  assert.match(repository, /last_generation_count = \$5/);
  assert.match(route, /action: z\.literal\("save_prompt"\)/);
});

test("production setup confirmation generates AI reference prompts from script style and storyboard context", async () => {
  const source = await readFile(new URL("./production-setup.ts", import.meta.url), "utf8");
  const repository = await readFile(new URL("../repositories/production-entities.ts", import.meta.url), "utf8");

  assert.match(source, /callArkResponseJson/);
  assert.match(source, /productionReferencePromptResponseSchema/);
  assert.match(source, /generateProductionReferencePrompts/);
  assert.match(source, /listScriptDirectionPackages/);
  assert.match(source, /listProjectCreativeDirections/);
  assert.match(source, /listStoryboardShots/);
  assert.match(source, /promptSource: "ai_script_context"/);
  assert.match(source, /sourcePackageId/);
  assert.match(source, /sourceCreativeDirectionIds/);
  assert.match(source, /sourceShotIds/);
  assert.match(source, /reasoningSummary/);
  assert.match(source, /thinking: "disabled"/);
  assert.match(source, /env\.ARK_TEXT_STRUCTURING_MODEL/);
  assert.match(source, /status === "locked" \|\| referenceSet\.status === "client_approved"/);
  assert.match(repository, /snapshot:\s*Record<string, unknown>/);
  assert.match(repository, /snapshot_json = case when \$7::jsonb is null then snapshot_json else snapshot_json \|\| \$7::jsonb end/);
});

test("manual production reference prompt saves are marked as manual edits", async () => {
  const source = await readFile(new URL("./production-setup.ts", import.meta.url), "utf8");

  assert.match(source, /promptSource: "manual_edit"/);
  assert.match(source, /manualEditedAt/);
  assert.match(source, /updateProductionReferencePrompt/);
  assert.ok(source.indexOf("promptSource: \"manual_edit\"") > source.indexOf("updateProductionReferencePrompt"));
});

test("initial production reference sets persist entity default ratios", async () => {
  const source = await readFile(new URL("./production-setup.ts", import.meta.url), "utf8");
  const repository = await readFile(new URL("../repositories/production-entities.ts", import.meta.url), "utf8");

  assert.match(repository, /defaultRatio\?: ProductionImageRatio/);
  assert.match(repository, /lastGenerationCount\?: number/);
  assert.match(repository, /default_ratio\s*=\s*coalesce\(/);
  assert.match(repository, /last_generation_count\s*=\s*coalesce\(/);
  assert.match(repository, /default_ratio,\s*last_generation_count/);
  assert.match(repository, /input\.defaultRatio\s*\?\?\s*"1:1"/);
  assert.match(repository, /input\.lastGenerationCount\s*\?\?\s*1/);
  assert.match(source, /defaultRatioForEntity\(entity\.entityType\)/);
  assert.match(source, /defaultRatioForEntity\(updatedEntity\.entityType\)/);
});

test("production setup selected image is explicit and review gate skips ignored entities", async () => {
  const source = await readFile(new URL("./production-setup.ts", import.meta.url), "utf8");
  const repository = await readFile(new URL("../repositories/production-entities.ts", import.meta.url), "utf8");
  const route = await readFile(new URL("../../app/api/projects/[projectId]/production-entities/route.ts", import.meta.url), "utf8");

  assert.match(repository, /selectProductionReferenceImage/);
  assert.match(repository, /selected_image_id = \$3/);
  assert.match(source, /selectProductionReferenceImageForSetup/);
  assert.match(source, /referenceSet\.selectedImageId/);
  assert.match(source, /entity\.inclusionStatus === "ignored"/);
  assert.match(route, /action: z\.literal\("select_image"\)/);
});

test("production reference image selection casts image id consistently for uuid column and json candidate pool", async () => {
  const repository = await readFile(new URL("../repositories/production-entities.ts", import.meta.url), "utf8");

  assert.match(repository, /selected_image_id = \$3::uuid/);
  assert.match(repository, /jsonb_build_array\(\$3::text\)/);
});

test("production setup selected image validates target and candidate before confirming review", async () => {
  const source = await readFile(new URL("./production-setup.ts", import.meta.url), "utf8");

  assert.match(source, /const referenceSet = referenceSets\.find\(\(item\) => item\.id === input\.referenceSetId\)/);
  assert.match(source, /production_reference_set_not_found/);
  assert.match(source, /const imageReferenceSetId = typeof image\.metadata\.referenceSetId === "string" \? image\.metadata\.referenceSetId : null/);
  assert.match(source, /if \(imageReferenceSetId && imageReferenceSetId !== referenceSet\.id\)/);
  assert.match(source, /if \(!imageReferenceSetId && !referenceSet\.referenceImageIds\.includes\(image\.id\)\)/);
  assert.match(source, /production_reference_image_mismatch/);
  assert.ok(source.indexOf("imageReferenceSetId && imageReferenceSetId !== referenceSet.id") < source.indexOf("!imageReferenceSetId && !referenceSet.referenceImageIds.includes(image.id)"));
  assert.ok(source.indexOf("production_reference_image_mismatch") < source.indexOf("await reviewGeneratedImageRecord"));
  assert.ok(source.indexOf("const referenceSet = referenceSets.find") < source.indexOf("await reviewGeneratedImageRecord"));
});

test("resolveShotReferenceImages maps a shot to its locked setting images by source_shot_ids", async () => {
  const source = await readFile(new URL("./production-setup.ts", import.meta.url), "utf8");

  assert.match(source, /export async function resolveShotReferenceImages/);
  // Linkage is derived from the existing ID-based source_shot_ids, not name re-matching.
  assert.match(source, /entity\.sourceShotIds\.includes\(input\.shotId\)/);
  assert.match(source, /entity\.inclusionStatus !== "ignored"/);
  assert.match(source, /entity\.entityType === "character" \|\| entity\.entityType === "scene"/);
  // Resolves selected setting image, falling back to confirmed reference candidates.
  assert.match(source, /referenceSet\.selectedImageId \? \[referenceSet\.selectedImageId\] : referenceSet\.referenceImageIds/);
  assert.match(source, /listGeneratedImagesByIds/);
  assert.match(source, /\.find\(isConfirmedProductionReferenceImage\)/);
  // Entities without a usable image are surfaced, never silently dropped.
  assert.match(source, /missing\.push\(\{ entityId: entity\.id, entityType, name: entity\.name \}\)/);
  assert.match(source, /references\.push\(\{ entityId: entity\.id, entityType, name: entity\.name, imageId: confirmedImage\.id, ossUrl: confirmedImage\.ossUrl \}\)/);
});
