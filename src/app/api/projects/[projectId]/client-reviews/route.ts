import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { createWorkflowClientReview } from "@/server/use-cases/client-review";

const createClientReviewRequestSchema = z.object({
  reviewType: z.enum([
    "brief_confirmation",
    "project_proposal",
    "quote_confirmation",
    "contract_confirmation",
    "script_package",
    "a_copy_review",
    "b_copy_review",
  ]),
  targetScopeId: z.string().uuid().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);

    const body = createClientReviewRequestSchema.parse(await request.json());
    if (body.reviewType === "script_package" || body.reviewType === "a_copy_review" || body.reviewType === "b_copy_review") {
      requireRole(user, ["creative", "admin"]);
    } else {
      requireRole(user, ["business", "admin"]);
    }

    const url = new URL(request.url);
    const result = await createWorkflowClientReview({
      projectId,
      actorId: user.id,
      origin: url.origin,
      reviewType: body.reviewType,
      targetScopeId: body.targetScopeId ?? null,
    });

    return Response.json({
      ok: true,
      data: {
        task: result.task,
        items: result.items,
        reviewUrl: result.reviewUrl,
        verificationCode: result.verificationCode,
        message: "甲方审核链接已生成。请把链接和验证码分开发给甲方，提交结果会自动回写内部端。",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
