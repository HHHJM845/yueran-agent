import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { commercialReviewActionSchema, reviewCommercialDocument } from "@/server/use-cases/review-commercial-document";

const reviewQuoteRequestSchema = z.object({
  quoteId: z.string().uuid(),
  action: commercialReviewActionSchema,
  reason: z.string().trim().optional().default(""),
});

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["business", "admin"]);

    const body = reviewQuoteRequestSchema.parse(await request.json());
    if ((body.action === "approve" || body.action === "request_revision") && user.role !== "admin") {
      requireRole(user, ["admin"]);
    }

    const result = await reviewCommercialDocument({
      projectId,
      actorId: user.id,
      documentType: "quote",
      documentId: body.quoteId,
      action: body.action,
      reason: body.reason,
    });

    return Response.json({
      ok: true,
      data: {
        quote: result.document,
        message: result.message,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
