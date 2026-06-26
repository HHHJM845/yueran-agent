import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./workspace-shell.tsx", import.meta.url), "utf8");

test("change request panel is mounted at project workspace level", () => {
  const stageAreaIndex = source.indexOf('<div className="workspace-main-area">');
  const firstStagePanelIndex = source.indexOf("<StagePanel", stageAreaIndex);
  const firstPanelIndex = source.indexOf("<ChangeRequestsPanel", stageAreaIndex);

  assert.notEqual(firstPanelIndex, -1);
  assert.ok(firstPanelIndex > stageAreaIndex);
  assert.ok(firstPanelIndex < firstStagePanelIndex);
  assert.ok(source.slice(firstPanelIndex, firstStagePanelIndex).includes("selectedStage={selectedStage}"));
});

test("review cut stage does not own a separate change request panel", () => {
  const reviewCutFunctionIndex = source.indexOf("function ReviewCutStageModule");
  const feedbackFunctionIndex = source.indexOf("function Feedback", reviewCutFunctionIndex);
  const reviewCutSource = source.slice(reviewCutFunctionIndex, feedbackFunctionIndex);

  assert.equal(reviewCutSource.includes("<ChangeRequestsPanel"), false);
});
