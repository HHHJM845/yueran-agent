import { jsonError } from "@/lib/errors";
import { requireCanStartJob, requireProjectAccess } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { createAuditLog } from "@/server/repositories/audit-logs";
import { enqueueAtmosphereImageGeneration } from "@/server/use-cases/generate-atmosphere-image";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; directionId: string; expansionId: string }> }
) {
  try {
    const user = await requireUser(request);
    const { projectId, directionId, expansionId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireCanStartJob(user, "atmosphere_image_generation");

    const result = await enqueueAtmosphereImageGeneration({
      projectId,
      directionId,
      expansionId,
      requestedBy: user.id,
    });
    await createAuditLog({
      actorId: user.id,
      projectId,
      action: "generated_image.generation_requested",
      objectType: "creative_expansion",
      objectId: expansionId,
      after: { projectId, directionId, expansionId, jobId: result.jobId, generatedImageId: result.generatedImageId },
    });

    return Response.json(
      {
        ok: true,
        data: {
          jobId: result.jobId,
          generatedImageId: result.generatedImageId,
          message: "氛围图生成任务已创建。右侧进度面板会显示真实处理状态。",
        },
      },
      { status: 202 }
    );
  } catch (error) {
    return jsonError(error);
  }
}
