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
import { listStoryboardScenes } from "@/server/repositories/story-production";
import { recordStageProgress } from "@/server/use-cases/stage-progress";

export type { StoryboardImageBatchView, StoryboardImageVersionView };

const createBatchInputSchema = z.object({
  projectId: z.string().uuid(),
  batchNumber: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  sceneIds: z.array(z.string().uuid()).min(1, "请至少选择一个场次分配到该批次。"),
  actorId: z.string().uuid(),
});

export async function createStoryboardImageBatch(input: {
  projectId: string;
  batchNumber: StoryboardImageBatchNumber;
  sceneIds: string[];
  actorId: string;
}): Promise<StoryboardImageBatchView> {
  const parsed = createBatchInputSchema.parse(input);
  const scenes = await listStoryboardScenes(parsed.projectId);
  const missingSceneIds = parsed.sceneIds.filter((sceneId) => !scenes.some((scene) => scene.id === sceneId));
  if (missingSceneIds.length > 0) {
    throw new AppError({
      status: 422,
      code: "storyboard_batch_scene_not_found",
      userMessage: "批次中包含不存在的场次。请刷新工作台后重新选择场次。",
    });
  }

  const batch = await createStoryboardImageBatchRecord(parsed);
  await recordStageProgress({
    projectId: parsed.projectId,
    stageKey: "storyboard_image_canvas",
    status: "in_progress",
    currentStage: "storyboard_image_canvas",
    projectStatus: "in_progress",
    userMessage: `第 ${parsed.batchNumber} 批分镜图片已创建，请确认本批所有正式图片后提交甲方审核。`,
    inputRefs: parsed.sceneIds.map((sceneId) => ({ type: "storyboard_scene", id: sceneId })),
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

export function assertAllStoryboardImageBatchesApproved(batches: Array<Pick<StoryboardImageBatchView, "batchNumber" | "status">>): void {
  const approvedNumbers = new Set(
    batches
      .filter((batch) => batch.status === "client_approved")
      .map((batch) => batch.batchNumber)
  );
  if (![1, 2, 3].every((batchNumber) => approvedNumbers.has(batchNumber as StoryboardImageBatchNumber))) {
    throw new AppError({
      status: 409,
      code: "storyboard_image_batches_not_approved",
      userMessage: "三批分镜图片尚未全部确认。请等待剩余批次完成甲方审核后再进入视频画布。",
    });
  }
}
