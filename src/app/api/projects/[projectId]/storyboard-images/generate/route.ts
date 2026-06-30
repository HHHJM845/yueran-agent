import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { enqueueStoryboardImageGeneration } from "@/server/use-cases/storyboard-media";

const generateSchema = z.object({
  shotId: z.string().uuid(),
  ratio: z.enum(["16:9", "9:16", "1:1", "4:3", "3:4"]).optional(),
  count: z.union([z.literal(1), z.literal(2), z.literal(4)]).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["creative", "admin"]);

    const body = generateSchema.parse(await request.json());
    const result = await enqueueStoryboardImageGeneration({
      projectId,
      shotId: body.shotId,
      requestedBy: user.id,
      ratio: body.ratio,
      count: body.count,
    });

    return Response.json({ ok: true, data: result }, { status: 202 });
  } catch (error) {
    return jsonError(error);
  }
}
