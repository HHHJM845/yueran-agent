import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { createAuditLog } from "@/server/repositories/audit-logs";
import { enqueueContractExport } from "@/server/use-cases/export-document";

const exportContractRequestSchema = z.object({
  contractId: z.string().uuid(),
  snapshotId: z.string().uuid().nullable().optional(),
  format: z.enum(["pdf", "docx"]),
});

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["business", "admin"]);

    const body = exportContractRequestSchema.parse(await request.json());
    const result = await enqueueContractExport({
      projectId,
      contractId: body.contractId,
      snapshotId: body.snapshotId ?? null,
      format: body.format,
      requestedBy: user.id,
    });
    await createAuditLog({
      actorId: user.id,
      projectId,
      action: "document_export.requested",
      objectType: "contract",
      objectId: body.contractId,
      after: { projectId, exportId: result.export.id, snapshotId: body.snapshotId ?? null, format: body.format, jobId: result.jobId },
    });

    return Response.json({
      ok: true,
      data: {
        jobId: result.jobId,
        export: result.export,
        message: "合同导出任务已创建。后台完成后会刷新历史导出记录。",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
