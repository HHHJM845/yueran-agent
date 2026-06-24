import { z } from "zod";
import { createArtifact } from "@/server/repositories/artifacts";
import { createAuditLog } from "@/server/repositories/audit-logs";
import { upsertProjectContract, updateContractLatestSnapshot, type ContractTemplateFields, type ContractView } from "@/server/repositories/contracts";
import { createDocumentSnapshot } from "@/server/repositories/proposals";
import { recordStageProgress } from "@/server/use-cases/stage-progress";

const contractStatusSchema = z.enum(["draft", "waiting_review", "needs_revision", "confirmed", "sent", "signed", "terminated"]);

const contractTemplateFieldsSchema = z.object({
  partyAName: z.string().trim().min(1, "请输入甲方名称"),
  partyBName: z.string().trim().min(1, "请输入乙方名称"),
  projectName: z.string().trim().min(1, "请输入项目名称"),
  quoteTitle: z.string().trim().default(""),
  quoteTotalAmount: z.coerce.number().nonnegative().default(0),
  quoteCurrency: z.string().trim().min(3).max(8).default("CNY"),
  deliveryScope: z.string().trim().min(4, "请输入交付范围"),
  paymentTerms: z.string().trim().min(4, "请输入付款条款"),
  effectiveDate: z.string().trim().min(4, "请输入合同生效日期"),
});

export const saveContractInputSchema = z.object({
  title: z.string().trim().min(2, "请输入合同标题"),
  templateKey: z.string().trim().min(2).default("default_aigc_video_contract"),
  templateFields: contractTemplateFieldsSchema,
  content: z.string().trim().optional(),
  status: contractStatusSchema.default("draft"),
  proposalId: z.string().uuid().nullable().optional(),
  quoteId: z.string().uuid().nullable().optional(),
  clientContractAssetId: z.string().uuid().nullable().optional(),
});

export async function saveProjectContract(input: {
  projectId: string;
  actorId: string;
  title: string;
  templateKey?: string;
  templateFields: ContractTemplateFields;
  content?: string;
  status?: string;
  proposalId?: string | null;
  quoteId?: string | null;
  clientContractAssetId?: string | null;
}) {
  const parsed = saveContractInputSchema.parse({
    title: input.title,
    templateKey: input.templateKey ?? "default_aigc_video_contract",
    templateFields: input.templateFields,
    content: input.content,
    status: input.status ?? "draft",
    proposalId: input.proposalId ?? null,
    quoteId: input.quoteId ?? null,
    clientContractAssetId: input.clientContractAssetId ?? null,
  });
  const content = parsed.content?.trim() || buildContractContent({
    title: parsed.title,
    ...parsed.templateFields,
  });

  const contract = await upsertProjectContract({
    projectId: input.projectId,
    proposalId: parsed.proposalId ?? null,
    quoteId: parsed.quoteId ?? null,
    clientContractAssetId: parsed.clientContractAssetId ?? null,
    title: parsed.title,
    templateKey: parsed.templateKey,
    templateFields: parsed.templateFields,
    content,
    status: parsed.status,
    actorId: input.actorId,
  });
  const snapshotData = buildContractSnapshotData(contract);
  const snapshot = await createDocumentSnapshot({
    projectId: input.projectId,
    documentType: "contract",
    documentId: contract.id,
    title: contract.title,
    version: contract.version,
    status: contract.status,
    content: contract.content,
    summary: snapshotData.summary,
    snapshot: snapshotData,
    createdBy: input.actorId,
  });

  await updateContractLatestSnapshot({
    contractId: contract.id,
    snapshotId: snapshot.id,
  });

  const artifact = await createArtifact({
    projectId: input.projectId,
    kind: "contract",
    title: `合同快照：${contract.title}`,
    status: contract.status,
    data: {
      contractId: contract.id,
      snapshotId: snapshot.id,
      title: contract.title,
      templateKey: contract.templateKey,
      templateFields: contract.templateFields,
      content: contract.content,
      status: contract.status,
      version: contract.version,
      summary: snapshot.summary,
    },
  });

  await recordStageProgress({
    projectId: input.projectId,
    stageKey: "selection_quote_contract",
    status: contract.status === "signed" ? "completed" : contract.status === "confirmed" || contract.status === "sent" ? "waiting_review" : "in_progress",
    currentStage: contract.status === "signed" ? "settlement_delivery_archive" : "selection_quote_contract",
    projectStatus: contract.status === "signed" ? "completed" : contract.status === "needs_revision" ? "needs_revision" : "in_progress",
    title: contract.status === "signed" ? "报价与签约已完成" : "合同快照已保存",
    userMessage:
      contract.status === "signed"
        ? "合同已签约，项目已进入结算交付与归档预留阶段。"
        : "合同已保存到项目快照，可以继续确认、导出或发送飞书。",
    outputRefs: [
      { type: "contract", id: contract.id },
      { type: "document_snapshot", id: snapshot.id },
      { type: "artifact", id: artifact.id, kind: artifact.kind },
    ],
    snapshot: {
      contractId: contract.id,
      snapshotId: snapshot.id,
      status: contract.status,
      version: contract.version,
    },
  });

  await createAuditLog({
    actorId: input.actorId,
    projectId: input.projectId,
    action: "contract.saved",
    objectType: "contract",
    objectId: contract.id,
    after: {
      projectId: input.projectId,
      snapshotId: snapshot.id,
      status: contract.status,
      version: contract.version,
      quoteId: contract.quoteId,
      proposalId: contract.proposalId,
      clientContractAssetId: contract.clientContractAssetId,
    },
  });

  return {
    contract: {
      ...contract,
      latestSnapshotId: snapshot.id,
    },
    snapshot,
    artifact,
  };
}

export function buildContractContent(input: { title: string } & ContractTemplateFields) {
  return [
    input.title,
    "",
    `甲方：${input.partyAName}`,
    `乙方：${input.partyBName}`,
    `项目名称：${input.projectName}`,
    `关联报价：${input.quoteTitle || "待确认"}`,
    `报价金额：${formatMoney(input.quoteTotalAmount, input.quoteCurrency)}`,
    "",
    "一、交付范围",
    input.deliveryScope,
    "",
    "二、付款条款",
    input.paymentTerms,
    "",
    "三、生效日期",
    input.effectiveDate,
    "",
    "四、补充约定",
    "双方确认，本合同所涉 AIGC 视频创意、生成素材、修改轮次和交付方式以后续确认版本为准。",
  ].join("\n");
}

export function buildContractSnapshotData(input: Pick<ContractView, "id" | "title" | "templateKey" | "templateFields" | "content" | "status" | "version"> | {
  contractId: string;
  title: string;
  templateKey: string;
  templateFields: ContractTemplateFields;
  content: string;
  status: string;
  version: number;
}) {
  const contractId = "contractId" in input ? input.contractId : input.id;
  const summary = buildContractSummary(input.content);

  return {
    contractId,
    version: input.version,
    title: input.title,
    status: input.status,
    templateKey: input.templateKey,
    templateFields: input.templateFields,
    summary,
    content: input.content,
    capturedAt: new Date().toISOString(),
  };
}

function buildContractSummary(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= 24) return normalized;
  const maxLength = Math.min(120, normalized.length - 4);
  return `${normalized.slice(0, maxLength)}...`;
}

function formatMoney(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}
