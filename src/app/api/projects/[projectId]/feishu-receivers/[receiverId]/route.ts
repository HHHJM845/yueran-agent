import { z } from "zod";
import { AppError, jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { createAuditLog } from "@/server/repositories/audit-logs";
import {
  archiveProjectFeishuReceiver,
  getProjectFeishuReceiver,
  maskReceiverId,
  upsertProjectFeishuReceiver,
} from "@/server/repositories/feishu-receivers";

const updateFeishuReceiverSchema = z.object({
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

export async function PATCH(request: Request, context: { params: Promise<{ projectId: string; receiverId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId, receiverId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["business", "admin"]);
    const existing = await getProjectFeishuReceiver({ projectId, receiverId });
    if (!existing) {
      throw new AppError({
        status: 404,
        code: "feishu_receiver_not_found",
        userMessage: "没有找到这个常用飞书接收对象。请刷新项目后再试。",
      });
    }

    const body = updateFeishuReceiverSchema.parse(await request.json());
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
      action: "feishu_receiver.updated",
      objectType: "feishu_receiver",
      objectId: receiver.id,
      before: {
        receiverType: existing.receiverType,
        displayName: existing.displayName,
        maskedReceiverId: maskReceiverId(existing.receiverId),
        isPrimary: existing.isPrimary,
      },
      after: {
        receiverType: receiver.receiverType,
        displayName: receiver.displayName,
        maskedReceiverId: maskReceiverId(receiver.receiverId),
        isPrimary: receiver.isPrimary,
      },
    });
    return Response.json({
      ok: true,
      data: {
        receiver,
        message: "常用飞书接收对象已更新。",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ projectId: string; receiverId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId, receiverId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["business", "admin"]);
    const receiver = await archiveProjectFeishuReceiver({ projectId, receiverId, actorId: user.id });
    if (!receiver) {
      throw new AppError({
        status: 404,
        code: "feishu_receiver_not_found",
        userMessage: "没有找到这个常用飞书接收对象。请刷新项目后再试。",
      });
    }
    await createAuditLog({
      actorId: user.id,
      projectId,
      action: "feishu_receiver.archived",
      objectType: "feishu_receiver",
      objectId: receiver.id,
      after: {
        receiverType: receiver.receiverType,
        displayName: receiver.displayName,
        maskedReceiverId: maskReceiverId(receiver.receiverId),
      },
    });
    return Response.json({ ok: true, data: { message: "常用飞书接收对象已停用，不会再出现在交付选择中。" } });
  } catch (error) {
    return jsonError(error);
  }
}
