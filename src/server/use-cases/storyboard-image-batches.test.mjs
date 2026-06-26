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
