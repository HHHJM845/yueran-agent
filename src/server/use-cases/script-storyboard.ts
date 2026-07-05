import { z } from "zod";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { assertSpeechTranscriptionReady } from "@/server/providers/ai";
import { callArkResponseJson, transcribeArkAudio } from "@/server/providers/ark";
import { createArtifact } from "@/server/repositories/artifacts";
import { listProjectAssetAnalyses } from "@/server/repositories/asset-analyses";
import { listProjectAssets } from "@/server/repositories/assets";
import { getProjectContract } from "@/server/repositories/contracts";
import { listCreativeProposalRounds } from "@/server/repositories/creative-proposals";
import type { CreativeProposalRoundView } from "@/server/repositories/creative-proposals";
import { listProjectCreativeDirections } from "@/server/repositories/creative-directions";
import { listProjectCreativeExpansions } from "@/server/repositories/creative-expansions";
import { getProjectDeliveryChecklist } from "@/server/repositories/delivery-checklists";
import { getProjectById } from "@/server/repositories/projects";
import { getProjectProposal } from "@/server/repositories/proposals";
import { getProjectQuote } from "@/server/repositories/quotes";
import {
  appendScriptRevisionMessage,
  createOrUpdateScriptPackage,
  createScriptPackageWithPlainScript,
  createScriptReferenceAssets,
  createStoryboardDraft,
  getScriptDirectionPackage,
  listScriptRevisionMessages,
  updateScriptPackagePlainAndFullScript,
  updateScriptPackageStandardizedAndFullScript,
  type ScriptDirectionPackageView,
  type ScriptRevisionInputMode,
} from "@/server/repositories/story-production";
import { createProductionSetupFromStoryboard } from "@/server/use-cases/production-setup";
import { validateStandardScriptFormat } from "@/server/use-cases/script-standardization";
import { normalizeStoryboardSplitResponse } from "@/server/use-cases/script-storyboard-normalization";
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

const requiredAiTextFieldSchema = z.preprocess(
  normalizeAiTextField,
  z.string().trim().min(1)
);
const optionalAiTextFieldSchema = z.preprocess(
  normalizeAiTextField,
  z.string().trim().min(1).optional()
);

const scriptGenerationResponseSchema = z.object({
  title: optionalAiTextFieldSchema,
  concept: optionalAiTextFieldSchema,
  script: requiredAiTextFieldSchema,
});

const scriptGenerationAliasFieldsSchema = z.object({
  title: optionalAiTextFieldSchema,
  concept: optionalAiTextFieldSchema,
  script: optionalAiTextFieldSchema,
  standardizedScript: optionalAiTextFieldSchema,
  plainScript: optionalAiTextFieldSchema,
  fullScript: optionalAiTextFieldSchema,
});

const flexibleScriptGenerationResponseSchema = z.preprocess((raw) => {
  const parsed = scriptGenerationAliasFieldsSchema.safeParse(raw);
  if (!parsed.success) return raw;
  return {
    title: parsed.data.title,
    concept: parsed.data.concept,
    script: parsed.data.script ?? parsed.data.standardizedScript ?? parsed.data.plainScript ?? parsed.data.fullScript,
  };
}, scriptGenerationResponseSchema);

const revisionInputModeSchema = z.enum(["text", "voice"]);
const MAX_SCRIPT_REVISION_AUDIO_BYTES = 12 * 1024 * 1024;
const STANDARDIZATION_PLAIN_SCRIPT_MAX_CHARS = 14000;
export const STANDARD_SCRIPT_FORMAT_SPEC = `标准剧本格式规范（必须严格遵守，逐条对齐）：
一、前置内容（置于最顶部，各占独立行）
1. 剧名：单独一行，且整行只有书名号包裹的剧名，例如：《重生之还是她》。
2. 剧情简介：以“剧情简介：”开头，1–3 句概括核心创意。
3. 人物小传：以“人物小传：”开头，列出主要人物及简要背景。
二、正文（按集、按场组织）
4. 集数：每集开头单独成行，例如“第一集”或“第 1 集”。
5. 场次行：单独一行，采用“集-场”唯一编号，并在同一行包含地点、时间（日/夜）、内外景（内/外），三要素齐全，顺序不限。例如：1-1 江边广场 日 外。
6. 人物：每场紧跟场次行，用单独一行“人物：”列出该场出场人物，以顿号或逗号分隔。例如：人物：小帅、小美。
7. 画面：描述视觉画面与人物动作，每段独立成行，以 △ 开头引导。
8. 台词：格式为“人名（情绪）：台词内容”，情绪可省略但“人名：”必填。例如：小帅（开心）：没想到在这里遇见了你。
三、专用符号
- △：画面动作/神态描述引导，置于该行开头。
- VO：画外音（只有声音、人物不出镜），单独成行“VO：……”。
- OS/（独白）：角色内心独白，用“人名（独白）：……”表达。
- 【闪回】/【闪出】：标记回忆/梦境的开始与结束，必须成对、先闪回后闪出。
四、合规示例（请按此结构与符号产出）
《镜头下的危机》
剧情简介：外科医生许轻言生活规律，一场意外将她卷入始料未及的风波。
人物小传：许轻言，外科医生，冷静、生活规律。
第一集
1-1 医院办公室 日 内
人物：许轻言
△许轻言身穿白大褂，专注地看着电脑屏幕，四周是忙碌的医院办公室。
VO：许医生，3 床的病人术后有点发烧。
许轻言（冷静）：物理降温，观察两小时，我马上过去。
△快剪蒙太奇：许医生查房、坐诊、下班健身、回家看书、睡觉，生活极其规律单调。
许轻言（独白）：如果时光倒流，我绝不会相信我会卷入那样的事。那时的我，只是芸芸众生中最普通的一个。`;

function normalizeAiTextField(value: unknown): unknown {
  if (value == null) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => normalizeAiTextField(item))
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    return parts.length > 0 ? parts.join("\n") : undefined;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["text", "content", "value", "script", "standardizedScript", "plainScript", "fullScript", "title", "concept"]) {
      const normalized = normalizeAiTextField(record[key]);
      if (typeof normalized === "string" && normalized.trim()) return normalized;
    }
    return JSON.stringify(value, null, 2);
  }
  return value;
}

type ScriptGenerationContext = Awaited<ReturnType<typeof collectScriptGenerationContext>>;
type ScriptGenerationReadyContext = ScriptGenerationContext & { finalRound: CreativeProposalRoundView };

export async function generatePlainScriptPackage(input: {
  projectId: string;
  actorId: string;
}): Promise<{ package: ScriptDirectionPackageView; message: string }> {
  try {
    ensureArkConfigured("豆包文本模型还没有配置，暂时不能自动生成朴素剧本。请配置 ARK_API_KEY 后重试。");
    const context = await collectScriptGenerationContext(input.projectId);
    assertScriptGenerationContext(context);
    const parsed = scriptGenerationResponseSchema.parse(
      await callArkResponseJson({
        model: env.ARK_TEXT_STRUCTURING_MODEL,
        temperature: 0.2,
        maxOutputTokens: 9000,
        timeoutMs: 240_000,
        thinking: "disabled",
        telemetry: {
          projectId: input.projectId,
          callId: "plain_script_generation",
          provider: env.TEXT_STRUCTURING_PROVIDER,
          operation: "plain_script_generation",
          metadata: buildScriptGenerationTelemetryMetadata(context),
        },
        messages: [
          {
            role: "system",
            content:
              "你是内部 AIGC 视频项目的编剧。只基于当前项目工作台输入生成大白话剧本，不使用任何跨项目知识库。只输出严格 JSON：{ title, concept, script }。script 必须像小说或导演口述故事，适合人工继续读和提修改意见。不要写成标准剧本格式，不要使用“场次、内外、日夜、人物、画面、台词”这些字段标题，不要使用三角形、星号或分镜编号。",
          },
          { role: "user", content: buildPlainScriptPrompt(context) },
        ],
      })
    );

    const title = parsed.title?.trim() || `${context.project.brandName}${context.project.projectName} 朴素剧本`.trim();
    const concept = parsed.concept?.trim() || "基于已确认创意提案生成的朴素剧本草稿。";
    const savedPackage = await createScriptPackageWithPlainScript({
      projectId: input.projectId,
      directionId: context.selectedDirectionId,
      title,
      concept,
      plainScript: parsed.script,
      actorId: input.actorId,
    });

    await recordStageProgress({
      projectId: input.projectId,
      stageKey: "script_storyboard_confirmation",
      status: "in_progress",
      currentStage: "script_storyboard_confirmation",
      projectStatus: "in_progress",
      userMessage: "朴素剧本已基于最终创意提案和当前项目资料生成，请在脚本页签内继续修订或转成标准剧本。",
      inputRefs: buildScriptGenerationInputRefs(context),
      outputRefs: [{ type: "script_direction_package", id: savedPackage.id }],
      snapshot: { packageId: savedPackage.id, operation: "plain_script_generation" },
    });

    return {
      package: savedPackage,
      message: "朴素剧本已生成并保存。请人工检查内容，再继续修订或转成标准剧本。",
    };
  } catch (error) {
    await recordScriptGenerationFailure(input.projectId, error, "plain_script_generation");
    throw error;
  }
}

export async function revisePlainScriptPackage(input: {
  projectId: string;
  packageId: string;
  instruction: string;
  inputMode: ScriptRevisionInputMode;
  actorId: string;
}): Promise<{ package: ScriptDirectionPackageView; message: string }> {
  try {
    const instruction = input.instruction.trim();
    const inputMode = revisionInputModeSchema.parse(input.inputMode);
    if (!instruction) {
      throw new AppError({
        status: 400,
        code: "script_revision_instruction_required",
        userMessage: "请先输入本轮修改意见，再提交脚本修订。",
      });
    }
    ensureArkConfigured("豆包文本模型还没有配置，暂时不能自动修订朴素剧本。请配置 ARK_API_KEY 后重试。");

    const context = await collectScriptGenerationContext(input.projectId);
    assertScriptGenerationContext(context);
    const pkg = await getScriptDirectionPackage({ projectId: input.projectId, packageId: input.packageId });
    if (!pkg) {
      throw new AppError({
        status: 404,
        code: "script_package_not_found",
        userMessage: "没有找到可修订的脚本包。请刷新项目后重试。",
      });
    }
    const currentScript = (pkg.plainScript || pkg.fullScript).trim();
    if (!currentScript) {
      throw new AppError({
        status: 422,
        code: "plain_script_required",
        userMessage: "当前脚本包还没有朴素剧本，不能直接修订。请先生成朴素剧本。",
      });
    }

    await appendScriptRevisionMessage({
      projectId: input.projectId,
      packageId: input.packageId,
      role: "user",
      inputMode,
      content: instruction,
      actorId: input.actorId,
    });
    const messages = (await listScriptRevisionMessages(input.projectId)).filter((message) => message.packageId === input.packageId).slice(-12);
    const parsed = scriptGenerationResponseSchema.parse(
      await callArkResponseJson({
        model: env.ARK_TEXT_STRUCTURING_MODEL,
        temperature: 0.15,
        maxOutputTokens: 9000,
        timeoutMs: 240_000,
        thinking: "disabled",
        telemetry: {
          projectId: input.projectId,
          callId: "plain_script_revision",
          provider: env.TEXT_STRUCTURING_PROVIDER,
          operation: "plain_script_revision",
          metadata: { packageId: input.packageId, revisionMessageCount: messages.length },
        },
        messages: [
          {
            role: "system",
            content:
              "你是内部 AIGC 视频项目的编剧。请只基于当前脚本和本项目修订意见改写大白话剧本，不引入跨项目知识。只输出严格 JSON：{ title, concept, script }。保留未要求删除的关键信息，修订后脚本必须完整可读，并继续保持小说或导演口述故事的自然叙述。不要写成标准剧本格式，不要使用“场次、内外、日夜、人物、画面、台词”这些字段标题，不要使用三角形、星号或分镜编号。",
          },
          {
            role: "user",
            content: buildRevisionPrompt({
              context,
              pkg,
              currentScript,
              messages,
              instruction,
            }),
          },
        ],
      })
    );

    const savedPackage = await updateScriptPackagePlainAndFullScript({
      projectId: input.projectId,
      packageId: input.packageId,
      plainScript: parsed.script,
      title: parsed.title ?? pkg.title,
      concept: parsed.concept ?? pkg.concept,
      status: "draft",
      actorId: input.actorId,
    });
    if (!savedPackage) {
      throw new AppError({
        status: 404,
        code: "script_package_not_found",
        userMessage: "脚本修订保存失败：没有找到可更新的脚本包。请刷新后重试。",
      });
    }

    await appendScriptRevisionMessage({
      projectId: input.projectId,
      packageId: input.packageId,
      role: "assistant",
      inputMode: "text",
      content: parsed.script,
      actorId: input.actorId,
    });
    await recordStageProgress({
      projectId: input.projectId,
      stageKey: "script_storyboard_confirmation",
      status: "in_progress",
      currentStage: "script_storyboard_confirmation",
      projectStatus: "in_progress",
      userMessage: "朴素剧本已按修改意见更新。你可以继续修订，或确认后转成标准剧本。",
      inputRefs: [{ type: "script_direction_package", id: input.packageId }],
      outputRefs: [{ type: "script_direction_package", id: savedPackage.id }],
      snapshot: { packageId: savedPackage.id, operation: "plain_script_revision", inputMode },
    });

    return { package: savedPackage, message: "朴素剧本已修订并保存。" };
  } catch (error) {
    await recordScriptGenerationFailure(input.projectId, error, "plain_script_revision", input.packageId);
    throw error;
  }
}

export async function transcribeScriptRevisionAudio(input: {
  projectId: string;
  audio: Buffer;
  mimeType: string;
  actorId: string;
}) {
  if (input.audio.length > MAX_SCRIPT_REVISION_AUDIO_BYTES) {
    throw new AppError({
      status: 413,
      code: "script_revision_audio_too_large",
      userMessage: "这段语音太长了。请控制在一分钟左右，或分几次录入修改意见。",
    });
  }

  const config = assertSpeechTranscriptionReady();
  const transcript = await transcribeArkAudio({
    model: config.model,
    audio: input.audio,
    mimeType: input.mimeType,
    timeoutMs: 90_000,
    telemetry: {
      projectId: input.projectId,
      callId: `script-revision-speech-${Date.now()}`,
      provider: config.provider,
      operation: "script_revision_speech_transcription",
      metadata: {
        actorId: input.actorId,
        audioBytes: input.audio.length,
        mimeType: input.mimeType,
      },
    },
  });

  return {
    transcript,
    message: "语音已转成文字，请确认后提交修订。",
  };
}

export async function generateStandardizedScriptFromPlain(input: {
  projectId: string;
  packageId: string;
  actorId: string;
}): Promise<{ package: ScriptDirectionPackageView; message: string }> {
  try {
    ensureArkConfigured("豆包文本模型还没有配置，暂时不能把朴素剧本整理成标准剧本。请配置 ARK_API_KEY 后重试。");
    const context = await collectScriptGenerationContext(input.projectId);
    assertScriptGenerationContext(context);
    const pkg = await getScriptDirectionPackage({ projectId: input.projectId, packageId: input.packageId });
    if (!pkg) {
      throw new AppError({
        status: 404,
        code: "script_package_not_found",
        userMessage: "没有找到可标准化的脚本包。请刷新项目后重试。",
      });
    }
    const plainScript = pkg.plainScript.trim();
    if (!plainScript) {
      throw new AppError({
        status: 422,
        code: "plain_script_required",
        userMessage: "当前脚本包还没有朴素剧本，暂时不能生成标准剧本。请先生成或保存朴素剧本。",
      });
    }

    const parsed = flexibleScriptGenerationResponseSchema.parse(
      await callArkResponseJson({
        model: env.ARK_TEXT_STRUCTURING_MODEL,
        temperature: 0.1,
        maxOutputTokens: 12000,
        timeoutMs: 300_000,
        thinking: "disabled",
        telemetry: {
          projectId: input.projectId,
          callId: "standardized_script_from_plain",
          provider: env.TEXT_STRUCTURING_PROVIDER,
          operation: "standardized_script_from_plain",
          metadata: { packageId: input.packageId },
        },
        messages: [
          {
            role: "system",
            content:
              "你是影视广告标准剧本格式编辑。严格按给定“标准剧本格式规范”整理，只输出严格 JSON {title, concept, script}。其中 script 必须是【从一行 《剧名》 开始】的完整标准剧本纯文本，包含剧情简介、人物小传、集数、场次、每场人物/画面/台词，每场必须至少有一行“人名（情绪）：台词”或“VO：...”格式的台词行，行与行之间用 \\n 分隔；title 为不含书名号的剧名，concept 为一句话剧情简介。",
          },
          { role: "user", content: buildStandardizationPrompt({ context, pkg, plainScript }) },
        ],
      })
    );

    const savedPackage = await updateScriptPackageStandardizedAndFullScript({
      projectId: input.projectId,
      packageId: input.packageId,
      standardizedScript: parsed.script,
      title: parsed.title ?? pkg.title,
      concept: parsed.concept ?? pkg.concept,
      status: "internal_review",
      actorId: input.actorId,
    });
    if (!savedPackage) {
      throw new AppError({
        status: 404,
        code: "script_package_not_found",
        userMessage: "标准剧本保存失败：没有找到可更新的脚本包。请刷新后重试。",
      });
    }

    await recordStageProgress({
      projectId: input.projectId,
      stageKey: "script_storyboard_confirmation",
      status: "in_progress",
      currentStage: "script_storyboard_confirmation",
      projectStatus: "in_progress",
      userMessage: "标准剧本已根据朴素剧本生成并保存，请人工检查格式后再提交甲方确认。",
      inputRefs: [{ type: "script_direction_package", id: input.packageId }],
      outputRefs: [{ type: "script_direction_package", id: savedPackage.id }],
      snapshot: { packageId: savedPackage.id, operation: "standardized_script_from_plain" },
    });

    return { package: savedPackage, message: "标准剧本已生成并保存。" };
  } catch (error) {
    await recordScriptGenerationFailure(input.projectId, error, "standardized_script_from_plain", input.packageId);
    throw error;
  }
}

export async function saveStandardizedScriptEdit(input: {
  projectId: string;
  packageId: string;
  standardizedScript: string;
  actorId: string;
}): Promise<{ package: ScriptDirectionPackageView; message: string }> {
  try {
    const standardizedScript = input.standardizedScript.trim();
    if (!standardizedScript) {
      throw new AppError({
        status: 400,
        code: "standardized_script_required",
        userMessage: "标准剧本内容不能为空。请补充后再保存。",
      });
    }
    const savedPackage = await updateScriptPackageStandardizedAndFullScript({
      projectId: input.projectId,
      packageId: input.packageId,
      standardizedScript,
      status: "internal_review",
      actorId: input.actorId,
    });
    if (!savedPackage) {
      throw new AppError({
        status: 404,
        code: "script_package_not_found",
        userMessage: "没有找到可保存的脚本包。请刷新项目后重试。",
      });
    }

    await recordStageProgress({
      projectId: input.projectId,
      stageKey: "script_storyboard_confirmation",
      status: "in_progress",
      currentStage: "script_storyboard_confirmation",
      projectStatus: "in_progress",
      userMessage: "标准剧本修改已保存。请确认无误后再进入甲方确认或文字分镜拆分。",
      inputRefs: [{ type: "script_direction_package", id: input.packageId }],
      outputRefs: [{ type: "script_direction_package", id: savedPackage.id }],
      snapshot: { packageId: savedPackage.id, operation: "standardized_script_manual_edit" },
    });

    return { package: savedPackage, message: "标准剧本修改已保存。" };
  } catch (error) {
    await recordScriptGenerationFailure(input.projectId, error, "standardized_script_manual_edit", input.packageId);
    throw error;
  }
}

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
    userMessage: "完整剧本已保存。请继续确认剧本格式，确认后再抽取人物和场景清单并生成设定图。",
    outputRefs: [{ type: "script_direction_package", id: pkg.id }],
    snapshot: { packageId: pkg.id, referenceCount: references.length },
  });

  return {
    package: pkg,
    references,
    message: "完整剧本已保存。下一步请确认格式并抽取人物、场景清单。",
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
      userMessage: "没有找到完整剧本记录。请先保存完整剧本，再拆分文字分镜。",
    });
  }
  const storyboardSourceScript = resolveStoryboardSplitSourceScript(pkg);
  assertStandardizedScriptReadyForStoryboard(storyboardSourceScript);

  let storyboard: z.infer<typeof storyboardSplitResponseSchema>;
  try {
    ensureArkConfigured("豆包文本模型还没有配置，暂时不能自动拆分文字分镜。请配置 ARK_API_KEY 后重试。");
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
          content: `完整剧本标题：${pkg.title}\n导入说明：${pkg.concept}\n标准剧本：\n${storyboardSourceScript}`,
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

  await recordStageProgress({
    projectId: input.projectId,
    stageKey: "script_storyboard_confirmation",
    status: "in_progress",
    currentStage: "script_storyboard_confirmation",
    projectStatus: "in_progress",
    userMessage: "文字分镜已拆分并保存，主要人物和场景设定已同步。请先确认文字分镜，再确认人物和场景设定。",
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
    message: "文字分镜已自动拆分并保存，主要人物和场景设定已同步。请先确认文字分镜，再确认人物和场景设定。",
  };
}

function resolveStoryboardSplitSourceScript(pkg: ScriptDirectionPackageView) {
  const standardizedScript = pkg.standardizedScript.trim();
  if (standardizedScript) return standardizedScript;

  const fullScript = pkg.fullScript.trim();
  if (isStandardizedCompatibilityFullScript(pkg, fullScript)) return fullScript;

  throw new AppError({
    status: 422,
    code: "standardized_script_required",
    userMessage: "标准剧本为空，暂时不能拆分文字分镜。请先保存标准剧本内容。",
  });
}

function assertStandardizedScriptReadyForStoryboard(script: string) {
  const validation = validateStandardScriptFormat(script);
  if (validation.hasBlockingIssues) {
    throw new AppError({
      status: 422,
      code: "standardized_script_has_format_issues",
      userMessage: "标准剧本仍有必填格式问题。请先在脚本设定页签里修改并确认标准剧本，再拆分文字分镜。",
    });
  }
}

export async function ensureScriptPackageStandardizedForReview(input: {
  projectId: string;
  packageId: string;
  actorId?: string | null;
}) {
  ensureArkConfigured("标准剧本格式不符合甲方审核要求，且当前豆包文本模型还没有配置，暂时不能自动规范化。请配置 ARK_API_KEY 后重试，或先在脚本设定页手动整理成标准格式。");
  const pkg = await getScriptDirectionPackage({ projectId: input.projectId, packageId: input.packageId });
  if (!pkg) {
    throw new AppError({
      status: 404,
      code: "script_package_not_found",
      userMessage: "没有找到完整剧本记录。请先保存完整剧本后再提交甲方审核。",
    });
  }

  const currentScript = pkg.standardizedScript.trim();
  if (!currentScript) {
    throw new AppError({
      status: 422,
      code: "script_package_standardized_script_required",
      userMessage: "请先生成标准剧本，再提交甲方审核。",
    });
  }

  const validation = validateStandardScriptFormat(currentScript);
  if (!validation.hasBlockingIssues) return pkg;

  const parsed = flexibleScriptGenerationResponseSchema.parse(
    await callArkResponseJson({
      model: env.ARK_TEXT_STRUCTURING_MODEL,
      temperature: 0.1,
      maxOutputTokens: 12000,
      timeoutMs: 300_000,
      thinking: "disabled",
      telemetry: {
        projectId: input.projectId,
        callId: "client_review_standard_script_normalization",
        provider: env.TEXT_STRUCTURING_PROVIDER,
        operation: "client_review_standard_script_normalization",
        metadata: {
          packageId: input.packageId,
          issueCodes: validation.issues.map((issue) => issue.code),
        },
      },
      messages: [
        {
          role: "system",
          content:
            "你是影视广告标准剧本格式编辑。请把输入剧本严格规范为给定“标准剧本格式规范”，只输出严格 JSON {title, concept, script}。script 必须从一行《剧名》开始，包含剧情简介、人物小传、集数、场次、每场人物/△画面/角色台词；不要输出 Markdown，不要新增剧情，不要删除关键信息，无法确定的信息写“待补充”。",
        },
        {
          role: "user",
          content: [
            `输出格式硬约束：\n${STANDARD_SCRIPT_FORMAT_SPEC}`,
            `当前标题：${pkg.title}`,
            `当前概念：${pkg.concept}`,
            `需规范化的剧本：\n${currentScript.slice(0, STANDARDIZATION_PLAIN_SCRIPT_MAX_CHARS)}`,
          ].join("\n\n"),
        },
      ],
    })
  );

  const normalizedValidation = validateStandardScriptFormat(parsed.script);
  if (normalizedValidation.hasBlockingIssues) {
    throw new AppError({
      status: 502,
      code: "client_review_script_normalization_failed",
      userMessage: "标准剧本自动规范化后仍缺少必填格式。请先在脚本设定页手动整理成标准格式，再提交甲方审核。",
    });
  }

  const savedPackage = await updateScriptPackageStandardizedAndFullScript({
    projectId: input.projectId,
    packageId: input.packageId,
    standardizedScript: parsed.script,
    title: parsed.title ?? pkg.title,
    concept: parsed.concept ?? pkg.concept,
    status: pkg.status,
    actorId: input.actorId ?? null,
  });
  if (!savedPackage) {
    throw new AppError({
      status: 404,
      code: "script_package_not_found",
      userMessage: "标准剧本规范化保存失败：没有找到可更新的脚本包。请刷新后重试。",
    });
  }

  return savedPackage;
}

function isStandardizedCompatibilityFullScript(pkg: ScriptDirectionPackageView, fullScript: string) {
  if (!fullScript || pkg.plainScript.trim() === fullScript) return false;
  return new Set(["internal_review", "client_reviewing", "client_approved", "locked"]).has(pkg.status);
}

function ensureArkConfigured(userMessage: string) {
  if (!env.ARK_API_KEY) {
    throw new AppError({
      status: 503,
      code: "ark_not_configured",
      userMessage,
    });
  }
}

async function collectScriptGenerationContext(projectId: string) {
  const [
    project,
    creativeRounds,
    creativeDirections,
    creativeExpansions,
    assets,
    assetAnalyses,
    proposal,
    quote,
    contract,
    deliveryChecklist,
  ] = await Promise.all([
    getProjectById(projectId),
    listCreativeProposalRounds(projectId),
    listProjectCreativeDirections(projectId),
    listProjectCreativeExpansions(projectId),
    listProjectAssets(projectId),
    listProjectAssetAnalyses(projectId),
    getProjectProposal(projectId),
    getProjectQuote(projectId),
    getProjectContract(projectId),
    getProjectDeliveryChecklist(projectId),
  ]);

  if (!project) {
    throw new AppError({
      status: 404,
      code: "project_not_found",
      userMessage: "没有找到这个项目。请刷新项目列表后重试。",
    });
  }

  const finalRound = resolveFinalCreativeProposalRound(creativeRounds.rounds);
  const finalDirectionIds = new Set(
    finalRound?.retainedDirectionIds.length
      ? finalRound.retainedDirectionIds
      : finalRound?.directionIds.length
        ? finalRound.directionIds
        : creativeDirections.filter((direction) => direction.isSelected).map((direction) => direction.id)
  );
  const directionsForScript = creativeDirections
    .filter((direction) => finalDirectionIds.size === 0 || finalDirectionIds.has(direction.id) || direction.isSelected)
    .slice(0, 6);
  const directionIds = new Set(directionsForScript.map((direction) => direction.id));
  const expansionsForScript = creativeExpansions
    .filter((expansion) => directionIds.size === 0 || directionIds.has(expansion.directionId))
    .slice(0, 10);
  const successfulAnalyses = assetAnalyses.filter((analysis) => analysis.status === "succeeded").slice(0, 8);

  return {
    project,
    finalRound,
    creativeDirections: directionsForScript,
    creativeExpansions: expansionsForScript,
    assets: assets.slice(0, 20),
    assetAnalyses: successfulAnalyses,
    proposal,
    quote,
    contract,
    deliveryChecklist,
    selectedDirectionId: directionsForScript[0]?.id ?? null,
  };
}

function assertScriptGenerationContext(context: ScriptGenerationContext): asserts context is ScriptGenerationReadyContext {
  if (!context.finalRound) {
    throw new AppError({
      status: 422,
      code: "final_creative_proposal_required",
      userMessage: "当前项目还没有已确认的最终创意提案轮次，暂时不能自动生成或改写脚本。请先完成 SOP3 最终提案确认，再回到脚本页签重试。",
    });
  }
}

function resolveFinalCreativeProposalRound(rounds: CreativeProposalRoundView[]) {
  const finalStatuses = new Set(["client_approved", "approved", "locked", "confirmed", "final"]);
  return rounds.filter((round) => round.roundNumber === 2 && finalStatuses.has(round.status)).at(-1) ?? null;
}

function buildPlainScriptPrompt(context: ScriptGenerationReadyContext) {
  return [
    "请基于当前项目内已保存产物，生成 SOP5 的大白话剧本草稿。不得使用跨项目知识库、历史客户资料或未出现在下方输入中的内容。",
    buildCurrentProjectContextPrompt(context),
    "输出要求：大白话剧本必须是一段自然、完整、可直接阅读的叙述，像小说或导演口述故事。可以按段落推进情绪和画面，但不要写成标准剧本格式，不要使用“场次、内外、日夜、人物、画面、台词”这些字段标题，不要使用三角形、星号或分镜编号。必须完整描述故事开端、冲突/卖点展开、视觉段落、人物/产品动作、结尾和待确认事项；确认提交后，系统才会另行整理成标准剧本。",
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 11000);
}

function buildCurrentProjectContextPrompt(context: ScriptGenerationReadyContext) {
  return [
    "当前项目补充上下文：",
    `品牌：${context.project.brandName}`,
    `项目：${context.project.projectName}`,
    context.project.dueDate ? `截止时间：${context.project.dueDate}` : "",
    formatCreativeRoundForPrompt(context.finalRound),
    context.proposal ? `最终提案：${context.proposal.title}\n${context.proposal.content.slice(0, 1600)}` : "",
    formatCreativeDirectionsForPrompt(context),
    formatCreativeExpansionsForPrompt(context),
    formatAssetsForPrompt(context),
    context.quote ? `报价信息：${context.quote.title}，总额 ${context.quote.currency} ${context.quote.totalAmount}；备注：${context.quote.notes}` : "",
    context.contract ? `合同交付范围：${context.contract.templateFields.deliveryScope}\n付款条款：${context.contract.templateFields.paymentTerms}` : "",
    formatDeliveryChecklistForScriptPrompt(context),
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 8000);
}

function buildRevisionPrompt(input: {
  context: ScriptGenerationReadyContext;
  pkg: ScriptDirectionPackageView;
  currentScript: string;
  messages: Array<{ role: string; inputMode: string; content: string }>;
  instruction: string;
}) {
  return [
    buildCurrentProjectContextPrompt(input.context),
    `标题：${input.pkg.title}`,
    `概念：${input.pkg.concept}`,
    `当前朴素剧本：\n${input.currentScript}`,
    `最近修订记录：\n${input.messages.map((message) => `${message.role}/${message.inputMode}：${message.content}`).join("\n")}`,
    `本轮修改意见：${input.instruction}`,
    "修订输出仍然必须保持大白话剧本形态：像小说或导演口述故事，不要写成标准剧本格式，不要使用“场次、内外、日夜、人物、画面、台词”这些字段标题，不要使用三角形、星号或分镜编号。",
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 12000);
}

function buildStandardizationPrompt(input: {
  context: ScriptGenerationReadyContext;
  pkg: ScriptDirectionPackageView;
  plainScript: string;
}) {
  return [
    buildCurrentProjectContextPrompt(input.context),
    `标题：${input.pkg.title}`,
    `概念：${input.pkg.concept}`,
    `输出格式硬约束：\n${STANDARD_SCRIPT_FORMAT_SPEC}`,
    "整理要求：只依据朴素剧本与项目上下文整理，不新增剧情、不删关键信息；无法确定的信息用“待补充”标注，不要编造。每个场次必须至少包含一行可被识别的台词；如果朴素剧本没有明确对白或画外音，就用该场主要人物写“人名（独白）：待补充。”，不要省略台词行。",
    `朴素剧本：\n${input.plainScript.slice(0, STANDARDIZATION_PLAIN_SCRIPT_MAX_CHARS)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function formatCreativeRoundForPrompt(round: CreativeProposalRoundView) {
  const conceptText = round.concepts
    .map((concept) => {
      const imageText = concept.images
        .filter((image) => image.isSelected || image.status === "selected" || image.status === "generated")
        .slice(0, 3)
        .map((image) => `图：${image.prompt.slice(0, 220)}${image.ossUrl ? "（已保存 OSS）" : ""}`)
        .join("；");
      return `故事卡 ${concept.sceneIndex}：${concept.title}；${concept.description}；来源：${concept.sourceText.slice(0, 360)}；画面提示：${concept.imagePrompt.slice(0, 360)}${imageText ? `；${imageText}` : ""}`;
    })
    .join("\n");
  return `最终创意提案轮次：Round ${round.roundNumber}，状态 ${round.status}。\n客户反馈：${formatUnknownValue(round.clientFeedback).slice(0, 600)}\n${conceptText}`;
}

function formatCreativeDirectionsForPrompt(context: ScriptGenerationContext) {
  if (context.creativeDirections.length === 0) return "";
  return context.creativeDirections
    .map(
      (direction) =>
        `创意方向：${direction.title}；核心：${direction.coreIdea}；适配原因：${direction.fitReason}；风险：${direction.riskNotes}；参考标签：${direction.referenceTags.join("、")}`
    )
    .join("\n");
}

function formatCreativeExpansionsForPrompt(context: ScriptGenerationContext) {
  if (context.creativeExpansions.length === 0) return "";
  return context.creativeExpansions
    .map(
      (expansion) =>
        `故事大纲：${expansion.title}；一句话：${expansion.oneLiner}；结构：${formatUnknownValue(expansion.storyArc)}；视觉亮点：${expansion.visualHighlights.join("、")}；风格：${expansion.visualStyle}`
    )
    .join("\n");
}

function formatAssetsForPrompt(context: ScriptGenerationContext) {
  const analysisText = context.assetAnalyses
    .map((analysis) => `资料解析：${analysis.summary}；标签：${analysis.labels.slice(0, 8).join("、")}；文本：${analysis.extractedText.slice(0, 360)}`)
    .join("\n");
  const assetText = context.assets
    .map((asset) => `素材：${asset.fileName ?? asset.externalProvider ?? asset.assetType}；类型：${asset.assetType}/${asset.sourceType}；解析状态：${asset.parseStatus}`)
    .join("\n");
  return [analysisText, assetText].filter(Boolean).join("\n");
}

function formatDeliveryChecklistForScriptPrompt(context: ScriptGenerationContext) {
  const checklist = context.deliveryChecklist;
  if (!checklist) return "";
  return [
    `交付清单：状态 ${checklist.status}，版本 v${checklist.version}。${checklist.notes}`,
    ...checklist.items.map((item) => `${item.title} x${item.quantity}（${item.status}）：${item.description}`),
  ]
    .filter(Boolean)
    .join("\n");
}

function buildScriptGenerationTelemetryMetadata(context: ScriptGenerationContext) {
  return {
    hasFinalRound: Boolean(context.finalRound),
    creativeDirectionCount: context.creativeDirections.length,
    creativeExpansionCount: context.creativeExpansions.length,
    assetCount: context.assets.length,
    assetAnalysisCount: context.assetAnalyses.length,
    hasProposal: Boolean(context.proposal),
    hasQuote: Boolean(context.quote),
    hasContract: Boolean(context.contract),
    hasDeliveryChecklist: Boolean(context.deliveryChecklist),
  };
}

function buildScriptGenerationInputRefs(context: ScriptGenerationContext) {
  return [
    context.finalRound ? { type: "creative_proposal_round", id: context.finalRound.id } : null,
    ...context.creativeDirections.map((direction) => ({ type: "creative_direction", id: direction.id })),
    ...context.creativeExpansions.map((expansion) => ({ type: "creative_expansion", id: expansion.id })),
    ...context.assetAnalyses.map((analysis) => ({ type: "asset_analysis", id: analysis.id })),
    context.proposal ? { type: "proposal", id: context.proposal.id } : null,
    context.quote ? { type: "quote", id: context.quote.id } : null,
    context.contract ? { type: "contract", id: context.contract.id } : null,
    context.deliveryChecklist ? { type: "delivery_checklist", id: context.deliveryChecklist.id } : null,
  ].filter((ref): ref is { type: string; id: string } => Boolean(ref));
}

async function recordScriptGenerationFailure(projectId: string, error: unknown, operation: string, packageId?: string) {
  const userMessage =
    error instanceof AppError
      ? error.userMessage
      : "脚本生成或修订失败。系统已保存失败状态，你可以补充项目资料后重试，或联系管理员查看服务端日志。";
  await recordStageProgress({
    projectId,
    stageKey: "script_storyboard_confirmation",
    status: "needs_revision",
    currentStage: "script_storyboard_confirmation",
    projectStatus: "needs_revision",
    title: "脚本生成需要处理",
    userMessage,
    errorMessage: userMessage,
    inputRefs: packageId ? [{ type: "script_direction_package", id: packageId }] : [],
    snapshot: { operation },
  });
}

function formatUnknownValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(formatUnknownValue).filter(Boolean).join("、");
  if (typeof value === "object") return Object.values(value).map(formatUnknownValue).filter(Boolean).join("、");
  return String(value);
}
