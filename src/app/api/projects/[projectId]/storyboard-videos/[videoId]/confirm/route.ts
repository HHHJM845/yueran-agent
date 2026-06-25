import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { confirmStoryboardVideo } from "@/server/use-cases/storyboard-media";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; videoId: string }> }
) {
  try {
    const user = await requireUser(request);
    const { projectId, videoId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["creative", "admin"]);

    const result = await confirmStoryboardVideo({
      projectId,
      videoId,
      actorId: user.id,
    });

    return Response.json({ ok: true, data: result });
  } catch (error) {
    return jsonError(error);
  }
}
