import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { createChangeRequest, listOpenChangeRequests, updateChangeRequestStatus } from "@/server/use-cases/change-requests";

const createChangeRequestSchema = z.object({
  sourceSop: z.string().trim().min(1, "请填写变更来源 SOP").max(80, "变更来源不能超过 80 个字符"),
  originalScope: z.string().trim().min(1, "请填写原始范围").max(2000, "原始范围不能超过 2000 个字符"),
  requestedScope: z.string().trim().min(1, "请填写变更后的范围").max(2000, "变更范围不能超过 2000 个字符"),
  impactJson: z.record(z.string(), z.unknown()).default({}),
  sourceObjectType: z.string().trim().max(80).optional(),
  sourceObjectId: z.string().uuid().optional().nullable(),
});

const updateChangeRequestSchema = z.object({
  changeRequestId: z.string().uuid(),
  status: z.enum(["draft", "submitted", "approved", "rejected", "implemented", "cancelled"]),
  decisionReason: z.string().trim().max(1200, "处理说明不能超过 1200 个字符").optional(),
});

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);

    return Response.json({
      ok: true,
      data: {
        changeRequests: await listOpenChangeRequests(projectId),
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["business", "creative", "admin"]);

    const body = createChangeRequestSchema.parse(await request.json());
    const changeRequest = await createChangeRequest({
      projectId,
      sourceSop: body.sourceSop,
      originalScope: body.originalScope,
      requestedScope: body.requestedScope,
      impactJson: body.impactJson,
      actorId: user.id,
      sourceObjectType: body.sourceObjectType,
      sourceObjectId: body.sourceObjectId,
    });

    return Response.json({
      ok: true,
      data: {
        changeRequest,
        message: "需求变更已创建，请先完成内部确认，再同步更新报价或合同范围。",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["business", "admin"]);

    const body = updateChangeRequestSchema.parse(await request.json());
    const changeRequest = await updateChangeRequestStatus({
      projectId,
      changeRequestId: body.changeRequestId,
      status: body.status,
      decisionReason: body.decisionReason,
      actorId: user.id,
    });

    return Response.json({
      ok: true,
      data: {
        changeRequest,
        message: "需求变更状态已更新，项目范围和后续交付请以当前状态为准。",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
