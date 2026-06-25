import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { saveScriptDirectionPackage } from "@/server/use-cases/script-storyboard";

const referenceSchema = z.object({
  title: z.string().trim().min(1, "请输入参考图标题"),
  styleLabel: z.string().trim().max(80).optional(),
  prompt: z.string().trim().max(1200).optional(),
  ossUrl: z.string().trim().url().nullable().optional(),
});

const savePackageSchema = z.object({
  directionId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1, "请输入脚本方向标题"),
  concept: z.string().trim().min(1, "请输入脚本方向概念"),
  fullScript: z.string().trim().min(1, "请输入完整剧本"),
  characterReferences: z.array(referenceSchema).max(3, "每个脚本方向最多 3 张人物参考图").optional(),
  sceneReferences: z.array(referenceSchema).max(2, "每个脚本方向最多 2 张场景参考图").optional(),
});

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["creative", "admin"]);

    const body = savePackageSchema.parse(await request.json());
    const result = await saveScriptDirectionPackage({
      projectId,
      directionId: body.directionId,
      title: body.title,
      concept: body.concept,
      fullScript: body.fullScript,
      actorId: user.id,
      characterReferences: body.characterReferences,
      sceneReferences: body.sceneReferences,
    });

    return Response.json({ ok: true, data: result });
  } catch (error) {
    return jsonError(error);
  }
}
