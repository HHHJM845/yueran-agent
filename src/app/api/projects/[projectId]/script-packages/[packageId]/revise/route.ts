import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { revisePlainScriptPackage } from "@/server/use-cases/script-storyboard";

const revisePlainScriptSchema = z.object({
  instruction: z.string().trim().min(1, "请输入本轮修改意见"),
  inputMode: z.enum(["text", "voice"]).default("text"),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; packageId: string }> }
) {
  try {
    const user = await requireUser(request);
    const { projectId, packageId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["creative", "admin"]);

    const body = revisePlainScriptSchema.parse(await request.json());
    const result = await revisePlainScriptPackage({
      projectId,
      packageId,
      instruction: body.instruction,
      inputMode: body.inputMode,
      actorId: user.id,
    });

    return Response.json({ ok: true, data: result });
  } catch (error) {
    return jsonError(error);
  }
}
