import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { listStoryboardImageBatches } from "@/server/repositories/storyboard-image-batches";
import { createStoryboardImageBatch } from "@/server/use-cases/storyboard-image-batches";

const createBatchSchema = z.object({
  batchNumber: z.number().int().min(1).optional().nullable(),
  sceneIds: z.array(z.string().uuid()).optional(),
});

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    const batches = await listStoryboardImageBatches(projectId);
    return Response.json({ ok: true, data: { storyboardImageBatches: batches } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["creative", "admin"]);
    const input = createBatchSchema.parse(await request.json());
    const batch = await createStoryboardImageBatch({
      projectId,
      batchNumber: input.batchNumber ?? null,
      sceneIds: input.sceneIds,
      actorId: user.id,
    });
    return Response.json({
      ok: true,
      data: {
        batch,
        message: `第 ${batch.batchNumber} 次分镜图片全量提交批次已创建，请确认当前图片后提交甲方审核。`,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
