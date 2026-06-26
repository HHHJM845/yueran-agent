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
