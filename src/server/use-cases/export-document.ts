import { z } from "zod";
import { AppError } from "@/lib/errors";
import { createDocumentExportObjectKey, uploadOssObject } from "@/server/providers/oss";
import { createArtifact } from "@/server/repositories/artifacts";
import { getProjectContract } from "@/server/repositories/contracts";
import {
  createDocumentExport,
  getDocumentExportByJobId,
  markDocumentExportFailed,
  markDocumentExportProcessing,
  markDocumentExportSucceeded,
  updateDocumentExportSourceJob,
  type DocumentExportFormat,
} from "@/server/repositories/document-exports";
import { listProjectDocumentSnapshots } from "@/server/repositories/proposals";
import { appendJobEvent, createJob, getJobInput, updateJobStatus } from "@/server/repositories/jobs";
import { renderDocumentExport } from "@/server/renderers/document-export";

const documentExportFormatSchema = z.enum(["pdf", "docx"]);
const documentExportJobInputSchema = z.object({
  documentType: z.enum(["contract"]),
  documentId: z.string().uuid(),
  snapshotId: z.string().uuid(),
  exportId: z.string().uuid(),
  format: documentExportFormatSchema,
  requestedBy: z.string().uuid().nullable().optional(),
});

export const enqueueContractExportInputSchema = z.object({
  contractId: z.string().uuid(),
  snapshotId: z.string().uuid().nullable().optional(),
  format: documentExportFormatSchema,
});

export async function enqueueContractExport(input: {
  projectId: string;
  contractId: string;
  snapshotId?: string | null;
  format: DocumentExportFormat;
  requestedBy: string;
}) {
  const parsed = enqueueContractExportInputSchema.parse({
    contractId: input.contractId,
    snapshotId: input.snapshotId ?? null,
    format: input.format,
  });
  const contract = await getProjectContract(input.projectId);

  if (!contract || contract.id !== parsed.contractId) {
    throw new AppError({
      status: 404,
      code: "contract_not_found",
      userMessage: "没有找到要导出的合同。请刷新工作台后重试。",
    });
  }

  const snapshot = await resolveContractSnapshot({
    projectId: input.projectId,
    contractId: contract.id,
    snapshotId: parsed.snapshotId ?? contract.latestSnapshotId,
  });
  const fileName = buildExportFileName(snapshot.title, snapshot.version, parsed.format);
  const exportRecord = await createDocumentExport({
    projectId: input.projectId,
    documentType: "contract",
    documentId: contract.id,
    snapshotId: snapshot.id,
    format: parsed.format,
    title: `${snapshot.title} v${snapshot.version} ${parsed.format.toUpperCase()} 导出`,
    fileName,
    mimeType: mimeTypeForFormat(parsed.format),
    createdBy: input.requestedBy,
  });
  const { jobId } = await createJob({
    projectId: input.projectId,
    type: "document_export",
    title: `导出合同：${snapshot.title} v${snapshot.version}`,
    inputJson: {
      documentType: "contract",
      documentId: contract.id,
      snapshotId: snapshot.id,
      exportId: exportRecord.id,
      format: parsed.format,
      requestedBy: input.requestedBy,
    },
    createdBy: input.requestedBy,
    maxAttempts: 2,
  });
  const updatedExport = await updateDocumentExportSourceJob({
    exportId: exportRecord.id,
    sourceJobId: jobId,
  });

  return {
    jobId,
    export: updatedExport,
  };
}

export async function runDocumentExportJob(jobId: string, options: { workerManagedFailure?: boolean } = {}) {
  const job = await getJobInput<z.infer<typeof documentExportJobInputSchema>>(jobId);
  if (!job) {
    throw new AppError({
      status: 404,
      code: "job_not_found",
      userMessage: "没有找到这个文档导出任务。",
    });
  }

  const parsedInput = documentExportJobInputSchema.parse(job.input);
  const exportRecord = await getDocumentExportByJobId(jobId);
  if (!exportRecord || exportRecord.id !== parsedInput.exportId) {
    throw new AppError({
      status: 404,
      code: "document_export_not_found",
      userMessage: "没有找到这个导出记录。请重新发起导出。",
    });
  }

  await markDocumentExportProcessing({ exportId: exportRecord.id });
  await updateJobStatus(jobId, {
    status: "processing",
    currentStep: "document_export_rendering",
    userMessage: "正在根据已保存的合同快照生成导出文件。",
  });
  await appendJobEvent(jobId, {
    type: "step.started",
    jobId,
    projectId: job.projectId,
    stepId: "document_export_rendering",
    title: "开始生成导出文件",
    userMessage: "系统正在根据合同快照生成正式文件。",
    at: new Date().toISOString(),
  });

  try {
    const snapshot = await resolveContractSnapshot({
      projectId: job.projectId,
      contractId: parsedInput.documentId,
      snapshotId: parsedInput.snapshotId,
    });
    const rendered = await renderDocumentExport({
      title: snapshot.title,
      content: snapshot.content,
      format: parsedInput.format,
    });
    const objectKey = createDocumentExportObjectKey(job.projectId, exportRecord.id, exportRecord.fileName);
    const uploaded = await uploadOssObject({
      objectKey,
      body: rendered.bytes,
      contentType: rendered.mimeType,
    });
    const savedExport = await markDocumentExportSucceeded({
      exportId: exportRecord.id,
      ossKey: uploaded.ossKey,
      ossUrl: uploaded.ossUrl,
      fileSize: rendered.bytes.length,
    });
    const artifact = await createArtifact({
      projectId: job.projectId,
      kind: "document_export",
      title: savedExport.title,
      status: "succeeded",
      data: {
        exportId: savedExport.id,
        documentType: savedExport.documentType,
        documentId: savedExport.documentId,
        snapshotId: savedExport.snapshotId,
        format: savedExport.format,
        fileName: savedExport.fileName,
        mimeType: savedExport.mimeType,
        fileSize: savedExport.fileSize,
        ossKey: savedExport.ossKey,
        version: savedExport.version,
      },
      ossUrl: uploaded.ossUrl,
      sourceJobId: jobId,
      createdBy: parsedInput.requestedBy ?? null,
    });

    await appendJobEvent(jobId, {
      type: "artifact.created",
      jobId,
      projectId: job.projectId,
      artifactId: artifact.id,
      title: "已创建合同导出文件",
      payload: {
        artifactKind: artifact.kind,
        exportId: savedExport.id,
        format: savedExport.format,
      },
      userMessage: "合同导出文件已生成并保存到 OSS。",
      at: new Date().toISOString(),
    });
    await appendJobEvent(jobId, {
      type: "job.completed",
      jobId,
      projectId: job.projectId,
      title: "合同导出完成",
      userMessage: "合同导出完成，可以在历史导出记录中查看文件。",
      at: new Date().toISOString(),
    });
    await updateJobStatus(jobId, {
      status: "succeeded",
      currentStep: "completed",
      userMessage: "合同导出完成。",
    });

    return { jobId, export: savedExport, artifact };
  } catch (error) {
    const userMessage =
      error instanceof AppError
        ? error.userMessage
        : "合同导出失败。系统已保存失败状态，你可以稍后重试或联系管理员。";

    await markDocumentExportFailed({
      exportId: exportRecord.id,
      failureReason: userMessage,
    });
    await appendJobEvent(jobId, {
      type: "step.failed",
      jobId,
      projectId: job.projectId,
      stepId: "document_export_rendering",
      title: "合同导出失败",
      userMessage,
      recoverable: true,
      at: new Date().toISOString(),
    });

    if (!options.workerManagedFailure) {
      await updateJobStatus(jobId, {
        status: "failed",
        currentStep: "failed",
        userMessage,
        errorCode: error instanceof AppError ? error.code : "document_export_failed",
      });
    }

    throw error;
  }
}

async function resolveContractSnapshot(input: {
  projectId: string;
  contractId: string;
  snapshotId?: string | null;
}) {
  const snapshots = await listProjectDocumentSnapshots(input.projectId, "contract");
  const snapshot = input.snapshotId
    ? snapshots.find((item) => item.id === input.snapshotId)
    : snapshots.find((item) => item.documentId === input.contractId);

  if (!snapshot || snapshot.documentId !== input.contractId) {
    throw new AppError({
      status: 422,
      code: "contract_snapshot_required",
      userMessage: "请先保存合同快照，再导出正式文件。",
    });
  }

  return snapshot;
}

export function buildExportFileName(title: string, version: number, format: DocumentExportFormat) {
  const safeTitle = title.replace(/[^\w.\-\u4e00-\u9fa5]+/g, "_").slice(0, 80) || "contract";
  return `${safeTitle}-v${version}.${format}`;
}

function mimeTypeForFormat(format: DocumentExportFormat) {
  if (format === "pdf") return "application/pdf";
  return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}
