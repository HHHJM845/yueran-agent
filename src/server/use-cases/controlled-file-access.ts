import { AppError } from "@/lib/errors";
import { createReadUrl } from "@/server/providers/oss";
import { createAuditLog } from "@/server/repositories/audit-logs";
import { getProjectAsset } from "@/server/repositories/assets";
import { getDocumentExport } from "@/server/repositories/document-exports";
import type { AuthUser } from "@/server/repositories/users";

export type ControlledFileKind = "asset" | "document_export";

export async function createControlledAssetAccess(input: {
  projectId: string;
  assetId: string;
  actor: AuthUser;
  mode?: "preview" | "download";
}) {
  const asset = await getProjectAsset(input.projectId, input.assetId);
  if (!asset) {
    throw new AppError({
      status: 404,
      code: "asset_not_found",
      userMessage: "没有找到这份资料。它可能已被删除，或你没有权限查看。",
    });
  }

  if (asset.sourceType === "external_link") {
    await createAuditLog({
      actorId: input.actor.id,
      projectId: input.projectId,
      action: input.mode === "download" ? "asset.external_download_requested" : "asset.external_preview_requested",
      objectType: "asset",
      objectId: asset.id,
      after: {
        projectId: input.projectId,
        assetType: asset.assetType,
        externalProvider: asset.externalProvider,
      },
    });
    return {
      url: asset.externalUrl,
      fileName: asset.fileName ?? asset.externalProvider ?? "外部资料链接",
      mimeType: "text/uri-list",
      expiresInSeconds: null,
      disposition: input.mode === "download" ? "attachment" : "inline",
    };
  }

  if (!asset.ossKey) {
    throw new AppError({
      status: 422,
      code: "asset_file_not_ready",
      userMessage: "这份资料还没有可访问的文件。请确认上传已经完成，或重新上传后再打开。",
    });
  }

  const disposition = input.mode === "download" ? "attachment" : "inline";
  const fileName = asset.fileName ?? "项目资料";
  const mimeType = asset.mimeType ?? "application/octet-stream";
  const url = createReadUrl(asset.ossKey, 300, {
    disposition,
    fileName,
    contentType: mimeType,
  });
  await createAuditLog({
    actorId: input.actor.id,
    projectId: input.projectId,
    action: input.mode === "download" ? "asset.download" : "asset.preview",
    objectType: "asset",
    objectId: asset.id,
    after: {
      projectId: input.projectId,
      assetType: asset.assetType,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      fileSize: asset.fileSize,
      disposition,
      expiresInSeconds: 300,
    },
  });

  return {
    url,
    fileName,
    mimeType,
    expiresInSeconds: 300,
    disposition,
  };
}

export async function createControlledDocumentExportAccess(input: {
  projectId: string;
  exportId: string;
  actor: AuthUser;
  mode?: "preview" | "download";
}) {
  const exportRecord = await getDocumentExport({ projectId: input.projectId, exportId: input.exportId });
  if (!exportRecord) {
    throw new AppError({
      status: 404,
      code: "document_export_not_found",
      userMessage: "没有找到这份导出文件。它可能已经被删除，或你没有权限查看。",
    });
  }

  if (exportRecord.status !== "succeeded" || !exportRecord.ossKey) {
    throw new AppError({
      status: 422,
      code: "document_export_not_ready",
      userMessage: "这份导出文件还没有生成完成。请稍后刷新导出记录后再打开。",
    });
  }

  const disposition = input.mode === "preview" ? "inline" : "attachment";
  const url = createReadUrl(exportRecord.ossKey, 300, {
    disposition,
    fileName: exportRecord.fileName,
    contentType: exportRecord.mimeType,
  });
  await createAuditLog({
    actorId: input.actor.id,
    projectId: input.projectId,
    action: input.mode === "preview" ? "document_export.preview" : "document_export.download",
    objectType: "document_export",
    objectId: exportRecord.id,
    after: {
      projectId: input.projectId,
      documentType: exportRecord.documentType,
      documentId: exportRecord.documentId,
      snapshotId: exportRecord.snapshotId,
      format: exportRecord.format,
      fileName: exportRecord.fileName,
      fileSize: exportRecord.fileSize,
      disposition,
      expiresInSeconds: 300,
    },
  });

  return {
    url,
    fileName: exportRecord.fileName,
    mimeType: exportRecord.mimeType,
    expiresInSeconds: 300,
    disposition,
  };
}
