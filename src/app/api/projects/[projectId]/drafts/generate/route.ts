import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { createAuditLog } from "@/server/repositories/audit-logs";
import { enqueueDocumentDraftGeneration } from "@/server/use-cases/generate-document-drafts";

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["business", "admin"]);

    const result = await enqueueDocumentDraftGeneration({
      projectId,
      requestedBy: user.id,
    });
    await createAuditLog({
      actorId: user.id,
      projectId,
      action: "document_draft.generation_requested",
      objectType: "project",
      objectId: projectId,
      after: { projectId, jobId: result.jobId },
    });

    return Response.json(
      {
        ok: true,
        data: {
          jobId: result.jobId,
          message: "提案、报价和合同草稿生成任务已创建。后台完成后会保存为历史快照，并可在工作台刷新查看。",
        },
      },
      { status: 202 }
    );
  } catch (error) {
    return jsonError(error);
  }
}
