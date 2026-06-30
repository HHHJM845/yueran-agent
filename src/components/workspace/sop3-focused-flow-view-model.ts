import type {
  ArtifactView,
  ClientReviewTaskView,
  CreativeDirectionView,
  CreativeExpansionView,
  CreativeProposalRoundView,
  GeneratedImageView,
} from "@/components/workspace/api";
import type { JobSummary } from "@/domain/types";

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
  const round1 = findLatestRound(input.creativeProposalRounds, 1);
  const round2 = findLatestRound(input.creativeProposalRounds, 2);
  const round1ReviewTask = findCreativeRoundReviewTask(input.clientReviewTasks, round1, "creative_round_1");
  const round2ReviewTask = findCreativeRoundReviewTask(input.clientReviewTasks, round2, "creative_round_2");
  const directionCount = sortedDirections.length;
  const round1Returned = isClientReviewReturned(round1ReviewTask?.status);
  const round2Returned = isClientReviewReturned(round2ReviewTask?.status);
  const round1FocusIds = resolveRetainedDirectionIds(round1, round1ReviewTask, round1Returned, "round1");
  const round2FocusIds = resolveRetainedDirectionIds(round2, round2ReviewTask, round2Returned, "round2");
  const internalSelectionDirections = sortedDirections.filter((direction) => direction.isSelected);
  const round1SubmittedDirections = directionsForIds(sortedDirections, round1?.directionIds ?? []);
  const round1RetainedDirections = directionsForIds(sortedDirections, round1FocusIds);
  const round2RetainedDirections = directionsForIds(sortedDirections, round2FocusIds);
  const selectedDirections = round2
    ? round2RetainedDirections
    : round1Returned
      ? round1RetainedDirections
      : internalSelectionDirections;
  const unselectedDirections = sortedDirections.filter((direction) => !selectedDirections.some((item) => item.id === direction.id));
  const selectedExpansionCount = countSelectedExpansions(input.expansions, selectedDirections);
  const selectedGeneratedImageCount = countSelectedGeneratedImages(input.generatedImages, selectedDirections);
  const confirmedImageCount = countConfirmedGeneratedImages(input.generatedImages, selectedDirections);
  const selectedHistoryDirections = round2
    ? round2RetainedDirections
    : round1Returned
      ? round1RetainedDirections
      : internalSelectionDirections;

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
      key: round1ReviewTask ? "refresh_client_feedback" : "send_round_1_review",
      label: round1ReviewTask ? "刷新甲方回传" : "发送给甲方初筛",
      description: "甲方提交后，系统会自动回写筛选结果。",
      disabledReason: null,
    };
    visibleDirections = round1SubmittedDirections;
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
    visibleDirections = selectedDirections.length > 0 ? selectedDirections : round1RetainedDirections;
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
    visibleDirections = round2RetainedDirections;
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
    visibleDirections = round2RetainedDirections;
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
      activeDirectionTitles:
        currentTask.key === "deepen_confirmed_direction" || currentTask.key === "wait_round_2_feedback" || currentTask.key === "finalize_proposal"
          ? selectedHistoryDirections.map((direction) => direction.title)
          : [],
    }),
  };
}

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

function directionsForIds(directions: CreativeDirectionView[], ids: string[]) {
  const idSet = new Set(ids);
  return directions.filter((direction) => idSet.has(direction.id));
}

function countSelectedExpansions(expansions: CreativeExpansionView[], selectedDirections: CreativeDirectionView[]) {
  const ids = new Set(selectedDirections.map((direction) => direction.id));
  return expansions.filter((expansion) => ids.has(expansion.directionId)).length;
}

function countSelectedGeneratedImages(images: GeneratedImageView[], selectedDirections: CreativeDirectionView[]) {
  const ids = new Set(selectedDirections.map((direction) => direction.id));
  return images.filter((image) => image.directionId && ids.has(image.directionId) && isGeneratedImageRunningOrDone(image)).length;
}

function countConfirmedGeneratedImages(images: GeneratedImageView[], selectedDirections: CreativeDirectionView[]) {
  const ids = new Set(selectedDirections.map((direction) => direction.id));
  return images.filter((image) => image.directionId && ids.has(image.directionId) && image.reviewStatus === "confirmed").length;
}

function resolveRetainedDirectionIds(
  round: CreativeProposalRoundView | null,
  reviewTask: ClientReviewTaskView | null,
  reviewReturned: boolean,
  phase: "round1" | "round2"
) {
  const retainedFromRound = extractRetainedDirectionIds(round?.retainedDirectionIds);
  const retainedFromClientFeedback = extractRetainedDirectionIds(readRetainedDirectionIds(round?.clientFeedback));
  const retainedFromDecisionPayload = extractRetainedDirectionIds(readRetainedDirectionIds(round?.clientFeedback?.decisionPayload));
  const retainedFromReviewTask = extractRetainedDirectionIds(readRetainedDirectionIds(reviewTask?.decisionPayload));
  const fallbackDirectionIds = round?.directionIds ?? [];

  if (phase === "round1" && !reviewReturned) {
    return fallbackDirectionIds;
  }

  return (
    retainedFromRound ??
    retainedFromClientFeedback ??
    retainedFromDecisionPayload ??
    retainedFromReviewTask ??
    fallbackDirectionIds
  );
}

function extractRetainedDirectionIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
  return ids.length > 0 ? ids : null;
}

function readRetainedDirectionIds(value: unknown): unknown {
  if (!value || typeof value !== "object") return null;
  return (value as { retainedDirectionIds?: unknown }).retainedDirectionIds ?? null;
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
  activeDirectionTitles: string[];
}): Sop3ProgressNodeView[] {
  const selectedCount = input.selectedDirections.length;
  const round1Returned = isClientReviewReturned(input.round1ReviewTask?.status);
  const round2Returned = isClientReviewReturned(input.round2ReviewTask?.status);
  const activeDirectionTitleText = input.activeDirectionTitles.length > 0 ? input.activeDirectionTitles.join("、") : "暂无可展示方向。";
  const scopedGeneratedImageCount = input.generatedImages.filter(
    (image) => image.directionId && input.selectedDirections.some((direction) => direction.id === image.directionId) && isGeneratedImageRunningOrDone(image)
  ).length;

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
      historySummary: input.round1ReviewTask
        ? `Round 1 ${clientReviewStatusLabel(input.round1ReviewTask.status)}。${input.round1ReviewTask.feedback || "暂无甲方备注。"}`
        : "还没有 Round 1 甲方审核记录。",
      previewMode: "readonly",
    },
    {
      key: "direction_deepening",
      label: "方向深化",
      status: progressStatus(input.currentTaskKey, "deepen_confirmed_direction", input.selectedExpansionCount > 0),
      summary: input.selectedExpansionCount > 0 ? `故事大纲 ${input.selectedExpansionCount}，确认图 ${input.confirmedImageCount}` : "待深化",
      historySummary: `${activeDirectionTitleText}；故事大纲 ${input.selectedExpansionCount}，氛围图 ${scopedGeneratedImageCount}，确认采用 ${input.confirmedImageCount}。`,
      previewMode: "readonly",
    },
    {
      key: "final_confirmation",
      label: "最终确认",
      status: progressStatus(input.currentTaskKey, "wait_round_2_feedback", round2Returned || input.currentTaskKey === "finalize_proposal"),
      summary: input.round2ReviewTask ? clientReviewStatusLabel(input.round2ReviewTask.status) : "待最终确认",
      historySummary: input.round2ReviewTask
        ? `Round 2 ${clientReviewStatusLabel(input.round2ReviewTask.status)}。${input.round2ReviewTask.feedback || "暂无甲方备注。"}`
        : "还没有 Round 2 最终确认记录。",
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
