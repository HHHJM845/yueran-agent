import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { createAuditLog } from "@/server/repositories/audit-logs";
import { listProjectFeishuReceivers, maskReceiverId, upsertProjectFeishuReceiver } from "@/server/repositories/feishu-receivers";

const feishuReceiverSchema = z.object({
  receiverType: z.enum(["user", "chat"]),
  receiverId: z.string().trim().min(2, "请输入飞书 open_id 或 chat_id"),
  displayName: z.string().trim().optional().default(""),
  companyName: z.string().trim().optional().default(""),
  contactRole: z.string().trim().optional().default(""),
  contactPhone: z.string().trim().optional().nullable(),
  contactEmail: z.string().trim().email("请输入有效邮箱").optional().nullable().or(z.literal("")),
  isPrimary: z.boolean().optional().default(false),
  notes: z.string().trim().optional().default(""),
});

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["business", "admin"]);
    const receivers = await listProjectFeishuReceivers(projectId);
    return Response.json({ ok: true, data: { receivers } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["business", "admin"]);
    const body = feishuReceiverSchema.parse(await request.json());
    const receiver = await upsertProjectFeishuReceiver({
      projectId,
      receiverType: body.receiverType,
      receiverId: body.receiverId,
      displayName: body.displayName,
      companyName: body.companyName,
      contactRole: body.contactRole,
      contactPhone: body.contactPhone || null,
      contactEmail: body.contactEmail || null,
      isPrimary: body.isPrimary,
      notes: body.notes,
      actorId: user.id,
    });
    await createAuditLog({
      actorId: user.id,
      projectId,
      action: "feishu_receiver.saved",
      objectType: "feishu_receiver",
      objectId: receiver.id,
      after: {
        receiverType: receiver.receiverType,
        displayName: receiver.displayName,
        maskedReceiverId: maskReceiverId(receiver.receiverId),
        isPrimary: receiver.isPrimary,
      },
    });
    const receivers = await listProjectFeishuReceivers(projectId);
    return Response.json({
      ok: true,
      data: {
        receiver,
        receivers,
        message: "常用飞书接收对象已保存，后续交付可以直接选择。",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
