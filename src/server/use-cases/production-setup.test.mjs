import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("assertProductionSetupLocked requires locked entities before image stage", async () => {
  const { assertProductionSetupLocked } = await import("./production-setup.ts");
  assert.throws(
    () =>
      assertProductionSetupLocked({
        entities: [{ id: "char-1", entityType: "character", status: "draft" }],
        storyboardShots: [{ id: "shot-1" }],
      }),
    /人物和场景设定尚未全部锁定/
  );
  assert.doesNotThrow(() =>
    assertProductionSetupLocked({
      entities: [{ id: "char-1", entityType: "character", status: "locked" }],
      storyboardShots: [{ id: "shot-1" }],
    })
  );
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
