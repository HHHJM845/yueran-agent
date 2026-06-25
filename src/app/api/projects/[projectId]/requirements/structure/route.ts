import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireCanStartJob, requireProjectAccess } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { createAuditLog } from "@/server/repositories/audit-logs";
import { enqueueRequirementStructuring } from "@/server/use-cases/structure-requirement";

const structureRequirementSchema = z.object({
  requirementText: z.string().min(1, "请先粘贴客户需求文本"),
});

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireCanStartJob(user, "requirement_structuring");
    const body = structureRequirementSchema.parse(await request.json());
    const result = await enqueueRequirementStructuring({
      projectId,
      requirementText: body.requirementText,
    });
    await createAuditLog({
      actorId: user.id,
      projectId,
      action: "requirement.structuring_requested",
      objectType: "project",
      objectId: projectId,
      after: { projectId, jobId: result.jobId, inputChars: body.requirementText.length },
    });

    return Response.json(
      {
        ok: true,
        data: {
          jobId: result.jobId,
          message: "需求结构化任务已创建。系统会写入后端任务日志，完成后刷新工作台即可查看结果。",
        },
      },
      { status: 202 }
    );
  } catch (error) {
    return jsonError(error);
  }
}
