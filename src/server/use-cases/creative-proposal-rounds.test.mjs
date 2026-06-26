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

test("creative review payload summarizes direction priority and visual notes", async () => {
  const { formatCreativeReviewDecisionPayload } = await import("./client-review.ts");

  const payload = formatCreativeReviewDecisionPayload({
    overallFeedback: "整体更偏明亮、有科技感。",
    items: [
      {
        itemId: "direction-low",
        itemLabel: "方向 B",
        decision: "rejected",
        score: 2,
        feedback: "人物情绪太弱。",
        metadata: { sceneIndex: 2 },
      },
      {
        itemId: "direction-high",
        itemLabel: "方向 A",
        decision: "approved",
        score: 5,
        feedback: "保留清透色调。",
        metadata: { sceneIndex: 1 },
      },
    ],
  });

  assert.equal(payload.directionPriority, "方向 A（通过，评分 5 分）；方向 B（打回，评分 2 分）");
  assert.equal(payload.visualPreferenceNotes, "方向 B：人物情绪太弱。；方向 A：保留清透色调。；整体更偏明亮、有科技感。");
});
