import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { createAuditLog } from "@/server/repositories/audit-logs";
import { getProjectAsset } from "@/server/repositories/assets";
import { createReviewCut } from "@/server/repositories/review-cuts";
import { recordStageProgress } from "@/server/use-cases/stage-progress";

const createReviewCutSchema = z.object({
  cutType: z.enum(["a_copy", "b_copy"]),
  title: z.string().trim().min(1, "请填写成片标题").max(120, "标题不能超过 120 个字符"),
  description: z.string().trim().max(1200, "说明不能超过 1200 个字符").optional(),
  assetId: z.string().uuid().optional().nullable(),
  videoUrl: z.string().url("请输入有效的视频播放链接").optional().nullable(),
  durationSeconds: z.coerce.number().min(1, "视频时长至少为 1 秒").optional().nullable(),
});

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["creative", "admin"]);
    const body = createReviewCutSchema.parse(await request.json());
    const asset = body.assetId ? await getProjectAsset(projectId, body.assetId) : null;
    const videoUrl = body.videoUrl ?? asset?.ossUrl ?? asset?.externalUrl ?? null;
    const reviewCut = await createReviewCut({
      projectId,
      cutType: body.cutType,
      title: body.title,
      description: body.description,
      assetId: asset?.id ?? null,
      videoUrl,
      durationSeconds: body.durationSeconds ?? null,
      createdBy: user.id,
    });
    await createAuditLog({
      actorId: user.id,
      projectId,
      action: "review_cut.created",
      objectType: "review_cut",
      objectId: reviewCut.id,
      after: {
        cutType: reviewCut.cutType,
        version: reviewCut.version,
        roundNumber: reviewCut.roundNumber,
        assetId: reviewCut.assetId,
      },
    });
    await recordStageProgress({
      projectId,
      stageKey: body.cutType === "a_copy" ? "a_copy_revision" : "b_copy_final_confirmation",
      status: "in_progress",
      currentStage: body.cutType === "a_copy" ? "a_copy_revision" : "b_copy_final_confirmation",
      projectStatus: "in_progress",
      userMessage: body.cutType === "a_copy" ? "A copy 成片已上传，等待内部审核后再发给甲方。" : "B copy 精剪成片已上传，等待内部审核后再发给甲方。",
      outputRefs: [{ type: "review_cut", id: reviewCut.id }],
      snapshot: { reviewCutId: reviewCut.id, cutType: reviewCut.cutType, version: reviewCut.version, roundNumber: reviewCut.roundNumber },
    });

    return Response.json({
      ok: true,
      data: {
        reviewCut,
        message: "成片版本已保存。内部确认后即可生成甲方本地审核链接。",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
