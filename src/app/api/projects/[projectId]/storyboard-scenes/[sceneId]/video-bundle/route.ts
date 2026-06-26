import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { listSelectedStoryboardVideosForScene } from "@/server/repositories/story-production";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string; sceneId: string }> }
) {
  try {
    const user = await requireUser(request);
    const { projectId, sceneId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["creative", "admin"]);

    const videos = await listSelectedStoryboardVideosForScene({ projectId, sceneId });
    return Response.json({ ok: true, data: { sceneId, videos } });
  } catch (error) {
    return jsonError(error);
  }
}
