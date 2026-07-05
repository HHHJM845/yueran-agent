import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { createAuditLog } from "@/server/repositories/audit-logs";
import { confirmRound2DeepeningScript } from "@/server/use-cases/generate-creative-expansions";

export async function POST(request: Request, context: { params: Promise<{ projectId: string; directionId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId, directionId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["creative", "admin"]);

    const result = await confirmRound2DeepeningScript({ projectId, directionId });
    await createAuditLog({
      actorId: user.id,
      projectId,
      action: "creative_round2.script_confirmed",
      objectType: "creative_direction",
      objectId: directionId,
      after: { projectId, directionId, artifactId: result.artifact.id },
    });

    return Response.json({ ok: true, data: result });
  } catch (error) {
    return jsonError(error);
  }
}
