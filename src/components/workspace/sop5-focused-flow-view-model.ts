import type {
  ClientReviewTaskView,
  ProductionEntityView,
  ScriptDirectionPackageView,
  StoryboardSceneView,
  StoryboardShotView,
} from "@/components/workspace/api";

export type Sop5TabKey = "script_setup" | "storyboard_split";
export type Sop5ScriptSetupMode =
  | "needs_plain_script_generation"
  | "plain_script_ready"
  | "standardized_ready";

export type Sop5FocusedFlowView = {
  tabs: Array<{ key: Sop5TabKey; label: string; disabled: boolean; disabledReason: string | null }>;
  activeTab: Sop5TabKey;
  progressNodes: Array<{ key: string; label: string; status: "completed" | "current" | "pending"; readOnly: true }>;
  scriptSetup: {
    mode: Sop5ScriptSetupMode;
    primaryActionLabel: string;
    packageId: string | null;
    plainScript: string;
    standardizedScript: string;
  };
  storyboardSplit: {
    canGenerateStoryboard: boolean;
    disabledReason: string | null;
    isStoryboardSequenceConfirmed: boolean;
    sceneCount: number;
    shotCount: number;
    activeEntityCount: number;
  };
  legacyCopyBanned: string[];
};

type Sop5ScriptPackageView = ScriptDirectionPackageView & {
  plainScript?: string | null;
  standardizedScript?: string | null;
};

export function createSop5FocusedFlowViewModel(input: {
  scriptPackages: Sop5ScriptPackageView[];
  storyboardScenes: StoryboardSceneView[];
  storyboardShots: StoryboardShotView[];
  productionEntities: ProductionEntityView[];
}): Sop5FocusedFlowView {
  const latestPackage = input.scriptPackages[0] ?? null;
  const plainScript = latestPackage?.plainScript || latestPackage?.fullScript || "";
  const standardizedScript = latestPackage?.standardizedScript || "";
  const hasPlainScript = plainScript.trim().length > 0;
  const hasStandardizedScript = standardizedScript.trim().length > 0;
  const hasStoryboard = input.storyboardShots.length > 0;
  const isStoryboardSequenceConfirmed = hasStoryboard && input.storyboardShots.every((shot) => shot.status !== "draft");
  const activeEntityCount = input.productionEntities.filter((entity) => entity.inclusionStatus !== "ignored").length;

  const mode: Sop5ScriptSetupMode = hasStandardizedScript
    ? "standardized_ready"
    : hasPlainScript
      ? "plain_script_ready"
      : "needs_plain_script_generation";

  const canGenerateStoryboard = hasStandardizedScript;
  const storyboardDisabledReason = canGenerateStoryboard ? null : "请先在脚本设定中确认并生成标准剧本。";

  return {
    tabs: [
      { key: "script_setup", label: "脚本设定（完整剧本）", disabled: false, disabledReason: null },
      {
        key: "storyboard_split",
        label: "文字分镜拆解",
        disabled: !hasStandardizedScript,
        disabledReason: storyboardDisabledReason,
      },
    ],
    activeTab: hasStandardizedScript ? "storyboard_split" : "script_setup",
    progressNodes: [
      { key: "contract_signed", label: "合同签约", status: "completed", readOnly: true },
      { key: "plain_script", label: "大白话剧本", status: hasPlainScript ? "completed" : "current", readOnly: true },
      {
        key: "script_revision",
        label: "对话修订",
        status: hasPlainScript && !hasStandardizedScript ? "current" : hasStandardizedScript ? "completed" : "pending",
        readOnly: true,
      },
      {
        key: "standardized_script",
        label: "标准剧本",
        status: hasStandardizedScript ? "completed" : "pending",
        readOnly: true,
      },
      {
        key: "storyboard",
        label: "文字分镜",
        status: isStoryboardSequenceConfirmed ? "completed" : hasStandardizedScript ? "current" : "pending",
        readOnly: true,
      },
      {
        key: "entities",
        label: "人物场景",
        status: activeEntityCount > 0 && isStoryboardSequenceConfirmed ? "completed" : isStoryboardSequenceConfirmed ? "current" : "pending",
        readOnly: true,
      },
      { key: "storyboard_images", label: "分镜图生成", status: "pending", readOnly: true },
    ],
    scriptSetup: {
      mode,
      primaryActionLabel:
        mode === "needs_plain_script_generation" ? "生成大白话剧本" : mode === "plain_script_ready" ? "确认提交" : "发送给甲方",
      packageId: latestPackage?.id ?? null,
      plainScript,
      standardizedScript,
    },
    storyboardSplit: {
      canGenerateStoryboard,
      disabledReason: storyboardDisabledReason,
      isStoryboardSequenceConfirmed,
      sceneCount: input.storyboardScenes.length,
      shotCount: input.storyboardShots.length,
      activeEntityCount,
    },
    legacyCopyBanned: ["人工在外部写好剧本复制粘贴进来", "点击格式检查", "标准格式检查", "甲方完整剧本确认"],
  };
}

export function resolveSop5ActiveTab(input: {
  requestedTab: Sop5TabKey;
  packageId: string | null;
  clientReviewTasks: Array<Pick<ClientReviewTaskView, "reviewType" | "reviewScene" | "targetScopeId" | "status">>;
}): Sop5TabKey {
  if (
    input.requestedTab === "script_setup" &&
    input.packageId &&
    input.clientReviewTasks.some(
      (task) =>
        task.reviewType === "script_package" &&
        task.reviewScene !== "production_setup" &&
        task.targetScopeId === input.packageId &&
        task.status === "approved"
    )
  ) {
    return "storyboard_split";
  }

  return input.requestedTab;
}
