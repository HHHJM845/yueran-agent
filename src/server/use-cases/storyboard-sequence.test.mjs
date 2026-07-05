import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("storyboard sequence editor protects produced shots from deletion", async () => {
  const source = await readFile(new URL("../repositories/story-production.ts", import.meta.url), "utf8");

  assert.match(source, /deleteStoryboardShotIfUnused/);
  assert.match(source, /from storyboard_images/);
  assert.match(source, /from storyboard_videos/);
  assert.match(source, /storyboard_shot_has_assets/);
});

test("storyboard sequence editor can reorder and create shots", async () => {
  const source = await readFile(new URL("../repositories/story-production.ts", import.meta.url), "utf8");

  assert.match(source, /updateStoryboardShotOrder/);
  assert.match(source, /createStoryboardShot/);
  assert.match(source, /sort_order = \$4/);
  assert.match(source, /insert into storyboard_shots/);
});

test("storyboard sequence save refreshes production setup references", async () => {
  const source = await readFile(new URL("./storyboard-sequence.ts", import.meta.url), "utf8").catch(() => "");

  assert.match(source, /saveStoryboardSequence/);
  assert.match(source, /listStoryboardShots/);
  assert.match(source, /createProductionSetupFromStoryboard/);
});

test("storyboard sequence has an explicit confirmation gate before production setup", async () => {
  const source = await readFile(new URL("./storyboard-sequence.ts", import.meta.url), "utf8").catch(() => "");
  const repository = await readFile(new URL("../repositories/story-production.ts", import.meta.url), "utf8");

  assert.match(source, /export async function confirmStoryboardSequence/);
  assert.match(source, /updateStoryboardShotsStatus/);
  assert.match(source, /status: "internal_review"/);
  assert.match(source, /文字分镜已确认/);
  assert.match(repository, /export async function updateStoryboardShotsStatus/);
  assert.match(repository, /status = \$2/);
});

test("editing storyboard sequence resets confirmation before setup can be confirmed", async () => {
  const source = await readFile(new URL("./storyboard-sequence.ts", import.meta.url), "utf8").catch(() => "");
  const repository = await readFile(new URL("../repositories/story-production.ts", import.meta.url), "utf8");

  assert.match(source, /status: "draft"/);
  assert.match(repository, /updateStoryboardShotContent[\s\S]*status = 'draft'/);
  assert.match(repository, /updateStoryboardShotOrder[\s\S]*status = 'draft'/);
});

test("script revision messages derive package ownership from the project package", async () => {
  const source = await readFile(new URL("../repositories/story-production.ts", import.meta.url), "utf8");
  const match = source.match(/export async function appendScriptRevisionMessage[\s\S]*?export async function listScriptRevisionMessages/);

  assert.ok(match, "appendScriptRevisionMessage source should be present");
  assert.match(match[0], /from script_direction_packages/);
  assert.match(match[0], /where (?:\w+\.)?project_id = \$1[\s\S]*and (?:\w+\.)?id = \$2[\s\S]*and (?:\w+\.)?status <> 'archived'/);
  assert.match(match[0], /select package.project_id, package.id/);
  assert.match(match[0], /script_revision_package_not_found/);
});

test("story production workspace payload returns script revision messages", async () => {
  const source = await readFile(new URL("../repositories/story-production.ts", import.meta.url), "utf8");

  assert.match(source, /listScriptRevisionMessages\(projectId\)/);
  assert.match(source, /scriptRevisionMessages: revisionMessages/);
});
