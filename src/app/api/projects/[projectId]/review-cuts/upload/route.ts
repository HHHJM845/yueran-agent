import { Buffer } from "node:buffer";
import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { assertSupportedAssetFile, createProjectAssetObjectKey, uploadOssObject } from "@/server/providers/oss";
import { createAuditLog } from "@/server/repositories/audit-logs";
import { createUploadedAsset } from "@/server/repositories/assets";
import { createReviewCut } from "@/server/repositories/review-cuts";
import { recordStageProgress } from "@/server/use-cases/stage-progress";

const reviewCutUploadSchema = z.object({
  cutType: z.enum(["a_copy", "b_copy"]),
  title: z.string().trim().min(1, "请填写成片标题").max(120, "标题不能超过 120 个字符"),
  description: z.string().trim().max(1200, "说明不能超过 1200 个字符").optional(),
});

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["creative", "admin"]);

    const formData = await request.formData();
    const body = reviewCutUploadSchema.parse({
      cutType: formData.get("cutType"),
      title: formData.get("title"),
      description: formData.get("description") ?? "",
    });
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return Response.json(
        { ok: false, error: { code: "review_cut_file_missing", message: "请先选择要上传的成片视频。", recoverable: true } },
        { status: 400 }
      );
    }

    const fileName = file.name || `${body.cutType}-review-cut.mp4`;
    const mimeType = file.type || "video/mp4";
    const fileSize = file.size;
    assertSupportedAssetFile({ fileName, fileSize, mimeType });

    const objectKey = createProjectAssetObjectKey(projectId, fileName);
    const uploaded = await uploadOssObject({
      objectKey,
      body: Buffer.from(await file.arrayBuffer()),
      contentType: mimeType,
    });
    const asset = await createUploadedAsset({
      projectId,
      uploadedBy: user.id,
      assetType: "video",
      ossKey: uploaded.ossKey,
      ossUrl: uploaded.ossUrl,
      fileName,
      fileSize,
      mimeType,
    });
    const reviewCut = await createReviewCut({
      projectId,
      cutType: body.cutType,
      title: body.title,
      description: body.description ?? "",
      assetId: asset.id,
      videoUrl: asset.ossUrl,
      durationSeconds: null,
      createdBy: user.id,
    });

    await createAuditLog({
      actorId: user.id,
      projectId,
      action: "review_cut.uploaded",
      objectType: "review_cut",
      objectId: reviewCut.id,
      after: {
        cutType: reviewCut.cutType,
        version: reviewCut.version,
        roundNumber: reviewCut.roundNumber,
        assetId: reviewCut.assetId,
        ossKey: asset.ossKey,
      },
    });
    await recordStageProgress({
      projectId,
      stageKey: body.cutType === "a_copy" ? "a_copy_revision" : "b_copy_final_confirmation",
      status: "in_progress",
      currentStage: body.cutType === "a_copy" ? "a_copy_revision" : "b_copy_final_confirmation",
      projectStatus: "in_progress",
      userMessage: body.cutType === "a_copy" ? "A copy 成片已上传到 OSS，等待内部审核后再发给甲方。" : "B copy 定稿成片已上传到 OSS，等待内部审核后再发给甲方。",
      outputRefs: [{ type: "review_cut", id: reviewCut.id }],
      snapshot: { reviewCutId: reviewCut.id, cutType: reviewCut.cutType, version: reviewCut.version, roundNumber: reviewCut.roundNumber, assetId: asset.id },
    });

    return Response.json({
      ok: true,
      data: {
        reviewCut,
        message: body.cutType === "a_copy" ? "A copy 成片已上传并保存。" : "B copy 定稿成片已上传并保存。",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
