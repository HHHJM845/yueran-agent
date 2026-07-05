import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { generateProjectWorkloadEstimateDraft } from "@/server/use-cases/workload-estimate";

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["business", "admin"]);

    const workloadEstimate = await generateProjectWorkloadEstimateDraft({
      projectId,
      actorId: user.id,
    });

    return Response.json({
      ok: true,
      data: {
        workloadEstimate,
        message: "AI 已根据已确认创意提案生成工作量预估草稿，请人工核对后保存进入报价。",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
