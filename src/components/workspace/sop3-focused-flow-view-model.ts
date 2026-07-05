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
  | "generate_story_outlines"
  | "select_directions"
  | "prepare_round_1_materials"
  | "wait_round_1_feedback"
  | "deepen_confirmed_direction"
  | "wait_round_2_feedback"
  | "finalize_proposal"
  | "repair_incomplete_data";

export type Sop3PrimaryActionKey =
  | "generate_directions"
  | "generate_story_outlines"
  | "generate_round_1_materials"
  | "send_round_1_review"
  | "refresh_client_feedback"
  | "generate_deepening_outline"
  | "generate_deepening_script"
  | "confirm_deepening_script"
  | "split_deepening_storyboard"
  | "generate_deepening_assets"
  | "send_round_2_review"
  | "enter_quote_contract"
  | "repair_data";

export type Sop3ProgressNodeKey =
  | "direction_generation"
  | "internal_selection"
  | "round_1_materials"
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

const ROUND_1_STYLE_VARIANTS = [
  { key: "2d", label: "二维风格" },
  { key: "pixar_3d", label: "三维皮克斯风格" },
  { key: "realistic", label: "写实风格" },
] as const;

export function buildSop3FocusedFlow(input: Sop3FocusedFlowInput): Sop3FocusedFlowView {
  const sortedDirections = [...input.directions].sort((left, right) => left.sortOrder - right.sortOrder);
  const selectedDirections = sortedDirections.filter((direction) => direction.isSelected === true);
  const unselectedDirections = sortedDirections.filter((direction) => direction.isSelected !== true);
  const round1 = findLatestRound(input.creativeProposalRounds, 1);
  const round2 = findLatestRound(input.creativeProposalRounds, 2);
  const round1ReviewTask = findCreativeRoundReviewTask(input.clientReviewTasks, round1, "creative_round_1");
  const round2ReviewTask = findCreativeRoundReviewTask(input.clientReviewTasks, round2, "creative_round_2");
  const directionCount = sortedDirections.length;
  const round1Returned = isClientReviewReturned(round1ReviewTask?.status);
  const round2Returned = isClientReviewReturned(round2ReviewTask?.status);
  const round1Rejected = isClientReviewRejected(round1ReviewTask);
  const round2Rejected = isClientReviewRejected(round2ReviewTask);
  const round1ReturnedWithoutRetainedDirections = round1Returned && hasExplicitEmptyRetainedDirectionIds(round1, round1ReviewTask);
  const round2ReturnedWithoutRetainedDirections = round2Returned && hasExplicitEmptyRetainedDirectionIds(round2, round2ReviewTask);
  const round1FocusIds = resolveRetainedDirectionIds(round1, round1ReviewTask, round1Returned, "round1");
  const round2FocusIds = resolveRetainedDirectionIds(round2, round2ReviewTask, round2Returned, "round2");
  const round1SubmittedDirections = directionsForIds(sortedDirections, round1?.directionIds ?? []);
  const round1RetainedDirections = directionsForIds(sortedDirections, round1FocusIds);
  const round2RetainedDirections = directionsForIds(sortedDirections, round2FocusIds);
  const focusedDirections = round2
    ? round2RetainedDirections
    : round1Returned
      ? round1RetainedDirections
      : selectedDirections;
  const round2StoryboardExpansionIds = collectRound2StoryboardExpansionIds(input.artifacts, focusedDirections);
  const round2StoryboardExpansions = input.expansions.filter((expansion) => round2StoryboardExpansionIds.has(expansion.id));
  const focusedExpansionCount = countSelectedExpansions(round2StoryboardExpansions, focusedDirections);
  const focusedConfirmedImageCount = countConfirmedGeneratedImages(input.generatedImages, focusedDirections);
  const round1MaterialStats = buildCreativeMaterialStats({
    directions: selectedDirections,
    expansions: input.expansions,
    generatedImages: input.generatedImages,
    requiredSceneCount: 0,
    candidateCountPerScene: 1,
  });
  const round1StoryOutlineStats = buildRound1StoryOutlineStats(sortedDirections, input.expansions);
  const hasRunningDirectionJob = hasRunningJob(input.jobs, "creative_direction_generation");
  const hasRunningStoryOutlineJob = hasRunningJob(input.jobs, "creative_expansion_generation");
  const hasRunningBundledStoryOutlineJob = hasRunningDirectionJob || hasRunningStoryOutlineJob;
  const round2MaterialStats = buildCreativeMaterialStats({
    directions: focusedDirections,
    expansions: round2StoryboardExpansions,
    generatedImages: input.generatedImages,
    requiredSceneCount: 4,
    candidateCountPerScene: 1,
  });
  const round2DeepeningStats = buildRound2DeepeningStats({
    directions: focusedDirections,
    artifacts: input.artifacts,
    expansions: round2StoryboardExpansions,
  });
  const focusedHistoryDirections = round2
    ? round2RetainedDirections
    : round1Returned
      ? round1RetainedDirections
      : selectedDirections;

  let currentTask: Sop3FocusedFlowView["currentTask"];
  let primaryAction: Sop3FocusedFlowView["primaryAction"];
  let visibleDirections: CreativeDirectionView[] = selectedDirections.length > 0 ? selectedDirections : sortedDirections;
  let blockingMessage: string | null = null;

  if (directionCount === 0) {
    currentTask = {
      key: "generate_directions",
      title: hasRunningDirectionJob ? "方向卡片生成中" : "生成四个创意方向卡片",
      description: "先基于已确认 Brief 生成 4 张内部创意方向卡，每张卡会直接包含故事大纲。",
      statusLabel: hasRunningDirectionJob ? "生成中" : "待生成",
    };
    primaryAction = {
      key: "generate_directions",
      label: hasRunningDirectionJob ? "方向卡片生成中" : "生成 4 个创意方向",
      description: "",
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
      description: "方向数量必须是 4 个，才能进入内部选择和 Round 1 提案准备。",
      disabledReason: input.canGenerate ? null : "当前角色不能重新生成方向。",
    };
    blockingMessage = `当前只有 ${directionCount} 个创意方向。请重新生成 4 个方向后继续。`;
  } else if (!round1) {
    if (!round1StoryOutlineStats.isComplete) {
      if (hasRunningBundledStoryOutlineJob) {
        currentTask = {
          key: "generate_directions",
          title: "方向卡片生成中",
          description: "系统正在生成或补齐方向卡片里的故事大纲。完成后即可选择进入 Round 1 的方向。",
          statusLabel: `方向卡片 ${round1StoryOutlineStats.readyDirectionCount}/${round1StoryOutlineStats.requiredDirectionCount}`,
        };
        primaryAction = {
          key: "generate_directions",
          label: "方向卡片生成中",
          description: "后台任务正在处理；完成后工作台会自动刷新，或稍后手动刷新查看。",
          disabledReason: "方向卡片正在生成，请等待任务完成。",
        };
        visibleDirections = [];
      } else {
        currentTask = {
          key: "generate_story_outlines",
          title: "补齐方向卡片内容",
          description: "部分方向卡缺少卡内故事大纲，请补齐后再进入内部选择。已有故事大纲的方向不会重复创建。",
          statusLabel: `方向卡片 ${round1StoryOutlineStats.readyDirectionCount}/${round1StoryOutlineStats.requiredDirectionCount}`,
        };
        primaryAction = {
          key: "generate_story_outlines",
          label: "补齐方向卡片内容",
          description: "系统会为缺少卡内故事大纲的方向创建修复任务；已有故事大纲的方向不会重复创建。",
          disabledReason: input.canGenerate ? null : "当前角色不能补齐方向卡片内容。",
        };
        visibleDirections = sortedDirections;
      }
    } else if (selectedDirections.length === 0) {
      currentTask = {
        key: "select_directions",
        title: "选择进入 Round 1 的方向",
        description: "先阅读每个方向的故事大纲，再从四个方向中单选或多选。选好后为已选方向生成二维、三维皮克斯、写实三种静态场景图，再打包给甲方确认。",
        statusLabel: "待选择",
      };
      primaryAction = {
        key: "generate_round_1_materials",
        label: "准备 Round 1 提案材料",
        description: "先选择方向，再为已选方向生成三种风格静态场景图。",
        disabledReason: "请至少选择 1 个创意方向。",
      };
      visibleDirections = sortedDirections;
    } else {
      const round1MaterialActionLabel =
        round1MaterialStats.generatedImageCount === 0 ? "生成 Round 1 提案材料" : "补齐 Round 1 提案材料";
      currentTask = {
        key: "prepare_round_1_materials",
        title: "准备 Round 1 完整提案包",
        description: "Round 1 需要包含已选方向和每个方向的三种风格静态场景图。材料补齐后再发送给甲方确认。",
        statusLabel: round1MaterialStats.isComplete
          ? "材料已就绪"
          : `风格图 ${round1MaterialStats.generatedImageCount}/${round1MaterialStats.requiredImageCount}`,
      };
      primaryAction = {
        key: round1MaterialStats.isComplete ? "send_round_1_review" : "generate_round_1_materials",
        label: round1MaterialStats.isComplete ? "发送 Round 1 完整提案包" : round1MaterialActionLabel,
        description: round1MaterialStats.isComplete
          ? "系统会保存 Round 1 完整提案包，并生成甲方审核链接。"
          : round1MaterialStats.generatedImageCount === 0
            ? "为已选方向生成三种风格静态场景图。"
            : "继续补齐已选方向的三种风格静态场景图。",
        disabledReason:
          round1MaterialStats.isComplete
            ? input.canLaunchReview
              ? null
              : "当前角色不能发起甲方审核。"
            : input.canGenerate
              ? null
              : "当前角色不能生成 Round 1 提案材料。",
      };
      visibleDirections = selectedDirections;
    }
  } else if (round1Rejected) {
    currentTask = {
      key: "repair_incomplete_data",
      title: "修订 Round 1 提案包",
      description: "甲方已打回第一轮创意视觉提案，请按反馈调整风格图或方向后重新发送。",
      statusLabel: "需要修订",
    };
    primaryAction = {
      key: "send_round_1_review",
      label: "重新发送 Round 1 提案包",
      description: "修订完成后重新生成甲方审核链接。",
      disabledReason: input.canLaunchReview ? null : "当前角色不能发起甲方审核。",
    };
    visibleDirections = round1SubmittedDirections;
    blockingMessage = buildClientRejectedMessage(round1ReviewTask, "第一轮创意方向已被甲方打回。");
  } else if (round1ReturnedWithoutRetainedDirections) {
    currentTask = {
      key: "repair_incomplete_data",
      title: "补充第一轮保留方向",
      description: "甲方回传没有保留任何方向，请重新沟通、修订材料或重新发送 Round 1。",
      statusLabel: "需要处理",
    };
    primaryAction = {
      key: "send_round_1_review",
      label: "重新发送 Round 1 提案包",
      description: "至少保留一个方向后才能进入深化。",
      disabledReason: input.canLaunchReview ? null : "当前角色不能发起甲方审核。",
    };
    visibleDirections = round1SubmittedDirections;
    blockingMessage = "甲方回传没有保留任何方向。请重新沟通方向或打回修订后再继续。";
  } else if (!isClientReviewReturned(round1ReviewTask?.status)) {
    currentTask = {
      key: "wait_round_1_feedback",
      title: "等待甲方 Round 1 反馈",
      description: "Round 1 完整提案包已发送，当前只需要查看发送状态或刷新回传结果。",
      statusLabel: round1ReviewTask ? clientReviewStatusLabel(round1ReviewTask.status) : "待发送",
    };
    primaryAction = {
      key: round1ReviewTask ? "refresh_client_feedback" : "send_round_1_review",
      label: round1ReviewTask ? "刷新甲方回传" : "发送 Round 1 完整提案包",
      description: "甲方提交后，系统会自动回写筛选结果。",
      disabledReason: null,
    };
    visibleDirections = round1SubmittedDirections;
  } else if (!round2) {
    if (!round2DeepeningStats.hasAllScripts) {
      currentTask = {
        key: "deepen_confirmed_direction",
        title: "生成方向深化故事",
        description: "基于甲方保留方向直接生成 700-800 字完整故事。系统会自动补齐必要上下文，人工确认后再精选 4 个精彩场景用于生图。",
        statusLabel: `完整故事 ${round2DeepeningStats.scriptCount}/${focusedDirections.length}`,
      };
      primaryAction = {
        key: "generate_deepening_script",
        label: round2DeepeningStats.scriptCount > 0 ? "补齐方向深化故事" : "生成方向深化故事",
        description: "系统会为缺少完整故事的保留方向生成 700-800 字方向深化故事。",
        disabledReason: input.canGenerate ? null : "当前角色不能生成方向深化故事。",
      };
    } else if (!round2DeepeningStats.hasAllConfirmedScripts) {
      currentTask = {
        key: "deepen_confirmed_direction",
        title: "人工确认完整故事",
        description: "请人工确认完整故事。确认后才能从故事中精选 4 个最适合生成图片的精彩场景。",
        statusLabel: `已确认 ${round2DeepeningStats.confirmedScriptCount}/${focusedDirections.length}`,
      };
      primaryAction = {
        key: "confirm_deepening_script",
        label: "确认完整故事",
        description: "确认当前完整故事可作为精选四个精彩场景的依据。",
        disabledReason: input.canEdit ? null : "当前角色不能确认完整故事。",
      };
    } else if (!round2DeepeningStats.hasAllStoryboardScenes) {
      currentTask = {
        key: "deepen_confirmed_direction",
        title: "精选 4 个精彩场景",
        description: "从已确认完整故事中选出 4 个最适合生成图片的精彩场景，再分别生成深化视觉图。",
        statusLabel: `精彩场景 ${round2MaterialStats.storyCardCount}/${round2MaterialStats.requiredStoryCardCount}`,
      };
      primaryAction = {
        key: "split_deepening_storyboard",
        label: "精选 4 个精彩场景",
        description: "系统会基于已确认完整故事选出四个可生图的精彩场景。",
        disabledReason: input.canGenerate ? null : "当前角色不能精选精彩场景。",
      };
    } else {
      currentTask = {
        key: "deepen_confirmed_direction",
        title: "生成深化视觉图",
        description: "完整故事已确认并精选 4 个精彩场景。现在为每个场景生成 1 张深化视觉图。",
        statusLabel: round2MaterialStats.isComplete ? "已补齐" : `深化视觉图 ${round2MaterialStats.generatedImageCount}/${round2MaterialStats.requiredImageCount}`,
      };
      primaryAction = {
        key: "generate_deepening_assets",
        label: round2MaterialStats.hasAnyMaterial ? "继续补齐深化视觉图" : "生成深化视觉图",
        description: "为已精选的 4 个精彩场景分别生成深化视觉图。",
        disabledReason: input.canGenerate ? null : "当前角色不能生成深化视觉图。",
      };
    }
    visibleDirections = round1RetainedDirections;
  } else if (round2Rejected) {
    currentTask = {
      key: "repair_incomplete_data",
      title: "修订最终确认内容",
      description: "甲方已打回第二轮深化内容，请按反馈调整后重新发起最终确认。",
      statusLabel: "需要修订",
    };
    primaryAction = {
      key: "send_round_2_review",
      label: "重新发起最终确认",
      description: "修订完成后重新生成最终确认链接。",
      disabledReason: input.canLaunchReview ? null : "当前角色不能发起甲方审核。",
    };
    visibleDirections = round2RetainedDirections;
    blockingMessage = buildClientRejectedMessage(round2ReviewTask, "最终确认内容已被甲方打回。");
  } else if (round2ReturnedWithoutRetainedDirections) {
    currentTask = {
      key: "repair_incomplete_data",
      title: "补充最终确认方向",
      description: "最终确认回传没有保留任何方向，请重新选择方向后再发起确认。",
      statusLabel: "需要处理",
    };
    primaryAction = {
      key: "send_round_2_review",
      label: "重新发起最终确认",
      description: "至少保留一个方向后才能整理最终提案。",
      disabledReason: input.canLaunchReview ? null : "当前角色不能发起甲方审核。",
    };
    visibleDirections = round2?.directionIds ? directionsForIds(sortedDirections, round2.directionIds) : [];
    blockingMessage = "最终确认回传没有保留任何方向。请重新沟通方向或打回修订后再继续。";
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
      focusedDirections,
      round1MaterialStats,
      round1StoryOutlineStats,
      round2DeepeningStats,
      round2MaterialStats,
      expansions: input.expansions,
      generatedImages: input.generatedImages,
      round1,
      round2,
      round1ReviewTask,
      round2ReviewTask,
      currentTaskKey: currentTask.key,
      selectedExpansionCount: focusedExpansionCount,
      confirmedImageCount: focusedConfirmedImageCount,
      activeDirectionTitles:
        currentTask.key === "deepen_confirmed_direction" || currentTask.key === "wait_round_2_feedback" || currentTask.key === "finalize_proposal"
          ? focusedHistoryDirections.map((direction) => direction.title)
          : [],
    }),
  };
}

export function isClientReviewReturned(status: string | null | undefined): boolean {
  return status === "submitted" || status === "approved";
}

function isClientReviewRejected(task: ClientReviewTaskView | null) {
  return task?.status === "rejected" || task?.decisionPayload?.decision === "rejected";
}

function buildClientRejectedMessage(task: ClientReviewTaskView | null, fallback: string) {
  const feedback = task?.feedback?.trim();
  if (feedback) return `${fallback}甲方反馈：${feedback}`;
  const visualPreferenceNotes = readStringField(task?.decisionPayload, "visualPreferenceNotes");
  if (visualPreferenceNotes) return `${fallback}甲方反馈：${visualPreferenceNotes}`;
  return fallback;
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

function countConfirmedGeneratedImages(images: GeneratedImageView[], selectedDirections: CreativeDirectionView[]) {
  const ids = new Set(selectedDirections.map((direction) => direction.id));
  return images.filter((image) => image.directionId && ids.has(image.directionId) && image.reviewStatus === "confirmed").length;
}

type CreativeMaterialStats = {
  storyCardCount: number;
  requiredStoryCardCount: number;
  generatedImageCount: number;
  requiredImageCount: number;
  confirmedImageCount: number;
  hasAnyMaterial: boolean;
  isComplete: boolean;
  hasIncompleteStoryCardImages: boolean;
  missingStyleLabels: string[];
};

type Round1StoryOutlineStats = {
  readyDirectionCount: number;
  requiredDirectionCount: number;
  isComplete: boolean;
};

type Round2DeepeningStats = {
  outlineCount: number;
  scriptCount: number;
  confirmedScriptCount: number;
  hasAllOutlines: boolean;
  hasAllScripts: boolean;
  hasAllConfirmedScripts: boolean;
  hasAllStoryboardScenes: boolean;
};

function buildRound1StoryOutlineStats(directions: CreativeDirectionView[], expansions: CreativeExpansionView[]): Round1StoryOutlineStats {
  const directionIdsWithOutline = new Set(expansions.map((expansion) => expansion.directionId));
  const readyDirectionCount = directions.filter((direction) => directionIdsWithOutline.has(direction.id)).length;
  return {
    readyDirectionCount,
    requiredDirectionCount: directions.length,
    isComplete: directions.length > 0 && readyDirectionCount === directions.length,
  };
}

function buildRound2DeepeningStats(input: {
  directions: CreativeDirectionView[];
  artifacts: ArtifactView[];
  expansions: CreativeExpansionView[];
}): Round2DeepeningStats {
  const outlineCount = input.directions.filter((direction) =>
    Boolean(findLatestSop3Artifact(input.artifacts, direction.id, "round2_deepening_outline"))
  ).length;
  const scriptCount = input.directions.filter((direction) =>
    Boolean(findLatestSop3Artifact(input.artifacts, direction.id, "round2_deepening_script"))
  ).length;
  const confirmedScriptCount = input.directions.filter((direction) => {
    const artifact = findLatestSop3Artifact(input.artifacts, direction.id, "round2_deepening_script");
    return artifact?.status === "confirmed";
  }).length;
  const directionsWithFourScenes = input.directions.filter(
    (direction) => input.expansions.filter((expansion) => expansion.directionId === direction.id).length >= 4
  ).length;

  return {
    outlineCount,
    scriptCount,
    confirmedScriptCount,
    hasAllOutlines: input.directions.length > 0 && outlineCount === input.directions.length,
    hasAllScripts: input.directions.length > 0 && scriptCount === input.directions.length,
    hasAllConfirmedScripts: input.directions.length > 0 && confirmedScriptCount === input.directions.length,
    hasAllStoryboardScenes: input.directions.length > 0 && directionsWithFourScenes === input.directions.length,
  };
}

function collectRound2StoryboardExpansionIds(artifacts: ArtifactView[], directions: CreativeDirectionView[]) {
  const directionIds = new Set(directions.map((direction) => direction.id));
  const expansionIds = new Set<string>();
  for (const artifact of artifacts) {
    if (readStringField(artifact.data, "sop3ArtifactType") !== "round2_deepening_storyboard_split") continue;
    if (!directionIds.has(readStringField(artifact.data, "directionId"))) continue;
    const ids = readStringArrayField(artifact.data, "expansionIds");
    for (const id of ids) expansionIds.add(id);
  }
  return expansionIds;
}

function findLatestSop3Artifact(artifacts: ArtifactView[], directionId: string, type: string) {
  return artifacts.find(
    (artifact) =>
      (artifact.kind === "proposal" || artifact.kind === "creative_expansion") &&
      readStringField(artifact.data, "sop3ArtifactType") === type &&
      readStringField(artifact.data, "directionId") === directionId
  ) ?? null;
}

function buildCreativeMaterialStats(input: {
  directions: CreativeDirectionView[];
  expansions: CreativeExpansionView[];
  generatedImages: GeneratedImageView[];
  requiredSceneCount: number;
  candidateCountPerScene: number;
}): CreativeMaterialStats {
  const directionIds = new Set(input.directions.map((direction) => direction.id));
  if (input.requiredSceneCount === 0) {
    const scopedStyleImages = input.generatedImages.filter(
      (image) => image.directionId && directionIds.has(image.directionId) && image.expansionId === null && isGeneratedImageRunningOrDone(image)
    );
    const missingStyleLabels = input.directions.flatMap((direction) => {
      const styleKeys = new Set(
        scopedStyleImages
          .filter((image) => image.directionId === direction.id)
          .map((image) => readStringField(image.metadata, "styleVariant"))
          .filter(Boolean)
      );
      return ROUND_1_STYLE_VARIANTS.filter((style) => !styleKeys.has(style.key)).map((style) => style.label);
    });

    return {
      storyCardCount: 0,
      requiredStoryCardCount: 0,
      generatedImageCount: scopedStyleImages.length,
      requiredImageCount: input.directions.length * ROUND_1_STYLE_VARIANTS.length,
      confirmedImageCount: countConfirmedGeneratedImages(input.generatedImages, input.directions),
      hasAnyMaterial: scopedStyleImages.length > 0,
      isComplete: input.directions.length > 0 && missingStyleLabels.length === 0,
      hasIncompleteStoryCardImages: missingStyleLabels.length > 0,
      missingStyleLabels: [...new Set(missingStyleLabels)],
    };
  }

  const scopedExpansions = input.expansions.filter((expansion) => directionIds.has(expansion.directionId));
  const requiredStoryCardCount = input.directions.length * input.requiredSceneCount;
  const requiredImageCount = requiredStoryCardCount * input.candidateCountPerScene;
  const directionsWithEnoughStoryCards = input.directions.filter(
    (direction) => scopedExpansions.filter((expansion) => expansion.directionId === direction.id).length >= input.requiredSceneCount
  ).length;
  const requiredExpansions = input.directions.flatMap((direction) =>
    scopedExpansions
      .filter((expansion) => expansion.directionId === direction.id)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .slice(0, input.requiredSceneCount)
  );
  const requiredExpansionIds = new Set(requiredExpansions.map((expansion) => expansion.id));
  const scopedImages = input.generatedImages.filter(
    (image) => image.expansionId && requiredExpansionIds.has(image.expansionId) && isGeneratedImageRunningOrDone(image)
  );
  const hasIncompleteStoryCardImages =
    requiredExpansions.length < requiredStoryCardCount ||
    requiredExpansions.some(
      (expansion) => scopedImages.filter((image) => image.expansionId === expansion.id).length < input.candidateCountPerScene
    );
  const hasEnoughImages = scopedImages.length >= requiredImageCount && !hasIncompleteStoryCardImages;

  return {
    storyCardCount: scopedExpansions.length,
    requiredStoryCardCount,
    generatedImageCount: scopedImages.length,
    requiredImageCount,
    confirmedImageCount: input.generatedImages.filter(
      (image) => image.expansionId && requiredExpansionIds.has(image.expansionId) && image.reviewStatus === "confirmed"
    ).length,
    hasAnyMaterial: scopedExpansions.length > 0 || scopedImages.length > 0,
    isComplete: input.directions.length > 0 && directionsWithEnoughStoryCards === input.directions.length && hasEnoughImages,
    hasIncompleteStoryCardImages,
    missingStyleLabels: [],
  };
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

function hasExplicitEmptyRetainedDirectionIds(
  round: CreativeProposalRoundView | null,
  reviewTask: ClientReviewTaskView | null
) {
  return (
    isExplicitEmptyArray(readRetainedDirectionIds(round?.clientFeedback)) ||
    isExplicitEmptyArray(readRetainedDirectionIds(round?.clientFeedback?.decisionPayload)) ||
    isExplicitEmptyArray(readRetainedDirectionIds(reviewTask?.decisionPayload))
  );
}

function isExplicitEmptyArray(value: unknown) {
  return Array.isArray(value) && value.length === 0;
}

function readStringField(value: unknown, key: string) {
  if (!value || typeof value !== "object") return "";
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" ? field.trim() : "";
}

function readStringArrayField(value: unknown, key: string) {
  if (!value || typeof value !== "object") return [];
  const field = (value as Record<string, unknown>)[key];
  return Array.isArray(field) ? field.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()) : [];
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
  focusedDirections: CreativeDirectionView[];
  round1StoryOutlineStats: Round1StoryOutlineStats;
  round2DeepeningStats: Round2DeepeningStats;
  round1MaterialStats: CreativeMaterialStats;
  round2MaterialStats: CreativeMaterialStats;
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
  const round1Rejected = isClientReviewRejected(input.round1ReviewTask);
  const round2Rejected = isClientReviewRejected(input.round2ReviewTask);
  const activeDirectionTitleText = input.activeDirectionTitles.length > 0 ? input.activeDirectionTitles.join("、") : "暂无可展示方向。";
  const round1ImageGapText =
    input.round1MaterialStats.missingStyleLabels.length > 0
      ? `，缺少${input.round1MaterialStats.missingStyleLabels.join("、")}`
      : "";
  const round2ImageGapText = input.round2MaterialStats.hasIncompleteStoryCardImages ? "，仍有精彩场景图片不足" : "";
  const round2StorySummary =
    input.round2DeepeningStats.scriptCount > 0
      ? `完整故事 ${input.round2DeepeningStats.scriptCount}/${input.focusedDirections.length}`
      : "待生成完整故事";
  const scopedGeneratedImageCount = input.round2MaterialStats.generatedImageCount;
  const directionCardsReady =
    input.directions.length === 4 && (input.round1StoryOutlineStats.isComplete || Boolean(input.round1));
  const missingDirectionCardOutlineCount = Math.max(
    0,
    input.round1StoryOutlineStats.requiredDirectionCount - input.round1StoryOutlineStats.readyDirectionCount
  );

  return [
    {
      key: "direction_generation",
      label: "方向卡片生成",
      status: directionCardsReady
        ? "done"
        : input.currentTaskKey === "generate_directions" || input.currentTaskKey === "generate_story_outlines"
          ? "current"
          : "not_started",
      summary: directionCardsReady
        ? "已生成 4 张方向卡（含故事大纲）"
        : input.directions.length === 4
          ? `方向卡片 ${input.round1StoryOutlineStats.readyDirectionCount}/${input.round1StoryOutlineStats.requiredDirectionCount}`
          : `当前 ${input.directions.length}/4 张方向卡`,
      historySummary: directionCardsReady
        ? input.directions.map((direction) => direction.title).join("、")
        : input.directions.length > 0
          ? `已有 ${input.directions.length} 张方向卡，仍有 ${missingDirectionCardOutlineCount} 张缺少卡内故事大纲。`
          : "还没有生成方向卡片。",
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
      key: "round_1_materials",
      label: "Round 1 材料",
      status: progressStatus(input.currentTaskKey, "prepare_round_1_materials", Boolean(input.round1) || input.round1MaterialStats.isComplete),
      summary: input.round1MaterialStats.isComplete
        ? "已就绪"
        : `风格图 ${input.round1MaterialStats.generatedImageCount}/${input.round1MaterialStats.requiredImageCount}`,
      historySummary: `Round 1 需要已选方向和三种风格静态场景图；当前风格图 ${input.round1MaterialStats.generatedImageCount}/${input.round1MaterialStats.requiredImageCount}${round1ImageGapText}，确认采用 ${input.round1MaterialStats.confirmedImageCount}。`,
      previewMode: "readonly",
    },
    {
      key: "client_round_1",
      label: "Round 1 反馈",
      status: round1Rejected ? "needs_attention" : progressStatus(input.currentTaskKey, "wait_round_1_feedback", round1Returned),
      summary: input.round1ReviewTask ? clientReviewStatusLabel(input.round1ReviewTask.status) : "待发送给甲方",
      historySummary: input.round1ReviewTask
        ? `Round 1 ${clientReviewStatusLabel(input.round1ReviewTask.status)}。${input.round1ReviewTask.feedback || "暂无甲方备注。"}`
        : "还没有 Round 1 甲方审核记录。",
      previewMode: "readonly",
    },
    {
      key: "direction_deepening",
      label: "方向深化",
      status: progressStatus(input.currentTaskKey, "deepen_confirmed_direction", input.round2MaterialStats.storyCardCount > 0),
      summary: input.round2MaterialStats.storyCardCount > 0 ? `精彩场景 ${input.round2MaterialStats.storyCardCount}，确认图 ${input.round2MaterialStats.confirmedImageCount}` : round2StorySummary,
      historySummary: `${activeDirectionTitleText}；${round2StorySummary}；精彩场景 ${input.round2MaterialStats.storyCardCount}，深化视觉图 ${scopedGeneratedImageCount}${round2ImageGapText}，确认采用 ${input.round2MaterialStats.confirmedImageCount}。`,
      previewMode: "readonly",
    },
    {
      key: "final_confirmation",
      label: "最终确认",
      status: round2Rejected ? "needs_attention" : progressStatus(input.currentTaskKey, "wait_round_2_feedback", round2Returned || input.currentTaskKey === "finalize_proposal"),
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
