import { z } from "zod";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { callArkResponseJson } from "@/server/providers/ark";
import { createArtifact } from "@/server/repositories/artifacts";
import {
  createOrUpdateScriptPackage,
  createScriptReferenceAssets,
  createStoryboardDraft,
  getScriptDirectionPackage,
  updateScriptDirectionPackageStatus,
} from "@/server/repositories/story-production";
import { createProductionSetupFromStoryboard } from "@/server/use-cases/production-setup";
import { recordStageProgress } from "@/server/use-cases/stage-progress";

const storyboardSplitResponseSchema = z.object({
  scenes: z.array(
    z.object({
      sceneNumber: z.coerce.number().int().positive(),
      title: z.string().min(1),
      description: z.string().default(""),
      shots: z.array(
        z.object({
          shotNumber: z.string().min(1),
          visualDescription: z.string().min(1),
          shotSize: z.string().default(""),
          actionExpression: z.string().default(""),
          cameraMovement: z.string().default(""),
          durationSeconds: z.coerce.number().positive().nullable().optional(),
          soundTransition: z.string().default(""),
          notes: z.string().default(""),
          characterRefs: z.array(z.unknown()).default([]),
          sceneRefs: z.array(z.unknown()).default([]),
          imagePrompt: z.string().default(""),
          videoPrompt: z.string().default(""),
        })
      ),
    })
  ),
});

export async function saveScriptDirectionPackage(input: {
  projectId: string;
  directionId?: string | null;
  title: string;
  concept: string;
  fullScript: string;
  actorId: string;
  characterReferences?: Array<{ title: string; styleLabel?: string; prompt?: string; ossUrl?: string | null }>;
  sceneReferences?: Array<{ title: string; styleLabel?: string; prompt?: string; ossUrl?: string | null }>;
}) {
  const pkg = await createOrUpdateScriptPackage({
    projectId: input.projectId,
    directionId: input.directionId,
    title: input.title,
    concept: input.concept,
    fullScript: input.fullScript,
    actorId: input.actorId,
  });
  const references = await createScriptReferenceAssets({
    projectId: input.projectId,
    packageId: pkg.id,
    actorId: input.actorId,
    references: [
      ...(input.characterReferences ?? []).map((item, index) => ({
        ...item,
        referenceType: "character" as const,
        sortOrder: index,
      })),
      ...(input.sceneReferences ?? []).map((item, index) => ({
        ...item,
        referenceType: "scene" as const,
        sortOrder: index,
      })),
    ],
  });

  await recordStageProgress({
    projectId: input.projectId,
    stageKey: "script_storyboard_confirmation",
    status: "in_progress",
    currentStage: "script_storyboard_confirmation",
    projectStatus: "in_progress",
    userMessage: "脚本创意方向包已保存，人物参考与场景参考会并行挂在该方向下。",
    outputRefs: [{ type: "script_direction_package", id: pkg.id }],
    snapshot: { packageId: pkg.id, referenceCount: references.length },
  });

  return {
    package: pkg,
    references,
    message: "脚本方向包已保存。人物参考图和场景参考图已作为并行参考挂到该方向下。",
  };
}

export async function splitScriptIntoStoryboard(input: {
  projectId: string;
  packageId: string;
  actorId: string;
}) {
  const pkg = await getScriptDirectionPackage({ projectId: input.projectId, packageId: input.packageId });
  if (!pkg) {
    throw new AppError({
      status: 404,
      code: "script_package_not_found",
      userMessage: "没有找到脚本方向包。请先保存完整剧本，再拆分文字分镜。",
    });
  }
  if (!pkg.fullScript.trim()) {
    throw new AppError({
      status: 422,
      code: "script_package_empty_script",
      userMessage: "完整剧本为空，暂时不能拆分文字分镜。请先补全剧本内容。",
    });
  }
  if (!env.ARK_API_KEY) {
    throw new AppError({
      status: 503,
      code: "ark_not_configured",
      userMessage: "豆包文本模型还没有配置，暂时不能自动拆分文字分镜。请配置 ARK_API_KEY 后重试。",
    });
  }

  let storyboard: z.infer<typeof storyboardSplitResponseSchema>;
  try {
    const parsed = await callArkResponseJson<z.infer<typeof storyboardSplitResponseSchema>>({
      model: env.ARK_TEXT_STRUCTURING_MODEL,
      temperature: 0.2,
      maxOutputTokens: 12000,
      timeoutMs: 300_000,
      thinking: "disabled",
      telemetry: {
        projectId: input.projectId,
        callId: "storyboard_split_generation",
        provider: env.TEXT_STRUCTURING_PROVIDER,
        operation: "storyboard_split_generation",
        metadata: { packageId: input.packageId },
      },
      messages: [
        {
          role: "system",
          content:
            "你是广告片导演和分镜师。请把完整剧本拆成结构化文字分镜 JSON，按场次组织。只输出 JSON，不要 Markdown。顶层必须是 {\"scenes\": [...]}。每个 scene 必须包含 sceneNumber,title,description,shots。每条 shot 必须包含 shotNumber,visualDescription,shotSize,actionExpression,cameraMovement,durationSeconds,soundTransition,notes,characterRefs,sceneRefs,imagePrompt,videoPrompt。即使某字段暂无内容，也必须输出空字符串、null 或空数组，不要省略字段。",
        },
        {
          role: "user",
          content: `脚本方向：${pkg.title}\n方向概念：${pkg.concept}\n完整剧本：\n${pkg.fullScript}`,
        },
      ],
    });
    storyboard = storyboardSplitResponseSchema.parse(normalizeStoryboardSplitResponse(parsed));
  } catch (error) {
    const userMessage =
      error instanceof AppError
        ? error.userMessage
        : error instanceof z.ZodError
          ? "豆包已返回文字分镜内容，但结构字段不完整。系统已保存失败状态，请稍后重试或让创作团队先调整剧本文本。"
          : "文字分镜自动拆分失败。系统已保存失败状态，请稍后重试或缩短剧本后再试。";

    await recordStageProgress({
      projectId: input.projectId,
      stageKey: "script_storyboard_confirmation",
      status: "needs_revision",
      currentStage: "script_storyboard_confirmation",
      projectStatus: "needs_revision",
      userMessage,
      errorMessage: userMessage,
      inputRefs: [{ type: "script_direction_package", id: pkg.id }],
      snapshot: { packageId: pkg.id, operation: "storyboard_split_generation" },
    });

    if (error instanceof z.ZodError) {
      throw new AppError({
        status: 502,
        code: "storyboard_split_invalid_schema",
        userMessage,
      });
    }
    throw error;
  }
  const saved = await createStoryboardDraft({
    projectId: input.projectId,
    packageId: pkg.id,
    actorId: input.actorId,
    scenes: storyboard.scenes,
  });
  const artifact = await createArtifact({
    projectId: input.projectId,
    kind: "storyboard_shot_list",
    title: `文字分镜：${pkg.title}`,
    status: "draft",
    data: {
      packageId: pkg.id,
      scenes: saved.scenes,
      shots: saved.shots,
    },
    createdBy: input.actorId,
  });
  const productionSetup = await createProductionSetupFromStoryboard({
    projectId: input.projectId,
    storyboardShots: saved.shots,
    actorId: input.actorId,
  });

  await updateScriptDirectionPackageStatus({
    projectId: input.projectId,
    packageId: pkg.id,
    status: "client_approved",
    actorId: input.actorId,
  });
  await recordStageProgress({
    projectId: input.projectId,
    stageKey: "script_storyboard_confirmation",
    status: "in_progress",
    currentStage: "script_storyboard_confirmation",
    projectStatus: "in_progress",
    userMessage: "文字分镜已拆分并保存，人物和场景设定已生成，等待提交甲方审核后再进入分镜图片阶段。",
    inputRefs: [{ type: "script_direction_package", id: pkg.id }],
    outputRefs: [
      { type: "artifact", id: artifact.id, kind: artifact.kind },
      ...productionSetup.entities.map((entity) => ({ type: "production_entity", id: entity.id })),
    ],
    snapshot: {
      packageId: pkg.id,
      sceneCount: saved.scenes.length,
      shotCount: saved.shots.length,
      productionEntityCount: productionSetup.entities.length,
      productionReferenceSetCount: productionSetup.referenceSets.length,
    },
  });

  return {
    ...saved,
    artifact,
    productionEntities: productionSetup.entities,
    productionReferenceSets: productionSetup.referenceSets,
    message: "文字分镜已自动拆分并保存。人物和场景设定已生成，请先提交甲方审核，通过后再进入分镜图片阶段。",
  };
}

function normalizeStoryboardSplitResponse(value: unknown) {
  const record = asRecord(value);
  const rawScenes =
    asArray(record.scenes) ??
    asArray(record.storyboardScenes) ??
    asArray(record.storyboard_scenes) ??
    asArray(record.分镜场次) ??
    asArray(record.场次) ??
    [];

  return {
    scenes: rawScenes.map((scene, sceneIndex) => {
      const sceneRecord = asRecord(scene);
      const rawShots =
        asArray(sceneRecord.shots) ??
        asArray(sceneRecord.storyboardShots) ??
        asArray(sceneRecord.storyboard_shots) ??
        asArray(sceneRecord.分镜) ??
        asArray(sceneRecord.镜头) ??
        [];
      return {
        sceneNumber: firstValue(sceneRecord.sceneNumber, sceneRecord.scene_number, sceneRecord.number, sceneRecord.场次编号, sceneIndex + 1),
        title: firstString(sceneRecord.title, sceneRecord.name, sceneRecord.标题, sceneRecord.场次标题) ?? `场次 ${sceneIndex + 1}`,
        description: firstString(sceneRecord.description, sceneRecord.desc, sceneRecord.场次描述, sceneRecord.描述) ?? "",
        shots: rawShots.map((shot, shotIndex) => {
          const shotRecord = asRecord(shot);
          const shotNumber =
            firstString(shotRecord.shotNumber, shotRecord.shot_number, shotRecord.number, shotRecord.分镜编号, shotRecord.镜号) ??
            `${sceneIndex + 1}-${shotIndex + 1}`;
          const visualDescription =
            firstString(
              shotRecord.visualDescription,
              shotRecord.visual_description,
              shotRecord.picture,
              shotRecord.frame,
              shotRecord.画面内容,
              shotRecord.画面描述,
              shotRecord.description,
              shotRecord.desc
            ) ?? `分镜 ${shotNumber}`;
          return {
            shotNumber,
            visualDescription,
            shotSize: firstString(shotRecord.shotSize, shotRecord.shot_size, shotRecord.景别) ?? "",
            actionExpression:
              firstString(shotRecord.actionExpression, shotRecord.action_expression, shotRecord.action, shotRecord.动作与表情) ?? "",
            cameraMovement:
              firstString(shotRecord.cameraMovement, shotRecord.camera_movement, shotRecord.camera, shotRecord.机位与运镜) ?? "",
            durationSeconds: normalizeDuration(firstValue(shotRecord.durationSeconds, shotRecord.duration_seconds, shotRecord.duration, shotRecord.时长)),
            soundTransition:
              firstString(shotRecord.soundTransition, shotRecord.sound_transition, shotRecord.sound, shotRecord.声音与转场) ?? "",
            notes: firstString(shotRecord.notes, shotRecord.remark, shotRecord.备注) ?? "",
            characterRefs: normalizeArray(shotRecord.characterRefs, shotRecord.character_refs, shotRecord.characters, shotRecord.涉及人物),
            sceneRefs: normalizeArray(shotRecord.sceneRefs, shotRecord.scene_refs, shotRecord.scenes, shotRecord.涉及场景),
            imagePrompt: firstString(shotRecord.imagePrompt, shotRecord.image_prompt, shotRecord.prompt, shotRecord.图片Prompt) ?? "",
            videoPrompt: firstString(shotRecord.videoPrompt, shotRecord.video_prompt, shotRecord.video, shotRecord.视频Prompt) ?? "",
          };
        }),
      };
    }),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : null;
}

function firstValue(...values: unknown[]) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function firstString(...values: unknown[]) {
  const value = firstValue(...values);
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function normalizeDuration(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.]+/g, ""));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function normalizeArray(...values: unknown[]) {
  const value = firstValue(...values);
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}
