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
  assert.match(source, /current_stage = 'settlement_delivery_archive'/);
  assert.doesNotMatch(source, /generateOpenAIImage/);
  assert.doesNotMatch(source, /callArk/);
  assert.doesNotMatch(source, /deliverToFeishu/);
});
