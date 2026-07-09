import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

function artifact(id, directionId, type, status = "draft", overrides = {}) {
  return {
    id,
    projectId: "project-1",
    kind: "proposal",
    title: `${type} ${directionId}`,
    status,
    data: {
      sop3ArtifactType: type,
      directionId,
      directionTitle: `方向 ${directionId}`,
      outline: type.includes("outline") ? "完整故事大纲" : undefined,
      script: type.includes("script") ? "约 500 字完整剧本" : undefined,
    },
    ossUrl: null,
    sourceJobId: null,
    version: 1,
    updatedAt: "2026-06-30T00:00:00.000Z",
    ...overrides,
  };
}

function round2SplitArtifact(id, directionId, expansionIds) {
  return artifact(id, directionId, "round2_deepening_storyboard_split", "draft", {
    kind: "creative_expansion",
    data: {
      sop3ArtifactType: "round2_deepening_storyboard_split",
      directionId,
      directionTitle: `方向 ${directionId}`,
      expansionIds,
    },
  });
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

function job(id, type, status, overrides = {}) {
  return {
    id,
    projectId: "project-1",
    type,
    status,
    title: "后台任务",
    provider: "volcengine_ark",
    modelName: "doubao-seed-2-1-pro-260628",
    currentStep: null,
    retryCount: 0,
    userMessage: null,
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
  assert.equal(view.progressNodes[0].label, "方向卡片生成");
  assert.ok(!view.progressNodes.some((node) => node.key === "story_outline"));
});

test("buildSop3FocusedFlow moves to Round 1 style preparation after internal selection", () => {
  const view = buildSop3FocusedFlow(
    flowInput({
      directions: fourDirections.map((item, index) => ({ ...item, isSelected: index < 2 })),
      expansions: fourDirections.map((item) => expansion(`outline-${item.id}`, item.id)),
    })
  );

  assert.equal(view.currentTask.key, "prepare_round_1_materials");
  assert.equal(view.primaryAction.key, "generate_round_1_materials");
  assert.equal(view.visibleDirections.length, 2);
  assert.deepEqual(view.visibleDirections.map((item) => item.id), ["direction-1", "direction-2"]);
  assert.match(view.progressNodes.find((node) => node.key === "internal_selection").summary, /已选 2 个方向/);
});

test("buildSop3FocusedFlow waits while automatic Round 1 story outlines are generating", () => {
  const view = buildSop3FocusedFlow(
    flowInput({
      directions: fourDirections,
      expansions: [],
      jobs: [job("outline-job-1", "creative_expansion_generation", "processing")],
    })
  );

  assert.equal(view.currentTask.key, "generate_directions");
  assert.equal(view.primaryAction.key, "generate_directions");
  assert.equal(view.visibleDirections.length, 0);
  assert.match(view.currentTask.title, /方向卡片生成中/);
  assert.match(view.primaryAction.label, /生成中/);
  assert.match(view.primaryAction.disabledReason, /正在生成/);
  assert.equal(view.progressNodes.find((node) => node.key === "direction_generation").status, "current");
});

test("buildSop3FocusedFlow keeps waiting when the direction job is still generating bundled story outlines", () => {
  const view = buildSop3FocusedFlow(
    flowInput({
      directions: fourDirections,
      expansions: [],
      jobs: [job("direction-job-1", "creative_direction_generation", "processing")],
    })
  );

  assert.equal(view.currentTask.key, "generate_directions");
  assert.equal(view.primaryAction.key, "generate_directions");
  assert.match(view.currentTask.title, /方向卡片生成中/);
  assert.match(view.primaryAction.label, /生成中/);
  assert.match(view.primaryAction.disabledReason, /正在生成/);
  assert.equal(view.visibleDirections.length, 0);
});

test("buildSop3FocusedFlow keeps a fallback action to fill missing Round 1 story outlines", () => {
  const view = buildSop3FocusedFlow(
    flowInput({
      directions: fourDirections,
      expansions: [expansion("outline-direction-1", "direction-1")],
      jobs: [job("outline-job-failed", "creative_expansion_generation", "failed")],
    })
  );

  assert.equal(view.currentTask.key, "generate_story_outlines");
  assert.equal(view.primaryAction.key, "generate_story_outlines");
  assert.equal(view.primaryAction.label, "补齐方向卡片内容");
  assert.equal(view.primaryAction.disabledReason, null);
  assert.equal(view.visibleDirections.length, 4);
  assert.match(view.currentTask.statusLabel, /1\/4/);
});

test("buildSop3FocusedFlow enters selection only after every direction has a story outline", () => {
  const view = buildSop3FocusedFlow(
    flowInput({
      directions: fourDirections,
      expansions: fourDirections.map((item) => expansion(`outline-${item.id}`, item.id)),
    })
  );

  assert.equal(view.currentTask.key, "select_directions");
  assert.equal(view.primaryAction.key, "generate_round_1_materials");
  assert.match(view.primaryAction.disabledReason, /至少选择 1 个/);
  assert.ok(!view.progressNodes.some((node) => node.key === "story_outline"));
  assert.equal(view.progressNodes.find((node) => node.key === "direction_generation").status, "done");
  assert.match(view.progressNodes.find((node) => node.key === "direction_generation").summary, /含故事大纲/);
  assert.equal(view.progressNodes.find((node) => node.key === "internal_selection").status, "current");
});

test("creative direction generation returns card story outlines in one model call", () => {
  const directionGenerationSource = readFileSync(new URL("../../server/use-cases/generate-creative-directions.ts", import.meta.url), "utf8");
  const expansionGenerationSource = readFileSync(new URL("../../server/use-cases/generate-creative-expansions.ts", import.meta.url), "utf8");
  const round1EnqueueStart = expansionGenerationSource.indexOf("export async function enqueueCreativeExpansionGeneration");
  const round1EnqueueEnd = expansionGenerationSource.indexOf("export async function enqueueRound2DeepeningScriptGeneration", round1EnqueueStart);
  const round1RunStart = expansionGenerationSource.indexOf("await updateJobStatus(jobId", expansionGenerationSource.indexOf("export async function runCreativeExpansionGenerationJob"));
  const round1RunEnd = expansionGenerationSource.indexOf("try {", round1RunStart);
  assert.notEqual(round1EnqueueStart, -1);
  assert.notEqual(round1EnqueueEnd, -1);
  assert.notEqual(round1RunStart, -1);
  assert.notEqual(round1RunEnd, -1);
  const round1EnqueueSource = expansionGenerationSource.slice(round1EnqueueStart, round1EnqueueEnd);
  const round1RunSource = expansionGenerationSource.slice(round1RunStart, round1RunEnd);

  assert.match(directionGenerationSource, /storyOutline/);
  assert.match(directionGenerationSource, /createCreativeExpansions/);
  assert.match(directionGenerationSource, /timeoutMs: 300_000/);
  assert.match(directionGenerationSource, /简短故事梗概/);
  assert.match(directionGenerationSource, /savedDirections\.map\(\(direction, index\)[\s\S]*storyOutlines\[index\]/);
  assert.doesNotMatch(directionGenerationSource, /runCreativeExpansionGenerationJob|enqueueCreativeExpansionGeneration|generateRound1StoryOutlinesForDirections/);
  assert.doesNotMatch(round1EnqueueSource, /creative_direction_not_selected|!direction\.isSelected/);
  assert.doesNotMatch(round1RunSource, /creative_direction_not_selected|!direction\.isSelected/);
});

test("buildSop3FocusedFlow prepares Round 1 materials before client review", () => {
  const selected = fourDirections.map((item, index) => ({ ...item, isSelected: index < 2 }));
  const view = buildSop3FocusedFlow(
    flowInput({
      directions: selected,
      generatedImages: [
        generatedImage("style-2d", "direction-1", null, { metadata: { roundNumber: 1, styleVariant: "2d" } }),
      ],
      expansions: fourDirections.map((item) => expansion(`outline-${item.id}`, item.id)),
    })
  );

  assert.equal(view.currentTask.key, "prepare_round_1_materials");
  assert.equal(view.primaryAction.key, "generate_round_1_materials");
  assert.equal(view.primaryAction.label, "补齐 Round 1 提案材料");
  assert.match(view.currentTask.title, /Round 1/);
  assert.match(view.currentTask.description, /三种风格/);
  assert.deepEqual(view.visibleDirections.map((item) => item.id), ["direction-1", "direction-2"]);
  assert.equal(view.progressNodes.find((node) => node.key === "round_1_materials").status, "current");
});

test("buildSop3FocusedFlow shows a generate action before any Round 1 style image exists", () => {
  const selected = fourDirections.map((item, index) => ({ ...item, isSelected: index === 0 }));
  const view = buildSop3FocusedFlow(
    flowInput({
      directions: selected,
      expansions: fourDirections.map((item) => expansion(`outline-${item.id}`, item.id)),
      generatedImages: [],
    })
  );

  assert.equal(view.currentTask.key, "prepare_round_1_materials");
  assert.equal(view.currentTask.statusLabel, "风格图 0/3");
  assert.equal(view.primaryAction.key, "generate_round_1_materials");
  assert.equal(view.primaryAction.label, "生成 Round 1 提案材料");
  assert.match(view.primaryAction.description, /生成三种风格/);
});

test("buildSop3FocusedFlow sends Round 1 only after complete proposal materials are ready", () => {
  const selected = fourDirections.map((item, index) => ({ ...item, isSelected: index < 2 }));
  const readyImages = selected
    .filter((item) => item.isSelected)
    .flatMap((direction) =>
      ["2d", "pixar_3d", "realistic"].map((styleVariant) =>
        generatedImage(`image-${direction.id}-${styleVariant}`, direction.id, null, {
          metadata: { roundNumber: 1, styleVariant },
        })
      )
  );

  const view = buildSop3FocusedFlow(
    flowInput({
      directions: selected,
      expansions: fourDirections.map((item) => expansion(`outline-${item.id}`, item.id)),
      generatedImages: readyImages,
    })
  );

  assert.equal(view.currentTask.key, "prepare_round_1_materials");
  assert.equal(view.primaryAction.key, "send_round_1_review");
  assert.equal(view.primaryAction.disabledReason, null);
  assert.match(view.primaryAction.label, /完整提案包/);
  assert.match(view.progressNodes.find((node) => node.key === "round_1_materials").summary, /已就绪/);
});

test("buildSop3FocusedFlow keeps Round 1 blocked until every selected direction has three style images", () => {
  const selected = fourDirections.map((item, index) => ({ ...item, isSelected: index === 0 }));
  const incompleteImages = [
    generatedImage("image-direction-1-2d", "direction-1", null, { metadata: { roundNumber: 1, styleVariant: "2d" } }),
    generatedImage("image-direction-1-realistic", "direction-1", null, { metadata: { roundNumber: 1, styleVariant: "realistic" } }),
  ];

  const view = buildSop3FocusedFlow(
    flowInput({
      directions: selected,
      expansions: fourDirections.map((item) => expansion(`outline-${item.id}`, item.id)),
      generatedImages: incompleteImages,
    })
  );

  assert.equal(view.currentTask.key, "prepare_round_1_materials");
  assert.equal(view.primaryAction.key, "generate_round_1_materials");
  assert.match(view.primaryAction.label, /补齐 Round 1/);
  assert.match(view.progressNodes.find((node) => node.key === "round_1_materials").summary, /风格图 2\/3/);
  assert.match(view.progressNodes.find((node) => node.key === "round_1_materials").historySummary, /缺少三维皮克斯风格/);
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
  assert.match(view.primaryAction.label, /Round 1/);
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
      artifacts: [],
    })
  );

  assert.equal(view.currentTask.key, "deepen_confirmed_direction");
  assert.equal(view.primaryAction.key, "generate_deepening_script");
  assert.deepEqual(view.selectedDirections.map((item) => item.id), ["direction-1", "direction-2", "direction-3"]);
  assert.deepEqual(view.unselectedDirections.map((item) => item.id), ["direction-4"]);
  assert.deepEqual(view.visibleDirections.map((item) => item.id), ["direction-1", "direction-3"]);
  assert.equal(view.progressNodes.find((node) => node.key === "internal_selection").summary, "已选 3 个方向");
  assert.equal(view.progressNodes.find((node) => node.key === "client_round_1").status, "done");
  assert.match(view.currentTask.title, /方向深化故事/);
  assert.match(view.currentTask.description, /700-800 字/);
  assert.doesNotMatch(view.currentTask.title, /故事大纲/);
  assert.match(view.progressNodes.find((node) => node.key === "direction_deepening").historySummary, /方向 direction-1、方向 direction-3/);
  assert.doesNotMatch(view.progressNodes.find((node) => node.key === "direction_deepening").historySummary, /direction-2/);
});

test("buildSop3FocusedFlow does not count legacy Round 1 outlines as Round 2 storyboard scenes", () => {
  const selected = fourDirections.map((item, index) => ({ ...item, isSelected: index === 0 }));
  const round1 = round("round-1", 1, ["direction-1"], {
    clientReviewTaskId: "review-1",
    retainedDirectionIds: ["direction-1"],
  });
  const legacyRound1Expansions = [1, 2, 3, 4].map((sortOrder) =>
    expansion(`legacy-round1-outline-${sortOrder}`, "direction-1", sortOrder)
  );

  const view = buildSop3FocusedFlow(
    flowInput({
      directions: selected,
      creativeProposalRounds: [round1],
      clientReviewTasks: [
        reviewTask("review-1", "creative_round_1", "submitted", {
          decisionPayload: { retainedDirectionIds: ["direction-1"] },
        }),
      ],
      artifacts: [artifact("script-1", "direction-1", "round2_deepening_script", "confirmed")],
      expansions: legacyRound1Expansions,
    })
  );

  assert.equal(view.currentTask.key, "deepen_confirmed_direction");
  assert.equal(view.primaryAction.key, "split_deepening_storyboard");
  assert.match(view.currentTask.title, /精选 2 个精彩场景/);
  assert.equal(view.progressNodes.find((node) => node.key === "direction_deepening").summary, "完整故事 1/1");
});

test("buildSop3FocusedFlow generates direction deepening story directly before confirmation and Round 2 images", () => {
  const selected = fourDirections.map((item, index) => ({ ...item, isSelected: index === 0 }));
  const round1 = round("round-1", 1, ["direction-1"], {
    clientReviewTaskId: "review-1",
    retainedDirectionIds: ["direction-1"],
  });
  const base = {
    directions: selected,
    creativeProposalRounds: [round1],
    clientReviewTasks: [
      reviewTask("review-1", "creative_round_1", "submitted", {
        decisionPayload: { retainedDirectionIds: ["direction-1"] },
      }),
    ],
  };

  const noDeepeningStory = buildSop3FocusedFlow(flowInput(base));
  assert.equal(noDeepeningStory.primaryAction.key, "generate_deepening_script");
  assert.match(noDeepeningStory.currentTask.title, /方向深化故事/);
  assert.match(noDeepeningStory.currentTask.description, /700-800 字/);

  const scriptDraft = buildSop3FocusedFlow(
    flowInput({
      ...base,
      artifacts: [artifact("script-1", "direction-1", "round2_deepening_script", "draft")],
    })
  );
  assert.equal(scriptDraft.primaryAction.key, "confirm_deepening_script");
  assert.match(scriptDraft.currentTask.title, /确认完整故事/);

  const scriptConfirmed = buildSop3FocusedFlow(
    flowInput({
      ...base,
      artifacts: [artifact("script-1", "direction-1", "round2_deepening_script", "confirmed")],
    })
  );
  assert.equal(scriptConfirmed.primaryAction.key, "split_deepening_storyboard");
  assert.match(scriptConfirmed.currentTask.title, /精选.*2/);

  const splitReady = buildSop3FocusedFlow(
    flowInput({
      ...base,
      expansions: [1, 2].map((index) => expansion(`expansion-${index}`, "direction-1", index)),
      artifacts: [
        artifact("script-1", "direction-1", "round2_deepening_script", "confirmed"),
        round2SplitArtifact("split-1", "direction-1", ["expansion-1", "expansion-2"]),
      ],
    })
  );
  assert.equal(splitReady.primaryAction.key, "generate_deepening_assets");
  assert.match(splitReady.currentTask.title, /深化视觉图/);
});

test("buildSop3FocusedFlow does not count Round 1 direction style images as Round 2 deepening images", () => {
  const selected = fourDirections.map((item, index) => ({ ...item, isSelected: index === 0 }));
  const round1 = round("round-1", 1, ["direction-1"], {
    clientReviewTaskId: "review-1",
    retainedDirectionIds: ["direction-1"],
  });
  const deepeningExpansions = [1, 2].map((index) => expansion(`expansion-${index}`, "direction-1", index));
  const view = buildSop3FocusedFlow(
    flowInput({
      directions: selected,
      creativeProposalRounds: [round1],
      clientReviewTasks: [
        reviewTask("review-1", "creative_round_1", "submitted", {
          decisionPayload: { retainedDirectionIds: ["direction-1"] },
        }),
      ],
      artifacts: [
        artifact("script-1", "direction-1", "round2_deepening_script", "confirmed"),
        round2SplitArtifact("split-1", "direction-1", deepeningExpansions.map((item) => item.id)),
      ],
      expansions: deepeningExpansions,
      generatedImages: [
        generatedImage("round1-style-1", "direction-1", null, { metadata: { styleVariant: "2d" } }),
        generatedImage("round1-style-2", "direction-1", null, { metadata: { styleVariant: "pixar_3d" } }),
        generatedImage("round1-style-3", "direction-1", null, { metadata: { styleVariant: "realistic" } }),
      ],
    })
  );

  assert.equal(view.primaryAction.key, "generate_deepening_assets");
  assert.equal(view.currentTask.statusLabel, "深化视觉图 0/2");
});

test("buildSop3FocusedFlow keeps deepening generation action after materials are complete", () => {
  const selected = fourDirections.map((item, index) => ({ ...item, isSelected: index === 0 }));
  const round1 = round("round-1", 1, ["direction-1"], {
    clientReviewTaskId: "review-1",
    retainedDirectionIds: ["direction-1"],
  });
  const deepeningExpansions = [1, 2].map((index) => expansion(`expansion-${index}`, "direction-1", index));
  const view = buildSop3FocusedFlow(
    flowInput({
      directions: selected,
      creativeProposalRounds: [round1],
      clientReviewTasks: [
        reviewTask("review-1", "creative_round_1", "submitted", {
          decisionPayload: { retainedDirectionIds: ["direction-1"] },
        }),
      ],
      artifacts: [
        artifact("script-1", "direction-1", "round2_deepening_script", "confirmed"),
        round2SplitArtifact("split-1", "direction-1", deepeningExpansions.map((item) => item.id)),
      ],
      expansions: deepeningExpansions,
      generatedImages: deepeningExpansions.map((item, index) =>
        generatedImage(`image-${index + 1}`, "direction-1", item.id, { status: "succeeded" })
      ),
    })
  );

  assert.equal(view.currentTask.key, "deepen_confirmed_direction");
  assert.equal(view.currentTask.statusLabel, "已补齐");
  assert.equal(view.primaryAction.key, "generate_deepening_assets");
  assert.equal(view.primaryAction.label, "继续补齐深化视觉图");
  assert.deepEqual(view.visibleDirections.map((item) => item.id), ["direction-1"]);
});

test("buildSop3FocusedFlow treats approved Round 1 with no retained direction as incomplete feedback", () => {
  const selected = fourDirections.map((item, index) => ({ ...item, isSelected: index < 2 }));
  const round1 = round("round-1", 1, ["direction-1", "direction-2"], {
    clientReviewTaskId: "review-1",
    retainedDirectionIds: [],
  });
  const view = buildSop3FocusedFlow(
    flowInput({
      directions: selected,
      creativeProposalRounds: [round1],
      clientReviewTasks: [
        reviewTask("review-1", "creative_round_1", "approved", {
          decisionPayload: { retainedDirectionIds: [] },
        }),
      ],
    })
  );

  assert.equal(view.currentTask.key, "repair_incomplete_data");
  assert.equal(view.primaryAction.key, "send_round_1_review");
  assert.match(view.blockingMessage, /没有保留任何方向/);
  assert.deepEqual(view.visibleDirections.map((item) => item.id), ["direction-1", "direction-2"]);
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

test("buildSop3FocusedFlow does not advance when Round 1 is rejected", () => {
  const selected = fourDirections.map((item, index) => ({ ...item, isSelected: index < 2 }));
  const round1 = round("round-1", 1, ["direction-1", "direction-2"], {
    clientReviewTaskId: "review-1",
  });
  const view = buildSop3FocusedFlow(
    flowInput({
      directions: selected,
      creativeProposalRounds: [round1],
      clientReviewTasks: [
        reviewTask("review-1", "creative_round_1", "rejected", {
          feedback: "方向还不够准，需要补充客户品牌调性。",
        }),
      ],
    })
  );

  assert.equal(view.currentTask.key, "repair_incomplete_data");
  assert.equal(view.primaryAction.key, "send_round_1_review");
  assert.match(view.currentTask.title, /Round 1 提案包/);
  assert.match(view.blockingMessage, /方向还不够准/);
  assert.deepEqual(view.visibleDirections.map((item) => item.id), ["direction-1", "direction-2"]);
  assert.equal(view.progressNodes.find((node) => node.key === "client_round_1").status, "needs_attention");
});

test("buildSop3FocusedFlow does not finalize when Round 2 is rejected", () => {
  const selected = fourDirections.map((item, index) => ({ ...item, isSelected: index === 0 }));
  const round1 = round("round-1", 1, ["direction-1"], { clientReviewTaskId: "review-1" });
  const round2 = round("round-2", 2, ["direction-1"], { clientReviewTaskId: "review-2" });
  const view = buildSop3FocusedFlow(
    flowInput({
      directions: selected,
      creativeProposalRounds: [round1, round2],
      clientReviewTasks: [
        reviewTask("review-1", "creative_round_1", "approved"),
        reviewTask("review-2", "creative_round_2", "rejected", {
          feedback: "最终视觉还需要更贴近年轻用户。",
        }),
      ],
    })
  );

  assert.equal(view.currentTask.key, "repair_incomplete_data");
  assert.equal(view.primaryAction.key, "send_round_2_review");
  assert.match(view.currentTask.title, /修订最终确认/);
  assert.match(view.blockingMessage, /更贴近年轻用户/);
  assert.deepEqual(view.visibleDirections.map((item) => item.id), ["direction-1"]);
  assert.equal(view.progressNodes.find((node) => node.key === "final_confirmation").status, "needs_attention");
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
  assert.match(view.progressNodes.find((node) => node.key === "direction_deepening").historySummary, /精彩场景 0/);
});

test("isClientReviewReturned only treats submitted or approved as successful feedback", () => {
  assert.equal(isClientReviewReturned("submitted"), true);
  assert.equal(isClientReviewReturned("approved"), true);
  assert.equal(isClientReviewReturned("rejected"), false);
  assert.equal(isClientReviewReturned("active"), false);
  assert.equal(isClientReviewReturned(null), false);
});
