import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSop3FocusedFlow,
  isClientReviewReturned,
} from "./sop3-focused-flow-view-model.ts";

function direction(id, overrides = {}) {
  return {
    id,
    projectId: "project-1",
    title: `方向 ${id}`,
    coreIdea: `核心想法 ${id}`,
    fitReason: `适配理由 ${id}`,
    riskNotes: "",
    referenceTags: [],
    score: 80,
    costEstimate: "中",
    cycleEstimate: "7 天",
    technicalDifficulty: "中",
    atmospherePrompt: "",
    detail: {},
    isSelected: false,
    selectedAt: null,
    status: "draft",
    sortOrder: Number(id.replace("direction-", "")) || 1,
    sourceJobId: null,
    updatedAt: "2026-06-30T00:00:00.000Z",
    ...overrides,
  };
}

function expansion(id, directionId, sortOrder = 1) {
  return {
    id,
    projectId: "project-1",
    directionId,
    title: `故事 ${id}`,
    oneLiner: "一句话故事",
    storyArc: {},
    visualHighlights: [],
    visualStyle: "写实",
    productionDifficulty: "中",
    riskNotes: "",
    status: "draft",
    sortOrder,
    sourceJobId: null,
    updatedAt: "2026-06-30T00:00:00.000Z",
  };
}

function generatedImage(id, directionId, expansionId, overrides = {}) {
  return {
    id,
    projectId: "project-1",
    directionId,
    expansionId,
    prompt: "氛围图 prompt",
    provider: "openai",
    modelName: "gpt-image-2-all",
    status: "succeeded",
    ossKey: null,
    ossUrl: null,
    failureReason: null,
    retryCount: 0,
    sourceJobId: null,
    reviewStatus: "pending",
    reviewNote: null,
    reviewedAt: null,
    metadata: {},
    updatedAt: "2026-06-30T00:00:00.000Z",
    ...overrides,
  };
}

function round(id, roundNumber, directionIds, overrides = {}) {
  return {
    id,
    projectId: "project-1",
    roundNumber,
    status: "draft",
    version: 1,
    directionIds,
    retainedDirectionIds: roundNumber === 2 ? directionIds : [],
    clientFeedback: {},
    clientReviewTaskId: null,
    snapshot: {},
    concepts: [],
    updatedAt: "2026-06-30T00:00:00.000Z",
    ...overrides,
  };
}

function reviewTask(id, reviewScene, status, overrides = {}) {
  return {
    id,
    projectId: "project-1",
    moduleKey: "creative_direction_proposal",
    reviewType: "project_proposal",
    targetScopeType: "proposal",
    targetScopeId: "round-1",
    title: "甲方审核",
    summary: "",
    version: 1,
    status,
    expiresAt: null,
    submittedAt: status === "submitted" ? "2026-06-30T00:00:00.000Z" : null,
    reviewedAt: null,
    sopKey: "sop_3",
    reviewScene,
    roundNumber: reviewScene === "creative_round_2" ? 2 : 1,
    batchNumber: null,
    reviewPayloadVersion: 1,
    payload: {},
    decisionPayload: {},
    reviewerName: null,
    reviewerContact: null,
    feedback: "",
    createdAt: "2026-06-30T00:00:00.000Z",
    updatedAt: "2026-06-30T00:00:00.000Z",
    ...overrides,
  };
}

function flowInput(overrides = {}) {
  return {
    directions: [],
    expansions: [],
    generatedImages: [],
    creativeProposalRounds: [],
    clientReviewTasks: [],
    jobs: [],
    artifacts: [],
    canGenerate: true,
    canEdit: true,
    canLaunchReview: true,
    ...overrides,
  };
}

const fourDirections = [
  direction("direction-1"),
  direction("direction-2"),
  direction("direction-3"),
  direction("direction-4"),
];

test("buildSop3FocusedFlow starts with direction generation", () => {
  const view = buildSop3FocusedFlow(flowInput());

  assert.equal(view.currentTask.key, "generate_directions");
  assert.equal(view.primaryAction.key, "generate_directions");
  assert.match(view.currentTask.title, /生成/);
  assert.equal(view.visibleDirections.length, 0);
  assert.equal(view.progressNodes[0].status, "current");
});

test("buildSop3FocusedFlow shows exactly four directions for internal selection", () => {
  const view = buildSop3FocusedFlow(
    flowInput({
      directions: fourDirections.map((item, index) => ({ ...item, isSelected: index < 2 })),
    })
  );

  assert.equal(view.currentTask.key, "select_directions");
  assert.equal(view.primaryAction.key, "send_round_1_review");
  assert.equal(view.visibleDirections.length, 4);
  assert.deepEqual(view.visibleDirections.map((item) => item.id), ["direction-1", "direction-2", "direction-3", "direction-4"]);
  assert.match(view.progressNodes.find((node) => node.key === "internal_selection").summary, /已选 2 个方向/);
});

test("buildSop3FocusedFlow waits for Round 1 feedback after client review is active", () => {
  const selected = fourDirections.map((item, index) => ({ ...item, isSelected: index < 2 }));
  const round1 = round("round-1", 1, ["direction-1", "direction-2"], { clientReviewTaskId: "review-1" });
  const view = buildSop3FocusedFlow(
    flowInput({
      directions: selected,
      creativeProposalRounds: [round1],
      clientReviewTasks: [reviewTask("review-1", "creative_round_1", "active")],
    })
  );

  assert.equal(view.currentTask.key, "wait_round_1_feedback");
  assert.equal(view.primaryAction.key, "refresh_client_feedback");
  assert.equal(view.visibleDirections.length, 2);
  assert.doesNotMatch(view.currentTask.description, /氛围图/);
});

test("buildSop3FocusedFlow keeps Round 1 send action aligned when no review task exists", () => {
  const selected = fourDirections.map((item, index) => ({ ...item, isSelected: index < 2 }));
  const round1 = round("round-1", 1, ["direction-1", "direction-2"]);
  const view = buildSop3FocusedFlow(
    flowInput({
      directions: selected,
      creativeProposalRounds: [round1],
      clientReviewTasks: [],
    })
  );

  assert.equal(view.currentTask.key, "wait_round_1_feedback");
  assert.equal(view.primaryAction.key, "send_round_1_review");
  assert.equal(view.primaryAction.label, "发送给甲方初筛");
});

test("buildSop3FocusedFlow deepens only confirmed selected directions after Round 1 returns", () => {
  const selected = fourDirections.map((item, index) => ({ ...item, isSelected: index < 3 }));
  const round1 = round("round-1", 1, ["direction-1", "direction-2", "direction-3"], {
    clientReviewTaskId: "review-1",
    retainedDirectionIds: ["direction-1", "direction-3"],
  });
  const view = buildSop3FocusedFlow(
    flowInput({
      directions: selected,
      creativeProposalRounds: [round1],
      clientReviewTasks: [
        reviewTask("review-1", "creative_round_1", "submitted", {
          decisionPayload: { retainedDirectionIds: ["direction-1", "direction-3"] },
        }),
      ],
      expansions: [
        expansion("expansion-1", "direction-1"),
        expansion("expansion-2", "direction-2"),
        expansion("expansion-3", "direction-3"),
      ],
      generatedImages: [
        generatedImage("image-1", "direction-1", "expansion-1", { reviewStatus: "confirmed" }),
        generatedImage("image-2", "direction-2", "expansion-2", { reviewStatus: "confirmed" }),
        generatedImage("image-3", "direction-3", "expansion-3", { reviewStatus: "confirmed" }),
      ],
    })
  );

  assert.equal(view.currentTask.key, "deepen_confirmed_direction");
  assert.equal(view.primaryAction.key, "generate_deepening_assets");
  assert.deepEqual(view.selectedDirections.map((item) => item.id), ["direction-1", "direction-2", "direction-3"]);
  assert.deepEqual(view.unselectedDirections.map((item) => item.id), ["direction-4"]);
  assert.deepEqual(view.visibleDirections.map((item) => item.id), ["direction-1", "direction-3"]);
  assert.equal(view.progressNodes.find((node) => node.key === "internal_selection").summary, "已选 3 个方向");
  assert.equal(view.progressNodes.find((node) => node.key === "client_round_1").status, "done");
  assert.match(view.progressNodes.find((node) => node.key === "direction_deepening").historySummary, /氛围图 2/);
  assert.match(view.progressNodes.find((node) => node.key === "direction_deepening").summary, /故事大纲 2，确认图 2/);
  assert.match(view.progressNodes.find((node) => node.key === "direction_deepening").historySummary, /方向 direction-1、方向 direction-3/);
  assert.doesNotMatch(view.progressNodes.find((node) => node.key === "direction_deepening").historySummary, /direction-2/);
});

test("buildSop3FocusedFlow waits for Round 2 feedback and then finalizes proposal", () => {
  const selected = fourDirections.map((item, index) => ({ ...item, isSelected: index === 0 }));
  const round1 = round("round-1", 1, ["direction-1"], { clientReviewTaskId: "review-1" });
  const round2 = round("round-2", 2, ["direction-1"], { clientReviewTaskId: "review-2" });

  const waiting = buildSop3FocusedFlow(
    flowInput({
      directions: selected,
      creativeProposalRounds: [round1, round2],
      clientReviewTasks: [
        reviewTask("review-1", "creative_round_1", "submitted"),
        reviewTask("review-2", "creative_round_2", "active"),
      ],
    })
  );

  assert.equal(waiting.currentTask.key, "wait_round_2_feedback");

  const final = buildSop3FocusedFlow(
    flowInput({
      directions: selected,
      creativeProposalRounds: [round1, round2],
      clientReviewTasks: [
        reviewTask("review-1", "creative_round_1", "submitted"),
        reviewTask("review-2", "creative_round_2", "approved"),
      ],
    })
  );

  assert.equal(final.currentTask.key, "finalize_proposal");
  assert.equal(final.primaryAction.key, "enter_quote_contract");
  assert.equal(final.progressNodes.find((node) => node.key === "final_confirmation").status, "done");
});

test("buildSop3FocusedFlow exposes read-only history previews without changing current task", () => {
  const selected = fourDirections.map((item, index) => ({ ...item, isSelected: index < 2 }));
  const round1 = round("round-1", 1, ["direction-1", "direction-2"], { clientReviewTaskId: "review-1" });
  const view = buildSop3FocusedFlow(
    flowInput({
      directions: selected,
      creativeProposalRounds: [round1],
      clientReviewTasks: [reviewTask("review-1", "creative_round_1", "submitted")],
      expansions: [expansion("expansion-1", "direction-1")],
      generatedImages: [generatedImage("image-1", "direction-1", "expansion-1", { reviewStatus: "confirmed" })],
    })
  );

  assert.equal(view.currentTask.key, "deepen_confirmed_direction");
  assert.ok(view.progressNodes.every((node) => node.previewMode === "readonly"));
  assert.match(view.progressNodes.find((node) => node.key === "direction_deepening").historySummary, /故事大纲 1/);
});

test("isClientReviewReturned treats submitted approved rejected as returned", () => {
  assert.equal(isClientReviewReturned("submitted"), true);
  assert.equal(isClientReviewReturned("approved"), true);
  assert.equal(isClientReviewReturned("rejected"), true);
  assert.equal(isClientReviewReturned("active"), false);
  assert.equal(isClientReviewReturned(null), false);
});
