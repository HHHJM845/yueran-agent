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
  return roundNumber === 1 ? 2 : 4;
}

export function getImageCandidateCountPerScene() {
  return 4;
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

  const sceneCount = getRequiredSceneCountForRound(input.roundNumber);
  const selectedDirectionIdsSet = new Set(selectedDirections.map((direction) => direction.id));
  const expansions = (await listProjectCreativeExpansions(input.projectId)).filter((expansion) => selectedDirectionIdsSet.has(expansion.directionId));
  const missingExpansionDirection = selectedDirections.find((direction) => expansions.filter((expansion) => expansion.directionId === direction.id).length < sceneCount);
  if (missingExpansionDirection) {
    throw new AppError({
      status: 422,
      code: "creative_round_story_cards_incomplete",
      userMessage: `创意方向「${missingExpansionDirection.title}」还没有 ${sceneCount} 个故事卡。请先生成故事大纲和候选氛围图，再创建本轮提案包。`,
    });
  }

  const version = (await listCreativeProposalRounds(input.projectId)).rounds.filter((round) => round.roundNumber === input.roundNumber).length + 1;
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
  const selectedDirectionIds = (await listProjectCreativeDirections(input.projectId)).filter((direction) => direction.isSelected).map((direction) => direction.id);
  if (!isSameDirectionSet(round.directionIds, selectedDirectionIds)) {
    throw new AppError({
      status: 409,
      code: "creative_round_selection_changed",
      userMessage: "当前内部选择的创意方向已经变化。请先重新保存本轮提案包快照，再生成新的甲方审核链接。",
    });
  }

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
}) {
  const sceneCount = getRequiredSceneCountForRound(input.roundNumber);
  return input.directions.flatMap((direction) =>
    input.expansions
      .filter((expansion) => expansion.directionId === direction.id)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .slice(0, sceneCount)
      .map((expansion, index) => {
        const sceneIndex = index + 1;
      return {
        directionId: direction.id,
        sceneIndex,
        title: expansion.title,
        description: buildSceneDescription(direction, expansion, sceneIndex, input.roundNumber),
        sourceText: [direction.coreIdea, expansion.oneLiner, ...Object.values(expansion.storyArc), expansion.visualStyle, expansion.riskNotes].filter(Boolean).join("\n"),
        imagePrompt: direction.atmospherePrompt || `${expansion.title}，${expansion.oneLiner}，商业 AIGC 视频视觉提案氛围图，场景 ${sceneIndex}`,
        requiredImageCount: getImageCandidateCountPerScene(),
        snapshot: {
          directionTitle: direction.title,
          expansionId: expansion.id,
          expansionTitle: expansion.title,
          roundNumber: input.roundNumber,
          source: "derived_from_selected_story_card",
        },
      };
      })
  );
}

function buildSceneDescription(
  direction: {
    coreIdea: string;
    fitReason: string;
  },
  expansion: Pick<CreativeExpansionView, "oneLiner" | "storyArc" | "visualStyle" | "visualHighlights">,
  sceneIndex: number,
  roundNumber: 1 | 2
) {
  if (roundNumber === 1) {
    return `故事卡 ${sceneIndex}：${expansion.oneLiner || direction.coreIdea}`;
  }

  const labels = ["开场吸引", "产品/服务亮点", "情绪转折", "收束记忆点"];
  const arcText = Object.values(expansion.storyArc).filter(Boolean).join("；");
  return `${labels[sceneIndex - 1] ?? "深化视觉"}：${arcText || expansion.oneLiner || direction.fitReason}`;
}

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
    const candidates = generatedImages
      .filter((image) => (expansionId ? image.expansionId === expansionId : image.directionId === concept.directionId) && image.status === "succeeded")
      .sort((left, right) => Number(right.reviewStatus === "confirmed") - Number(left.reviewStatus === "confirmed"))
      .slice(0, getImageCandidateCountPerScene());

    for (let index = 0; index < getImageCandidateCountPerScene(); index += 1) {
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

function isSameDirectionSet(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((id) => rightSet.has(id));
}
