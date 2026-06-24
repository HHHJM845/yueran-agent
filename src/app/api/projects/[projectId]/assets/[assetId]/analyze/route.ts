import { jsonError } from "@/lib/errors";
import { requireCanStartJob, requireProjectAccess } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { createAuditLog } from "@/server/repositories/audit-logs";
import { enqueueAssetUnderstanding } from "@/server/use-cases/analyze-asset";

export async function POST(request: Request, context: { params: Promise<{ projectId: string; assetId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId, assetId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireCanStartJob(user, "asset_understanding");

    const result = await enqueueAssetUnderstanding({ projectId, assetId });
    await createAuditLog({
      actorId: user.id,
      projectId,
      action: "asset.analysis_requested",
      objectType: "asset",
      objectId: assetId,
      after: { projectId, jobId: result.jobId },
    });

    return Response.json(
      {
        ok: true,
        data: {
          jobId: result.jobId,
          message: "资料解析任务已创建。右侧进度面板会显示真实处理状态。",
        },
      },
      { status: 202 }
    );
  } catch (error) {
    return jsonError(error);
  }
}
