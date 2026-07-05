import { z } from "zod";
import { AppError } from "@/lib/errors";
import { assertTextStructuringReady } from "@/server/providers/ai";
import { callArkJson } from "@/server/providers/ark";
import {
  listProjectCreativeDirections,
  type CreativeDirectionView,
} from "@/server/repositories/creative-directions";
import {
  listProjectCreativeExpansions,
  type CreativeExpansionView,
} from "@/server/repositories/creative-expansions";
import {
  listCreativeProposalRounds,
  type CreativeProposalRoundView,
} from "@/server/repositories/creative-proposals";
import {
  getProjectDeliveryChecklist,
  getProjectDeliveryChecklistWithCancelled,
  createOrUpdateDeliveryChecklist,
} from "@/server/repositories/delivery-checklists";
import type {
  DeliveryChecklistItemKind,
  DeliveryChecklistView,
  SaveDeliveryChecklistItemInput,
} from "@/server/repositories/delivery-checklists";
import { getProjectById } from "@/server/repositories/projects";
import {
  getProjectWorkloadEstimate,
  saveWorkloadEstimateDraft,
  type WorkloadEstimateView,
} from "@/server/repositories/workload-estimates";
import { recordStageProgress } from "@/server/use-cases/stage-progress";

export type WorkloadEstimateDraft = {
  roleCount: number;
  sceneCount: number;
  shotCount: number;
  imageCount: number;
  videoCount: number;
  revisionRounds: number;
  deliverableVersions: string[];
  complexity: "low" | "medium" | "high";
  priceRange: { minCny: number; maxCny: number };
  rationale: string;
  riskNotes: string;
};

export type { WorkloadEstimateView, DeliveryChecklistView };

const aiWorkloadEstimateLineItemSchema = z.object({
  item: z.string().default(""),
  quantity: z.coerce.number().int().nonnegative().default(0),
  unit: z.string().default("项"),
  priceBasis: z.string().default(""),
});

const aiWorkloadEstimateResponseSchema = z.object({
  roleCount: z.coerce.number().int().nonnegative().default(0),
  sceneCount: z.coerce.number().int().nonnegative().default(0),
  shotCount: z.coerce.number().int().nonnegative().default(0),
  imageCount: z.coerce.number().int().nonnegative().default(0),
  videoCount: z.coerce.number().int().nonnegative().default(0),
  revisionRounds: z.coerce.number().int().nonnegative().default(2),
  deliverableVersions: z.array(z.string()).default(["横版成片"]),
  complexity: z.enum(["low", "medium", "high"]).default("medium"),
  minPriceCny: z.coerce.number().int().nonnegative().default(0),
  maxPriceCny: z.coerce.number().int().nonnegative().default(0),
  rationale: z.string().default(""),
  riskNotes: z.string().default(""),
  lineItems: z.array(aiWorkloadEstimateLineItemSchema).default([]),
});

type AiWorkloadEstimateResponse = z.infer<typeof aiWorkloadEstimateResponseSchema>;

const complexityValues = new Set(["low", "medium", "high"]);
const allowedChecklistKinds: DeliveryChecklistItemKind[] = [
  "horizontal_final",
  "vertical_final",
  "no_subtitle_final",
  "cover",
  "project_file",
  "generated_assets",
  "other",
];
const sop4WorkloadEstimateStatuses = new Set<WorkloadEstimateView["status"]>(["draft", "generated"]);
const sop4ChecklistStatuses = new Set<DeliveryChecklistView["status"]>(["draft", "changed", "confirmed"]);
const sop4ChecklistItemStatuses = new Set(["planned", "changed"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeWorkloadEstimate(value: unknown): WorkloadEstimateDraft {
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const minPrice = toNonnegativeInteger(record.minPriceCny);
  const maxPrice = toNonnegativeInteger(record.maxPriceCny);
  const [normalizedMin, normalizedMax] = normalizePriceRange(minPrice, maxPrice);
  const complexity = String(record.complexity ?? "medium");

  return {
    roleCount: toNonnegativeInteger(record.roleCount),
    sceneCount: toNonnegativeInteger(record.sceneCount),
    shotCount: toNonnegativeInteger(record.shotCount),
    imageCount: toNonnegativeInteger(record.imageCount),
    videoCount: toNonnegativeInteger(record.videoCount),
    revisionRounds: toNonnegativeInteger(record.revisionRounds),
    deliverableVersions: normalizeDeliverableVersions(record.deliverableVersions),
    complexity: complexityValues.has(complexity) ? (complexity as WorkloadEstimateDraft["complexity"]) : "medium",
    priceRange: {
      minCny: normalizedMin,
      maxCny: normalizedMax,
    },
    rationale: String(record.rationale ?? "").trim(),
    riskNotes: String(record.riskNotes ?? "").trim(),
  };
}

function normalizePriceRange(minPrice: number, maxPrice: number) {
  if (minPrice <= 0 && maxPrice <= 0) return [0, 0];
  if (minPrice <= 0) return [maxPrice, maxPrice];
  if (maxPrice <= 0) return [minPrice, minPrice];
  return minPrice <= maxPrice ? [minPrice, maxPrice] : [maxPrice, minPrice];
}

export async function saveProjectWorkloadEstimate(input: {
  projectId: string;
  actorId: string;
  estimate: unknown;
  status?: WorkloadEstimateView["status"];
}): Promise<WorkloadEstimateView> {
  const project = await getProjectById(input.projectId);
  if (!project) {
    throw new AppError({
      status: 404,
      code: "project_not_found",
      userMessage: "没有找到这个项目。请刷新项目列表后重试。",
    });
  }

  await assertProjectSop3Round2ClientApproved(input.projectId);
  const estimate = normalizeWorkloadEstimate(input.estimate);
  return saveWorkloadEstimateDraft({
    projectId: input.projectId,
    actorId: input.actorId,
    status: normalizeSop4WorkloadEstimateStatus(input.status),
    roleCount: estimate.roleCount,
    sceneCount: estimate.sceneCount,
    shotCount: estimate.shotCount,
    imageCount: estimate.imageCount,
    videoCount: estimate.videoCount,
    revisionRounds: estimate.revisionRounds,
    deliverableVersions: estimate.deliverableVersions,
    complexity: estimate.complexity,
    minPriceCny: estimate.priceRange.minCny,
    maxPriceCny: estimate.priceRange.maxCny,
    rationale: estimate.rationale,
    riskNotes: estimate.riskNotes,
  });
}

export async function generateProjectWorkloadEstimateDraft(input: {
  projectId: string;
  actorId: string;
}): Promise<WorkloadEstimateView> {
  const project = await getProjectById(input.projectId);
  if (!project) {
    throw new AppError({
      status: 404,
      code: "project_not_found",
      userMessage: "没有找到这个项目。请刷新项目列表后重试。",
    });
  }

  const [{ rounds }, creativeDirections, creativeExpansions] = await Promise.all([
    listCreativeProposalRounds(input.projectId),
    listProjectCreativeDirections(input.projectId),
    listProjectCreativeExpansions(input.projectId),
  ]);
  assertSop3Round2ClientApproved(rounds);
  const approvedRound2 = findApprovedSop3Round2(rounds);
  if (!approvedRound2) {
    throw new AppError({
      status: 409,
      code: "sop3_round2_client_review_required",
      userMessage: "请先完成 SOP 3 第二轮创意视觉提案的甲方确认，再生成工作量预估草稿。",
    });
  }

  const aiConfig = assertTextStructuringReady();
  const response = parseAiWorkloadEstimateResponse(
    await callArkJson<AiWorkloadEstimateResponse>({
      model: aiConfig.model,
      temperature: 0.15,
      maxOutputTokens: 1800,
      timeoutMs: 90_000,
      telemetry: {
        projectId: input.projectId,
        callId: `sop4-workload-estimate-${Date.now()}`,
        provider: aiConfig.provider,
        operation: "sop4_workload_estimate",
        metadata: {
          actorId: input.actorId,
          sourceRoundId: approvedRound2.id,
          directionCount: creativeDirections.length,
          expansionCount: creativeExpansions.length,
        },
      },
      messages: [
        {
          role: "system",
          content:
            "你是 AIGC 视频项目的商务制片和工作量估算专家。只依据输入中已确认的提案、方向、故事大纲和项目上下文进行预估，不新增剧情、不假设客户未确认的新交付。只输出严格 JSON，字段必须包含 roleCount, sceneCount, shotCount, imageCount, videoCount, revisionRounds, deliverableVersions, complexity, minPriceCny, maxPriceCny, rationale, riskNotes, lineItems。",
        },
        {
          role: "user",
          content: buildAiWorkloadEstimatePrompt({
            project,
            approvedRound2,
            creativeDirections,
            creativeExpansions,
          }),
        },
      ],
    })
  );
  const estimate = normalizeWorkloadEstimate(buildWorkloadEstimateInputFromAi(response));

  return saveWorkloadEstimateDraft({
    projectId: input.projectId,
    actorId: input.actorId,
    status: "generated",
    roleCount: estimate.roleCount,
    sceneCount: estimate.sceneCount,
    shotCount: estimate.shotCount,
    imageCount: estimate.imageCount,
    videoCount: estimate.videoCount,
    revisionRounds: estimate.revisionRounds,
    deliverableVersions: estimate.deliverableVersions,
    complexity: estimate.complexity,
    minPriceCny: estimate.priceRange.minCny,
    maxPriceCny: estimate.priceRange.maxCny,
    rationale: estimate.rationale,
    riskNotes: estimate.riskNotes,
    sourceRoundId: approvedRound2.id,
    sourceJobId: null,
  });
}

export async function createDeliveryChecklistFromEstimate(input: {
  projectId: string;
  estimateId: string;
  actorId: string;
}): Promise<DeliveryChecklistView> {
  await assertProjectSop3Round2ClientApproved(input.projectId);
  const estimate = await getProjectWorkloadEstimate(input.projectId);
  if (!estimate || estimate.id !== input.estimateId) {
    throw new AppError({
      status: 404,
      code: "workload_estimate_not_found",
      userMessage: "没有找到可用于生成交付清单的工作量估算。请先保存估算后再生成清单。",
    });
  }

  const existingChecklist = await getProjectDeliveryChecklistWithCancelled(input.projectId);
  const items = mergeChecklistItemsWithExistingIds(
    buildChecklistItemsFromEstimate(estimate),
    existingChecklist?.items ?? []
  );
  return createOrUpdateDeliveryChecklist({
    projectId: input.projectId,
    estimateId: estimate.id,
    actorId: input.actorId,
    status: "draft",
    notes: "交付清单由工作量估算生成，请在签约前人工核对数量、版本和新增需求。签约后新增交付物需要创建变更请求。",
    items,
  });
}

export async function saveProjectDeliveryChecklist(input: {
  projectId: string;
  actorId: string;
  estimateId?: string | null;
  status?: DeliveryChecklistView["status"];
  notes?: string;
  items: Array<SaveDeliveryChecklistItemInput>;
  removedItemIds?: string[];
}) {
  const existing = await getProjectDeliveryChecklist(input.projectId);
  const normalizedItems = input.items.map((item, index) => normalizeChecklistItem(item, index)).filter((item) => item.title);
  const submittedItemIds = new Set(normalizedItems.map((item) => item.id).filter(Boolean));
  const removedItemIds = normalizeRemovedChecklistItemIds(input.removedItemIds).filter((itemId) => !submittedItemIds.has(itemId));
  if (normalizedItems.length === 0) {
    throw new AppError({
      status: 422,
      code: "delivery_checklist_items_required",
      userMessage: "请至少保留一条交付物，再保存交付清单。",
    });
  }

  const status = normalizeSop4DeliveryChecklistStatus(input.status);
  const checklist = await createOrUpdateDeliveryChecklist({
    projectId: input.projectId,
    actorId: input.actorId,
    estimateId: input.estimateId ?? existing?.estimateId ?? null,
    status,
    notes: String(input.notes ?? "").trim(),
    items: normalizedItems,
    removedItemIds,
  });

  if (status === "confirmed") {
    await recordStageProgress({
      projectId: input.projectId,
      stageKey: "selection_quote_contract",
      status: "completed",
      currentStage: "script_storyboard_confirmation",
      projectStatus: "in_progress",
      title: "交付清单已确认",
      userMessage: "交付清单已确认，项目进入脚本、人物场景设定与文字分镜确认。",
      outputRefs: [{ type: "delivery_checklist", id: checklist.id }],
      snapshot: {
        deliveryChecklistId: checklist.id,
        status: checklist.status,
        version: checklist.version,
      },
    });
  }

  return checklist;
}

async function assertProjectSop3Round2ClientApproved(projectId: string) {
  const bundle = await listCreativeProposalRounds(projectId);
  assertSop3Round2ClientApproved(bundle.rounds);
}

export function assertSop3Round2ClientApproved(
  rounds: Array<Pick<CreativeProposalRoundView, "roundNumber" | "status" | "clientReviewTaskId">>
) {
  const approvedRound2 = rounds.some(
    (round) => round.roundNumber === 2 && round.status === "client_approved" && Boolean(round.clientReviewTaskId)
  );
  if (approvedRound2) return;

  throw new AppError({
    status: 409,
    code: "sop3_round2_client_review_required",
    userMessage: "请先完成 SOP 3 第二轮创意视觉提案的甲方确认，再保存 SOP 4 工作量估算或生成交付清单。",
  });
}

function findApprovedSop3Round2(rounds: CreativeProposalRoundView[]) {
  return rounds.find((round) => round.roundNumber === 2 && round.status === "client_approved" && Boolean(round.clientReviewTaskId)) ?? null;
}

function buildWorkloadEstimateInputFromAi(response: AiWorkloadEstimateResponse) {
  const itemizedRationale = response.lineItems
    .filter((item) => item.item.trim())
    .map((item) => `- ${item.item}：${item.quantity}${item.unit}。${item.priceBasis}`.trim())
    .join("\n");

  return {
    ...response,
    rationale: [response.rationale.trim(), itemizedRationale ? `分项估算：\n${itemizedRationale}` : ""]
      .filter(Boolean)
      .join("\n\n"),
  };
}

function parseAiWorkloadEstimateResponse(value: AiWorkloadEstimateResponse) {
  const parsed = aiWorkloadEstimateResponseSchema.safeParse(value);
  if (parsed.success) return parsed.data;

  throw new AppError({
    status: 502,
    code: "workload_estimate_model_output_invalid",
    userMessage: "AI 预估返回的工作量结构不完整。请稍后重试，或先手动填写工作量估算。",
  });
}

function buildAiWorkloadEstimatePrompt(input: {
  project: NonNullable<Awaited<ReturnType<typeof getProjectById>>>;
  approvedRound2: CreativeProposalRoundView;
  creativeDirections: CreativeDirectionView[];
  creativeExpansions: CreativeExpansionView[];
}) {
  const retainedDirectionIds = new Set(
    input.approvedRound2.retainedDirectionIds.length > 0
      ? input.approvedRound2.retainedDirectionIds
      : input.approvedRound2.directionIds
  );
  const relevantDirections = input.creativeDirections.filter(
    (direction) => retainedDirectionIds.has(direction.id) || direction.isSelected
  );
  const relevantExpansions = input.creativeExpansions.filter((expansion) => retainedDirectionIds.has(expansion.directionId));

  return [
    "请基于以下已确认的 SOP 3 第二轮创意提案，生成 SOP 4 工作量估算草稿。",
    "硬性要求：AI 只生成草稿，人工仍需核对保存后才能进入报价；不要把草稿描述成最终报价。",
    "输出 JSON 字段说明：roleCount 角色数；sceneCount 场景数；shotCount 预计镜头数；imageCount 预计图片/关键帧/候选图数量；videoCount 成片或视频生成数量；revisionRounds 建议修改轮次；deliverableVersions 交付版本；complexity 为 low/medium/high；minPriceCny/maxPriceCny 为建议价格区间；rationale 写明估算依据；riskNotes 写明影响报价的风险；lineItems 写分项、数量和计价依据。",
    "无法从提案确定的信息请在 rationale 或 riskNotes 标注待人工确认，不要编造。",
    "",
    "项目信息：",
    `品牌：${input.project.brandName}`,
    `项目：${input.project.projectName}`,
    `负责人：${input.project.ownerName}`,
    "",
    "已确认的 SOP 3 第二轮创意提案：",
    truncateText(JSON.stringify({
      roundId: input.approvedRound2.id,
      version: input.approvedRound2.version,
      directionIds: input.approvedRound2.directionIds,
      retainedDirectionIds: input.approvedRound2.retainedDirectionIds,
      clientFeedback: input.approvedRound2.clientFeedback,
      snapshot: input.approvedRound2.snapshot,
      concepts: input.approvedRound2.concepts.map((concept) => ({
        title: concept.title,
        description: concept.description,
        sourceText: concept.sourceText,
        requiredImageCount: concept.requiredImageCount,
        selectedImageCount: concept.selectedImageIds.length,
      })),
    }, null, 2), 6000),
    "",
    "已选/保留创意方向：",
    truncateText(JSON.stringify(relevantDirections.map((direction) => ({
      title: direction.title,
      coreIdea: direction.coreIdea,
      fitReason: direction.fitReason,
      costEstimate: direction.costEstimate,
      cycleEstimate: direction.cycleEstimate,
      technicalDifficulty: direction.technicalDifficulty,
      riskNotes: direction.riskNotes,
      detail: direction.detail,
    })), null, 2), 3600),
    "",
    "故事大纲/深化内容：",
    truncateText(JSON.stringify(relevantExpansions.map((expansion) => ({
      title: expansion.title,
      oneLiner: expansion.oneLiner,
      storyArc: expansion.storyArc,
      visualHighlights: expansion.visualHighlights,
      visualStyle: expansion.visualStyle,
      productionDifficulty: expansion.productionDifficulty,
      riskNotes: expansion.riskNotes,
    })), null, 2), 3600),
    "",
    "请给出可供商务人工核对的分项、数量与建议价格区间。",
  ].join("\n");
}

export function normalizeSop4WorkloadEstimateStatus(status?: WorkloadEstimateView["status"]) {
  const normalizedStatus = status ?? "draft";
  if (sop4WorkloadEstimateStatuses.has(normalizedStatus)) {
    return normalizedStatus;
  }

  throw new AppError({
    status: 422,
    code: "workload_estimate_status_not_supported_in_sop4",
    userMessage: "SOP 4 只能保存工作量估算草稿或生成状态。确认和归档状态不能通过工作量估算入口写入。",
  });
}

export function normalizeSop4DeliveryChecklistStatus(status?: DeliveryChecklistView["status"]) {
  const normalizedStatus = status ?? "draft";
  if (sop4ChecklistStatuses.has(normalizedStatus)) {
    return normalizedStatus;
  }

  throw new AppError({
    status: 422,
    code: "delivery_checklist_status_not_supported_in_sop4",
    userMessage: "SOP 4 只能保存交付清单草稿、变更状态或确认状态。归档请在 SOP 10 处理。",
  });
}

function buildChecklistItemsFromEstimate(estimate: WorkloadEstimateView): SaveDeliveryChecklistItemInput[] {
  const versionKinds = estimate.deliverableVersions.map(mapDeliverableVersionToKind);
  const fallbackKinds: DeliveryChecklistItemKind[] = ["horizontal_final"];
  const uniqueKinds = Array.from(new Set<DeliveryChecklistItemKind>(versionKinds.length > 0 ? versionKinds : fallbackKinds));
  const versionItems: SaveDeliveryChecklistItemInput[] = uniqueKinds.map((kind, index) => ({
    itemKind: kind,
    title: checklistTitle(kind),
    description: `${estimate.videoCount || 1} 条成片，报价签约前需确认分辨率、字幕和使用范围。`,
    quantity: Math.max(1, estimate.videoCount || 1),
    status: "planned" as const,
    sortOrder: index,
  }));

  return [
    ...versionItems,
    {
      itemKind: "cover",
      title: "封面图",
      description: "用于飞书交付和客户归档的主视觉封面。",
      quantity: 1,
      status: "planned" as const,
      sortOrder: versionItems.length,
    },
    {
      itemKind: "generated_assets",
      title: "确认版 AI 生成资产",
      description: `${estimate.imageCount} 张候选/确认图片与 ${estimate.videoCount} 条视频生成记录，按项目归档。`,
      quantity: Math.max(1, estimate.imageCount + estimate.videoCount),
      status: "planned" as const,
      sortOrder: versionItems.length + 1,
    },
    {
      itemKind: "project_file",
      title: "项目过程文件与交付记录",
      description: "包含确认脚本、分镜、审核记录、合同/报价快照和飞书发送记录。",
      quantity: 1,
      status: "planned" as const,
      sortOrder: versionItems.length + 2,
    },
  ];
}

export function mergeChecklistItemsWithExistingIds(
  generatedItems: SaveDeliveryChecklistItemInput[],
  existingItems: DeliveryChecklistView["items"]
): SaveDeliveryChecklistItemInput[] {
  const remainingItems = [...existingItems];
  const mergedItems: SaveDeliveryChecklistItemInput[] = [];

  for (const item of generatedItems) {
    const matchedIndex = findExistingChecklistItemIndex(remainingItems, item);
    if (matchedIndex < 0) {
      mergedItems.push(item);
      continue;
    }

    const [matchedItem] = remainingItems.splice(matchedIndex, 1);
    if (matchedItem.status === "cancelled") continue;

    mergedItems.push({ ...item, id: matchedItem.id });
  }

  return mergedItems;
}

function normalizeChecklistItem(item: SaveDeliveryChecklistItemInput, index: number): SaveDeliveryChecklistItemInput {
  const itemKind = allowedChecklistKinds.includes(item.itemKind) ? item.itemKind : "other";
  return {
    id: item.id,
    itemKind,
    title: String(item.title ?? "").trim(),
    description: String(item.description ?? "").trim(),
    quantity: Math.max(1, toNonnegativeInteger(item.quantity)),
    status: normalizeSop4ChecklistItemStatus(item.status),
    sortOrder: item.sortOrder ?? index,
    metadata: item.metadata ?? {},
  };
}

function normalizeRemovedChecklistItemIds(itemIds?: string[]) {
  if (!itemIds?.length) return [];
  const normalizedItemIds = Array.from(new Set(itemIds.map((itemId) => String(itemId).trim()).filter(Boolean)));
  const invalidItemId = normalizedItemIds.find((itemId) => !uuidPattern.test(itemId));
  if (invalidItemId) {
    throw new AppError({
      status: 422,
      code: "delivery_checklist_removed_item_id_invalid",
      userMessage: "交付清单里有无法识别的删除项。请刷新项目工作台后重试。",
    });
  }
  return normalizedItemIds;
}

export function normalizeSop4ChecklistItemStatus(status?: SaveDeliveryChecklistItemInput["status"]) {
  const normalizedStatus = status ?? "planned";
  if (sop4ChecklistItemStatuses.has(normalizedStatus)) {
    return normalizedStatus;
  }

  throw new AppError({
    status: 422,
    code: "delivery_checklist_item_status_not_supported_in_sop4",
    userMessage: "SOP 4 的交付清单项只能保存为计划中或已变更。最终确认请在 SOP 9 完成，交付归档请在 SOP 10 处理。",
  });
}

function findExistingChecklistItemIndex(
  existingItems: DeliveryChecklistView["items"],
  generatedItem: SaveDeliveryChecklistItemInput
) {
  const normalizedTitle = normalizeChecklistIdentityTitle(generatedItem.title);

  if (normalizedTitle) {
    const exactIndex = existingItems.findIndex(
      (item) => item.itemKind === generatedItem.itemKind && normalizeChecklistIdentityTitle(item.title) === normalizedTitle
    );
    if (exactIndex >= 0) return exactIndex;

    const titleFallbackIndex = existingItems.findIndex(
      (item) => normalizeChecklistIdentityTitle(item.title) === normalizedTitle
    );
    if (titleFallbackIndex >= 0) return titleFallbackIndex;
  }

  return existingItems.findIndex((item) => item.itemKind === generatedItem.itemKind);
}

function normalizeChecklistIdentityTitle(title: string) {
  return title.trim().toLowerCase();
}

function mapDeliverableVersionToKind(version: string): DeliveryChecklistItemKind {
  if (version.includes("竖")) return "vertical_final";
  if (version.includes("无字幕") || version.toLowerCase().includes("no subtitle")) return "no_subtitle_final";
  if (version.includes("封面")) return "cover";
  if (version.includes("工程") || version.includes("项目")) return "project_file";
  if (version.includes("资产") || version.includes("素材")) return "generated_assets";
  if (version.includes("横")) return "horizontal_final";
  return "other";
}

function checklistTitle(kind: DeliveryChecklistItemKind) {
  const labels: Record<DeliveryChecklistItemKind, string> = {
    horizontal_final: "横版成片",
    vertical_final: "竖版成片",
    no_subtitle_final: "无字幕版成片",
    cover: "封面图",
    project_file: "项目过程文件",
    generated_assets: "AI 生成资产归档",
    other: "其他交付物",
  };
  return labels[kind];
}

function normalizeDeliverableVersions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => String(item).trim()).filter(Boolean)));
}

function toNonnegativeInteger(value: unknown) {
  const normalized = typeof value === "string" ? value.replace(/[^\d.-]/g, "") : value;
  const numberValue = Number(normalized);
  if (!Number.isFinite(numberValue) || numberValue <= 0) return 0;
  return Math.floor(numberValue);
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}\n...（以上内容已截断，请基于已展示信息保守估算）`;
}
