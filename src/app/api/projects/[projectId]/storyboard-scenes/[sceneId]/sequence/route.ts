import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { saveStoryboardSequence, storyboardSequenceShotSchema } from "@/server/use-cases/storyboard-sequence";

const saveSequenceSchema = z.object({
  shots: z.array(storyboardSequenceShotSchema).min(1, "每个场次至少需要保留一条分镜。"),
  deletedShotIds: z.array(z.string().uuid()).optional().default([]),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string; sceneId: string }> }
) {
  try {
    const user = await requireUser(request);
    const { projectId, sceneId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["creative", "admin"]);
    const input = saveSequenceSchema.parse(await request.json());
    const result = await saveStoryboardSequence({
      projectId,
      sceneId,
      shots: input.shots,
      deletedShotIds: input.deletedShotIds,
      actorId: user.id,
    });
    return Response.json({ ok: true, data: result });
  } catch (error) {
    return jsonError(error);
  }
}
