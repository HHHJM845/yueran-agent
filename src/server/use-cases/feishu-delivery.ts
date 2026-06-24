import { z } from "zod";
import { AppError } from "@/lib/errors";
import { createFeishuDocumentWithMarkdown, sendFeishuTextMessage } from "@/server/providers/feishu";
import { createArtifact } from "@/server/repositories/artifacts";
import {
  getProjectFeishuReceiver,
  markFeishuReceiverDeliveryResult,
  upsertProjectFeishuReceiver,
} from "@/server/repositories/feishu-receivers";
import {
  createFeishuDelivery,
  getFeishuDeliveryByJobId,
  getProjectFeishuDelivery,
  markFailedFeishuDeliveryRetrying,
  markFeishuDeliveryDocumentCreated,
  markFeishuDeliveryFailed,
  markFeishuDeliveryProcessing,
  markFeishuDeliverySucceeded,
  updateFeishuDeliverySourceJob,
  type FeishuDeliveryDocumentType,
  type FeishuReceiverType,
} from "@/server/repositories/feishu-deliveries";
import { appendJobEvent, createJob, getJobInput, updateJobStatus } from "@/server/repositories/jobs";
import { listProjectDocumentSnapshots, type DocumentSnapshotView } from "@/server/repositories/proposals";
import { recordStageProgress } from "@/server/use-cases/stage-progress";

const feishuDeliveryDocumentTypeSchema = z.enum(["proposal", "quote", "contract"]);
const feishuReceiverTypeSchema = z.enum(["user", "chat"]);

const feishuDeliveryJobInputSchema = z.object({
  deliveryId: z.string().uuid(),
  documentType: feishuDeliveryDocumentTypeSchema,
  documentId: z.string().uuid(),
  snapshotId: z.string().uuid().nullable(),
  receiverType: feishuReceiverTypeSchema,
  receiverId: z.string().min(1),
  receiverName: z.string().optional().default(""),
  receiverRefId: z.string().uuid().nullable().optional(),
  requestedBy: z.string().uuid().nullable().optional(),
});

const retryFeishuDeliveryRequestSchema = z.object({
  receiverType: z.string().optional(),
  receiverId: z.string().trim().min(2, "请输入飞书接收人的 open_id 或群聊 chat_id").optional(),
  receiverName: z.string().trim().optional(),
  receiverRefId: z.string().uuid().nullable().optional(),
});

export const enqueueFeishuDeliveryInputSchema = z.object({
  documentType: feishuDeliveryDocumentTypeSchema,
  documentId: z.string().uuid(),
  snapshotId: z.string().uuid().nullable().optional(),
  receiverType: z.string().optional().default("chat"),
  receiverId: z.string().trim().optional().default(""),
  receiverName: z.string().trim().optional().default(""),
  receiverRefId: z.string().uuid().nullable().optional(),
  saveReceiver: z.boolean().optional().default(false),
});

export function sanitizeReceiverType(value: unknown): FeishuReceiverType {
  return value === "user" || value === "chat" ? value : "chat";
}

export async function enqueueFeishuDelivery(input: {
  projectId: string;
  documentType: FeishuDeliveryDocumentType;
  documentId: string;
  snapshotId?: string | null;
  receiverType: string;
  receiverId: string;
  receiverName?: string | null;
  receiverRefId?: string | null;
  saveReceiver?: boolean;
  requestedBy: string;
}) {
  const parsed = enqueueFeishuDeliveryInputSchema.parse({
    documentType: input.documentType,
    documentId: input.documentId,
    snapshotId: input.snapshotId ?? null,
    receiverType: input.receiverType,
    receiverId: input.receiverId,
    receiverName: input.receiverName ?? "",
    receiverRefId: input.receiverRefId ?? null,
    saveReceiver: Boolean(input.saveReceiver),
  });
  const receiver = await resolveDeliveryReceiver({
    projectId: input.projectId,
    receiverType: parsed.receiverType,
    receiverId: parsed.receiverId,
    receiverName: parsed.receiverName,
    receiverRefId: parsed.receiverRefId ?? null,
    saveReceiver: parsed.saveReceiver,
    requestedBy: input.requestedBy,
  });
  const snapshots = await listProjectDocumentSnapshots(input.projectId);
  const targetSnapshot = resolveDeliverySnapshot({
    snapshots,
    documentType: parsed.documentType,
    documentId: parsed.documentId,
    snapshotId: parsed.snapshotId,
  });
  const markdown = buildFeishuDeliveryMarkdown(buildDeliveryDocumentBundle(snapshots, targetSnapshot));
  const delivery = await createFeishuDelivery({
    projectId: input.projectId,
    documentType: parsed.documentType,
    documentId: parsed.documentId,
    snapshotId: targetSnapshot.id,
    title: `${targetSnapshot.title} 飞书交付`,
    content: markdown,
    receiverType: receiver.receiverType,
    receiverId: receiver.receiverId,
    receiverName: receiver.receiverName,
    receiverRefId: receiver.receiverRefId,
    createdBy: input.requestedBy,
  });
  const { jobId } = await createJob({
    projectId: input.projectId,
    type: "feishu_delivery",
    title: `飞书交付：${targetSnapshot.title}`,
    inputJson: {
      deliveryId: delivery.id,
      documentType: parsed.documentType,
      documentId: parsed.documentId,
      snapshotId: targetSnapshot.id,
      receiverType: receiver.receiverType,
      receiverId: receiver.receiverId,
      receiverName: receiver.receiverName,
      receiverRefId: receiver.receiverRefId,
      requestedBy: input.requestedBy,
    },
    createdBy: input.requestedBy,
    maxAttempts: 2,
  });
  const updatedDelivery = await updateFeishuDeliverySourceJob({
    deliveryId: delivery.id,
    sourceJobId: jobId,
  });

  return {
    jobId,
    delivery: updatedDelivery,
  };
}

export async function retryFeishuDelivery(input: {
  projectId: string;
  deliveryId: string;
  receiverType?: string;
  receiverId?: string;
  receiverName?: string | null;
  receiverRefId?: string | null;
  requestedBy: string;
}) {
  const parsed = retryFeishuDeliveryRequestSchema.parse({
    receiverType: input.receiverType,
    receiverId: input.receiverId,
    receiverName: input.receiverName ?? undefined,
    receiverRefId: input.receiverRefId ?? null,
  });
  const delivery = await getProjectFeishuDelivery({
    projectId: input.projectId,
    deliveryId: input.deliveryId,
  });

  if (!delivery) {
    throw new AppError({
      status: 404,
      code: "feishu_delivery_not_found",
      userMessage: "没有找到这条飞书交付记录。请刷新项目后再试。",
    });
  }

  if (delivery.status !== "failed") {
    throw new AppError({
      status: 409,
      code: "feishu_delivery_not_retryable",
      userMessage: "这条飞书交付当前不能补发。只有失败状态的交付记录可以重新入队。",
    });
  }

  const receiver = await resolveRetryDeliveryReceiver({
    projectId: input.projectId,
    currentReceiverType: delivery.receiverType,
    currentReceiverId: delivery.receiverId,
    currentReceiverName: delivery.receiverName,
    requestedReceiverType: parsed.receiverType,
    requestedReceiverId: parsed.receiverId,
    requestedReceiverName: parsed.receiverName,
    receiverRefId: parsed.receiverRefId ?? null,
  });
  const retryMessage = buildFeishuDeliveryRetryQueuedMessage({
    previousFailureReason: delivery.failureReason,
    hasReusableDocument: Boolean(delivery.feishuDocumentToken && delivery.feishuDocumentUrl),
  });
  const { jobId } = await createJob({
    projectId: input.projectId,
    type: "feishu_delivery",
    title: `飞书补发：${delivery.title}`,
    inputJson: {
      deliveryId: delivery.id,
      documentType: delivery.documentType,
      documentId: delivery.documentId,
      snapshotId: delivery.snapshotId,
      receiverType: receiver.receiverType,
      receiverId: receiver.receiverId,
      receiverName: receiver.receiverName,
      receiverRefId: receiver.receiverRefId,
      requestedBy: input.requestedBy,
    },
    createdBy: input.requestedBy,
    maxAttempts: 2,
  });
  const retriedDelivery = await markFailedFeishuDeliveryRetrying({
    projectId: input.projectId,
    deliveryId: delivery.id,
    sourceJobId: jobId,
    receiverType: receiver.receiverType,
    receiverId: receiver.receiverId,
    receiverName: receiver.receiverName,
    receiverRefId: receiver.receiverRefId,
    retryMessage,
  });

  if (!retriedDelivery) {
    await updateJobStatus(jobId, {
      status: "cancelled",
      currentStep: "cancelled",
      userMessage: "这条飞书交付状态已经变化，本次补发任务已取消。请刷新项目后查看最新状态。",
    });
    throw new AppError({
      status: 409,
      code: "feishu_delivery_not_retryable",
      userMessage: "这条飞书交付状态已经变化，未能重新入队。请刷新项目后再试。",
    });
  }

  await recordStageProgress({
    projectId: input.projectId,
    stageKey: "selection_quote_contract",
    status: "in_progress",
    currentStage: "selection_quote_contract",
    projectStatus: "in_progress",
    jobId,
    title: "飞书交付补发已入队",
    userMessage: "飞书交付补发已重新进入队列。系统会保留已创建的飞书文档链接，并重新发送给指定对象。",
    inputRefs: buildDeliveryInputRefs(retriedDelivery),
    outputRefs: [{ type: "feishu_delivery", id: retriedDelivery.id }],
    snapshot: {
      deliveryId: retriedDelivery.id,
      receiverType: retriedDelivery.receiverType,
      receiverName: retriedDelivery.receiverName,
      receiverId: retriedDelivery.receiverId,
      receiverRefId: retriedDelivery.receiverRefId,
      feishuDocumentUrl: retriedDelivery.feishuDocumentUrl,
      retryCount: retriedDelivery.retryCount,
    },
  });

  return {
    jobId,
    delivery: retriedDelivery,
  };
}

export async function runFeishuDeliveryJob(jobId: string, options: { workerManagedFailure?: boolean } = {}) {
  const job = await getJobInput<z.infer<typeof feishuDeliveryJobInputSchema>>(jobId);
  if (!job) {
    throw new AppError({
      status: 404,
      code: "job_not_found",
      userMessage: "没有找到这个飞书交付任务。",
    });
  }

  const parsedInput = feishuDeliveryJobInputSchema.parse(job.input);
  const delivery = await getFeishuDeliveryByJobId(jobId);
  if (!delivery || delivery.id !== parsedInput.deliveryId) {
    throw new AppError({
      status: 404,
      code: "feishu_delivery_not_found",
      userMessage: "没有找到这个飞书交付记录。请重新发起交付。",
    });
  }

  await markFeishuDeliveryProcessing({ deliveryId: delivery.id });
  await updateJobStatus(jobId, {
    status: "processing",
    currentStep: "feishu_document_creating",
    userMessage: "正在创建飞书文档并准备发送给指定联系人或群聊。",
  });
  await appendJobEvent(jobId, {
    type: "step.started",
    jobId,
    projectId: job.projectId,
    stepId: "feishu_document_creating",
    title: "开始飞书交付",
    userMessage: "系统正在创建飞书文档，随后会发送到指定对象。",
    at: new Date().toISOString(),
  });

  try {
    const reusableDocument =
      delivery.feishuDocumentToken && delivery.feishuDocumentUrl
        ? {
            documentToken: delivery.feishuDocumentToken,
            documentUrl: delivery.feishuDocumentUrl,
          }
        : null;
    const document =
      reusableDocument ??
      (await createFeishuDocumentWithMarkdown({
        title: delivery.title,
        markdown: delivery.content,
      }));

    if (reusableDocument) {
      await appendJobEvent(jobId, {
        type: "delivery.updated",
        jobId,
        projectId: job.projectId,
        stepId: "feishu_document_reused",
        title: "复用已有飞书文档",
        payload: {
          documentToken: document.documentToken,
          documentUrl: document.documentUrl,
        },
        userMessage: "系统已复用上次创建成功的飞书文档，正在重新发送消息。",
        at: new Date().toISOString(),
      });
    } else {
      await markFeishuDeliveryDocumentCreated({
        deliveryId: delivery.id,
        feishuDocumentToken: document.documentToken,
        feishuDocumentUrl: document.documentUrl,
      });
      await appendJobEvent(jobId, {
        type: "delivery.updated",
        jobId,
        projectId: job.projectId,
        stepId: "feishu_document_created",
        title: "飞书文档已创建",
        payload: {
          documentToken: document.documentToken,
          documentUrl: document.documentUrl,
        },
        userMessage: "飞书文档已创建，正在发送消息。",
        at: new Date().toISOString(),
      });
    }

    const messageText = [
      `${delivery.title}`,
      "",
      `文档链接：${document.documentUrl}`,
      "",
      "请查收并按项目确认流程反馈。",
    ].join("\n");
    const message = await sendFeishuTextMessage({
      receiverType: parsedInput.receiverType,
      receiverId: parsedInput.receiverId,
      text: messageText,
    });
    const savedDelivery = await markFeishuDeliverySucceeded({
      deliveryId: delivery.id,
      feishuDocumentToken: document.documentToken,
      feishuDocumentUrl: document.documentUrl,
      feishuMessageId: message.messageId,
    });
    await markFeishuReceiverDeliveryResult({
      projectId: job.projectId,
      receiverId: savedDelivery.receiverRefId,
      deliveryId: savedDelivery.id,
      sentAt: savedDelivery.sentAt,
      failureReason: null,
    });
    const artifact = await createArtifact({
      projectId: job.projectId,
      kind: "feishu_delivery_record",
      title: savedDelivery.title,
      status: "succeeded",
      data: {
        deliveryId: savedDelivery.id,
        documentType: savedDelivery.documentType,
        documentId: savedDelivery.documentId,
        snapshotId: savedDelivery.snapshotId,
        receiverType: savedDelivery.receiverType,
        receiverName: savedDelivery.receiverName,
        receiverId: savedDelivery.receiverId,
        feishuDocumentToken: savedDelivery.feishuDocumentToken,
        feishuDocumentUrl: savedDelivery.feishuDocumentUrl,
        feishuMessageId: savedDelivery.feishuMessageId,
        sentAt: savedDelivery.sentAt,
      },
      sourceJobId: jobId,
      createdBy: parsedInput.requestedBy ?? null,
    });

    await recordStageProgress({
      projectId: job.projectId,
      stageKey: "selection_quote_contract",
      status: "waiting_review",
      currentStage: "selection_quote_contract",
      projectStatus: "waiting_review",
      jobId,
      title: "飞书交付已发送",
      userMessage: "飞书文档已创建并发送，项目正在等待甲方确认。",
      inputRefs: buildDeliveryInputRefs(savedDelivery),
      outputRefs: [
        { type: "feishu_delivery", id: savedDelivery.id },
        { type: "artifact", id: artifact.id, kind: artifact.kind },
      ],
      snapshot: {
        deliveryId: savedDelivery.id,
        feishuDocumentUrl: savedDelivery.feishuDocumentUrl,
        feishuMessageId: savedDelivery.feishuMessageId,
        sentAt: savedDelivery.sentAt,
      },
    });

    await appendJobEvent(jobId, {
      type: "artifact.created",
      jobId,
      projectId: job.projectId,
      artifactId: artifact.id,
      title: "已创建飞书交付记录",
      payload: {
        artifactKind: artifact.kind,
        deliveryId: savedDelivery.id,
        messageId: savedDelivery.feishuMessageId,
      },
      userMessage: "飞书文档和发送记录已归档到项目。",
      at: new Date().toISOString(),
    });
    await appendJobEvent(jobId, {
      type: "job.completed",
      jobId,
      projectId: job.projectId,
      title: "飞书交付完成",
      userMessage: "飞书交付完成，文档链接和消息发送记录已回写。",
      at: new Date().toISOString(),
    });
    await updateJobStatus(jobId, {
      status: "succeeded",
      currentStep: "completed",
      userMessage: "飞书交付完成。",
    });

    return { jobId, delivery: savedDelivery, artifact };
  } catch (error) {
    const userMessage =
      error instanceof AppError
        ? error.userMessage
        : "飞书交付失败。系统已保存失败状态，你可以确认接收对象和飞书权限后重试。";

    await markFeishuDeliveryFailed({
      deliveryId: delivery.id,
      failureReason: userMessage,
    });
    await markFeishuReceiverDeliveryResult({
      projectId: job.projectId,
      receiverId: delivery.receiverRefId,
      deliveryId: delivery.id,
      failureReason: userMessage,
    });
    await recordStageProgress({
      projectId: job.projectId,
      stageKey: "selection_quote_contract",
      status: "blocked",
      currentStage: "selection_quote_contract",
      projectStatus: "blocked",
      jobId,
      title: "飞书交付失败",
      userMessage,
      errorMessage: userMessage,
      inputRefs: buildDeliveryInputRefs(delivery),
    });
    await appendJobEvent(jobId, {
      type: "step.failed",
      jobId,
      projectId: job.projectId,
      stepId: "feishu_delivery",
      title: "飞书交付失败",
      userMessage,
      recoverable: true,
      at: new Date().toISOString(),
    });

    if (!options.workerManagedFailure) {
      await updateJobStatus(jobId, {
        status: "failed",
        currentStep: "failed",
        userMessage,
        errorCode: error instanceof AppError ? error.code : "feishu_delivery_failed",
      });
    }

    throw error;
  }
}

export function buildFeishuDeliveryRetryQueuedMessage(input: {
  previousFailureReason?: string | null;
  hasReusableDocument: boolean;
}) {
  const base = input.hasReusableDocument
    ? "飞书交付已重新入队。系统会复用上次创建成功的飞书文档，并重新发送给指定对象。"
    : "飞书交付已重新入队。系统会重新创建飞书文档并发送给指定对象。";
  const previousFailureReason = input.previousFailureReason?.trim();
  return previousFailureReason ? `${base}上一轮失败原因：${previousFailureReason}` : base;
}

export function resolveFeishuRetryReceiver(input: {
  currentReceiverType: FeishuReceiverType;
  currentReceiverId: string;
  currentReceiverName: string;
  requestedReceiverType?: string | null;
  requestedReceiverId?: string | null;
  requestedReceiverName?: string | null;
}) {
  return {
    receiverType: input.requestedReceiverType
      ? sanitizeReceiverType(input.requestedReceiverType)
      : input.currentReceiverType,
    receiverId: input.requestedReceiverId?.trim() || input.currentReceiverId,
    receiverName: input.requestedReceiverName?.trim() ?? input.currentReceiverName,
  };
}

async function resolveDeliveryReceiver(input: {
  projectId: string;
  receiverType: string;
  receiverId?: string | null;
  receiverName?: string | null;
  receiverRefId?: string | null;
  saveReceiver?: boolean;
  requestedBy?: string | null;
}) {
  if (input.receiverRefId) {
    const receiver = await getProjectFeishuReceiver({
      projectId: input.projectId,
      receiverId: input.receiverRefId,
    });
    if (!receiver) {
      throw new AppError({
        status: 404,
        code: "feishu_receiver_not_found",
        userMessage: "没有找到这个常用飞书接收对象。请刷新项目后重新选择，或改为手动输入。",
      });
    }

    return {
      receiverType: receiver.receiverType,
      receiverId: receiver.receiverId,
      receiverName: receiver.displayName,
      receiverRefId: receiver.id,
    };
  }

  const receiverType = sanitizeReceiverType(input.receiverType);
  const receiverId = input.receiverId?.trim();
  if (!receiverId) {
    throw new AppError({
      status: 400,
      code: "feishu_receiver_required",
      userMessage: receiverType === "user" ? "请输入甲方联系人的 open_id。" : "请输入甲方群聊的 chat_id。",
    });
  }

  if (input.saveReceiver) {
    const saved = await upsertProjectFeishuReceiver({
      projectId: input.projectId,
      receiverType,
      receiverId,
      displayName: input.receiverName?.trim() || (receiverType === "user" ? "甲方联系人" : "甲方群聊"),
      actorId: input.requestedBy ?? null,
    });
    return {
      receiverType: saved.receiverType,
      receiverId: saved.receiverId,
      receiverName: saved.displayName,
      receiverRefId: saved.id,
    };
  }

  return {
    receiverType,
    receiverId,
    receiverName: input.receiverName?.trim() ?? "",
    receiverRefId: null,
  };
}

async function resolveRetryDeliveryReceiver(input: {
  projectId: string;
  currentReceiverType: FeishuReceiverType;
  currentReceiverId: string;
  currentReceiverName: string;
  requestedReceiverType?: string | null;
  requestedReceiverId?: string | null;
  requestedReceiverName?: string | null;
  receiverRefId?: string | null;
}) {
  if (input.receiverRefId) {
    const receiver = await getProjectFeishuReceiver({
      projectId: input.projectId,
      receiverId: input.receiverRefId,
    });
    if (!receiver) {
      throw new AppError({
        status: 404,
        code: "feishu_receiver_not_found",
        userMessage: "没有找到这个常用飞书接收对象。请刷新项目后重新选择，或改为手动输入补发对象。",
      });
    }
    return {
      receiverType: receiver.receiverType,
      receiverId: receiver.receiverId,
      receiverName: receiver.displayName,
      receiverRefId: receiver.id,
    };
  }

  const receiver = resolveFeishuRetryReceiver(input);
  return {
    ...receiver,
    receiverRefId: null,
  };
}

export function buildFeishuDeliveryMarkdown(input: {
  proposal?: { title: string; content: string } | null;
  quote?: { title: string; currency: string; totalAmount: number; content?: string } | null;
  contract?: { title: string; content: string } | null;
}) {
  const sections = ["# 项目交付材料"];

  if (input.proposal) {
    sections.push("## 创意提案", `### ${input.proposal.title}`, summarizeForDelivery(input.proposal.content, 1200));
  }

  if (input.quote) {
    sections.push(
      "## 报价",
      `### ${input.quote.title}`,
      `合计：${formatMoney(input.quote.totalAmount, input.quote.currency)}`,
      input.quote.content ? summarizeForDelivery(input.quote.content, 1200) : ""
    );
  }

  if (input.contract) {
    sections.push("## 合同", `### ${input.contract.title}`, summarizeForDelivery(input.contract.content, 2400));
  }

  sections.push("## 后续确认", "请甲方确认以上材料，如需修改请在飞书中回复具体意见。");

  return sections.filter(Boolean).join("\n\n");
}

function resolveDeliverySnapshot(input: {
  snapshots: DocumentSnapshotView[];
  documentType: FeishuDeliveryDocumentType;
  documentId: string;
  snapshotId?: string | null;
}) {
  const snapshot = input.snapshotId
    ? input.snapshots.find((item) => item.id === input.snapshotId)
    : input.snapshots.find((item) => item.documentType === input.documentType && item.documentId === input.documentId);

  if (!snapshot || snapshot.documentType !== input.documentType || snapshot.documentId !== input.documentId) {
    throw new AppError({
      status: 422,
      code: "document_snapshot_required",
      userMessage: "请先保存要交付的提案、报价或合同快照，再发送飞书。",
    });
  }

  return snapshot;
}

function buildDeliveryDocumentBundle(snapshots: DocumentSnapshotView[], targetSnapshot: DocumentSnapshotView) {
  const proposal = latestSnapshotOfType(snapshots, "proposal");
  const quote = latestSnapshotOfType(snapshots, "quote");
  const contract = latestSnapshotOfType(snapshots, "contract");
  const target = targetSnapshot.documentType === "proposal" ? targetSnapshot : null;

  return {
    proposal: proposal
      ? { title: proposal.title, content: proposal.content }
      : target
        ? { title: target.title, content: target.content }
        : null,
    quote: quote ? parseQuoteDeliverySnapshot(quote) : null,
    contract: contract ? { title: contract.title, content: contract.content } : null,
  };
}

function latestSnapshotOfType(snapshots: DocumentSnapshotView[], type: FeishuDeliveryDocumentType) {
  return snapshots.find((item) => item.documentType === type) ?? null;
}

function parseQuoteDeliverySnapshot(snapshot: DocumentSnapshotView) {
  const data = parseRecord(snapshot.content);
  return {
    title: snapshot.title,
    currency: String(data.currency ?? "CNY"),
    totalAmount: Number(data.totalAmount ?? 0),
    content: snapshot.summary || snapshot.content,
  };
}

function parseRecord(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function summarizeForDelivery(value: string, maxLength: number) {
  const normalized = value.trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}\n\n（内容较长，系统已截取摘要。完整版本请以项目系统内快照为准。）`;
}

function formatMoney(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

function buildDeliveryInputRefs(delivery: {
  documentType: FeishuDeliveryDocumentType;
  documentId: string;
  snapshotId: string | null;
}) {
  const refs: Array<Record<string, string>> = [{ type: delivery.documentType, id: delivery.documentId }];
  if (delivery.snapshotId) {
    refs.push({ type: "document_snapshot", id: delivery.snapshotId });
  }
  return refs;
}
