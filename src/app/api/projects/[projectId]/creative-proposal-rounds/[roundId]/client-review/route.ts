import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { createCreativeProposalRoundClientReview } from "@/server/use-cases/creative-proposal-rounds";

export async function POST(request: Request, context: { params: Promise<{ projectId: string; roundId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId, roundId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["creative", "business", "admin"]);

    const url = new URL(request.url);
    const result = await createCreativeProposalRoundClientReview({
      projectId,
      roundId,
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
        message: "本轮创意视觉提案审核链接已生成。请把链接和验证码分开发给甲方，提交结果会自动回写内部端。",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
