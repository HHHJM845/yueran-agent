import { z } from "zod";
import { buildSop4ContractTemplateContent } from "@/domain/contract-template";
import { AppError } from "@/lib/errors";
import { createArtifact } from "@/server/repositories/artifacts";
import { createAuditLog } from "@/server/repositories/audit-logs";
import { upsertProjectContract, updateContractLatestSnapshot, type ContractMode, type ContractTemplateFields, type ContractView } from "@/server/repositories/contracts";
import { createDocumentSnapshot } from "@/server/repositories/proposals";
import { recordStageProgress } from "@/server/use-cases/stage-progress";

const contractStatusSchema = z.enum(["draft", "waiting_review", "needs_revision", "confirmed", "sent", "signed", "terminated"]);
const contractModeSchema = z.enum(["vendor_provided", "client_provided"]);

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

const contractTemplateFieldsBaseSchema = contractTemplateFieldsSchema.partial({
  deliveryScope: true,
  paymentTerms: true,
  effectiveDate: true,
}).extend({
  partyAName: z.string().trim().min(1, "请输入甲方名称"),
  partyBName: z.string().trim().min(1, "请输入乙方名称"),
  projectName: z.string().trim().min(1, "请输入项目名称"),
  quoteTitle: z.string().trim().default(""),
  quoteTotalAmount: z.coerce.number().nonnegative().default(0),
  quoteCurrency: z.string().trim().min(3).max(8).default("CNY"),
  deliveryScope: z.string().trim().default(""),
  paymentTerms: z.string().trim().default(""),
  effectiveDate: z.string().trim().default(""),
});

const saveContractBaseInputSchema = z.object({
  mode: contractModeSchema.default("vendor_provided"),
  title: z.string().trim().min(2, "请输入合同标题"),
  templateKey: z.string().trim().min(2).default("default_aigc_video_contract"),
  templateFields: contractTemplateFieldsBaseSchema,
  content: z.string().trim().optional(),
  status: contractStatusSchema.default("draft"),
  proposalId: z.string().uuid().nullable().optional(),
  quoteId: z.string().uuid().nullable().optional(),
  clientContractAssetId: z.string().uuid().nullable().optional(),
  signedContractAssetId: z.string().uuid().nullable().optional(),
});

export const saveContractInputSchema = saveContractBaseInputSchema.superRefine((value, context) => {
  if (value.mode === "vendor_provided") {
    if (value.templateFields.deliveryScope.trim().length < 4) {
      context.addIssue({
        code: "custom",
        path: ["templateFields", "deliveryScope"],
        message: "请输入交付范围",
      });
    }
    if (value.templateFields.paymentTerms.trim().length < 4) {
      context.addIssue({
        code: "custom",
        path: ["templateFields", "paymentTerms"],
        message: "请输入付款条款",
      });
    }
    if (value.templateFields.effectiveDate.trim().length < 4) {
      context.addIssue({
        code: "custom",
        path: ["templateFields", "effectiveDate"],
        message: "请输入合同生效日期",
      });
    }
  }
});

export function buildContractStageProgressInput(input: {
  projectId: string;
  contractId: string;
  snapshotId: string;
  artifactId: string;
  artifactKind: string;
  status: string;
  version: number;
}) {
  const signed = input.status === "signed";

  return {
    projectId: input.projectId,
    stageKey: "selection_quote_contract" as const,
    status: signed ? ("completed" as const) : input.status === "confirmed" || input.status === "sent" ? ("waiting_review" as const) : ("in_progress" as const),
    currentStage: signed ? ("script_storyboard_confirmation" as const) : ("selection_quote_contract" as const),
    projectStatus: signed ? ("in_progress" as const) : input.status === "needs_revision" ? ("needs_revision" as const) : ("in_progress" as const),
    title: signed ? "报价与签约已完成" : "合同快照已保存",
    userMessage: signed
      ? "合同已签署，项目可以进入脚本、人物、场景设定与文字分镜确认。"
      : "合同已保存到项目快照，可以继续确认、导出或发送飞书。",
    outputRefs: [
      { type: "contract", id: input.contractId },
      { type: "document_snapshot", id: input.snapshotId },
      { type: "artifact", id: input.artifactId, kind: input.artifactKind },
    ],
    snapshot: {
      contractId: input.contractId,
      snapshotId: input.snapshotId,
      status: input.status,
      version: input.version,
    },
  };
}

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
  signedContractAssetId?: string | null;
  mode?: ContractMode;
}) {
  const rawParsed = saveContractBaseInputSchema.parse({
    mode: input.mode ?? "vendor_provided",
    title: input.title,
    templateKey: input.templateKey ?? "default_aigc_video_contract",
    templateFields: input.templateFields,
    content: input.content,
    status: input.status ?? "draft",
    proposalId: input.proposalId ?? null,
    quoteId: input.quoteId ?? null,
    clientContractAssetId: input.clientContractAssetId ?? null,
    signedContractAssetId: input.signedContractAssetId ?? null,
  });
  if (rawParsed.status === "signed" && !rawParsed.signedContractAssetId) {
    throw new AppError({
      status: 422,
      code: "contract_signed_proof_required",
      userMessage: "请先上传已签署的合同文件再标记为已签署。",
    });
  }

  const parsed = saveContractInputSchema.parse({
    mode: rawParsed.mode,
    title: rawParsed.title,
    templateKey: rawParsed.templateKey,
    templateFields: rawParsed.templateFields,
    content: rawParsed.content,
    status: rawParsed.status,
    proposalId: rawParsed.proposalId ?? null,
    quoteId: rawParsed.quoteId ?? null,
    clientContractAssetId: rawParsed.clientContractAssetId ?? null,
    signedContractAssetId: rawParsed.signedContractAssetId ?? null,
  });
  if (parsed.status === "signed" && !parsed.signedContractAssetId) {
    throw new AppError({
      status: 422,
      code: "contract_signed_proof_required",
      userMessage: "请先上传已签署的合同文件再标记为已签署。",
    });
  }

  const content = buildPersistedContractContent({
    mode: parsed.mode,
    title: parsed.title,
    fields: parsed.templateFields,
    content: parsed.content,
  });

  const contract = await upsertProjectContract({
    projectId: input.projectId,
    proposalId: parsed.proposalId ?? null,
    quoteId: parsed.quoteId ?? null,
    clientContractAssetId: parsed.clientContractAssetId ?? null,
    signedContractAssetId: parsed.signedContractAssetId ?? null,
    mode: parsed.mode,
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
      mode: contract.mode,
      signedContractAssetId: contract.signedContractAssetId,
      summary: snapshot.summary,
    },
  });

  await recordStageProgress(
    buildContractStageProgressInput({
      projectId: input.projectId,
      contractId: contract.id,
      snapshotId: snapshot.id,
      artifactId: artifact.id,
      artifactKind: artifact.kind,
      status: contract.status,
      version: contract.version,
    }),
  );

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
      signedContractAssetId: contract.signedContractAssetId,
      mode: contract.mode,
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
  return buildSop4ContractTemplateContent(input);
}

export function buildPersistedContractContent(input: {
  mode: ContractMode;
  title: string;
  fields: ContractTemplateFields;
  content?: string | null;
}) {
  const trimmedContent = input.content?.trim();
  if (trimmedContent) return trimmedContent;
  if (input.mode === "client_provided") {
    return "本合同以甲方上传的合同文件为准；系统仅保存签署状态、合同元数据与已签署文件凭证。";
  }
  return buildContractContent({
    title: input.title,
    ...input.fields,
  });
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
