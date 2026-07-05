import { z } from "zod";
import { AppError } from "@/lib/errors";
import {
  createStoryboardShot,
  deleteStoryboardShotIfUnused,
  getStoryboardShot,
  listStoryboardShots,
  updateStoryboardShotContent,
  updateStoryboardShotOrder,
  updateStoryboardShotsStatus,
  type StoryboardShotView,
} from "@/server/repositories/story-production";
import { createProductionSetupFromStoryboard } from "@/server/use-cases/production-setup";
import { recordStageProgress } from "@/server/use-cases/stage-progress";

export const storyboardSequenceShotSchema = z.object({
  id: z.string().uuid().optional(),
  shotNumber: z.string().trim().min(1, "镜号不能为空。"),
  visualDescription: z.string().trim().min(1, "分镜内容不能为空。"),
  shotSize: z.string().optional().default(""),
  actionExpression: z.string().optional().default(""),
  cameraMovement: z.string().optional().default(""),
  durationSeconds: z.coerce.number().positive().nullable().optional(),
  soundTransition: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  characterRefs: z.array(z.unknown()).optional().default([]),
  sceneRefs: z.array(z.unknown()).optional().default([]),
  imagePrompt: z.string().optional().default(""),
  videoPrompt: z.string().optional().default(""),
});

export async function saveStoryboardSequence(input: {
  projectId: string;
  sceneId: string;
  shots: Array<z.infer<typeof storyboardSequenceShotSchema>>;
  deletedShotIds?: string[];
  actorId: string;
}) {
  if (input.shots.length === 0) {
    throw new AppError({
      status: 422,
      code: "storyboard_sequence_empty",
      userMessage: "每个场次至少需要保留一条分镜。",
    });
  }

  const currentProjectShots = await listStoryboardShots(input.projectId);
  const currentSceneShots = currentProjectShots.filter((shot) => shot.sceneId === input.sceneId);
  if (currentSceneShots.length === 0) {
    throw new AppError({
      status: 404,
      code: "storyboard_scene_not_found",
      userMessage: "没有找到这个场次的分镜。请刷新工作台后再编辑。",
    });
  }
  const currentShotIds = new Set(currentSceneShots.map((shot) => shot.id));
  const seenShotIds = new Set<string>();
  const savedShots: StoryboardShotView[] = [];
  const packageId = currentSceneShots[0]?.packageId ?? null;

  for (const [index, shot] of input.shots.entries()) {
    const sortOrder = index;
    if (shot.id) {
      if (!currentShotIds.has(shot.id)) {
        throw new AppError({
          status: 422,
          code: "storyboard_shot_not_in_scene",
          userMessage: "有一条分镜不属于当前场次。请刷新后重新编辑。",
        });
      }
      if (seenShotIds.has(shot.id)) {
        throw new AppError({
          status: 422,
          code: "storyboard_shot_duplicate",
          userMessage: "同一条分镜被重复提交。请刷新后重新编辑。",
        });
      }
      seenShotIds.add(shot.id);
      await assertStoryboardShotEditable({ projectId: input.projectId, shotId: shot.id });
      const updated = await updateStoryboardShotContent({
        projectId: input.projectId,
        shotId: shot.id,
        sceneId: input.sceneId,
        shotNumber: shot.shotNumber,
        visualDescription: shot.visualDescription,
        shotSize: shot.shotSize,
        actionExpression: shot.actionExpression,
        cameraMovement: shot.cameraMovement,
        durationSeconds: shot.durationSeconds ?? null,
        soundTransition: shot.soundTransition,
        notes: shot.notes,
        characterRefs: shot.characterRefs,
        sceneRefs: shot.sceneRefs,
        imagePrompt: shot.imagePrompt,
        videoPrompt: shot.videoPrompt,
        sortOrder,
        actorId: input.actorId,
      });
      if (updated) savedShots.push(updated);
    } else {
      savedShots.push(
        await createStoryboardShot({
          projectId: input.projectId,
          sceneId: input.sceneId,
          packageId,
          shotNumber: shot.shotNumber,
          visualDescription: shot.visualDescription,
          shotSize: shot.shotSize,
          actionExpression: shot.actionExpression,
          cameraMovement: shot.cameraMovement,
          durationSeconds: shot.durationSeconds ?? null,
          soundTransition: shot.soundTransition,
          notes: shot.notes,
          characterRefs: shot.characterRefs,
          sceneRefs: shot.sceneRefs,
          imagePrompt: shot.imagePrompt,
          videoPrompt: shot.videoPrompt,
          sortOrder,
          actorId: input.actorId,
        })
      );
    }
  }

  for (const deletedShotId of input.deletedShotIds ?? []) {
    if (!currentShotIds.has(deletedShotId)) continue;
    if (seenShotIds.has(deletedShotId)) continue;
    await deleteStoryboardShotIfUnused({
      projectId: input.projectId,
      shotId: deletedShotId,
      actorId: input.actorId,
    });
  }

  for (const [index, shot] of savedShots.entries()) {
    if (shot.sortOrder === index && shot.sceneId === input.sceneId) continue;
    await updateStoryboardShotOrder({
      projectId: input.projectId,
      shotId: shot.id,
      sceneId: input.sceneId,
      sortOrder: index,
      actorId: input.actorId,
    });
  }

  const refreshedShots = await listStoryboardShots(input.projectId);
  const productionSetup = await createProductionSetupFromStoryboard({
    projectId: input.projectId,
    storyboardShots: refreshedShots,
    actorId: input.actorId,
  });

  await recordStageProgress({
    projectId: input.projectId,
    stageKey: "script_storyboard_confirmation",
    status: "in_progress",
    currentStage: "script_storyboard_confirmation",
    projectStatus: "in_progress",
    userMessage: "文字分镜序列已保存，人物和场景设定清单已同步更新。",
    inputRefs: [{ type: "storyboard_scene", id: input.sceneId }],
    outputRefs: [
      ...savedShots.map((shot) => ({ type: "storyboard_shot", id: shot.id })),
      ...productionSetup.entities.map((entity) => ({ type: "production_entity", id: entity.id })),
    ],
    snapshot: {
      sceneId: input.sceneId,
      shotCount: refreshedShots.filter((shot) => shot.sceneId === input.sceneId).length,
      productionEntityCount: productionSetup.entities.length,
      status: "draft",
    },
  });

  const savedSceneShots = refreshedShots.filter((shot) => shot.sceneId === input.sceneId);
  return {
    shots: savedSceneShots,
    productionEntities: productionSetup.entities,
    productionReferenceSets: productionSetup.referenceSets,
    message: "分镜序列已保存，人物和场景设定清单已同步更新。",
  };
}

export async function confirmStoryboardSequence(input: { projectId: string; actorId: string }) {
  const storyboardShots = await listStoryboardShots(input.projectId);
  if (storyboardShots.length === 0) {
    throw new AppError({
      status: 422,
      code: "storyboard_sequence_empty",
      userMessage: "请先拆分文字分镜，再确认文字分镜。",
    });
  }

  const productionSetup = await createProductionSetupFromStoryboard({
    projectId: input.projectId,
    storyboardShots,
    actorId: input.actorId,
  });
  const shots = await updateStoryboardShotsStatus({
    projectId: input.projectId,
    status: "internal_review",
    actorId: input.actorId,
  });

  await recordStageProgress({
    projectId: input.projectId,
    stageKey: "script_storyboard_confirmation",
    status: "in_progress",
    currentStage: "script_storyboard_confirmation",
    projectStatus: "in_progress",
    userMessage: "文字分镜已确认，人物和场景设定清单已按最终分镜同步。请继续确认人物和场景设定。",
    outputRefs: [
      ...shots.map((shot) => ({ type: "storyboard_shot", id: shot.id })),
      ...productionSetup.entities.map((entity) => ({ type: "production_entity", id: entity.id })),
    ],
    snapshot: {
      shotCount: shots.length,
      productionEntityCount: productionSetup.entities.length,
      productionReferenceSetCount: productionSetup.referenceSets.length,
    },
  });

  return {
    shots,
    productionEntities: productionSetup.entities,
    productionReferenceSets: productionSetup.referenceSets,
    message: "文字分镜已确认，人物和场景设定清单已同步更新。",
  };
}

export async function assertStoryboardShotEditable(input: { projectId: string; shotId: string }) {
  const shot = await getStoryboardShot(input);
  if (!shot) {
    throw new AppError({
      status: 404,
      code: "storyboard_shot_not_found",
      userMessage: "没有找到这条分镜。请刷新后重新编辑。",
    });
  }
  if (shot.status === "locked" || shot.status === "client_approved" || shot.status === "image_selected" || shot.status === "video_selected") {
    throw new AppError({
      status: 422,
      code: "storyboard_shot_locked",
      userMessage: "这条分镜已经进入确认或生产状态，不能直接编辑。请先走需求变更流程。",
    });
  }
  return shot;
}
