import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { confirmStoryboardSequence } from "@/server/use-cases/storyboard-sequence";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["creative", "admin"]);
    const result = await confirmStoryboardSequence({ projectId, actorId: user.id });
    return Response.json({ ok: true, data: result });
  } catch (error) {
    return jsonError(error);
  }
}
