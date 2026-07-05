import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { createAuditLog } from "@/server/repositories/audit-logs";
import { getReviewCut } from "@/server/repositories/review-cuts";
import { recordStageProgress } from "@/server/use-cases/stage-progress";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; reviewCutId: string }> }
) {
  try {
    const user = await requireUser(request);
    const { projectId, reviewCutId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["creative", "admin"]);

    const reviewCut = await getReviewCut({ projectId, reviewCutId });
    if (!reviewCut || reviewCut.cutType !== "a_copy") {
      return Response.json(
        {
          ok: false,
          error: {
            code: "a_copy_review_cut_not_found",
            message: "没有找到可推进的 A copy 成片版本。请刷新后再试。",
            recoverable: true,
          },
        },
        { status: 404 }
      );
    }

    await createAuditLog({
      actorId: user.id,
      projectId,
      action: "review_cut.advance_b_copy",
      objectType: "review_cut",
      objectId: reviewCut.id,
      after: { cutType: reviewCut.cutType, version: reviewCut.version, roundNumber: reviewCut.roundNumber },
    });
    await recordStageProgress({
      projectId,
      stageKey: "a_copy_revision",
      status: "completed",
      currentStage: "b_copy_final_confirmation",
      projectStatus: "in_progress",
      userMessage: "A copy 已确认完成交付，项目进入 B Copy 定稿确认。",
      outputRefs: [{ type: "review_cut", id: reviewCut.id }],
      snapshot: { reviewCutId: reviewCut.id, cutType: reviewCut.cutType, version: reviewCut.version, roundNumber: reviewCut.roundNumber },
    });

    return Response.json({
      ok: true,
      data: {
        message: "已进入 B Copy 定稿确认。",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
