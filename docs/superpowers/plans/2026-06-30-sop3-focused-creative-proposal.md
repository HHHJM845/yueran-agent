# SOP 3 Focused Creative Proposal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework SOP 3 so the workspace shows only the current creative proposal task while preserving existing backend generation, client review, job worker, and SOP 4 gate logic.

**Architecture:** Add a small frontend view-model that derives the current SOP 3 task, visible directions, primary action, and progress nodes from existing workspace data. Refactor `CreativeDirectionsCard` to render one current-task body at a time and move historical Round/deepening details into a compact read-only progress map. Keep all existing API calls and persistence contracts unchanged.

**Tech Stack:** Next.js App Router, React, TypeScript, existing shadcn/Base UI components, Node test runner via `tsx --test`.

## Global Constraints

- Do not add a SOP 3 database sub-state machine.
- Do not implement rollback; the progress map is read-only history preview only.
- Do not change client review link, verification code, submission, or callback backend behavior.
- Do not delete persisted `creative_directions`, `creative_expansions`, `generated_images`, or `creative_proposal_rounds` data.
- Do not merge SOP 4 quote/contract logic into SOP 3.
- Do not keep asset analysis, full Round 1/2 details, complete proposal editor, story board, and future steps permanently visible in the SOP 3 main workspace.
- Preserve existing API calls: `generateCreativeDirections`, `updateCreativeDirectionSelection`, `createCreativeProposalRound`, `createCreativeProposalRoundClientReview`, `generateCreativeExpansions`, `generateAtmosphereImage`, `selectCreativeSceneImages`.
- All user-facing loading, success, empty, error, and blocked states use natural-language Chinese copy.
- Run `npm run test:baseline`, `npm run typecheck`, `npm run lint`, and `npm run build` before claiming completion.

---

## File Structure

- Create `src/components/workspace/sop3-focused-flow-view-model.ts`
  - Responsibility: derive `currentTask`, `primaryAction`, visible directions, blocking copy, and progress nodes from existing workspace data.
  - Exports:
    - `type Sop3CurrentTaskKey`
    - `type Sop3PrimaryActionKey`
    - `type Sop3ProgressNodeKey`
    - `type Sop3ProgressNodeView`
    - `type Sop3FocusedFlowInput`
    - `type Sop3FocusedFlowView`
    - `buildSop3FocusedFlow(input: Sop3FocusedFlowInput): Sop3FocusedFlowView`
    - `isClientReviewReturned(status: string | null | undefined): boolean`

- Create `src/components/workspace/sop3-focused-flow-view-model.test.mjs`
  - Responsibility: behavior tests for current-task derivation, progress node status, and read-only history summaries.

- Modify `src/components/workspace/workspace-shell.tsx`
  - Responsibility: remove SOP 3 decorative wrappers from `creative_direction_proposal` stage; consume the view-model inside `CreativeDirectionsCard`; render focused current-task bodies and the bottom progress map.

- Create `src/components/workspace/workspace-shell-sop3-focus.test.mjs`
  - Responsibility: source guards that prevent SOP 3 from regressing into a permanently stacked workspace.

- Modify `package.json`
  - Responsibility: add SOP 3 view-model and source guard tests to `npm run test:baseline`.

- Modify `AGENTS.md` and `README.md`
  - Responsibility: document that SOP 3 focused creative proposal flow is part of the baseline.

---

### Task 1: SOP 3 Focused Flow View Model

**Files:**
- Create: `src/components/workspace/sop3-focused-flow-view-model.ts`
- Create: `src/components/workspace/sop3-focused-flow-view-model.test.mjs`

**Interfaces:**
- Consumes:
  - `CreativeDirectionView`, `CreativeExpansionView`, `CreativeProposalRoundView`, `GeneratedImageView`, `ClientReviewTaskView`, `JobSummary`, `ArtifactView` from `src/components/workspace/api.ts` / `src/domain/types`.
- Produces:
  - `buildSop3FocusedFlow(input: Sop3FocusedFlowInput): Sop3FocusedFlowView`
  - `isClientReviewReturned(status: string | null | undefined): boolean`

- [ ] **Step 1: Write the failing view-model tests**

Create `src/components/workspace/sop3-focused-flow-view-model.test.mjs` with:

```js
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

test("buildSop3FocusedFlow deepens only confirmed selected directions after Round 1 returns", () => {
  const selected = fourDirections.map((item, index) => ({ ...item, isSelected: index < 2 }));
  const round1 = round("round-1", 1, ["direction-1", "direction-2"], { clientReviewTaskId: "review-1" });
  const view = buildSop3FocusedFlow(
    flowInput({
      directions: selected,
      creativeProposalRounds: [round1],
      clientReviewTasks: [reviewTask("review-1", "creative_round_1", "submitted")],
    })
  );

  assert.equal(view.currentTask.key, "deepen_confirmed_direction");
  assert.equal(view.primaryAction.key, "generate_deepening_assets");
  assert.deepEqual(view.visibleDirections.map((item) => item.id), ["direction-1", "direction-2"]);
  assert.equal(view.progressNodes.find((node) => node.key === "client_round_1").status, "done");
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
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```bash
npx tsx --test src/components/workspace/sop3-focused-flow-view-model.test.mjs
```

Expected: FAIL because `src/components/workspace/sop3-focused-flow-view-model.ts` does not exist.

- [ ] **Step 3: Create the view-model implementation**

Create `src/components/workspace/sop3-focused-flow-view-model.ts` with this structure:

```ts
import type {
  ClientReviewTaskView,
  CreativeDirectionView,
  CreativeExpansionView,
  CreativeProposalRoundView,
  GeneratedImageView,
} from "@/components/workspace/api";
import type { ArtifactView, JobSummary } from "@/domain/types";

export type Sop3CurrentTaskKey =
  | "generate_directions"
  | "select_directions"
  | "wait_round_1_feedback"
  | "deepen_confirmed_direction"
  | "wait_round_2_feedback"
  | "finalize_proposal"
  | "repair_incomplete_data";

export type Sop3PrimaryActionKey =
  | "generate_directions"
  | "send_round_1_review"
  | "refresh_client_feedback"
  | "generate_deepening_assets"
  | "send_round_2_review"
  | "enter_quote_contract"
  | "repair_data";

export type Sop3ProgressNodeKey =
  | "direction_generation"
  | "internal_selection"
  | "client_round_1"
  | "direction_deepening"
  | "final_confirmation";

export type Sop3ProgressNodeStatus = "not_started" | "current" | "done" | "needs_attention";

export type Sop3ProgressNodeView = {
  key: Sop3ProgressNodeKey;
  label: string;
  status: Sop3ProgressNodeStatus;
  summary: string;
  historySummary: string;
  previewMode: "readonly";
};

export type Sop3FocusedFlowInput = {
  directions: CreativeDirectionView[];
  expansions: CreativeExpansionView[];
  generatedImages: GeneratedImageView[];
  creativeProposalRounds: CreativeProposalRoundView[];
  clientReviewTasks: ClientReviewTaskView[];
  jobs: JobSummary[];
  artifacts: ArtifactView[];
  canGenerate: boolean;
  canEdit: boolean;
  canLaunchReview: boolean;
};

export type Sop3FocusedFlowView = {
  currentTask: {
    key: Sop3CurrentTaskKey;
    title: string;
    description: string;
    statusLabel: string;
  };
  primaryAction: {
    key: Sop3PrimaryActionKey;
    label: string;
    description: string;
    disabledReason: string | null;
  };
  visibleDirections: CreativeDirectionView[];
  selectedDirections: CreativeDirectionView[];
  unselectedDirections: CreativeDirectionView[];
  round1: CreativeProposalRoundView | null;
  round2: CreativeProposalRoundView | null;
  round1ReviewTask: ClientReviewTaskView | null;
  round2ReviewTask: ClientReviewTaskView | null;
  blockingMessage: string | null;
  progressNodes: Sop3ProgressNodeView[];
};

export function buildSop3FocusedFlow(input: Sop3FocusedFlowInput): Sop3FocusedFlowView {
  const sortedDirections = [...input.directions].sort((left, right) => left.sortOrder - right.sortOrder);
  const selectedDirections = sortedDirections.filter((direction) => direction.isSelected);
  const unselectedDirections = sortedDirections.filter((direction) => !direction.isSelected);
  const round1 = findLatestRound(input.creativeProposalRounds, 1);
  const round2 = findLatestRound(input.creativeProposalRounds, 2);
  const round1ReviewTask = findCreativeRoundReviewTask(input.clientReviewTasks, round1, "creative_round_1");
  const round2ReviewTask = findCreativeRoundReviewTask(input.clientReviewTasks, round2, "creative_round_2");
  const directionCount = sortedDirections.length;
  const selectedExpansionCount = countSelectedExpansions(input.expansions, selectedDirections);
  const selectedGeneratedImageCount = countSelectedGeneratedImages(input.generatedImages, selectedDirections);
  const confirmedImageCount = input.generatedImages.filter((image) => image.reviewStatus === "confirmed").length;

  let currentTask: Sop3FocusedFlowView["currentTask"];
  let primaryAction: Sop3FocusedFlowView["primaryAction"];
  let visibleDirections: CreativeDirectionView[] = selectedDirections.length > 0 ? selectedDirections : sortedDirections;
  let blockingMessage: string | null = null;

  if (directionCount === 0) {
    currentTask = {
      key: "generate_directions",
      title: "生成四个创意方向",
      description: "先基于已确认 Brief 生成 4 个内部创意方向，生成完成后页面只展示这四个方向。",
      statusLabel: hasRunningJob(input.jobs, "creative_direction_generation") ? "生成中" : "待生成",
    };
    primaryAction = {
      key: "generate_directions",
      label: hasRunningJob(input.jobs, "creative_direction_generation") ? "正在生成方向" : "生成 4 个创意方向",
      description: "系统会在后台生成方向并保存到项目。",
      disabledReason: input.canGenerate ? null : "当前角色不能发起创意方向生成。",
    };
    visibleDirections = [];
  } else if (directionCount !== 4) {
    currentTask = {
      key: "repair_incomplete_data",
      title: "修复创意方向数量",
      description: "当前方向数量不完整，请重新生成后再发给甲方。",
      statusLabel: "需要处理",
    };
    primaryAction = {
      key: "repair_data",
      label: "重新生成 4 个方向",
      description: "方向数量必须是 4 个，才能进入内部选择和甲方初筛。",
      disabledReason: input.canGenerate ? null : "当前角色不能重新生成方向。",
    };
    blockingMessage = `当前只有 ${directionCount} 个创意方向。请重新生成 4 个方向后继续。`;
  } else if (!round1) {
    currentTask = {
      key: "select_directions",
      title: "选择要发给甲方的方向",
      description: "从四个方向中单选或多选，选好后直接发送给甲方初筛。",
      statusLabel: selectedDirections.length > 0 ? `已选 ${selectedDirections.length} 个` : "待选择",
    };
    primaryAction = {
      key: "send_round_1_review",
      label: "发送给甲方初筛",
      description: "系统会保存 Round 1 提案包并生成甲方审核链接。",
      disabledReason:
        selectedDirections.length === 0
          ? "请至少选择 1 个创意方向。"
          : input.canLaunchReview
            ? null
            : "当前角色不能发起甲方审核。",
    };
    visibleDirections = sortedDirections;
  } else if (!isClientReviewReturned(round1ReviewTask?.status)) {
    currentTask = {
      key: "wait_round_1_feedback",
      title: "等待甲方初筛",
      description: "Round 1 已进入甲方初筛，当前只需要查看发送状态或刷新回传结果。",
      statusLabel: round1ReviewTask ? clientReviewStatusLabel(round1ReviewTask.status) : "待发送",
    };
    primaryAction = {
      key: "refresh_client_feedback",
      label: round1ReviewTask ? "刷新甲方回传" : "发送给甲方初筛",
      description: "甲方提交后，系统会自动回写筛选结果。",
      disabledReason: null,
    };
    visibleDirections = directionsForRound(sortedDirections, round1);
  } else if (!round2) {
    currentTask = {
      key: "deepen_confirmed_direction",
      title: "深化已确认方向",
      description: "只处理甲方初筛后保留的方向，生成故事大纲和氛围图。",
      statusLabel: selectedExpansionCount > 0 ? `故事大纲 ${selectedExpansionCount}` : "待深化",
    };
    primaryAction = {
      key: "generate_deepening_assets",
      label: selectedExpansionCount > 0 && selectedGeneratedImageCount > 0 ? "继续补齐深化内容" : "生成深化内容",
      description: "为已确认方向生成故事大纲和氛围图候选。",
      disabledReason: input.canGenerate ? null : "当前角色不能生成深化内容。",
    };
    visibleDirections = selectedDirections.length > 0 ? selectedDirections : directionsForRound(sortedDirections, round1);
  } else if (!isClientReviewReturned(round2ReviewTask?.status)) {
    currentTask = {
      key: "wait_round_2_feedback",
      title: "等待最终确认",
      description: "Round 2 已进入最终确认，当前只需要查看发送状态或刷新甲方回传。",
      statusLabel: round2ReviewTask ? clientReviewStatusLabel(round2ReviewTask.status) : "待发送",
    };
    primaryAction = {
      key: "send_round_2_review",
      label: round2ReviewTask ? "刷新最终确认" : "发起最终确认",
      description: "甲方确认后，项目可以进入最终提案整理和 SOP 4。",
      disabledReason: input.canLaunchReview ? null : "当前角色不能发起甲方审核。",
    };
    visibleDirections = directionsForRound(sortedDirections, round2);
  } else {
    currentTask = {
      key: "finalize_proposal",
      title: "整理最终提案",
      description: "最终创意方向和视觉风格已确认，可以整理提案并进入报价合同。",
      statusLabel: "已确认",
    };
    primaryAction = {
      key: "enter_quote_contract",
      label: "进入报价合同",
      description: "继续进入 SOP 4 工作量估算、报价合同与交付清单。",
      disabledReason: null,
    };
    visibleDirections = directionsForRound(sortedDirections, round2);
  }

  return {
    currentTask,
    primaryAction,
    visibleDirections,
    selectedDirections,
    unselectedDirections,
    round1,
    round2,
    round1ReviewTask,
    round2ReviewTask,
    blockingMessage,
    progressNodes: buildProgressNodes({
      directions: sortedDirections,
      selectedDirections,
      expansions: input.expansions,
      generatedImages: input.generatedImages,
      round1,
      round2,
      round1ReviewTask,
      round2ReviewTask,
      currentTaskKey: currentTask.key,
      selectedExpansionCount,
      confirmedImageCount,
    }),
  };
}
```

Continue the same file with these helpers:

```ts
export function isClientReviewReturned(status: string | null | undefined): boolean {
  return status === "submitted" || status === "approved" || status === "rejected";
}

function findLatestRound(rounds: CreativeProposalRoundView[], roundNumber: 1 | 2) {
  return [...rounds]
    .filter((round) => round.roundNumber === roundNumber)
    .sort((left, right) => right.version - left.version)[0] ?? null;
}

function findCreativeRoundReviewTask(
  tasks: ClientReviewTaskView[],
  round: CreativeProposalRoundView | null,
  reviewScene: "creative_round_1" | "creative_round_2"
) {
  if (round?.clientReviewTaskId) {
    return tasks.find((task) => task.id === round.clientReviewTaskId) ?? null;
  }
  return tasks.find((task) => task.reviewScene === reviewScene) ?? null;
}

function directionsForRound(directions: CreativeDirectionView[], round: CreativeProposalRoundView | null) {
  if (!round) return [];
  const ids = new Set(round.directionIds);
  return directions.filter((direction) => ids.has(direction.id));
}

function countSelectedExpansions(expansions: CreativeExpansionView[], selectedDirections: CreativeDirectionView[]) {
  const ids = new Set(selectedDirections.map((direction) => direction.id));
  return expansions.filter((expansion) => ids.has(expansion.directionId)).length;
}

function countSelectedGeneratedImages(images: GeneratedImageView[], selectedDirections: CreativeDirectionView[]) {
  const ids = new Set(selectedDirections.map((direction) => direction.id));
  return images.filter((image) => image.directionId && ids.has(image.directionId) && isGeneratedImageRunningOrDone(image)).length;
}

function isGeneratedImageRunningOrDone(image: Pick<GeneratedImageView, "status">) {
  return image.status === "queued" || image.status === "processing" || image.status === "retrying" || image.status === "succeeded";
}

function hasRunningJob(jobs: JobSummary[], type: string) {
  return jobs.some((job) => job.type === type && (job.status === "queued" || job.status === "processing" || job.status === "retrying"));
}

function clientReviewStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "草稿",
    active: "等待甲方",
    submitted: "已回传",
    approved: "已通过",
    rejected: "已打回",
    expired: "已过期",
    revoked: "已撤回",
  };
  return labels[status] ?? status;
}

function buildProgressNodes(input: {
  directions: CreativeDirectionView[];
  selectedDirections: CreativeDirectionView[];
  expansions: CreativeExpansionView[];
  generatedImages: GeneratedImageView[];
  round1: CreativeProposalRoundView | null;
  round2: CreativeProposalRoundView | null;
  round1ReviewTask: ClientReviewTaskView | null;
  round2ReviewTask: ClientReviewTaskView | null;
  currentTaskKey: Sop3CurrentTaskKey;
  selectedExpansionCount: number;
  confirmedImageCount: number;
}): Sop3ProgressNodeView[] {
  const selectedCount = input.selectedDirections.length;
  const round1Returned = isClientReviewReturned(input.round1ReviewTask?.status);
  const round2Returned = isClientReviewReturned(input.round2ReviewTask?.status);

  return [
    {
      key: "direction_generation",
      label: "方向生成",
      status: progressStatus(input.currentTaskKey, "generate_directions", input.directions.length === 4),
      summary: input.directions.length === 4 ? "已生成 4 个方向" : `当前 ${input.directions.length}/4 个方向`,
      historySummary: input.directions.length > 0 ? input.directions.map((direction) => direction.title).join("、") : "还没有生成方向。",
      previewMode: "readonly",
    },
    {
      key: "internal_selection",
      label: "内部选择",
      status: progressStatus(input.currentTaskKey, "select_directions", selectedCount > 0 || Boolean(input.round1)),
      summary: selectedCount > 0 ? `已选 ${selectedCount} 个方向` : "待选择方向",
      historySummary: selectedCount > 0 ? input.selectedDirections.map((direction) => direction.title).join("、") : "还没有内部选择记录。",
      previewMode: "readonly",
    },
    {
      key: "client_round_1",
      label: "甲方初筛",
      status: progressStatus(input.currentTaskKey, "wait_round_1_feedback", round1Returned),
      summary: input.round1ReviewTask ? clientReviewStatusLabel(input.round1ReviewTask.status) : "待发送给甲方",
      historySummary: input.round1ReviewTask ? `Round 1 ${clientReviewStatusLabel(input.round1ReviewTask.status)}。${input.round1ReviewTask.feedback || "暂无甲方备注。"}` : "还没有 Round 1 甲方审核记录。",
      previewMode: "readonly",
    },
    {
      key: "direction_deepening",
      label: "方向深化",
      status: progressStatus(input.currentTaskKey, "deepen_confirmed_direction", input.selectedExpansionCount > 0),
      summary: input.selectedExpansionCount > 0 ? `故事大纲 ${input.selectedExpansionCount}，确认图 ${input.confirmedImageCount}` : "待深化",
      historySummary: `故事大纲 ${input.selectedExpansionCount}，氛围图 ${input.generatedImages.length}，确认采用 ${input.confirmedImageCount}。`,
      previewMode: "readonly",
    },
    {
      key: "final_confirmation",
      label: "最终确认",
      status: progressStatus(input.currentTaskKey, "wait_round_2_feedback", round2Returned || input.currentTaskKey === "finalize_proposal"),
      summary: input.round2ReviewTask ? clientReviewStatusLabel(input.round2ReviewTask.status) : "待最终确认",
      historySummary: input.round2ReviewTask ? `Round 2 ${clientReviewStatusLabel(input.round2ReviewTask.status)}。${input.round2ReviewTask.feedback || "暂无甲方备注。"}` : "还没有 Round 2 最终确认记录。",
      previewMode: "readonly",
    },
  ];
}

function progressStatus(currentTaskKey: Sop3CurrentTaskKey, taskKey: Sop3CurrentTaskKey, done: boolean): Sop3ProgressNodeStatus {
  if (done) return "done";
  if (currentTaskKey === taskKey) return "current";
  if (currentTaskKey === "repair_incomplete_data") return "needs_attention";
  return "not_started";
}
```

- [ ] **Step 4: Run the view-model test and verify it passes**

Run:

```bash
npx tsx --test src/components/workspace/sop3-focused-flow-view-model.test.mjs
```

Expected: PASS with 7 tests.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/components/workspace/sop3-focused-flow-view-model.ts src/components/workspace/sop3-focused-flow-view-model.test.mjs
git commit -m "feat: add focused SOP3 flow view model"
```

---

### Task 2: SOP 3 Source Guards And Baseline Entry

**Files:**
- Create: `src/components/workspace/workspace-shell-sop3-focus.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `CreativeDirectionsCard` and `StagePanel stage="creative_direction_proposal"` source in `workspace-shell.tsx`.
- Produces: baseline tests that fail until Task 3 removes permanent stacked SOP 3 rendering.

- [ ] **Step 1: Write the failing source guard test**

Create `src/components/workspace/workspace-shell-sop3-focus.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the source guard and verify it fails**

Run:

```bash
npx tsx --test src/components/workspace/workspace-shell-sop3-focus.test.mjs
```

Expected: FAIL because `CreativeDirectionsCard` still uses `Sop3FlowStrip`, permanently renders `CreativeExpansionBoard` and `CreativeProposalRoundsPanel`, and the SOP3 stage still includes stacked `StageWorkCard` blocks.

- [ ] **Step 3: Add the new tests to baseline**

Modify `package.json` so `test:baseline` includes the new files:

```json
"test:baseline": "tsx --test src/components/workspace/workspace-shell-brief-risk-simplification.test.mjs src/components/workspace/workspace-shell-stage-tabs.test.mjs src/components/workspace/workspace-shell-sop3-focus.test.mjs src/components/workspace/risk-check-view-model.test.mjs src/components/workspace/sop3-focused-flow-view-model.test.mjs src/server/use-cases/risk-check-card.test.mjs src/scripts/dev-with-worker.test.mjs"
```

- [ ] **Step 4: Run baseline and verify expected failure**

Run:

```bash
npm run test:baseline
```

Expected: FAIL only on `workspace-shell-sop3-focus.test.mjs`. Existing Brief/SOP2/worker tests should still pass.

- [ ] **Step 5: Commit Task 2**

```bash
git add package.json src/components/workspace/workspace-shell-sop3-focus.test.mjs
git commit -m "test: guard focused SOP3 workspace"
```

---

### Task 3: Focus The SOP 3 Main Workspace

**Files:**
- Modify: `src/components/workspace/workspace-shell.tsx`

**Interfaces:**
- Consumes:
  - `buildSop3FocusedFlow(input: Sop3FocusedFlowInput): Sop3FocusedFlowView`
  - Existing handlers in `CreativeDirectionsCard`.
- Produces:
  - `Sop3CurrentTaskBody`
  - `Sop3FocusedHeader`
  - `handleSendRound1Review`
  - `handleSendRound2Review`

- [ ] **Step 1: Import the view-model**

In `src/components/workspace/workspace-shell.tsx`, add:

```ts
import {
  buildSop3FocusedFlow,
  type Sop3FocusedFlowView,
  type Sop3ProgressNodeView,
} from "@/components/workspace/sop3-focused-flow-view-model";
```

- [ ] **Step 2: Simplify the SOP3 stage shell**

Replace the entire `<StagePanel stage="creative_direction_proposal" ...>` block with:

```tsx
<StagePanel stage="creative_direction_proposal" selectedStage={selectedStage}>
  <div className="grid gap-5">
    <CreativeDirectionsCard
      project={project}
      user={user}
      jobs={jobs}
      directions={creativeDirections}
      expansions={creativeExpansions}
      generatedImages={generatedImages}
      creativeProposalRounds={creativeProposalRounds}
      clientReviewTasks={clientReviewTasks}
      artifacts={artifacts}
      onRefresh={onWorkspaceRefresh}
    />
  </div>
</StagePanel>
```

This removes always-visible asset analysis and proposal editor from SOP3. They can remain available through future dedicated entry points, but they are not part of the focused SOP3 main workspace.

- [ ] **Step 3: Build focused flow inside `CreativeDirectionsCard`**

Inside `CreativeDirectionsCard`, replace the existing `sop3FlowState = deriveSop3FlowState(...)` block with:

```tsx
const focusedFlow = buildSop3FocusedFlow({
  directions,
  expansions,
  generatedImages,
  creativeProposalRounds,
  clientReviewTasks,
  jobs,
  artifacts,
  canGenerate,
  canEdit,
  canLaunchReview: canLaunchRoundReview,
});

const activeRound1 = focusedFlow.round1;
const activeRound2 = focusedFlow.round2;
const round1ReviewTask = focusedFlow.round1ReviewTask;
const round2ReviewTask = focusedFlow.round2ReviewTask;
const selectedDirectionCards = focusedFlow.selectedDirections;
const unselectedDirectionCards = focusedFlow.unselectedDirections;
```

Remove the old local declarations for `round1`, `round2`, `round1MatchesSelection`, `round2MatchesSelection`, `activeRound1`, `activeRound2`, `round1ReviewTask`, `round2ReviewTask`, and `sop3FlowState`.

- [ ] **Step 4: Add direct send helpers**

Inside `CreativeDirectionsCard`, add:

```tsx
async function handleSendRound1Review() {
  if (selectedDirections.length === 0) {
    setDirectionError("请至少选择 1 个创意方向，再发送给甲方初筛。");
    return;
  }

  setCreatingRound(1);
  setReviewingRoundId(null);
  setMessage(null);
  setDirectionError(null);

  const roundResult = await createCreativeProposalRound(project.id, {
    roundNumber: 1,
    directionIds: selectedDirections.map((direction) => direction.id),
  });

  if (!roundResult.ok) {
    setDirectionError(roundResult.error.message);
    setCreatingRound(null);
    return;
  }

  setCreatingRound(null);
  await handleCreateRoundClientReview(roundResult.data.round);
}

async function handleSendRound2Review() {
  if (selectedDirections.length === 0) {
    setDirectionError("请至少保留 1 个创意方向，再发起最终确认。");
    return;
  }

  setCreatingRound(2);
  setReviewingRoundId(null);
  setMessage(null);
  setDirectionError(null);

  const roundResult = await createCreativeProposalRound(project.id, {
    roundNumber: 2,
    directionIds: selectedDirections.map((direction) => direction.id),
  });

  if (!roundResult.ok) {
    setDirectionError(roundResult.error.message);
    setCreatingRound(null);
    return;
  }

  setCreatingRound(null);
  await handleCreateRoundClientReview(roundResult.data.round);
}
```

- [ ] **Step 5: Replace primary action routing**

Replace `handlePrimarySop3Action` with:

```tsx
function handlePrimarySop3Action() {
  if (focusedFlow.primaryAction.key === "generate_directions") {
    void handleGenerate();
    return;
  }

  if (focusedFlow.primaryAction.key === "send_round_1_review") {
    void handleSendRound1Review();
    return;
  }

  if (focusedFlow.primaryAction.key === "refresh_client_feedback") {
    void onRefresh();
    return;
  }

  if (focusedFlow.primaryAction.key === "generate_deepening_assets") {
    void handleGenerateSelectedAtmosphereImages();
    return;
  }

  if (focusedFlow.primaryAction.key === "send_round_2_review") {
    void handleSendRound2Review();
    return;
  }

  if (focusedFlow.primaryAction.key === "enter_quote_contract") {
    setMessage("最终方向已确认，请进入上方 SOP 4 报价合同模块继续。");
    return;
  }

  if (focusedFlow.primaryAction.key === "repair_data") {
    void handleGenerate();
  }
}
```

- [ ] **Step 6: Replace the component return with focused layout**

In `CreativeDirectionsCard`, replace the JSX return from `<WorkspaceCard...>` to before `</WorkspaceCard>` with:

```tsx
return (
  <WorkspaceCard className="lg:col-span-2">
    <Sop3FocusedHeader flow={focusedFlow} />

    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{focusedFlow.primaryAction.label}</p>
        <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{focusedFlow.primaryAction.description}</p>
        {focusedFlow.primaryAction.disabledReason && (
          <p className="mt-1 text-xs leading-5 text-[var(--warning)]">{focusedFlow.primaryAction.disabledReason}</p>
        )}
      </div>
      <Button
        type="button"
        onClick={handlePrimarySop3Action}
        disabled={Boolean(focusedFlow.primaryAction.disabledReason) || primaryActionBusy}
        className="h-10 shrink-0 justify-center"
      >
        {primaryActionBusy ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
        {focusedFlow.primaryAction.label}
      </Button>
    </div>

    {visibleDirectionError && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm text-[var(--warning)]">{visibleDirectionError}</div>}
    {visibleDirectionMessage && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-teal-bg)] p-3 text-sm text-[var(--success)]">{visibleDirectionMessage}</div>}
    {focusedFlow.blockingMessage && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm text-[var(--warning)]">{focusedFlow.blockingMessage}</div>}

    <Sop3CurrentTaskBody
      projectId={project.id}
      flow={focusedFlow}
      canEdit={canEdit}
      canExpand={canGenerate}
      canGenerateImage={canGenerate}
      canReviewImage={canEdit}
      editingId={editingId}
      savingDirectionId={savingDirectionId}
      expandingDirectionId={expandingDirectionId}
      generatingImageExpansionId={generatingImageExpansionId}
      generatedImages={generatedImages}
      expansions={expansions}
      createdRoundReview={createdRoundReview}
      onToggleEdit={(directionId) => setEditingId((current) => (current === directionId ? null : directionId))}
      onSelection={(direction) => void handleSelection(direction)}
      onGenerateExpansions={(direction) => void handleGenerateExpansions(direction)}
      onSave={(direction, formData) => void handleSave(direction, formData)}
      onGenerateAtmosphereImage={(direction, expansion) => void handleGenerateAtmosphereImage(direction, expansion)}
      onRefresh={onRefresh}
    />

    <Sop3ProgressMap nodes={focusedFlow.progressNodes} />
  </WorkspaceCard>
);
```

- [ ] **Step 7: Add `Sop3FocusedHeader`**

Place this helper below `CreativeDirectionsCard`:

```tsx
function Sop3FocusedHeader({ flow }: { flow: Sop3FocusedFlowView }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Sparkles size={18} />
          <h3 className="ds-text-section-title">{flow.currentTask.title}</h3>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">{flow.currentTask.description}</p>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">{flow.currentTask.statusLabel}</span>
        {flow.selectedDirections.length > 0 && (
          <span className="ds-pill ds-selected-pill">已选 {flow.selectedDirections.length}</span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Add `Sop3CurrentTaskBody`**

Place this helper below `Sop3FocusedHeader`:

```tsx
function Sop3CurrentTaskBody({
  projectId,
  flow,
  canEdit,
  canExpand,
  canGenerateImage,
  canReviewImage,
  editingId,
  savingDirectionId,
  expandingDirectionId,
  generatingImageExpansionId,
  generatedImages,
  expansions,
  createdRoundReview,
  onToggleEdit,
  onSelection,
  onGenerateExpansions,
  onSave,
  onGenerateAtmosphereImage,
  onRefresh,
}: {
  projectId: string;
  flow: Sop3FocusedFlowView;
  canEdit: boolean;
  canExpand: boolean;
  canGenerateImage: boolean;
  canReviewImage: boolean;
  editingId: string | null;
  savingDirectionId: string | null;
  expandingDirectionId: string | null;
  generatingImageExpansionId: string | null;
  generatedImages: GeneratedImageView[];
  expansions: CreativeExpansionView[];
  createdRoundReview: { roundId: string; url: string; code: string } | null;
  onToggleEdit: (directionId: string) => void;
  onSelection: (direction: CreativeDirectionView) => void;
  onGenerateExpansions: (direction: CreativeDirectionView) => void;
  onSave: (direction: CreativeDirectionView, formData: FormData) => void;
  onGenerateAtmosphereImage: (direction: CreativeDirectionView, expansion: CreativeExpansionView) => void;
  onRefresh: () => Promise<void>;
}) {
  if (flow.currentTask.key === "generate_directions") {
    return (
      <div className="mt-4 rounded-card-sm border border-dashed border-[var(--border-soft)] bg-[var(--surface-soft)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
        还没有创意方向。请先生成 4 个方向，生成完成后这里只显示四张方向卡。
      </div>
    );
  }

  if (flow.currentTask.key === "select_directions" || flow.currentTask.key === "repair_incomplete_data") {
    return (
      <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        {flow.visibleDirections.map((direction) => (
          <CreativeDirectionCard
            key={direction.id}
            direction={direction}
            expansions={expansions.filter((item) => item.directionId === direction.id)}
            canEdit={canEdit}
            canExpand={canExpand}
            editing={editingId === direction.id}
            saving={savingDirectionId === direction.id || expandingDirectionId === direction.id}
            onToggleEdit={() => onToggleEdit(direction.id)}
            onSelection={() => onSelection(direction)}
            onGenerateExpansions={() => onGenerateExpansions(direction)}
            onSave={(formData) => onSave(direction, formData)}
          />
        ))}
      </div>
    );
  }

  if (flow.currentTask.key === "wait_round_1_feedback" || flow.currentTask.key === "wait_round_2_feedback") {
    const reviewTask = flow.currentTask.key === "wait_round_1_feedback" ? flow.round1ReviewTask : flow.round2ReviewTask;
    const createdReview =
      reviewTask && createdRoundReview?.roundId === (flow.currentTask.key === "wait_round_1_feedback" ? flow.round1?.id : flow.round2?.id)
        ? createdRoundReview
        : null;
    return <Sop3WaitingForClientPanel reviewTask={reviewTask} createdReview={createdReview} directions={flow.visibleDirections} />;
  }

  if (flow.currentTask.key === "deepen_confirmed_direction") {
    return (
      <CreativeExpansionBoard
        projectId={projectId}
        selectedDirections={flow.visibleDirections}
        unselectedDirections={flow.unselectedDirections}
        expansions={expansions}
        generatedImages={generatedImages}
        canGenerateImage={canGenerateImage}
        canReviewImage={canReviewImage}
        generatingImageExpansionId={generatingImageExpansionId}
        onGenerateAtmosphereImage={onGenerateAtmosphereImage}
        onRefresh={onRefresh}
      />
    );
  }

  return <Sop3FinalProposalSummary flow={flow} expansions={expansions} generatedImages={generatedImages} />;
}
```

- [ ] **Step 9: Add waiting and final summary panels**

Place these helpers below `Sop3CurrentTaskBody`:

```tsx
function Sop3WaitingForClientPanel({
  reviewTask,
  createdReview,
  directions,
}: {
  reviewTask: ClientReviewTaskView | null;
  createdReview: { url: string; code: string } | null;
  directions: CreativeDirectionView[];
}) {
  return (
    <div className="mt-4 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-4">
      <p className="text-sm font-semibold text-[var(--text-primary)]">等待甲方回传</p>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
        当前只需要等待甲方完成筛选或确认。回传后，工作区会自动切到下一步。
      </p>
      {createdReview && <CreativeRoundReviewAccessBox review={createdReview} />}
      {reviewTask && !createdReview && (
        <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3 text-xs leading-5 text-[var(--text-secondary)]">
          <p className="font-medium text-[var(--text-primary)]">本轮甲方审核已发起</p>
          <p className="mt-1">状态：{clientReviewStatusLabel(reviewTask.status)} · v{reviewTask.version} · {formatDateTime(reviewTask.updatedAt)}</p>
          <p className="mt-1">历史验证码不会再次明文展示；如找不到已发送给甲方的链接和验证码，请重新生成审核链接。</p>
        </div>
      )}
      <CreativeProposalReviewFeedback task={reviewTask} />
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {directions.map((direction) => (
          <span key={direction.id} className="ds-pill bg-[var(--surface-card)] text-[var(--text-secondary)]">{direction.title}</span>
        ))}
      </div>
    </div>
  );
}

function Sop3FinalProposalSummary({
  flow,
  expansions,
  generatedImages,
}: {
  flow: Sop3FocusedFlowView;
  expansions: CreativeExpansionView[];
  generatedImages: GeneratedImageView[];
}) {
  const visibleDirectionIds = new Set(flow.visibleDirections.map((direction) => direction.id));
  const visibleExpansions = expansions.filter((expansion) => visibleDirectionIds.has(expansion.directionId));
  const visibleImages = generatedImages.filter((image) => image.directionId && visibleDirectionIds.has(image.directionId));
  const confirmedImageCount = visibleImages.filter((image) => image.reviewStatus === "confirmed").length;

  return (
    <div className="mt-4 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-4">
      <p className="text-sm font-semibold text-[var(--text-primary)]">最终方向已确认</p>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
        当前可以整理最终提案，并继续进入 SOP 4 工作量估算、报价合同与交付清单。
      </p>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <MiniMetric label="确认方向" value={`${flow.visibleDirections.length} 个`} />
        <MiniMetric label="故事大纲" value={`${visibleExpansions.length} 个`} />
        <MiniMetric label="确认氛围图" value={`${confirmedImageCount}/${visibleImages.length}`} />
      </div>
      <div className="mt-3 grid gap-2">
        {flow.visibleDirections.map((direction) => (
          <div key={direction.id} className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3 text-sm">
            <p className="font-medium text-[var(--text-primary)]">{direction.title}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">{direction.coreIdea}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 10: Remove old SOP 3 flow helpers**

Delete these old helpers from `workspace-shell.tsx` after the new focused helpers compile:

- `type Sop3FlowStepKey`
- `type Sop3PrimaryActionKey`
- `type Sop3FlowState`
- `type Sop3FlowInput`
- `deriveSop3FlowState`
- `Sop3FlowStrip`

Keep reusable helpers that are still used:

- `CreativeDirectionCard`
- `CreativeExpansionBoard`
- `CreativeProposalReviewFeedback`
- `CreativeRoundReviewAccessBox`
- `clientReviewStatusLabel`
- `formatDateTime`

- [ ] **Step 11: Run focused tests**

Run:

```bash
npx tsx --test src/components/workspace/sop3-focused-flow-view-model.test.mjs src/components/workspace/workspace-shell-sop3-focus.test.mjs
npm run typecheck
```

Expected: both tests PASS and TypeScript exits 0.

- [ ] **Step 12: Commit Task 3**

```bash
git add src/components/workspace/workspace-shell.tsx
git commit -m "feat: focus SOP3 current creative task"
```

---

### Task 4: Bottom Progress Map With Read-Only History Preview

**Files:**
- Modify: `src/components/workspace/workspace-shell.tsx`
- Modify: `src/components/workspace/workspace-shell-sop3-focus.test.mjs`

**Interfaces:**
- Consumes:
  - `Sop3ProgressNodeView[]` from `buildSop3FocusedFlow`.
- Produces:
  - `Sop3ProgressMap({ nodes }: { nodes: Sop3ProgressNodeView[] })`
  - Read-only node expansion state inside the progress map only.

- [ ] **Step 1: Extend source guard for progress map behavior**

Append this test to `workspace-shell-sop3-focus.test.mjs`:

```js
test("SOP3 progress map is a compact read-only history preview", () => {
  const map = componentSource("Sop3ProgressMap");

  assert.match(map, /流程进展/);
  assert.match(map, /historySummary/);
  assert.match(map, /只读记录/);
  assert.match(map, /setExpandedNode/);
  assert.doesNotMatch(map, /onRollback/);
  assert.doesNotMatch(map, /回滚/);
});
```

- [ ] **Step 2: Run the extended source guard and verify it fails**

Run:

```bash
npx tsx --test src/components/workspace/workspace-shell-sop3-focus.test.mjs
```

Expected: FAIL because `Sop3ProgressMap` does not exist yet.

- [ ] **Step 3: Add `Sop3ProgressMap`**

Place this helper below `Sop3FinalProposalSummary`:

```tsx
function Sop3ProgressMap({ nodes }: { nodes: Sop3ProgressNodeView[] }) {
  const [expandedNode, setExpandedNode] = useState<string | null>(null);

  return (
    <div className="mt-5 border-t border-[var(--border-soft)] pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">流程进展</p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">只读记录，可查看过往节点，不改变当前工作区。</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-5">
        {nodes.map((node) => {
          const expanded = expandedNode === node.key;
          return (
            <button
              key={node.key}
              type="button"
              onClick={() => setExpandedNode((current) => (current === node.key ? null : node.key))}
              className={cn(
                "min-h-24 rounded-card-sm border p-3 text-left text-xs transition",
                node.status === "done" && "border-[color-mix(in_oklch,var(--success)_28%,var(--border-soft))] bg-[var(--macaron-teal-bg)]",
                node.status === "current" && "border-[var(--accent)] bg-[var(--accent-subtle)]",
                node.status === "needs_attention" && "border-[color-mix(in_oklch,var(--warning)_28%,var(--border-soft))] bg-[var(--macaron-yellow-bg)]",
                node.status === "not_started" && "border-[var(--border-soft)] bg-[var(--surface-soft)]"
              )}
              aria-expanded={expanded}
            >
              <span className="font-semibold text-[var(--text-primary)]">{node.label}</span>
              <span className="mt-2 block leading-5 text-[var(--text-secondary)]">{node.summary}</span>
            </button>
          );
        })}
      </div>
      {expandedNode && (
        <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 text-xs leading-5 text-[var(--text-secondary)]">
          <p className="font-medium text-[var(--text-primary)]">只读记录</p>
          <p className="mt-1">{nodes.find((node) => node.key === expandedNode)?.historySummary ?? "这个节点还没有历史记录。"}</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npx tsx --test src/components/workspace/workspace-shell-sop3-focus.test.mjs
npm run typecheck
```

Expected: PASS and TypeScript exits 0.

- [ ] **Step 5: Commit Task 4**

```bash
git add src/components/workspace/workspace-shell.tsx src/components/workspace/workspace-shell-sop3-focus.test.mjs
git commit -m "feat: add SOP3 read-only progress map"
```

---

### Task 5: Baseline, Docs, And Browser QA

**Files:**
- Modify: `package.json`
- Modify: `AGENTS.md`
- Modify: `README.md`

**Interfaces:**
- Consumes:
  - Tests from Tasks 1-4.
- Produces:
  - `npm run test:baseline` that protects SOP1, SOP2, SOP3, stage tabs, and dev worker behavior.

- [ ] **Step 1: Confirm `package.json` baseline includes SOP3 tests**

Ensure `package.json` contains this exact `test:baseline` command:

```json
"test:baseline": "tsx --test src/components/workspace/workspace-shell-brief-risk-simplification.test.mjs src/components/workspace/workspace-shell-stage-tabs.test.mjs src/components/workspace/workspace-shell-sop3-focus.test.mjs src/components/workspace/risk-check-view-model.test.mjs src/components/workspace/sop3-focused-flow-view-model.test.mjs src/server/use-cases/risk-check-card.test.mjs src/scripts/dev-with-worker.test.mjs"
```

- [ ] **Step 2: Update AGENTS baseline rule**

In `AGENTS.md`, under `Brief / 风险体检 / Worker 基线`, update the heading to:

```md
### Brief / 风险体检 / 创意提案 / Worker 基线
```

Add these bullets to the protected behavior list:

```md
- SOP 3 工作区按当前任务聚焦展示：生成方向、内部选择、等待甲方、深化确认方向、等待最终确认、最终提案整理不会同时堆叠。
- SOP 3 底部只保留只读流程进展图，可查看历史摘要，但不能触发回滚或改变项目状态。
- SOP 3 继续复用现有创意方向、Round 提案包、甲方审核、故事大纲、氛围图 API 和后端状态机，不新增数据库子状态机。
```

- [ ] **Step 3: Update README baseline explanation**

In `README.md`, extend the `npm run test:baseline` list with:

```md
- SOP 3 创意视觉提案保持当前任务聚焦：主工作区不同时堆叠四方向、深化内容、Round 面板和最终提案整理；底部流程进展图只做历史预览。
```

- [ ] **Step 4: Run full verification**

Run:

```bash
npm run test:baseline
npm run typecheck
npm run lint
npm run build
```

Expected:

- `npm run test:baseline`: all tests pass.
- `npm run typecheck`: exits 0.
- `npm run lint`: exits 0 or only existing unrelated warnings.
- `npm run build`: exits 0.

- [ ] **Step 5: Browser QA**

Use the in-app browser against `http://localhost:3000` and verify:

- A project with no creative directions shows only the generate-directions empty state and the progress map.
- A project with four directions but no Round 1 shows only four direction cards and the `发送给甲方初筛` action.
- A project with active Round 1 shows the waiting-for-client panel and does not show `已选方向的故事卡与氛围图候选`.
- A project after Round 1 return shows only selected or retained directions in the deepening body.
- The bottom progress map expands a read-only history summary and does not contain rollback controls.

Record the browser QA observations in the final response.

- [ ] **Step 6: Commit Task 5**

```bash
git add package.json AGENTS.md README.md
git commit -m "test: baseline focused SOP3 proposal flow"
```

---

## Final Verification Checklist

- [ ] `npm run test:baseline` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` has 0 errors.
- [ ] `npm run build` passes.
- [ ] Browser QA covers empty, selection, waiting, deepening, and progress-map history states.
- [ ] No backend state-machine, database schema, client review route, or job worker contract was changed.
- [ ] No user-facing raw HTTP, database, SDK, model, or JSON errors were introduced.
- [ ] `npm run dev` still starts both Web/API and `src/scripts/job-worker.ts`.

## Self-Review Notes

- Spec coverage: Tasks 1-4 implement current-task derivation, focused main workspace, read-only progress map, and non-stacked SOP3 rendering. Task 5 packages baseline and verification.
- Scope: The plan does not add rollback, database fields, a new backend state machine, or SOP4 logic inside SOP3.
- Type consistency: `Sop3FocusedFlowView`, `Sop3ProgressNodeView`, and `buildSop3FocusedFlow` are defined in Task 1 and consumed by Tasks 3-4 with the same names.
- Baseline: SOP3 tests are added to `npm run test:baseline` in Task 2 and documented in Task 5.
