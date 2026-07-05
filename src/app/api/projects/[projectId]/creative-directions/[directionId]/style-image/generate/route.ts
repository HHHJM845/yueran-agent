import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireCanStartJob, requireProjectAccess } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { createAuditLog } from "@/server/repositories/audit-logs";
import { enqueueAtmosphereImageGeneration } from "@/server/use-cases/generate-atmosphere-image";

const requestSchema = z.object({
  styleVariant: z.enum(["2d", "pixar_3d", "realistic"]),
});

export async function POST(request: Request, context: { params: Promise<{ projectId: string; directionId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId, directionId } = await context.params;
    const body = requestSchema.parse(await request.json().catch(() => ({})));
    await requireProjectAccess(user, projectId);
    requireCanStartJob(user, "atmosphere_image_generation");

    const result = await enqueueAtmosphereImageGeneration({
      projectId,
      directionId,
      styleVariant: body.styleVariant,
      requestedBy: user.id,
    });
    await createAuditLog({
      actorId: user.id,
      projectId,
      action: "generated_image.generation_requested",
      objectType: "creative_direction",
      objectId: directionId,
      after: { projectId, directionId, styleVariant: body.styleVariant, jobId: result.jobId, generatedImageId: result.generatedImageId },
    });

    return Response.json(
      {
        ok: true,
        data: {
          jobId: result.jobId,
          generatedImageId: result.generatedImageId,
          message: "Round 1 风格图生成任务已创建。系统会写入后端任务日志，完成后自动刷新工作台即可查看结果。",
        },
      },
      { status: 202 }
    );
  } catch (error) {
    return jsonError(error);
  }
}
