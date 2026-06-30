import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("project stage progress does not let older async jobs move the project backward", async () => {
  const source = await readFile(new URL("./project-stages.ts", import.meta.url), "utf8");

  assert.match(source, /shouldUpdateProjectCurrentStage/);
  assert.match(source, /existingCurrentStage/);
  assert.match(source, /requestedCurrentStage/);
  assert.match(source, /getStageIndex\(input\.requestedCurrentStage\) >= getStageIndex\(input\.existingCurrentStage\)/);
  assert.match(source, /select current_stage[\s\S]*from projects[\s\S]*where id = \$1/);
});
