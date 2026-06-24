import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { createAuditLog } from "@/server/repositories/audit-logs";
import { enqueueFeishuDelivery } from "@/server/use-cases/feishu-delivery";

const feishuDeliveryRequestSchema = z.object({
  documentType: z.enum(["proposal", "quote", "contract"]),
  documentId: z.string().uuid(),
  snapshotId: z.string().uuid().nullable().optional(),
  receiverType: z.enum(["user", "chat"]).default("chat"),
  receiverId: z.string().trim().optional().default(""),
  receiverName: z.string().trim().optional().default(""),
  receiverRefId: z.string().uuid().nullable().optional(),
  saveReceiver: z.boolean().optional().default(false),
});

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["business", "admin"]);

    const body = feishuDeliveryRequestSchema.parse(await request.json());
    const result = await enqueueFeishuDelivery({
      projectId,
      documentType: body.documentType,
      documentId: body.documentId,
      snapshotId: body.snapshotId ?? null,
      receiverType: body.receiverType,
      receiverId: body.receiverId,
      receiverName: body.receiverName,
      receiverRefId: body.receiverRefId ?? null,
      saveReceiver: body.saveReceiver,
      requestedBy: user.id,
    });
    await createAuditLog({
      actorId: user.id,
      projectId,
      action: "feishu_delivery.requested",
      objectType: "feishu_delivery",
      objectId: result.delivery.id,
      after: {
        projectId,
        documentType: body.documentType,
        documentId: body.documentId,
        snapshotId: body.snapshotId ?? null,
        receiverType: body.receiverType,
        receiverName: body.receiverName,
        receiverRefId: body.receiverRefId ?? null,
        jobId: result.jobId,
      },
    });

    return Response.json({
      ok: true,
      data: {
        jobId: result.jobId,
        delivery: result.delivery,
        message: "飞书交付任务已创建。后台会创建文档、发送消息，并把链接和发送记录回写到项目归档。",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
