import { z } from "zod";
import { AppError } from "@/lib/errors";
import {
  createStoryboardImageBatch as createStoryboardImageBatchRecord,
  listStoryboardImageBatches,
  listStoryboardImageVersions,
  type StoryboardImageBatchNumber,
  type StoryboardImageBatchView,
  type StoryboardImageVersionView,
} from "@/server/repositories/storyboard-image-batches";
import { listStoryboardScenes, type StoryboardShotView } from "@/server/repositories/story-production";
import { recordStageProgress } from "@/server/use-cases/stage-progress";

export type { StoryboardImageBatchView, StoryboardImageVersionView };

export const createBatchInputSchema = z.object({
  projectId: z.string().uuid(),
  batchNumber: z.number().int().min(1).optional().nullable(),
  sceneIds: z.array(z.string().uuid()).optional(),
  actorId: z.string().uuid(),
});

export async function createStoryboardImageBatch(input: {
  projectId: string;
  batchNumber?: StoryboardImageBatchNumber | null;
  sceneIds?: string[];
  actorId: string;
}): Promise<StoryboardImageBatchView> {
  const parsed = createBatchInputSchema.parse(input);
  const scenes = await listStoryboardScenes(parsed.projectId);
  const sceneIds = parsed.sceneIds && parsed.sceneIds.length > 0 ? parsed.sceneIds : scenes.map((scene) => scene.id);
  const missingSceneIds = sceneIds.filter((sceneId) => !scenes.some((scene) => scene.id === sceneId));
  if (missingSceneIds.length > 0) {
    throw new AppError({
      status: 422,
      code: "storyboard_batch_scene_not_found",
      userMessage: "批次中包含不存在的场次。请刷新工作台后重新选择场次。",
    });
  }

  const batch = await createStoryboardImageBatchRecord({ ...parsed, sceneIds });
  await recordStageProgress({
    projectId: parsed.projectId,
    stageKey: "storyboard_image_canvas",
    status: "in_progress",
    currentStage: "storyboard_image_canvas",
    projectStatus: "in_progress",
    userMessage: `第 ${batch.batchNumber} 次分镜图片全量提交批次已创建，请确认当前所有图片后提交甲方审核。`,
    inputRefs: sceneIds.map((sceneId) => ({ type: "storyboard_scene", id: sceneId })),
    outputRefs: [{ type: "storyboard_image_batch", id: batch.id }],
    snapshot: {
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      sceneIds: batch.sceneIds,
      itemCount: batch.items.length,
    },
  });
  return batch;
}
export async function getStoryboardImageBatchWorkspace(projectId: string) {
  const [batches, versions] = await Promise.all([
    listStoryboardImageBatches(projectId),
    listStoryboardImageVersions(projectId),
  ]);
  return { storyboardImageBatches: batches, storyboardImageVersions: versions };
}

export function assertAllStoryboardShotsClientApproved(
  shots: Array<Pick<StoryboardShotView, "id" | "shotNumber" | "status">>
): void {
  const notApproved = shots.filter((shot) => shot.status !== "client_approved");
  if (notApproved.length > 0) {
    throw new AppError({
      status: 409,
      code: "storyboard_shots_not_approved",
      userMessage: `仍有 ${notApproved.length} 条分镜图片未通过甲方确认。请根据批注修图后再次全量提交审核。`,
    });
  }
}
