import test from "node:test";
import assert from "node:assert/strict";

test("buildProposalSnapshotData captures versioned proposal content", async () => {
  const { buildProposalSnapshotData } = await import("./save-proposal.ts");

  const snapshot = buildProposalSnapshotData({
    proposalId: "proposal-1",
    version: 3,
    title: "世界杯耐克提案",
    content: "第一段：品牌目标。\n第二段：创意方向。\n第三段：交付计划。",
    status: "draft",
  });

  assert.equal(snapshot.proposalId, "proposal-1");
  assert.equal(snapshot.version, 3);
  assert.equal(snapshot.title, "世界杯耐克提案");
  assert.equal(snapshot.status, "draft");
  assert.match(snapshot.summary, /品牌目标/);
  assert.ok(snapshot.content.length > snapshot.summary.length);
});
