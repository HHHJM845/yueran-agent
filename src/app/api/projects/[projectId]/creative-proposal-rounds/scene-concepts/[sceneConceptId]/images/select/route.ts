import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { selectCreativeSceneImages } from "@/server/use-cases/creative-proposal-rounds";

const selectImagesRequestSchema = z.object({
  imageIds: z.array(z.string().uuid()).min(1).max(4),
});

export async function POST(request: Request, context: { params: Promise<{ projectId: string; sceneConceptId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId, sceneConceptId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["creative", "admin"]);

    const body = selectImagesRequestSchema.parse(await request.json());
    const concept = await selectCreativeSceneImages({
      projectId,
      sceneConceptId,
      imageIds: body.imageIds,
      actorId: user.id,
    });

    return Response.json({
      ok: true,
      data: {
        concept,
        message: "视觉场景候选图已确认，并保存到数据库。刷新后可在本轮创意视觉提案中继续查看。",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
