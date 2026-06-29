import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { enqueueProductionReferenceImages } from "@/server/use-cases/production-reference-images";

const enqueueSchema = z.object({
  entityId: z.string().uuid("人物或场景设定 ID 不正确，请刷新后再试。"),
  prompt: z.string().trim().min(1, "请填写生成提示词。"),
  count: z.coerce.number().int().min(1).max(8).default(1),
  ratio: z.enum(["1:1", "3:4", "4:3", "16:9", "9:16"]),
});

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["creative", "admin"]);
    const input = enqueueSchema.parse(await request.json().catch(() => ({})));
    const result = await enqueueProductionReferenceImages({
      projectId,
      entityId: input.entityId,
      prompt: input.prompt,
      count: input.count,
      ratio: input.ratio,
      requestedBy: user.id,
    });
    return Response.json({ ok: true, data: result });
  } catch (error) {
    return jsonError(error);
  }
}
