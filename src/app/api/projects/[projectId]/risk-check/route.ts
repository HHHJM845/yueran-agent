import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import {
  generateRiskCheckFromProject,
  getRiskCheckForProject,
  riskCheckRejectionCategorySchema,
  saveRiskCheckDecision,
} from "@/server/use-cases/risk-check-card";

const postSchema = z.object({
  action: z.literal("generate"),
});

const patchSchema = z.object({
  action: z.literal("decide"),
  cardId: z.string().uuid("风险卡 ID 不合法"),
  decision: z.enum(["accept", "reject"]),
  rejectionCategory: riskCheckRejectionCategorySchema.optional(),
  reason: z.string().trim().max(800, "原因最多 800 字").optional().default(""),
}).superRefine((value, context) => {
  if (value.decision === "reject" && !value.rejectionCategory) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["rejectionCategory"],
      message: "请选择不能接的核心原因",
    });
  }

  if (value.decision === "reject" && !value.reason.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reason"],
      message: "请填写不能接的理由补充",
    });
  }
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
      rejectionCategory: body.rejectionCategory,
      reason: body.reason,
      actorId: user.id,
    });

    return Response.json({
      ok: true,
      data: {
        card,
        message:
          body.decision === "reject"
            ? body.rejectionCategory === "brief_insufficient"
              ? "已记录不能接原因：Brief 不足。项目已退回 Brief 环节补充资料。"
              : "已记录不能接原因：项目背景或项目本身原因。项目已停留在接单风险评估环节。"
            : "已记录能接判断，项目将进入创意视觉提案环节。",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
