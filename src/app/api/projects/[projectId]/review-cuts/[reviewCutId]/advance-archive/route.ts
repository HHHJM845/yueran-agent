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
    if (!reviewCut || reviewCut.cutType !== "b_copy") {
      return Response.json(
        {
          ok: false,
          error: {
            code: "b_copy_review_cut_not_found",
            message: "没有找到可归档的 B copy 定稿版本。请刷新后再试。",
            recoverable: true,
          },
        },
        { status: 404 }
      );
    }

    await createAuditLog({
      actorId: user.id,
      projectId,
      action: "review_cut.advance_archive",
      objectType: "review_cut",
      objectId: reviewCut.id,
      after: { cutType: reviewCut.cutType, version: reviewCut.version, roundNumber: reviewCut.roundNumber },
    });
    await recordStageProgress({
      projectId,
      stageKey: "b_copy_final_confirmation",
      status: "completed",
      currentStage: "settlement_delivery_archive",
      projectStatus: "in_progress",
      userMessage: "B copy 已确认通过，项目进入结算交付与完整归档。",
      outputRefs: [{ type: "review_cut", id: reviewCut.id }],
      snapshot: { reviewCutId: reviewCut.id, cutType: reviewCut.cutType, version: reviewCut.version, roundNumber: reviewCut.roundNumber },
    });

    return Response.json({
      ok: true,
      data: {
        message: "已进入结算交付与完整归档。",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
