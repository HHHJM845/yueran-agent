import { type ProjectStage, projectStages, type StageStatus } from "@/domain/types";

export const stageLabels: Record<ProjectStage, string> = {
  brand_requirement_intake: "品牌方需求洽谈",
  technical_feasibility: "技术可行性评估",
  creative_direction_proposal: "创意方向提案",
  selection_quote_contract: "方向初选、报价与签约",
  full_script_deepening: "完整脚本与深化",
  visual_design: "人物与场景视觉设定",
  text_storyboard: "文字分镜拆解",
  storyboard_image_generation: "分镜图片生成与确定",
  video_generation_selection: "视频生成与素材筛选",
  a_copy_revision: "A copy 生成与修改",
  b_copy_final_confirmation: "B copy 与定稿确认",
  settlement_delivery_archive: "结算交付与归档",
};

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
