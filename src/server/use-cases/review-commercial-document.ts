import { z } from "zod";
import { AppError } from "@/lib/errors";
import type { StageStatus } from "@/domain/types";
import { createAuditLog } from "@/server/repositories/audit-logs";
import { getProjectContract, updateContractStatus } from "@/server/repositories/contracts";
import { updateQuoteStatus } from "@/server/repositories/quotes";
import { recordStageProgress } from "@/server/use-cases/stage-progress";

export const commercialDocumentTypeSchema = z.enum(["quote", "contract"]);
export type CommercialDocumentType = z.infer<typeof commercialDocumentTypeSchema>;

export const commercialReviewActionSchema = z.enum([
  "submit_review",
  "approve",
  "request_revision",
  "mark_sent",
  "mark_signed",
  "terminate",
]);
export type CommercialReviewAction = z.infer<typeof commercialReviewActionSchema>;

const actionToStatus: Record<CommercialReviewAction, string> = {
  submit_review: "waiting_review",
  approve: "confirmed",
  request_revision: "needs_revision",
  mark_sent: "sent",
  mark_signed: "signed",
  terminate: "terminated",
};

export const reviewCommercialDocumentInputSchema = z.object({
  documentType: commercialDocumentTypeSchema,
  documentId: z.string().uuid(),
  action: commercialReviewActionSchema,
  reason: z.string().trim().max(500, "原因最多 500 字").optional().default(""),
});

export async function reviewCommercialDocument(input: {
  projectId: string;
  actorId: string;
  documentType: CommercialDocumentType;
  documentId: string;
  action: CommercialReviewAction;
  reason?: string | null;
}) {
  const parsed = reviewCommercialDocumentInputSchema.parse({
    documentType: input.documentType,
    documentId: input.documentId,
    action: input.action,
    reason: input.reason ?? "",
  });
  const nextStatus = actionToStatus[parsed.action];

  if (parsed.documentType === "contract" && parsed.action === "mark_signed") {
    const contract = await getProjectContract(input.projectId);
    if (!contract || contract.id !== parsed.documentId) {
      throw new AppError({
        status: 404,
        code: "commercial_document_not_found",
        userMessage: "没有找到这份合同。请刷新项目后再试。",
      });
    }
    if (!contract.signedContractAssetId) {
      throw new AppError({
        status: 422,
        code: "contract_signed_proof_required",
        userMessage: "请先上传已签署的合同文件再标记为已签署。",
      });
    }
  }

  const document =
    parsed.documentType === "quote"
      ? await updateQuoteStatus({
          projectId: input.projectId,
          quoteId: parsed.documentId,
          status: nextStatus,
          actorId: input.actorId,
        })
      : await updateContractStatus({
          projectId: input.projectId,
          contractId: parsed.documentId,
          status: nextStatus,
          actorId: input.actorId,
        });

  if (!document) {
    throw new AppError({
      status: 404,
      code: "commercial_document_not_found",
      userMessage: parsed.documentType === "quote" ? "没有找到这份报价。请刷新项目后再试。" : "没有找到这份合同。请刷新项目后再试。",
    });
  }

  const stage = mapCommercialStageProgress({
    documentType: parsed.documentType,
    action: parsed.action,
    status: nextStatus,
    title: document.title,
    reason: parsed.reason,
  });

  await recordStageProgress({
    projectId: input.projectId,
    stageKey: "selection_quote_contract",
    status: stage.stageStatus,
    currentStage: stage.currentStage,
    projectStatus: stage.projectStatus,
    title: stage.title,
    userMessage: stage.userMessage,
    errorMessage: stage.errorMessage,
    outputRefs: [{ type: parsed.documentType, id: document.id }],
    snapshot: {
      documentType: parsed.documentType,
      documentId: document.id,
      action: parsed.action,
      status: nextStatus,
      reason: parsed.reason || null,
      version: document.version,
      latestSnapshotId: document.latestSnapshotId,
    },
  });

  await createAuditLog({
    actorId: input.actorId,
    projectId: input.projectId,
    action: `${parsed.documentType}.${parsed.action}`,
    objectType: parsed.documentType,
    objectId: document.id,
    after: {
      projectId: input.projectId,
      action: parsed.action,
      status: nextStatus,
      reason: parsed.reason || null,
      version: document.version,
      latestSnapshotId: document.latestSnapshotId,
    },
  });

  return {
    document,
    message: stage.userMessage,
  };
}

export function mapCommercialStageProgress(input: {
  documentType: CommercialDocumentType;
  action: CommercialReviewAction;
  status: string;
  title: string;
  reason: string;
}) {
  const documentLabel = input.documentType === "quote" ? "报价" : "合同";
  const reasonSuffix = input.reason ? `原因：${input.reason}` : "";

  if (input.action === "request_revision") {
    return {
      stageStatus: "needs_revision" as StageStatus,
      currentStage: "selection_quote_contract" as const,
      projectStatus: "needs_revision" as StageStatus,
      title: `${documentLabel}需要修改`,
      userMessage: `${documentLabel}已标记为需要修改。${reasonSuffix || "请根据审核意见修改后重新提交。"}`,
      errorMessage: reasonSuffix || `${documentLabel}需要修改。`,
    };
  }

  if (input.action === "terminate") {
    return {
      stageStatus: "blocked" as StageStatus,
      currentStage: "selection_quote_contract" as const,
      projectStatus: "blocked" as StageStatus,
      title: `${documentLabel}已终止`,
      userMessage: `${documentLabel}已终止。${reasonSuffix || "项目进入阻塞状态，后续如需恢复请重新确认商务方案。"}`,
      errorMessage: reasonSuffix || `${documentLabel}已终止。`,
    };
  }

  if (input.action === "mark_signed") {
    return {
      stageStatus: "completed" as StageStatus,
      currentStage: "script_storyboard_confirmation" as const,
      projectStatus: "in_progress" as StageStatus,
      title: "报价与签约已完成",
      userMessage: `${documentLabel}已签署，项目可以进入脚本、人物场景设定与文字分镜确认。`,
      errorMessage: null,
    };
  }

  if (input.action === "approve") {
    return {
      stageStatus: "approved" as StageStatus,
      currentStage: "selection_quote_contract" as const,
      projectStatus: "in_progress" as StageStatus,
      title: `${documentLabel}已审核确认`,
      userMessage: `${documentLabel}已确认，可以继续导出、发送飞书或推进签署。`,
      errorMessage: null,
    };
  }

  if (input.action === "mark_sent") {
    return {
      stageStatus: "waiting_review" as StageStatus,
      currentStage: "selection_quote_contract" as const,
      projectStatus: "waiting_review" as StageStatus,
      title: `${documentLabel}已发送`,
      userMessage: `${documentLabel}已标记为已发送，项目正在等待甲方确认。`,
      errorMessage: null,
    };
  }

  return {
    stageStatus: "waiting_review" as StageStatus,
    currentStage: "selection_quote_contract" as const,
    projectStatus: "in_progress" as StageStatus,
    title: `${documentLabel}已提交审核`,
    userMessage: `${documentLabel}已提交审核，请管理员确认或驳回。`,
    errorMessage: null,
  };
}

export function commercialReviewActionLabel(action: CommercialReviewAction) {
  const labels: Record<CommercialReviewAction, string> = {
    submit_review: "提交审核",
    approve: "审核确认",
    request_revision: "驳回修改",
    mark_sent: "标记已发送",
    mark_signed: "标记已签署",
    terminate: "终止",
  };
  return labels[action];
}
