import { AppError } from "@/lib/errors";
import { getProjectDeliveryChecklist, createOrUpdateDeliveryChecklist } from "@/server/repositories/delivery-checklists";
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
const sop4ChecklistStatuses = new Set<DeliveryChecklistView["status"]>(["draft", "changed"]);
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

  const estimate = normalizeWorkloadEstimate(input.estimate);
  return saveWorkloadEstimateDraft({
    projectId: input.projectId,
    actorId: input.actorId,
    status: input.status ?? "draft",
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

export async function createDeliveryChecklistFromEstimate(input: {
  projectId: string;
  estimateId: string;
  actorId: string;
}): Promise<DeliveryChecklistView> {
  const estimate = await getProjectWorkloadEstimate(input.projectId);
  if (!estimate || estimate.id !== input.estimateId) {
    throw new AppError({
      status: 404,
      code: "workload_estimate_not_found",
      userMessage: "没有找到可用于生成交付清单的工作量估算。请先保存估算后再生成清单。",
    });
  }

  const existingChecklist = await getProjectDeliveryChecklist(input.projectId);
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

  return createOrUpdateDeliveryChecklist({
    projectId: input.projectId,
    actorId: input.actorId,
    estimateId: input.estimateId ?? existing?.estimateId ?? null,
    status: normalizeSop4DeliveryChecklistStatus(input.status),
    notes: String(input.notes ?? "").trim(),
    items: normalizedItems,
    removedItemIds,
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
    userMessage: "SOP 4 只能保存交付清单草稿或变更状态。最终确认请在 SOP 9 完成，归档请在 SOP 10 处理。",
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

  return generatedItems.map((item) => {
    const matchedIndex = findExistingChecklistItemIndex(remainingItems, item);
    if (matchedIndex < 0) return item;

    const [matchedItem] = remainingItems.splice(matchedIndex, 1);
    return { ...item, id: matchedItem.id };
  });
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
