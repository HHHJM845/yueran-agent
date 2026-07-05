import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { saveStandardizedScriptEdit } from "@/server/use-cases/script-storyboard";

const saveStandardizedScriptSchema = z.object({
  standardizedScript: z.string().trim().min(1, "标准剧本内容不能为空"),
});

export async function PUT(
  request: Request,
  context: { params: Promise<{ projectId: string; packageId: string }> }
) {
  try {
    const user = await requireUser(request);
    const { projectId, packageId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["creative", "admin"]);

    const body = saveStandardizedScriptSchema.parse(await request.json());
    const result = await saveStandardizedScriptEdit({
      projectId,
      packageId,
      standardizedScript: body.standardizedScript,
      actorId: user.id,
    });

    return Response.json({ ok: true, data: result });
  } catch (error) {
    return jsonError(error);
  }
}
