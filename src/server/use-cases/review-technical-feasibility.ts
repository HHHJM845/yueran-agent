import { z } from "zod";
import type { ProjectStage, StageStatus } from "@/domain/types";
import { AppError } from "@/lib/errors";
import { createAuditLog } from "@/server/repositories/audit-logs";
import { getProjectById } from "@/server/repositories/projects";
import { recordStageProgress } from "@/server/use-cases/stage-progress";

export const technicalFeasibilityActionSchema = z.enum(["request_revision", "approve"]);
export type TechnicalFeasibilityAction = z.infer<typeof technicalFeasibilityActionSchema>;

export const reviewTechnicalFeasibilityInputSchema = z.object({
  action: technicalFeasibilityActionSchema,
  reason: z.string().trim().max(800, "原因最多 800 字").optional().default(""),
  nextStep: z.string().trim().max(500, "下一步建议最多 500 字").optional().default(""),
});

export async function reviewTechnicalFeasibility(input: {
  projectId: string;
  actorId: string;
  action: TechnicalFeasibilityAction;
  reason?: string | null;
  nextStep?: string | null;
}) {
  const project = await getProjectById(input.projectId);
  if (!project) {
    throw new AppError({
      status: 404,
      code: "project_not_found",
      userMessage: "没有找到这个项目。请刷新项目列表后再试。",
    });
  }

  const parsed = reviewTechnicalFeasibilityInputSchema.parse({
    action: input.action,
    reason: input.reason ?? "",
    nextStep: input.nextStep ?? "",
  });

  if (parsed.action === "request_revision" && !parsed.reason) {
    throw new AppError({
      status: 400,
      code: "technical_revision_reason_required",
      userMessage: "请填写需要补充或修改的资料说明，商务团队才能按建议重新提交。",
    });
  }

  const stage = mapTechnicalFeasibilityStageProgress({
    action: parsed.action,
    reason: parsed.reason,
    nextStep: parsed.nextStep,
  });

  const stageState = await recordStageProgress({
    projectId: input.projectId,
    stageKey: "technical_feasibility",
    status: stage.stageStatus,
    currentStage: stage.currentStage,
    projectStatus: stage.projectStatus,
    title: stage.title,
    userMessage: stage.userMessage,
    errorMessage: stage.errorMessage,
    snapshot: {
      action: parsed.action,
      reason: parsed.reason || null,
      nextStep: parsed.nextStep || null,
      reviewedAt: new Date().toISOString(),
    },
  });

  if (parsed.action === "request_revision") {
    await recordStageProgress({
      projectId: input.projectId,
      stageKey: "brand_requirement_intake",
      status: "needs_revision",
      currentStage: "brand_requirement_intake",
      projectStatus: "needs_revision",
      title: "需求资料需要补充",
      userMessage: "接单风险评估已退回需求补充，商务团队补齐资料后可以重新发起评估。",
      errorMessage: parsed.reason || "接单风险评估需要补充资料后重新提交。",
      snapshot: {
        sourceStage: "technical_feasibility",
        action: parsed.action,
        reason: parsed.reason || null,
        nextStep: parsed.nextStep || null,
      },
    });
  }

  if (parsed.action === "approve") {
    await recordStageProgress({
      projectId: input.projectId,
      stageKey: "creative_direction_proposal",
      status: "in_progress",
      currentStage: "creative_direction_proposal",
      projectStatus: "in_progress",
      title: "创意方向提案可继续推进",
      userMessage: "接单风险评估已通过，创意团队可以继续提交或完善创意方向。",
      errorMessage: null,
      snapshot: {
        sourceStage: "technical_feasibility",
        action: parsed.action,
      },
    });
  }

  await createAuditLog({
    actorId: input.actorId,
    projectId: input.projectId,
    action: `technical_feasibility.${parsed.action}`,
    objectType: "project_stage_state",
    objectId: stageState.id,
    before: {
      currentStage: project.currentStage,
      status: project.status,
    },
    after: {
      projectId: input.projectId,
      stageKey: "technical_feasibility",
      action: parsed.action,
      stageStatus: stage.stageStatus,
      projectStatus: stage.projectStatus,
      reason: parsed.reason || null,
      nextStep: parsed.nextStep || null,
    },
  });

  return {
    stageState,
    message: stage.userMessage,
  };
}

export function mapTechnicalFeasibilityStageProgress(input: {
  action: TechnicalFeasibilityAction;
  reason: string;
  nextStep: string;
}) {
  const reasonSuffix = input.reason ? `原因：${input.reason}` : "";
  const nextStepSuffix = input.nextStep ? `下一步：${input.nextStep}` : "";
  const combinedDetail = [reasonSuffix, nextStepSuffix].filter(Boolean).join(" ");

  if (input.action === "request_revision") {
    return {
      stageStatus: "needs_revision" as StageStatus,
      currentStage: "brand_requirement_intake" as ProjectStage,
      projectStatus: "needs_revision" as StageStatus,
      title: "接单风险评估退回补充资料",
      userMessage: `接单风险评估已退回需求补充。${combinedDetail || "请商务团队补充资料后重新发起评估。"}`,
      errorMessage: combinedDetail || "接单风险评估需要补充资料后重新提交。",
    };
  }

  if (input.action === "approve") {
    return {
      stageStatus: "approved" as StageStatus,
      currentStage: "creative_direction_proposal" as ProjectStage,
      projectStatus: "in_progress" as StageStatus,
      title: "接单风险评估已通过",
      userMessage: "接单风险评估已通过，项目可继续推进创意方向提案。",
      errorMessage: null,
    };
  }

  return {
    stageStatus: "approved" as StageStatus,
    currentStage: "creative_direction_proposal" as ProjectStage,
    projectStatus: "in_progress" as StageStatus,
    title: "接单风险评估已通过",
    userMessage: "接单风险评估已通过，项目可继续推进创意方向提案。",
    errorMessage: null,
  };
}
