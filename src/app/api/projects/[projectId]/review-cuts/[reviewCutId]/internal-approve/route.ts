import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { createAuditLog } from "@/server/repositories/audit-logs";
import { markReviewCutInternalApproved } from "@/server/repositories/review-cuts";
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
    const reviewCut = await markReviewCutInternalApproved({ projectId, reviewCutId, actorId: user.id });
    if (!reviewCut) {
      return Response.json(
        {
          ok: false,
          error: {
            code: "review_cut_not_found",
            message: "没有找到这个成片版本。请刷新后再试。",
            recoverable: true,
          },
        },
        { status: 404 }
      );
    }
    await createAuditLog({
      actorId: user.id,
      projectId,
      action: "review_cut.internal_approved",
      objectType: "review_cut",
      objectId: reviewCut.id,
      after: { cutType: reviewCut.cutType, version: reviewCut.version },
    });
    await recordStageProgress({
      projectId,
      stageKey: reviewCut.cutType === "a_copy" ? "a_copy_revision" : "b_copy_final_confirmation",
      status: "waiting_review",
      currentStage: reviewCut.cutType === "a_copy" ? "a_copy_revision" : "b_copy_final_confirmation",
      projectStatus: "waiting_review",
      userMessage: reviewCut.cutType === "a_copy" ? "A copy 已通过内部审核，可以生成甲方审核链接。" : "B copy 已通过内部审核，可以生成甲方最终确认链接。",
      outputRefs: [{ type: "review_cut", id: reviewCut.id }],
      snapshot: { reviewCutId: reviewCut.id, cutType: reviewCut.cutType, version: reviewCut.version },
    });
    return Response.json({
      ok: true,
      data: {
        reviewCut,
        message: "内部审核已通过。现在可以生成甲方审核链接。",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
