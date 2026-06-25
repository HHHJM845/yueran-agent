import { type ProjectStage, projectStages, type StageStatus } from "@/domain/types";

export const stageLabels: Record<ProjectStage, string> = {
  brand_requirement_intake: "品牌方需求洽谈",
  technical_feasibility: "技术可行性评估",
  creative_direction_proposal: "创意方向提案",
  selection_quote_contract: "方向初选、报价与签约",
  script_storyboard_confirmation: "脚本创意与文字分镜确认",
  storyboard_image_canvas: "分镜图片自由画布",
  ai_video_canvas: "AI 视频自由画布",
  a_copy_revision: "A copy 生成与修改",
  b_copy_final_confirmation: "B copy 与定稿确认",
  settlement_delivery_archive: "结算交付与归档",
};

export const stageStepLabels: Record<ProjectStage, string> = {
  brand_requirement_intake: "Brief 收集与需求结构化",
  technical_feasibility: "技术可行性与素材标签评估",
  creative_direction_proposal: "创意方向与完整项目提案",
  selection_quote_contract: "报价合同与签约闭环",
  script_storyboard_confirmation: "脚本创意与文字分镜确认",
  storyboard_image_canvas: "分镜图片自由画布",
  ai_video_canvas: "AI 视频自由画布",
  a_copy_revision: "A copy 生成与修改",
  b_copy_final_confirmation: "B copy 与定稿确认",
  settlement_delivery_archive: "结算交付与归档",
};

export const workflowModules = [
  {
    key: "brief_to_project_proposal",
    label: "功能模块一：Brief 到完整项目提案",
    detail: "覆盖 Brief 收集、资料解析、技术可行性、创意方向、故事大纲、氛围图和完整项目提案。中间需要甲方审核的节点，统一挂接外部审核模块。",
    stages: ["brand_requirement_intake", "technical_feasibility", "creative_direction_proposal"] as ProjectStage[],
  },
  {
    key: "quote_contract_completion",
    label: "功能模块二：项目报价合同完成",
    detail: "覆盖报价、合同、签署和飞书交付闭环。报价确认、合同确认等甲方节点都用独立审核任务承载。",
    stages: ["selection_quote_contract"] as ProjectStage[],
  },
  {
    key: "script_storyboard_confirmation",
    label: "功能模块三：脚本创意与文字分镜确认",
    detail: "确认脚本方向、人物/场景参考、完整剧本和文字分镜，甲方审核通过后进入图片生产。",
    stages: ["script_storyboard_confirmation"] as ProjectStage[],
  },
  {
    key: "storyboard_image_canvas",
    label: "功能模块四：分镜图片自由画布",
    detail: "内部逐条分镜生成图片，按场次打包给甲方整体审核。",
    stages: ["storyboard_image_canvas"] as ProjectStage[],
  },
  {
    key: "ai_video_canvas",
    label: "功能模块五：AI 视频自由画布",
    detail: "内部基于已确认分镜图生成视频候选并确认正式资产，甲方审核留到后续 A copy。",
    stages: ["ai_video_canvas"] as ProjectStage[],
  },
  {
    key: "post_production_delivery",
    label: "后续模块：成片、定稿、交付归档",
    detail: "A copy、B copy、结算交付与归档为后续环节，当前保留状态机位置。",
    stages: ["a_copy_revision", "b_copy_final_confirmation", "settlement_delivery_archive"] as ProjectStage[],
  },
];

export const statusLabels: Record<StageStatus, string> = {
  not_started: "未开始",
  in_progress: "进行中",
  waiting_review: "等待确认",
  needs_revision: "需要修改",
  approved: "已确认",
  blocked: "已阻塞",
  completed: "已完成",
  archived: "已归档",
};

export function getStageIndex(stage: ProjectStage) {
  return projectStages.indexOf(stage);
}

export function canEnterStage(current: ProjectStage, next: ProjectStage, currentStatus: StageStatus) {
  const currentIndex = getStageIndex(current);
  const nextIndex = getStageIndex(next);

  if (nextIndex <= currentIndex) {
    return true;
  }

  return currentStatus === "approved" || currentStatus === "completed";
}
