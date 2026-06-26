import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import {
  generateRiskCheckFromProject,
  getRiskCheckForProject,
  saveRiskCheckDecision,
} from "@/server/use-cases/risk-check-card";

const postSchema = z.object({
  action: z.literal("generate"),
});

const patchSchema = z.object({
  action: z.literal("decide"),
  cardId: z.string().uuid("风险卡 ID 不合法"),
  decision: z.enum(["accept", "reject", "conditional_accept"]),
  reason: z.string().trim().min(1, "请填写人工判断原因").max(800, "原因最多 800 字"),
});

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);

    const riskCheck = await getRiskCheckForProject(projectId);
    return Response.json({
      ok: true,
      data: { riskCheck },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["business", "creative", "admin"]);

    postSchema.parse(await request.json().catch(() => ({ action: "generate" })));

    const result = await generateRiskCheckFromProject({
      projectId,
      actorId: user.id,
    });

    return Response.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["business", "admin"]);

    const body = patchSchema.parse(await request.json());
    const card = await saveRiskCheckDecision({
      projectId,
      cardId: body.cardId,
      decision: body.decision,
      reason: body.reason,
      actorId: user.id,
    });

    return Response.json({
      ok: true,
      data: {
        card,
        message:
          body.decision === "reject"
            ? "已记录当前项目暂不接单的人工判断。后续如果补齐条件，可以重新生成风险体检卡。"
            : body.decision === "conditional_accept"
              ? "已记录条件接单判断，请继续跟进限制条件并在后续 SOP 保留人工介入。"
              : "已记录可接单判断，风险体检卡的人工作业已留痕保存。",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
