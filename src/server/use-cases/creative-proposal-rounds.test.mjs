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
