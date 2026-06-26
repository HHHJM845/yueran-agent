import assert from "node:assert/strict";
import test from "node:test";

test("storyboard scene review keeps per-shot scores when the whole scene is rejected", async () => {
  const { normalizeReviewItemsForSubmission } = await import("./client-review.ts");

  const result = normalizeReviewItemsForSubmission({
    reviewType: "storyboard_scene_images",
    decision: "rejected",
    existingItems: [{ itemId: "11111111-1111-4111-8111-111111111111" }, { itemId: "22222222-2222-4222-8222-222222222222" }],
    submittedItems: [
      {
        itemId: "11111111-1111-4111-8111-111111111111",
        decision: "approved",
        score: 5,
        feedback: "这一条可以保留。",
      },
      {
        itemId: "22222222-2222-4222-8222-222222222222",
        decision: "rejected",
        score: 2,
        feedback: "人物表情和前一镜不连贯。",
      },
    ],
  });

  assert.equal(result.length, 2);
  assert.equal(result[0].decision, "approved");
  assert.equal(result[0].score, 5);
  assert.equal(result[1].decision, "rejected");
  assert.equal(result[1].score, 2);
  assert.match(result[1].feedback, /不连贯/);
});

test("storyboard scene review defaults missing item decisions from the scene decision", async () => {
  const { normalizeReviewItemsForSubmission } = await import("./client-review.ts");

  const result = normalizeReviewItemsForSubmission({
    reviewType: "storyboard_scene_images",
    decision: "approved",
    existingItems: [{ itemId: "11111111-1111-4111-8111-111111111111" }],
    submittedItems: [],
  });

  assert.equal(result[0].decision, "approved");
  assert.equal(result[0].score, 5);
});

test("full cut review defaults missing item decisions without per-shot scores", async () => {
  const { normalizeReviewItemsForSubmission } = await import("./client-review.ts");

  const result = normalizeReviewItemsForSubmission({
    reviewType: "a_copy_review",
    decision: "rejected",
    existingItems: [{ itemId: "33333333-3333-4333-8333-333333333333" }],
    submittedItems: [],
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].decision, "rejected");
  assert.equal(result[0].score, null);
  assert.equal(result[0].feedback, "");
});

test("b-copy approval advances into settlement delivery without completing the project", async () => {
  const { reviewSubmittedStage } = await import("./client-review.ts");

  const stage = reviewSubmittedStage("b_copy_review", "approved");

  assert.equal(stage.stageKey, "b_copy_final_confirmation");
  assert.equal(stage.status, "approved");
  assert.equal(stage.currentStage, "settlement_delivery_archive");
  assert.equal(stage.projectStatus, "in_progress");
  assert.match(stage.userMessage, /结算交付与完整归档/);
});

test("timecode annotations map to storyboard shots by accumulated duration", async () => {
  const { mapTimecodeToStoryboard } = await import("../repositories/review-cuts.ts");

  const scenes = [
    { id: "scene-2", sceneNumber: 2 },
    { id: "scene-1", sceneNumber: 1 },
  ];
  const shots = [
    { id: "shot-1", sceneId: "scene-1", sortOrder: 1, durationSeconds: 4 },
    { id: "shot-2", sceneId: "scene-1", sortOrder: 2, durationSeconds: 5 },
    { id: "shot-3", sceneId: "scene-2", sortOrder: 1, durationSeconds: 3 },
  ];

  const mapped = mapTimecodeToStoryboard({ timeSeconds: 7, scenes, shots });

  assert.equal(mapped.sceneId, "scene-1");
  assert.equal(mapped.shotId, "shot-2");
  assert.equal(mapped.confidence, 0.72);
});

test("timecode annotations beyond known duration fall back to last storyboard shot", async () => {
  const { mapTimecodeToStoryboard } = await import("../repositories/review-cuts.ts");

  const scenes = [{ id: "scene-1", sceneNumber: 1 }];
  const shots = [{ id: "shot-1", sceneId: "scene-1", sortOrder: 1, durationSeconds: 2 }];

  const mapped = mapTimecodeToStoryboard({ timeSeconds: 99, scenes, shots });

  assert.equal(mapped.sceneId, "scene-1");
  assert.equal(mapped.shotId, "shot-1");
  assert.equal(mapped.confidence, 0.38);
});
