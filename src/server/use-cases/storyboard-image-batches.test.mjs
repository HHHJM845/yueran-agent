import assert from "node:assert/strict";
import test from "node:test";

test("assertAllStoryboardImageBatchesApproved requires three approved batches", async () => {
  const { assertAllStoryboardImageBatchesApproved } = await import("./storyboard-image-batches.ts");

  assert.throws(
    () =>
      assertAllStoryboardImageBatchesApproved([
        { batchNumber: 1, status: "client_approved" },
        { batchNumber: 2, status: "client_approved" },
      ]),
    /三批分镜图片尚未全部确认/,
  );

  assert.doesNotThrow(() =>
    assertAllStoryboardImageBatchesApproved([
      { batchNumber: 1, status: "client_approved" },
      { batchNumber: 2, status: "client_approved" },
      { batchNumber: 3, status: "client_approved" },
    ]),
  );
});

test("assertAllStoryboardImageBatchesApproved only accepts the latest version for each batch", async () => {
  const { assertAllStoryboardImageBatchesApproved } = await import("./storyboard-image-batches.ts");

  assert.throws(
    () =>
      assertAllStoryboardImageBatchesApproved([
        { batchNumber: 1, status: "client_approved", version: 1, updatedAt: "2026-01-01T00:00:00.000Z" },
        { batchNumber: 2, status: "client_approved", version: 1, updatedAt: "2026-01-01T00:00:00.000Z" },
        { batchNumber: 3, status: "client_approved", version: 1, updatedAt: "2026-01-01T00:00:00.000Z" },
        { batchNumber: 2, status: "draft", version: 2, updatedAt: "2026-01-02T00:00:00.000Z" },
      ]),
    /三批分镜图片尚未全部确认/,
  );

  assert.throws(
    () =>
      assertAllStoryboardImageBatchesApproved([
        { batchNumber: 1, status: "client_approved", version: 1, updatedAt: "2026-01-01T00:00:00.000Z" },
        { batchNumber: 2, status: "client_approved", version: 1, updatedAt: "2026-01-01T00:00:00.000Z" },
        { batchNumber: 3, status: "client_approved", version: 1, updatedAt: "2026-01-01T00:00:00.000Z" },
        { batchNumber: 2, status: "client_rejected", version: 2, updatedAt: "2026-01-02T00:00:00.000Z" },
      ]),
    /三批分镜图片尚未全部确认/,
  );

  assert.doesNotThrow(() =>
    assertAllStoryboardImageBatchesApproved([
      { batchNumber: 1, status: "client_approved", version: 2, updatedAt: "2026-01-02T00:00:00.000Z" },
      { batchNumber: 2, status: "client_approved", version: 2, updatedAt: "2026-01-02T00:00:00.000Z" },
      { batchNumber: 3, status: "client_approved", version: 2, updatedAt: "2026-01-02T00:00:00.000Z" },
      { batchNumber: 2, status: "client_rejected", version: 1, updatedAt: "2026-01-01T00:00:00.000Z" },
    ]),
  );
});
