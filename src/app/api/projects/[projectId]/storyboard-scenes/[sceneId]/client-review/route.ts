import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { createReviewForStoryboardScene } from "@/server/use-cases/client-review";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; sceneId: string }> }
) {
  try {
    const user = await requireUser(request);
    const { projectId, sceneId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["creative", "admin"]);

    const url = new URL(request.url);
    const result = await createReviewForStoryboardScene({
      projectId,
      sceneId,
      actorId: user.id,
      origin: url.origin,
    });

    return Response.json({
      ok: true,
      data: {
        task: result.task,
        items: result.items,
        reviewUrl: result.reviewUrl,
        verificationCode: result.verificationCode,
        message: "场次审核链接已生成。请把链接和验证码分别发送给甲方，审核结果会回写内部端。",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
