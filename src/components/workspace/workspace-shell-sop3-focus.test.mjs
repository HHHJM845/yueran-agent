import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./workspace-shell.tsx", import.meta.url), "utf8");

function componentSource(name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  const next = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

function stageSource(stage) {
  const start = source.indexOf(`<StagePanel stage="${stage}"`);
  assert.notEqual(start, -1, `${stage} stage should exist`);
  const end = source.indexOf("</StagePanel>", start);
  assert.notEqual(end, -1, `${stage} stage should close`);
  return source.slice(start, end);
}

test("SOP3 stage renders one focused creative proposal workspace instead of stacked workflow cards", () => {
  const stage = stageSource("creative_direction_proposal");

  assert.match(stage, /<CreativeDirectionsCard/);
  assert.doesNotMatch(stage, /<AssetAnalysisResults/);
  assert.doesNotMatch(stage, /<ProposalEditorCard/);
  assert.doesNotMatch(stage, /title="资料解析与标签评分结果"/);
  assert.doesNotMatch(stage, /title="四个创意方向与两轮视觉提案"/);
  assert.doesNotMatch(stage, /title="最终提案整理与版本快照"/);
});

test("CreativeDirectionsCard uses focused view-model and does not permanently stack all SOP3 panels", () => {
  const card = componentSource("CreativeDirectionsCard");

  assert.match(card, /buildSop3FocusedFlow/);
  assert.match(card, /Sop3CurrentTaskBody/);
  assert.match(card, /Sop3ProgressMap/);
  assert.doesNotMatch(card, /<Sop3FlowStrip/);
  assert.doesNotMatch(card, /<CreativeExpansionBoard[\s\S]*<CreativeProposalRoundsPanel/);
  assert.doesNotMatch(card, /Round 提案包与甲方审核[\s\S]*完整流转是/);
});

test("SOP3 focused copy follows current-task language", () => {
  const card = componentSource("CreativeDirectionsCard");

  assert.match(card, /选择要发给甲方的方向/);
  assert.match(card, /等待甲方初筛/);
  assert.match(card, /深化已确认方向/);
  assert.match(card, /发送给甲方初筛/);
  assert.doesNotMatch(card, /四个方向与两轮视觉提案/);
  assert.doesNotMatch(card, /生成 4 个创意方向，完成方向初选、故事大纲、氛围图和两轮甲方反馈/);
});
