import assert from "node:assert/strict";
import test from "node:test";

test("shouldSuggestChangeRequestForReviewCut flags over-contract rounds", async () => {
  const { shouldSuggestChangeRequestForReviewCut } = await import("./change-requests.ts");
  assert.equal(shouldSuggestChangeRequestForReviewCut({ contractedRounds: 3, nextRoundNumber: 4, clientRejected: true }), true);
  assert.equal(shouldSuggestChangeRequestForReviewCut({ contractedRounds: 3, nextRoundNumber: 3, clientRejected: true }), false);
  assert.equal(shouldSuggestChangeRequestForReviewCut({ contractedRounds: 3, nextRoundNumber: 4, clientRejected: false }), false);
});
