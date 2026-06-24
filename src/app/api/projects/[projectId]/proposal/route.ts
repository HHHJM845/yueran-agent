import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { saveProjectProposal } from "@/server/use-cases/save-proposal";

const saveProposalRequestSchema = z.object({
  title: z.string(),
  content: z.string(),
  status: z.string().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["business", "admin"]);

    const body = saveProposalRequestSchema.parse(await request.json());
    const result = await saveProjectProposal({
      projectId,
      actorId: user.id,
      title: body.title,
      content: body.content,
      status: body.status,
    });

    return Response.json({
      ok: true,
      data: {
        proposal: result.proposal,
        snapshot: result.snapshot,
        message: `提案已保存为 v${result.proposal.version}，并创建历史快照。`,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
