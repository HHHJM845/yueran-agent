import assert from "node:assert/strict";
import test from "node:test";

test("validateCreativeDirectionCount requires exactly four directions", async () => {
  const { validateCreativeDirectionCount } = await import("./creative-proposal-rounds.ts");

  assert.doesNotThrow(() => validateCreativeDirectionCount([1, 2, 3, 4]));
  assert.throws(() => validateCreativeDirectionCount([1, 2, 3]), /exactly 4/);
  assert.throws(() => validateCreativeDirectionCount([1, 2, 3, 4, 5]), /exactly 4/);
});

test("creative proposal rounds use confirmed scene and candidate counts", async () => {
  const { getRequiredSceneCountForRound, getImageCandidateCountPerScene } = await import("./creative-proposal-rounds.ts");

  assert.equal(getRequiredSceneCountForRound(1), 2);
  assert.equal(getRequiredSceneCountForRound(2), 4);
  assert.equal(getImageCandidateCountPerScene(), 4);
});

test("creative review payload summarizes direction priority by direction while keeping scene notes", async () => {
  const { formatCreativeReviewDecisionPayload } = await import("./client-review.ts");

  const payload = formatCreativeReviewDecisionPayload({
    overallFeedback: "整体更偏明亮、有科技感。",
    items: [
      {
        itemId: "direction-low-scene-1",
        itemLabel: "方向 B - 视觉场景 1",
        decision: "rejected",
        score: 2,
        feedback: "人物情绪太弱。",
        metadata: { directionId: "direction-low", directionTitle: "方向 B", sceneIndex: 1, sortOrder: 2 },
      },
      {
        itemId: "direction-high-scene-1",
        itemLabel: "方向 A - 视觉场景 1",
        decision: "approved",
        score: 5,
        feedback: "保留清透色调。",
        metadata: { directionId: "direction-high", directionTitle: "方向 A", sceneIndex: 1, sortOrder: 1 },
      },
      {
        itemId: "direction-high-scene-2",
        itemLabel: "方向 A - 视觉场景 2",
        decision: "approved",
        score: 4,
        feedback: "第二个场景节奏可以更轻快。",
        metadata: { directionId: "direction-high", directionTitle: "方向 A", sceneIndex: 2, sortOrder: 1 },
      },
    ],
  });

  assert.equal(payload.directionPriority, "方向 A（通过 2/2，平均评分 4.5 分）；方向 B（通过 0/1，平均评分 2 分）");
  assert.equal(
    payload.visualPreferenceNotes,
    "方向 B - 视觉场景 1：人物情绪太弱。；方向 A - 视觉场景 1：保留清透色调。；方向 A - 视觉场景 2：第二个场景节奏可以更轻快。；整体更偏明亮、有科技感。"
  );
});
