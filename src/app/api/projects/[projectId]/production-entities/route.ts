import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import {
  getProductionSetup,
  submitProductionSetupReview,
  updateProductionEntityDepth,
} from "@/server/use-cases/production-setup";

const updateDepthSchema = z.object({
  entityId: z.string().uuid("人物或场景设定 ID 不正确，请刷新后再试。"),
  referenceDepth: z.enum(["basic", "full"], {
    message: "请选择基础设定或完整设定。",
  }),
});

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    return Response.json({ ok: true, data: await getProductionSetup(projectId) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    const input = updateDepthSchema.parse(await request.json());
    const result = await updateProductionEntityDepth({
      projectId,
      entityId: input.entityId,
      depth: input.referenceDepth,
      actorId: user.id,
    });
    return Response.json({ ok: true, data: result });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    const origin = request.headers.get("origin") ?? new URL(request.url).origin;
    const review = await submitProductionSetupReview({
      projectId,
      actorId: user.id,
      origin,
    });
    return Response.json({
      ok: true,
      data: {
        ...review,
        message: "人物场景设定审核链接已生成。请把链接和验证码分别发送给甲方确认。",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
