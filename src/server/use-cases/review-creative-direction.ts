import { z } from "zod";
import type { StageStatus } from "@/domain/types";
import { AppError } from "@/lib/errors";
import { createAuditLog } from "@/server/repositories/audit-logs";
import { getProjectCreativeDirection, updateCreativeDirectionStatus } from "@/server/repositories/creative-directions";
import { recordStageProgress } from "@/server/use-cases/stage-progress";

export const creativeDirectionReviewActionSchema = z.enum(["submit_review", "approve", "request_revision"]);
export type CreativeDirectionReviewAction = z.infer<typeof creativeDirectionReviewActionSchema>;

export const reviewCreativeDirectionInputSchema = z.object({
  action: creativeDirectionReviewActionSchema,
  reason: z.string().trim().max(600, "审核意见最多 600 字").optional().default(""),
});

const actionToDirectionStatus: Record<CreativeDirectionReviewAction, string> = {
  submit_review: "waiting_review",
  approve: "approved",
  request_revision: "needs_revision",
};

export async function reviewCreativeDirection(input: {
  projectId: string;
  directionId: string;
  actorId: string;
  action: CreativeDirectionReviewAction;
  reason?: string | null;
}) {
  const parsed = reviewCreativeDirectionInputSchema.parse({
    action: input.action,
    reason: input.reason ?? "",
  });

  if (parsed.action === "request_revision" && !parsed.reason) {
    throw new AppError({
      status: 400,
      code: "creative_direction_revision_reason_required",
      userMessage: "请填写驳回原因或修改建议，创意团队才能按意见修改后重新提交。",
    });
  }

  const existing = await getProjectCreativeDirection({
    projectId: input.projectId,
    directionId: input.directionId,
  });
  if (!existing) {
    throw new AppError({
      status: 404,
      code: "creative_direction_not_found",
      userMessage: "没有找到这张创意方向卡片。它可能已经被归档或删除。",
    });
  }

  const nextStatus = actionToDirectionStatus[parsed.action];
  const direction = await updateCreativeDirectionStatus({
    projectId: input.projectId,
    directionId: input.directionId,
    status: nextStatus,
  });

  if (!direction) {
    throw new AppError({
      status: 404,
      code: "creative_direction_not_found",
      userMessage: "没有找到这张创意方向卡片。它可能已经被归档或删除。",
    });
  }

  const stage = mapCreativeDirectionStageProgress({
    action: parsed.action,
    title: direction.title,
    reason: parsed.reason,
  });

  await recordStageProgress({
    projectId: input.projectId,
    stageKey: "creative_direction_proposal",
    status: stage.stageStatus,
    currentStage: "creative_direction_proposal",
    projectStatus: stage.projectStatus,
    title: stage.title,
    userMessage: stage.userMessage,
    errorMessage: stage.errorMessage,
    outputRefs: [{ type: "creative_direction", id: direction.id }],
    snapshot: {
      directionId: direction.id,
      directionTitle: direction.title,
      action: parsed.action,
      status: nextStatus,
      reason: parsed.reason || null,
      reviewedAt: new Date().toISOString(),
    },
  });

  await createAuditLog({
    actorId: input.actorId,
    projectId: input.projectId,
    action: `creative_direction.${parsed.action}`,
    objectType: "creative_direction",
    objectId: direction.id,
    before: {
      status: existing.status,
      title: existing.title,
      isSelected: existing.isSelected,
    },
    after: {
      projectId: input.projectId,
      action: parsed.action,
      status: nextStatus,
      title: direction.title,
      reason: parsed.reason || null,
      isSelected: direction.isSelected,
    },
  });

  return {
    direction,
    message: stage.userMessage,
  };
}

export function mapCreativeDirectionStageProgress(input: {
  action: CreativeDirectionReviewAction;
  title: string;
  reason: string;
}) {
  const reasonSuffix = input.reason ? `意见：${input.reason}` : "";

  if (input.action === "request_revision") {
    return {
      stageStatus: "needs_revision" as StageStatus,
      projectStatus: "needs_revision" as StageStatus,
      title: "创意方向被驳回修改",
      userMessage: `创意方向「${input.title}」已退回修改。${reasonSuffix || "请创意团队修改后重新提交审核。"}`,
      errorMessage: reasonSuffix || "创意方向需要修改后重新提交。",
    };
  }

  if (input.action === "approve") {
    return {
      stageStatus: "approved" as StageStatus,
      projectStatus: "in_progress" as StageStatus,
      title: "创意方向已确认",
      userMessage: `创意方向「${input.title}」已确认，可以继续深化、生成氛围图或进入提案报价。`,
      errorMessage: null,
    };
  }

  return {
    stageStatus: "waiting_review" as StageStatus,
    projectStatus: "waiting_review" as StageStatus,
    title: "创意方向已提交审核",
    userMessage: `创意方向「${input.title}」已提交审核，请管理员确认或驳回。`,
    errorMessage: null,
  };
}
