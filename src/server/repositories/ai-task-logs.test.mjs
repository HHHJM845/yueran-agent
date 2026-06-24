import test from "node:test";
import assert from "node:assert/strict";

test("AI task log normalizers keep counters safe for database writes", async () => {
  const {
    normalizeAiLogAttempt,
    normalizeAiLogDuration,
    normalizeAiLogErrorMessage,
    normalizeAiLogInteger,
  } = await import("./ai-task-logs.ts");

  assert.equal(normalizeAiLogInteger(12.4), 12);
  assert.equal(normalizeAiLogInteger(Number.NaN), null);
  assert.equal(normalizeAiLogInteger(-8), 0);
  assert.equal(normalizeAiLogDuration(42.4), 42);
  assert.equal(normalizeAiLogDuration(-1), 0);
  assert.equal(normalizeAiLogAttempt(0), 1);
  assert.equal(normalizeAiLogAttempt(undefined), 1);
  assert.equal(normalizeAiLogErrorMessage("x".repeat(600))?.length, 500);
  assert.equal(normalizeAiLogErrorMessage(null), null);
});
