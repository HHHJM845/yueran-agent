import { z } from "zod";
import { AppError } from "@/lib/errors";
import { withTransaction, type TransactionQuery } from "@/lib/db";
import {
  createCreativeProposalRound as insertCreativeProposalRound,
  createCreativeSceneConcepts,
  getCreativeProposalRound,
  listCreativeProposalRounds,
  linkCreativeProposalRoundClientReview,
  selectCreativeSceneImages as persistCreativeSceneImageSelection,
  upsertCreativeSceneImage,
  type CreativeProposalRoundView,
  type CreativeSceneConceptView,
} from "@/server/repositories/creative-proposals";
import { listProjectCreativeDirections } from "@/server/repositories/creative-directions";
import { listProjectCreativeExpansions, type CreativeExpansionView } from "@/server/repositories/creative-expansions";
import { listProjectArtifacts, type ArtifactSummary } from "@/server/repositories/artifacts";
import { listProjectGeneratedImages } from "@/server/repositories/generated-images";
import { createWorkflowClientReview } from "@/server/use-cases/client-review";

export type CreativeDirectionDraft = {
  title: string;
  coreIdea: string;
  fitReason: string;
  riskNotes: string;
  referenceTags: string[];
  score: number;
  costEstimate: string;
  cycleEstimate: string;
  technicalDifficulty: string;
  atmospherePrompt: string;
  detail: unknown;
};

export function validateCreativeDirectionCount(items: unknown[]) {
  if (items.length !== 4) {
    throw new Error("SOP 3 requires exactly 4 creative directions.");
  }
}

export function getRequiredSceneCountForRound(roundNumber: 1 | 2) {
  return roundNumber === 1 ? 0 : 4;
}

export type CreativeRoundStyleVariantKey = "2d" | "pixar_3d" | "realistic";

export type CreativeRoundStyleVariant = {
  key: CreativeRoundStyleVariantKey;
  label: string;
};

export const ROUND_1_STYLE_VARIANTS: CreativeRoundStyleVariant[] = [
  { key: "2d", label: "二维风格" },
  { key: "pixar_3d", label: "三维皮克斯风格" },
  { key: "realistic", label: "写实风格" },
];
const ROUND_1_STYLE_VARIANT_LABELS = "二维风格、三维皮克斯风格、写实风格";

type SelectedDirectionStyle = {
  directionId: string;
  directionTitle: string;
  styleVariant: string;
  styleLabel: string;
  selectedImageId: string | null;
  itemId: string;
};

export function getRequiredStyleVariantsForRound(roundNumber: 1 | 2): CreativeRoundStyleVariant[] {
  return roundNumber === 1 ? ROUND_1_STYLE_VARIANTS : [];
}

export function getImageCandidateCountPerScene() {
  return 1;
}

export function getMaxSelectedImageCountPerScene() {
  return 2;
}

export function normalizeCreativeDirections(input: unknown): CreativeDirectionDraft[] {
  const parsed = z
    .array(
      z.object({
        title: z.string().trim().min(1),
        coreIdea: z.string().trim().min(1),
        fitReason: z.string().trim().min(1),
        riskNotes: z.string().optional().default(""),
        referenceTags: z.array(z.string()).optional().default([]),
        score: z.number().min(0).max(100).optional().default(0),
        costEstimate: z.string().optional().default(""),
        cycleEstimate: z.string().optional().default(""),
        technicalDifficulty: z.string().optional().default(""),
        atmospherePrompt: z.string().optional().default(""),
        detail: z.unknown().optional().default({}),
      })
    )
    .parse(input);

  validateCreativeDirectionCount(parsed);
  return parsed;
}

export async function createCreativeProposalRound(input: {
  projectId: string;
  roundNumber: 1 | 2;
  directionIds: string[];
  actorId: string;
}): Promise<CreativeProposalRoundView> {
  const directions = await listProjectCreativeDirections(input.projectId);
  validateCreativeDirectionCount(directions);

  const selectedDirections = directions.filter((direction) => input.directionIds.includes(direction.id));
  if (input.directionIds.length > 0 && input.directionIds.some((id) => !directions.some((direction) => direction.id === id))) {
    throw new AppError({
      status: 422,
      code: "creative_direction_selection_invalid",
      userMessage: "本轮提案包含不属于当前项目的创意方向。请刷新工作台后重新选择。",
    });
  }

  if (selectedDirections.length === 0) {
    throw new AppError({
      status: 422,
      code: "creative_round_retained_direction_required",
      userMessage: input.roundNumber === 1 ? "第一轮提案至少需要选择一个创意方向。请先勾选要给甲方看的方向。" : "第二轮提案至少需要保留一个创意方向。请先在第一轮反馈后选择要深化的方向。",
    });
  }

  const selectedDirectionIdsSet = new Set(selectedDirections.map((direction) => direction.id));
  const allExpansions = (await listProjectCreativeExpansions(input.projectId)).filter((expansion) => selectedDirectionIdsSet.has(expansion.directionId));
  let expansions = allExpansions;
  const generatedImages = await listProjectGeneratedImages(input.projectId);
  if (input.roundNumber === 1) {
    assertCreativeRoundStoryOutlinesComplete({
      directions: selectedDirections,
      expansions,
    });
    assertCreativeRoundStyleImagesComplete({
      directions: selectedDirections,
      generatedImages,
    });
  } else {
    const artifacts = await listProjectArtifacts(input.projectId);
    const round2ExpansionIds = collectRound2StoryboardExpansionIds(artifacts, selectedDirections);
    expansions = allExpansions.filter((expansion) => round2ExpansionIds.has(expansion.id));
    assertRound2DeepeningScriptsConfirmed({
      directions: selectedDirections,
      artifacts,
    });
    const sceneCount = getRequiredSceneCountForRound(input.roundNumber);
    const missingExpansionDirection = selectedDirections.find((direction) => expansions.filter((expansion) => expansion.directionId === direction.id).length < sceneCount);
    if (missingExpansionDirection) {
      throw new AppError({
        status: 422,
        code: "creative_round_story_cards_incomplete",
        userMessage: `创意方向「${missingExpansionDirection.title}」还没有 ${sceneCount} 个精彩场景。请先精选精彩场景并补齐深化视觉图，再创建本轮提案包。`,
      });
    }
    assertCreativeRoundCandidateImagesComplete({
      roundNumber: input.roundNumber,
      directions: selectedDirections,
      expansions,
      generatedImages,
    });
  }

  const existingRounds = await listCreativeProposalRounds(input.projectId);
  const version = existingRounds.rounds.filter((round) => round.roundNumber === input.roundNumber).length + 1;
  const selectedDirectionStyles = buildRound2StyleSelectionMap(existingRounds.rounds);
  const directionIds = selectedDirections.map((direction) => direction.id);
  const round = await withTransaction(async (transactionQuery) => {
    const createdRound = await insertCreativeProposalRound({
      projectId: input.projectId,
      roundNumber: input.roundNumber,
      version,
      directionIds,
      retainedDirectionIds: input.roundNumber === 1 ? [] : directionIds,
      actorId: input.actorId,
      transactionQuery,
      snapshot: {
        directionCount: directions.length,
        selectedDirectionCount: selectedDirections.length,
        retainedDirectionCount: input.roundNumber === 1 ? 0 : selectedDirections.length,
        requiredSceneCountPerDirection: getRequiredSceneCountForRound(input.roundNumber),
        imageCandidateCountPerScene: getImageCandidateCountPerScene(),
        styleVariants: getRequiredStyleVariantsForRound(input.roundNumber),
      },
    });

    const concepts = await createCreativeSceneConcepts({
      projectId: input.projectId,
      roundId: createdRound.id,
      actorId: input.actorId,
      transactionQuery,
      concepts: buildSceneConceptInputs({
        roundNumber: input.roundNumber,
        directions: selectedDirections,
        expansions,
        selectedDirectionStyles,
      }),
    });
    await createCandidateImageRows({
      projectId: input.projectId,
      roundId: createdRound.id,
      concepts,
      actorId: input.actorId,
      transactionQuery,
    });

    return createdRound;
  });

  return (await listCreativeProposalRounds(input.projectId)).rounds.find((candidate) => candidate.id === round.id) ?? round;
}

export function assertCreativeRoundCandidateImagesComplete(input: {
  roundNumber: 1 | 2;
  directions: Array<{ id: string; title: string }>;
  expansions: CreativeExpansionView[];
  generatedImages: Array<{ expansionId: string | null; status: string }>;
}) {
  const sceneCount = getRequiredSceneCountForRound(input.roundNumber);
  const candidateCount = getImageCandidateCountPerScene();

  for (const direction of input.directions) {
    const roundExpansions = input.expansions
      .filter((expansion) => expansion.directionId === direction.id)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .slice(0, sceneCount);

    for (const expansion of roundExpansions) {
      const generatedCount = input.generatedImages.filter(
        (image) => image.expansionId === expansion.id && image.status === "succeeded"
      ).length;

      if (generatedCount < candidateCount) {
        throw new AppError({
          status: 422,
          code: "creative_round_candidate_images_incomplete",
          userMessage: `创意方向「${direction.title}」的精彩场景「${expansion.title}」还没有深化视觉图。每个精彩场景需要 1 张深化视觉图，请先补齐后再创建本轮提案包。`,
        });
      }
    }
  }
}

export function assertCreativeRoundStoryOutlinesComplete(input: {
  directions: Array<{ id: string; title: string }>;
  expansions: CreativeExpansionView[];
}) {
  const missingDirection = input.directions.find((direction) => !input.expansions.some((expansion) => expansion.directionId === direction.id));
  if (missingDirection) {
    throw new AppError({
      status: 422,
      code: "creative_round_story_outline_required",
      userMessage: `创意方向「${missingDirection.title}」还没有故事大纲。请先生成故事大纲，再创建并发送 Round 1 完整提案包。`,
    });
  }
}

function collectRound2StoryboardExpansionIds(
  artifacts: Array<Pick<ArtifactSummary, "kind" | "data">>,
  directions: Array<{ id: string }>
) {
  const directionIds = new Set(directions.map((direction) => direction.id));
  const expansionIds = new Set<string>();
  for (const artifact of artifacts) {
    if (artifact.kind !== "creative_expansion" && artifact.kind !== "proposal") continue;
    if (readStringFieldFromUnknown(artifact.data, "sop3ArtifactType") !== "round2_deepening_storyboard_split") continue;
    if (!directionIds.has(readStringFieldFromUnknown(artifact.data, "directionId"))) continue;
    for (const id of readStringArrayFieldFromUnknown(artifact.data, "expansionIds")) expansionIds.add(id);
  }
  return expansionIds;
}

export function assertRound2DeepeningScriptsConfirmed(input: {
  directions: Array<{ id: string; title: string }>;
  artifacts: Array<Pick<ArtifactSummary, "kind" | "status" | "data">>;
}) {
  for (const direction of input.directions) {
    const confirmedScript = input.artifacts.find(
      (artifact) =>
        artifact.kind === "proposal" &&
        artifact.status === "confirmed" &&
        readStringFieldFromUnknown(artifact.data, "sop3ArtifactType") === "round2_deepening_script" &&
        readStringFieldFromUnknown(artifact.data, "directionId") === direction.id &&
        readStringFieldFromUnknown(artifact.data, "script").length > 0
    );

    if (!confirmedScript) {
      throw new AppError({
        status: 422,
        code: "creative_round_script_confirmation_required",
        userMessage: `创意方向「${direction.title}」还没有确认完整故事。请先生成 700-800 字完整故事并人工确认，再精选 4 个精彩场景和创建第二轮提案包。`,
      });
    }
  }
}

export function assertCreativeRoundStyleImagesComplete(input: {
  directions: Array<{ id: string; title: string }>;
  generatedImages: Array<{ directionId: string | null; expansionId: string | null; status: string; metadata: Record<string, unknown> }>;
}) {
  const requiredStyles = getRequiredStyleVariantsForRound(1);
  for (const direction of input.directions) {
    const existingStyleKeys = new Set(
      input.generatedImages
        .filter((image) => image.directionId === direction.id && image.expansionId === null && image.status === "succeeded")
        .map((image) => readStringField(image.metadata, "styleVariant"))
        .filter(Boolean)
    );
    const missingStyles = requiredStyles.filter((style) => !existingStyleKeys.has(style.key));

    if (missingStyles.length > 0) {
      throw new AppError({
        status: 422,
        code: "creative_round_style_images_incomplete",
        userMessage: `创意方向「${direction.title}」还没有完整的 Round 1 三风格静态场景图。每个方向需要 ${ROUND_1_STYLE_VARIANT_LABELS} 各 1 张，请先补齐；当前缺少：${missingStyles.map((style) => style.label).join("、")}。`,
      });
    }
  }
}

export async function selectCreativeSceneImages(input: {
  projectId: string;
  sceneConceptId: string;
  imageIds: string[];
  actorId: string;
}): Promise<CreativeSceneConceptView> {
  if (input.imageIds.length === 0 || input.imageIds.length > getMaxSelectedImageCountPerScene()) {
    throw new AppError({
      status: 422,
      code: "creative_scene_image_selection_invalid",
      userMessage: "请选择 1 到 2 张候选氛围图。未生成成功的候选图不能被确认。",
    });
  }

  return persistCreativeSceneImageSelection(input);
}

export async function createCreativeProposalRoundClientReview(input: {
  projectId: string;
  roundId: string;
  actorId: string;
  origin: string;
}) {
  const round = await getCreativeProposalRound({ projectId: input.projectId, roundId: input.roundId });
  if (!round) {
    throw new AppError({
      status: 404,
      code: "creative_proposal_round_not_found",
      userMessage: "没有找到这轮创意视觉提案。请刷新工作台后再试。",
    });
  }
  const directions = await listProjectCreativeDirections(input.projectId);
  assertCreativeRoundClientReviewDirectionSnapshot({
    roundNumber: round.roundNumber,
    roundDirectionIds: round.directionIds,
    selectedDirectionIds: directions.filter((direction) => direction.isSelected).map((direction) => direction.id),
    projectDirectionIds: directions.map((direction) => direction.id),
  });

  const result = await createWorkflowClientReview({
    projectId: input.projectId,
    actorId: input.actorId,
    origin: input.origin,
    reviewType: "project_proposal",
    targetScopeId: round.id,
    sopKey: "sop_3",
    reviewScene: round.roundNumber === 1 ? "creative_round_1" : "creative_round_2",
    roundNumber: round.roundNumber,
    payloadVersion: round.version,
  });

  await linkCreativeProposalRoundClientReview({
    projectId: input.projectId,
    roundId: round.id,
    reviewTaskId: result.task.id,
    actorId: input.actorId,
  });

  return result;
}

export function assertCreativeRoundClientReviewDirectionSnapshot(input: {
  roundNumber: 1 | 2;
  roundDirectionIds: string[];
  selectedDirectionIds: string[];
  projectDirectionIds: string[];
}) {
  const projectDirectionIdSet = new Set(input.projectDirectionIds);
  if (input.roundDirectionIds.length === 0 || input.roundDirectionIds.some((id) => !projectDirectionIdSet.has(id))) {
    throw new AppError({
      status: 422,
      code: "creative_direction_selection_invalid",
      userMessage: "本轮提案包含不属于当前项目的创意方向。请刷新工作台后重新选择。",
    });
  }

  if (input.roundNumber === 1 && !isSameDirectionSet(input.roundDirectionIds, input.selectedDirectionIds)) {
    throw new AppError({
      status: 409,
      code: "creative_round_selection_changed",
      userMessage: "当前内部选择的创意方向已经变化。请先重新保存本轮提案包快照，再生成新的甲方审核链接。",
    });
  }
}

function buildSceneConceptInputs(input: {
  roundNumber: 1 | 2;
  directions: Array<{
    id: string;
    title: string;
    coreIdea: string;
    fitReason: string;
    riskNotes: string;
    atmospherePrompt: string;
    detail: unknown;
  }>;
  expansions: CreativeExpansionView[];
  selectedDirectionStyles?: Map<string, SelectedDirectionStyle>;
}) {
  if (input.roundNumber === 1) {
    return input.directions.flatMap((direction) => {
      const storyOutline = findDirectionStoryOutline(input.expansions, direction.id);
      const storyContent = storyOutline ? formatRound1StoryContent(storyOutline) : "";
      return getRequiredStyleVariantsForRound(1).map((style, index) => ({
        directionId: direction.id,
        sceneIndex: index + 1,
        title: `${direction.title} - ${style.label}`,
        description: [`${style.label}：${direction.coreIdea || direction.fitReason}`, storyContent ? `故事内容：${storyContent}` : ""].filter(Boolean).join("\n"),
        sourceText: [direction.coreIdea, direction.fitReason, storyContent, direction.riskNotes, direction.atmospherePrompt].filter(Boolean).join("\n"),
        imagePrompt: direction.atmospherePrompt || `${direction.title}，${style.label}，商业 AIGC 视频视觉提案静态场景图`,
        requiredImageCount: getImageCandidateCountPerScene(),
        snapshot: {
          directionTitle: direction.title,
          roundNumber: input.roundNumber,
          source: "derived_from_direction_style_variant",
          styleVariant: style.key,
          styleLabel: style.label,
          storyContent,
          storyOutlineId: storyOutline?.id ?? null,
        },
      }));
    });
  }

  const sceneCount = getRequiredSceneCountForRound(input.roundNumber);
  return input.directions.flatMap((direction) =>
    input.expansions
      .filter((expansion) => expansion.directionId === direction.id)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .slice(0, sceneCount)
      .map((expansion, index) => {
        const sceneIndex = index + 1;
        const selectedStyle = input.selectedDirectionStyles?.get(direction.id) ?? null;
      return {
        directionId: direction.id,
        sceneIndex,
        title: expansion.title,
        description: buildSceneDescription(direction, expansion, sceneIndex, input.roundNumber, selectedStyle),
        sourceText: [direction.coreIdea, expansion.oneLiner, ...Object.values(expansion.storyArc), expansion.visualStyle, expansion.riskNotes].filter(Boolean).join("\n"),
        imagePrompt: [
          direction.atmospherePrompt || `${expansion.title}，${expansion.oneLiner}，商业 AIGC 视频视觉提案氛围图，场景 ${sceneIndex}`,
          selectedStyle ? `延续甲方在 R1 选择的视觉风格：${selectedStyle.styleLabel}` : "",
        ].filter(Boolean).join("，"),
        requiredImageCount: getImageCandidateCountPerScene(),
        snapshot: {
          directionTitle: direction.title,
          expansionId: expansion.id,
          expansionTitle: expansion.title,
          roundNumber: input.roundNumber,
          source: "derived_from_selected_story_card",
          styleVariant: selectedStyle?.styleVariant ?? null,
          styleLabel: selectedStyle?.styleLabel ?? null,
          selectedRound1ImageId: selectedStyle?.selectedImageId ?? null,
        },
      };
      })
  );
}

function findDirectionStoryOutline(expansions: CreativeExpansionView[], directionId: string) {
  return expansions.filter((expansion) => expansion.directionId === directionId).sort((left, right) => left.sortOrder - right.sortOrder)[0] ?? null;
}

function formatRound1StoryContent(expansion: Pick<CreativeExpansionView, "title" | "oneLiner" | "storyArc" | "visualHighlights" | "visualStyle">) {
  return [
    expansion.title,
    expansion.oneLiner,
    ...Object.values(expansion.storyArc),
    expansion.visualHighlights.length > 0 ? `视觉重点：${expansion.visualHighlights.join("、")}` : "",
    expansion.visualStyle ? `风格：${expansion.visualStyle}` : "",
  ].filter(Boolean).join("；");
}

function buildSceneDescription(
  direction: {
    coreIdea: string;
    fitReason: string;
  },
  expansion: Pick<CreativeExpansionView, "oneLiner" | "storyArc" | "visualStyle" | "visualHighlights">,
  sceneIndex: number,
  roundNumber: 1 | 2,
  selectedStyle?: SelectedDirectionStyle | null
) {
  if (roundNumber === 1) {
    return `故事卡 ${sceneIndex}：${expansion.oneLiner || direction.coreIdea}`;
  }

  const labels = ["开场吸引", "产品/服务亮点", "情绪转折", "收束记忆点"];
  const arcText = Object.values(expansion.storyArc).filter(Boolean).join("；");
  const styleText = selectedStyle ? `视觉风格沿用 R1 甲方选择的${selectedStyle.styleLabel}。` : "";
  return `${labels[sceneIndex - 1] ?? "深化视觉"}：${arcText || expansion.oneLiner || direction.fitReason}${styleText}`;
}

function buildRound2StyleSelectionMap(rounds: Array<{ roundNumber: number; clientFeedback?: Record<string, unknown> | null }>) {
  const latestRound1 = [...rounds].reverse().find((round) => round.roundNumber === 1);
  const decisionPayload = readRecordField(latestRound1?.clientFeedback, "decisionPayload");
  const selections = decisionPayload?.selectedDirectionStyles;
  const map = new Map<string, SelectedDirectionStyle>();
  if (!Array.isArray(selections)) return map;

  for (const selection of selections) {
    if (!selection || typeof selection !== "object") continue;
    const record = selection as Record<string, unknown>;
    const directionId = readStringField(record, "directionId");
    const styleVariant = readStringField(record, "styleVariant");
    if (!directionId || !styleVariant) continue;
    map.set(directionId, {
      directionId,
      directionTitle: readStringField(record, "directionTitle"),
      styleVariant,
      styleLabel: readStringField(record, "styleLabel") || styleVariant,
      selectedImageId: readStringField(record, "selectedImageId") || null,
      itemId: readStringField(record, "itemId"),
    });
  }
  return map;
}

function readRecordField(value: unknown, key: string) {
  if (!value || typeof value !== "object") return null;
  const nested = (value as Record<string, unknown>)[key];
  return nested && typeof nested === "object" ? (nested as Record<string, unknown>) : null;
}

export const buildRound2StyleSelectionMapForTest = buildRound2StyleSelectionMap;
export const buildSceneConceptInputsForTest = buildSceneConceptInputs;

async function createCandidateImageRows(input: {
  projectId: string;
  roundId: string;
  concepts: CreativeSceneConceptView[];
  actorId: string;
  transactionQuery?: TransactionQuery;
}) {
  const generatedImages = await listProjectGeneratedImages(input.projectId);

  for (const concept of input.concepts) {
    const expansionId = readStringField(concept.snapshot, "expansionId");
    const styleVariant = readStringField(concept.snapshot, "styleVariant");
    const candidateCount = getImageCandidateCountPerScene();
    const candidates = generatedImages
      .filter((image) => {
        if (styleVariant) {
          return (
            image.directionId === concept.directionId &&
            image.expansionId === null &&
            image.status === "succeeded" &&
            readStringField(image.metadata, "styleVariant") === styleVariant
          );
        }
        return (expansionId ? image.expansionId === expansionId : image.directionId === concept.directionId) && image.status === "succeeded";
      })
      .sort((left, right) => Number(right.reviewStatus === "confirmed") - Number(left.reviewStatus === "confirmed"))
      .slice(0, candidateCount);

    for (let index = 0; index < candidateCount; index += 1) {
      const image = candidates[index] ?? null;
      await upsertCreativeSceneImage({
        projectId: input.projectId,
        roundId: input.roundId,
        sceneConceptId: concept.id,
        generatedImageId: image?.id ?? null,
        ossUrl: image?.ossUrl ?? null,
        prompt: image?.prompt ?? concept.imagePrompt,
        status: image ? "generated" : "queued",
        sortOrder: index + 1,
        actorId: input.actorId,
        transactionQuery: input.transactionQuery,
      });
    }
  }
}

function readStringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function readStringFieldFromUnknown(value: unknown, key: string) {
  if (!value || typeof value !== "object") return "";
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" ? field.trim() : "";
}

function readStringArrayFieldFromUnknown(value: unknown, key: string) {
  if (!value || typeof value !== "object") return [];
  const field = (value as Record<string, unknown>)[key];
  return Array.isArray(field) ? field.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()) : [];
}

function isSameDirectionSet(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((id) => rightSet.has(id));
}
