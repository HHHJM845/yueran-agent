import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { createCreativeProposalRound } from "@/server/use-cases/creative-proposal-rounds";

const createRoundRequestSchema = z.object({
  roundNumber: z.union([z.literal(1), z.literal(2)]),
  directionIds: z.array(z.string().uuid()).optional().default([]),
});

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["creative", "admin"]);

    const body = createRoundRequestSchema.parse(await request.json());
    const round = await createCreativeProposalRound({
      projectId,
      roundNumber: body.roundNumber,
      directionIds: body.directionIds,
      actorId: user.id,
    });

    return Response.json({
      ok: true,
      data: {
        round,
        message:
          body.roundNumber === 1
            ? "第一轮完整创意视觉提案包已保存。每个方向包含 2 个故事卡和候选氛围图记录，可继续发给甲方确认。"
            : "第二轮创意视觉提案已保存。保留方向已生成 4 个深化视觉场景，候选图会按真实生成记录展示。",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
