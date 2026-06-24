import { jsonError } from "@/lib/errors";
import { requireCanStartJob, requireProjectAccess } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { createAuditLog } from "@/server/repositories/audit-logs";
import { enqueueCreativeDirectionGeneration } from "@/server/use-cases/generate-creative-directions";

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireCanStartJob(user, "creative_direction_generation");

    const result = await enqueueCreativeDirectionGeneration({
      projectId,
      requestedBy: user.id,
    });
    await createAuditLog({
      actorId: user.id,
      projectId,
      action: "creative_direction.generation_requested",
      objectType: "project",
      objectId: projectId,
      after: { projectId, jobId: result.jobId },
    });

    return Response.json(
      {
        ok: true,
        data: {
          jobId: result.jobId,
          message: "Top 5 创意方向生成任务已创建。右侧进度面板会显示真实处理状态。",
        },
      },
      { status: 202 }
    );
  } catch (error) {
    return jsonError(error);
  }
}
