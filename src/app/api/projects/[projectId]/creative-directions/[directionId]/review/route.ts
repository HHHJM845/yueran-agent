import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { creativeDirectionReviewActionSchema, reviewCreativeDirection } from "@/server/use-cases/review-creative-direction";

const reviewCreativeDirectionRequestSchema = z.object({
  action: creativeDirectionReviewActionSchema,
  reason: z.string().trim().optional().default(""),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; directionId: string }> }
) {
  try {
    const user = await requireUser(request);
    const { projectId, directionId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["creative", "admin"]);

    const body = reviewCreativeDirectionRequestSchema.parse(await request.json());
    if ((body.action === "approve" || body.action === "request_revision") && user.role !== "admin") {
      requireRole(user, ["admin"]);
    }

    const result = await reviewCreativeDirection({
      projectId,
      directionId,
      actorId: user.id,
      action: body.action,
      reason: body.reason,
    });

    return Response.json({
      ok: true,
      data: {
        direction: result.direction,
        message: result.message,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
