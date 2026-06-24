import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { reviewTechnicalFeasibility, technicalFeasibilityActionSchema } from "@/server/use-cases/review-technical-feasibility";

const reviewTechnicalFeasibilityRequestSchema = z.object({
  action: technicalFeasibilityActionSchema,
  reason: z.string().trim().optional().default(""),
  nextStep: z.string().trim().optional().default(""),
});

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["business", "creative", "admin"]);

    const body = reviewTechnicalFeasibilityRequestSchema.parse(await request.json());
    if ((body.action === "mark_blocked" || body.action === "approve" || body.action === "reopen") && user.role !== "admin") {
      requireRole(user, ["admin"]);
    }

    const result = await reviewTechnicalFeasibility({
      projectId,
      actorId: user.id,
      action: body.action,
      reason: body.reason,
      nextStep: body.nextStep,
    });

    return Response.json({
      ok: true,
      data: {
        stageState: result.stageState,
        message: result.message,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
