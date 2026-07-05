import assert from "node:assert/strict";
import test from "node:test";

test("assertAllStoryboardShotsClientApproved requires every storyboard shot to be approved", async () => {
  const { assertAllStoryboardShotsClientApproved } = await import("./storyboard-image-batches.ts");

  assert.throws(
    () =>
      assertAllStoryboardShotsClientApproved([
        { id: "shot-1", status: "client_approved", shotNumber: "1-1-1" },
        { id: "shot-2", status: "client_rejected", shotNumber: "1-1-2" },
      ]),
    /仍有 1 条分镜图片未通过甲方确认/,
  );

  assert.doesNotThrow(() =>
    assertAllStoryboardShotsClientApproved([
      { id: "shot-1", status: "client_approved", shotNumber: "1-1-1" },
      { id: "shot-2", status: "client_approved", shotNumber: "1-1-2" },
      { id: "shot-3", status: "client_approved", shotNumber: "1-2-1" },
    ]),
  );
});
test("storyboard image batches are unlimited positive review rounds", async () => {
  const { createBatchInputSchema } = await import("./storyboard-image-batches.ts");

  assert.equal(createBatchInputSchema.parse({
    projectId: "00000000-0000-4000-8000-000000000001",
    batchNumber: 4,
    sceneIds: ["00000000-0000-4000-8000-000000000002"],
    actorId: "00000000-0000-4000-8000-000000000003",
  }).batchNumber, 4);

  assert.throws(
    () =>
      createBatchInputSchema.parse({
        projectId: "00000000-0000-4000-8000-000000000001",
        batchNumber: 0,
        sceneIds: ["00000000-0000-4000-8000-000000000002"],
        actorId: "00000000-0000-4000-8000-000000000003",
      }),
    /Number must be greater than or equal to 1|Too small/,
  );
});
