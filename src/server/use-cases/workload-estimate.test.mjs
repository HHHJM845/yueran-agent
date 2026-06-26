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

test("normalizeSop4DeliveryChecklistStatus rejects confirmed in SOP 4", async () => {
  const { normalizeSop4DeliveryChecklistStatus } = await import("./workload-estimate.ts");

  assert.throws(
    () => normalizeSop4DeliveryChecklistStatus("confirmed"),
    (error) =>
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "delivery_checklist_status_not_supported_in_sop4"
  );
});

test("normalizeSop4ChecklistItemStatus rejects confirmed item status in SOP 4", async () => {
  const { normalizeSop4ChecklistItemStatus } = await import("./workload-estimate.ts");

  assert.throws(
    () => normalizeSop4ChecklistItemStatus("confirmed"),
    (error) =>
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "delivery_checklist_item_status_not_supported_in_sop4"
  );
});

test("delivery checklist bulk save preserves existing item identity and change request traceability", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("../repositories/delivery-checklists.ts", import.meta.url), "utf8")
  );
  const {
    DELIVERY_CHECKLIST_ITEM_SAVE_UPDATE_SQL,
    DELIVERY_CHECKLIST_ITEM_REMOVE_SQL,
    DELIVERY_CHECKLIST_ITEM_LIST_SQL,
  } = await import("../repositories/delivery-checklists.ts");

  assert.doesNotMatch(source, /delete\s+from\s+delivery_checklist_items\s+where\s+checklist_id/i);
  assert.match(DELIVERY_CHECKLIST_ITEM_SAVE_UPDATE_SQL, /where\s+project_id\s*=\s*\$1\s+and\s+checklist_id\s*=\s*\$2\s+and\s+id\s*=\s*\$3/i);
  assert.doesNotMatch(
    DELIVERY_CHECKLIST_ITEM_SAVE_UPDATE_SQL.replace(/where[\s\S]*$/i, ""),
    /change_request_id/i
  );
  assert.match(DELIVERY_CHECKLIST_ITEM_REMOVE_SQL, /set\s+status\s*=\s*'cancelled'/i);
  assert.match(DELIVERY_CHECKLIST_ITEM_REMOVE_SQL, /where\s+project_id\s*=\s*\$1\s+and\s+checklist_id\s*=\s*\$2\s+and\s+id\s*=\s*any\(\$3::uuid\[\]\)/i);
  assert.doesNotMatch(
    DELIVERY_CHECKLIST_ITEM_REMOVE_SQL.replace(/where[\s\S]*$/i, ""),
    /change_request_id/i
  );
  assert.match(DELIVERY_CHECKLIST_ITEM_LIST_SQL, /status\s*<>\s*'cancelled'/i);
});

test("mergeChecklistItemsWithExistingIds reuses ids by item kind to avoid duplicate generated checklist items", async () => {
  const { mergeChecklistItemsWithExistingIds } = await import("./workload-estimate.ts");

  const merged = mergeChecklistItemsWithExistingIds(
    [
      { itemKind: "horizontal_final", title: "横版成片", quantity: 1 },
      { itemKind: "vertical_final", title: "竖版成片", quantity: 1 },
      { itemKind: "cover", title: "封面图", quantity: 1 },
    ],
    [
      {
        id: "item-horizontal",
        projectId: "project-1",
        checklistId: "checklist-1",
        itemKind: "horizontal_final",
        title: "横版成片",
        description: "",
        quantity: 1,
        status: "planned",
        changeRequestId: "cr-1",
        sortOrder: 0,
        metadata: {},
        updatedAt: "2026-06-26T00:00:00.000Z",
      },
      {
        id: "item-cover",
        projectId: "project-1",
        checklistId: "checklist-1",
        itemKind: "cover",
        title: "封面图",
        description: "",
        quantity: 1,
        status: "planned",
        changeRequestId: null,
        sortOrder: 1,
        metadata: {},
        updatedAt: "2026-06-26T00:00:00.000Z",
      },
    ]
  );

  assert.equal(merged[0].id, "item-horizontal");
  assert.equal(merged[1].id, undefined);
  assert.equal(merged[2].id, "item-cover");
});

test("mergeChecklistItemsWithExistingIds falls back by title when stable kind is shared", async () => {
  const { mergeChecklistItemsWithExistingIds } = await import("./workload-estimate.ts");

  const merged = mergeChecklistItemsWithExistingIds(
    [
      { itemKind: "other", title: "客户额外素材包", quantity: 1 },
      { itemKind: "other", title: "落版文件", quantity: 1 },
    ],
    [
      {
        id: "item-materials",
        projectId: "project-1",
        checklistId: "checklist-1",
        itemKind: "other",
        title: "客户额外素材包",
        description: "",
        quantity: 1,
        status: "changed",
        changeRequestId: null,
        sortOrder: 0,
        metadata: {},
        updatedAt: "2026-06-26T00:00:00.000Z",
      },
      {
        id: "item-final-files",
        projectId: "project-1",
        checklistId: "checklist-1",
        itemKind: "other",
        title: "落版文件",
        description: "",
        quantity: 1,
        status: "planned",
        changeRequestId: null,
        sortOrder: 1,
        metadata: {},
        updatedAt: "2026-06-26T00:00:00.000Z",
      },
    ]
  );

  assert.equal(merged[0].id, "item-materials");
  assert.equal(merged[1].id, "item-final-files");
});
