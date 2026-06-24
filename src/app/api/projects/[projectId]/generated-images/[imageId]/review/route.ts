import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { reviewGeneratedImage } from "@/server/use-cases/review-generated-image";

const reviewGeneratedImageSchema = z.object({
  reviewStatus: z.enum(["confirmed", "discarded"]),
  reviewNote: z.string().max(1000, "审核备注不能超过 1000 个字符").optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string; imageId: string }> }
) {
  try {
    const user = await requireUser(request);
    const { projectId, imageId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["creative", "admin"]);

    const body = reviewGeneratedImageSchema.parse(await request.json());
    const result = await reviewGeneratedImage({
      projectId,
      imageId,
      reviewStatus: body.reviewStatus,
      reviewNote: body.reviewNote,
      actorId: user.id,
    });

    return Response.json({
      ok: true,
      data: {
        generatedImage: result.image,
        message: result.message,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
