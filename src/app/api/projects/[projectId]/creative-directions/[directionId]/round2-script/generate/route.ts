import { jsonError } from "@/lib/errors";
import { requireCanStartJob, requireProjectAccess } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { createAuditLog } from "@/server/repositories/audit-logs";
import { enqueueRound2DeepeningScriptGeneration } from "@/server/use-cases/generate-creative-expansions";

export async function POST(request: Request, context: { params: Promise<{ projectId: string; directionId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId, directionId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireCanStartJob(user, "creative_expansion_generation");

    const result = await enqueueRound2DeepeningScriptGeneration({ projectId, directionId, requestedBy: user.id });
    await createAuditLog({
      actorId: user.id,
      projectId,
      action: "creative_round2.script_generation_requested",
      objectType: "creative_direction",
      objectId: directionId,
      after: { projectId, directionId, jobId: result.jobId },
    });

    return Response.json({ ok: true, data: { jobId: result.jobId, message: "约 500 字完整剧本生成任务已创建。完成后请人工确认再拆分分镜。" } }, { status: 202 });
  } catch (error) {
    return jsonError(error);
  }
}
