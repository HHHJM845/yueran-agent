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
