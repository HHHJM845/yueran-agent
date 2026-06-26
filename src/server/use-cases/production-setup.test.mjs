import assert from "node:assert/strict";
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
