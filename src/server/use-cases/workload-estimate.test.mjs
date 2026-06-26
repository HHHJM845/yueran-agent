import assert from "node:assert/strict";
import test from "node:test";

test("normalizeWorkloadEstimate clamps counts and keeps price range", async () => {
  const { normalizeWorkloadEstimate } = await import("./workload-estimate.ts");
  const estimate = normalizeWorkloadEstimate({
    roleCount: "3",
    sceneCount: "8",
    shotCount: "90",
    imageCount: "180",
    videoCount: "90",
    revisionRounds: "3",
    deliverableVersions: ["横版", "竖版", "无字幕版"],
    minPriceCny: "50000",
    maxPriceCny: "80000",
    rationale: "角色多，镜头量高，周期适中。",
  });

  assert.equal(estimate.roleCount, 3);
  assert.equal(estimate.sceneCount, 8);
  assert.equal(estimate.priceRange.minCny, 50000);
  assert.deepEqual(estimate.deliverableVersions, ["横版", "竖版", "无字幕版"]);
});

test("normalizeWorkloadEstimate mirrors a missing max price", async () => {
  const { normalizeWorkloadEstimate } = await import("./workload-estimate.ts");
  const estimate = normalizeWorkloadEstimate({
    minPriceCny: "50000",
    maxPriceCny: "",
  });

  assert.equal(estimate.priceRange.minCny, 50000);
  assert.equal(estimate.priceRange.maxCny, 50000);
});

test("normalizeWorkloadEstimate sorts reversed price values", async () => {
  const { normalizeWorkloadEstimate } = await import("./workload-estimate.ts");
  const estimate = normalizeWorkloadEstimate({
    minPriceCny: "80000",
    maxPriceCny: "50000",
  });

  assert.equal(estimate.priceRange.minCny, 50000);
  assert.equal(estimate.priceRange.maxCny, 80000);
});

test("delivery checklist bulk save preserves existing item identity and change request traceability", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("../repositories/delivery-checklists.ts", import.meta.url), "utf8")
  );
  const { DELIVERY_CHECKLIST_ITEM_SAVE_UPDATE_SQL } = await import("../repositories/delivery-checklists.ts");

  assert.doesNotMatch(source, /delete\s+from\s+delivery_checklist_items\s+where\s+checklist_id/i);
  assert.match(DELIVERY_CHECKLIST_ITEM_SAVE_UPDATE_SQL, /where\s+project_id\s*=\s*\$1\s+and\s+checklist_id\s*=\s*\$2\s+and\s+id\s*=\s*\$3/i);
  assert.doesNotMatch(
    DELIVERY_CHECKLIST_ITEM_SAVE_UPDATE_SQL.replace(/where[\s\S]*$/i, ""),
    /change_request_id/i
  );
});
