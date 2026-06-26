import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { enqueueStoryboardVideoGeneration } from "@/server/use-cases/storyboard-media";

const generateSchema = z.object({
  shotId: z.string().uuid(),
  mode: z.enum(["single_image", "start_end_frame", "multi_reference"]).default("single_image"),
  imageIds: z.array(z.string().uuid()).min(1),
});

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["creative", "admin"]);

    const body = generateSchema.parse(await request.json());
    const result = await enqueueStoryboardVideoGeneration({
      projectId,
      shotId: body.shotId,
      mode: body.mode,
      imageIds: body.imageIds,
      requestedBy: user.id,
    });

    return Response.json({ ok: true, data: result }, { status: 202 });
  } catch (error) {
    return jsonError(error);
  }
}
