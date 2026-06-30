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
