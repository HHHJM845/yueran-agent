import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { retryFeishuDelivery } from "@/server/use-cases/feishu-delivery";

const retryFeishuDeliveryRequestSchema = z.object({
  receiverType: z.enum(["user", "chat"]).optional(),
  receiverId: z.string().trim().min(2).optional(),
  receiverName: z.string().trim().optional(),
  receiverRefId: z.string().uuid().nullable().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; deliveryId: string }> }
) {
  try {
    const user = await requireUser(request);
    const { projectId, deliveryId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["business", "admin"]);

    const body = retryFeishuDeliveryRequestSchema.parse(await request.json().catch(() => ({})));
    const result = await retryFeishuDelivery({
      projectId,
      deliveryId,
      receiverType: body.receiverType,
      receiverId: body.receiverId,
      receiverName: body.receiverName,
      receiverRefId: body.receiverRefId ?? null,
      requestedBy: user.id,
    });

    return Response.json({
      ok: true,
      data: {
        jobId: result.jobId,
        delivery: result.delivery,
        message: "飞书交付补发已重新进入队列。系统会保留已创建的飞书文档链接，并重新发送给指定对象。",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
