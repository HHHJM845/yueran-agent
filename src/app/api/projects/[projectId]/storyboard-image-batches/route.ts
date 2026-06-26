import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { listStoryboardImageBatches } from "@/server/repositories/storyboard-image-batches";
import { createStoryboardImageBatch } from "@/server/use-cases/storyboard-image-batches";

const createBatchSchema = z.object({
  batchNumber: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  sceneIds: z.array(z.string().uuid()).min(1, "请至少选择一个场次。"),
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
      batchNumber: input.batchNumber,
      sceneIds: input.sceneIds,
      actorId: user.id,
    });
    return Response.json({
      ok: true,
      data: {
        batch,
        message: `第 ${batch.batchNumber} 批分镜图片已创建，请确认本批正式图片后提交甲方审核。`,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
