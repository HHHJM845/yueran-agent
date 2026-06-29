import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import {
  confirmProductionEntityList,
  createProductionEntityManual,
  editProductionEntity,
  getProductionSetup,
  ignoreProductionEntity,
  restoreProductionEntity,
  submitProductionSetupReview,
  updateProductionEntityDepth,
  updateProductionReferencePrompt,
} from "@/server/use-cases/production-setup";

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update_depth"),
    entityId: z.string().uuid("人物或场景设定 ID 不正确，请刷新后再试。"),
    referenceDepth: z.enum(["basic", "full"], { message: "请选择基础设定或完整设定。" }),
  }),
  z.object({
    action: z.literal("edit_entity"),
    entityId: z.string().uuid("人物或场景设定 ID 不正确，请刷新后再试。"),
    name: z.string().trim().min(1, "请填写人物或场景名称。"),
    description: z.string().trim().default(""),
  }),
  z.object({
    action: z.literal("ignore_entity"),
    entityId: z.string().uuid("人物或场景设定 ID 不正确，请刷新后再试。"),
    reason: z.string().trim().default(""),
  }),
  z.object({
    action: z.literal("restore_entity"),
    entityId: z.string().uuid("人物或场景设定 ID 不正确，请刷新后再试。"),
  }),
  z.object({
    action: z.literal("save_prompt"),
    referenceSetId: z.string().uuid("设定图卡片 ID 不正确，请刷新后再试。"),
    prompt: z.string().trim().min(1, "请填写生成提示词。"),
    ratio: z.enum(["1:1", "3:4", "4:3", "16:9", "9:16"]),
    generationCount: z.coerce.number().int().min(1).max(8),
  }),
]);

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("submit_review"),
  }),
  z.object({
    action: z.literal("create_entity"),
    entityType: z.enum(["character", "scene"]),
    name: z.string().trim().min(1, "请填写人物或场景名称。"),
    description: z.string().trim().default(""),
  }),
  z.object({
    action: z.literal("confirm_list"),
  }),
]);

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
    const input = patchSchema.parse(await request.json());
    if (input.action === "update_depth") {
      const result = await updateProductionEntityDepth({ projectId, entityId: input.entityId, depth: input.referenceDepth, actorId: user.id });
      return Response.json({ ok: true, data: result });
    }
    if (input.action === "edit_entity") {
      return Response.json({ ok: true, data: await editProductionEntity({ projectId, entityId: input.entityId, name: input.name, description: input.description, actorId: user.id }) });
    }
    if (input.action === "ignore_entity") {
      return Response.json({ ok: true, data: await ignoreProductionEntity({ projectId, entityId: input.entityId, reason: input.reason, actorId: user.id }) });
    }
    if (input.action === "restore_entity") {
      return Response.json({ ok: true, data: await restoreProductionEntity({ projectId, entityId: input.entityId, actorId: user.id }) });
    }
    return Response.json({
      ok: true,
      data: await updateProductionReferencePrompt({
        projectId,
        referenceSetId: input.referenceSetId,
        prompt: input.prompt,
        ratio: input.ratio,
        generationCount: input.generationCount,
        actorId: user.id,
      }),
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
    const input = postSchema.parse(await request.json());
    if (input.action === "create_entity") {
      return Response.json({ ok: true, data: await createProductionEntityManual({ projectId, entityType: input.entityType, name: input.name, description: input.description, actorId: user.id }) });
    }
    if (input.action === "confirm_list") {
      return Response.json({ ok: true, data: await confirmProductionEntityList({ projectId, actorId: user.id }) });
    }
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
