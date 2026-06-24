import { query } from "@/lib/db";
import type { JobStatus } from "@/domain/types";

export type DocumentExportFormat = "pdf" | "docx";
export type DocumentExportDocumentType = "proposal" | "quote" | "contract";

export type DocumentExportView = {
  id: string;
  projectId: string;
  documentType: DocumentExportDocumentType;
  documentId: string;
  snapshotId: string | null;
  format: DocumentExportFormat;
  title: string;
  fileName: string;
  mimeType: string;
  fileSize: number | null;
  status: JobStatus;
  ossKey: string | null;
  ossUrl: string | null;
  sourceJobId: string | null;
  failureReason: string | null;
  retryCount: number;
  version: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type DocumentExportRow = {
  id: string;
  project_id: string;
  document_type: DocumentExportDocumentType;
  document_id: string;
  snapshot_id: string | null;
  format: DocumentExportFormat;
  title: string;
  file_name: string;
  mime_type: string;
  file_size: number | null;
  status: JobStatus;
  oss_key: string | null;
  oss_url: string | null;
  source_job_id: string | null;
  failure_reason: string | null;
  retry_count: number;
  version: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function createDocumentExport(input: {
  projectId: string;
  documentType: DocumentExportDocumentType;
  documentId: string;
  snapshotId: string;
  format: DocumentExportFormat;
  title: string;
  fileName: string;
  mimeType: string;
  createdBy?: string | null;
}) {
  const result = await query<DocumentExportRow>(
    `insert into document_exports (
       project_id, document_type, document_id, snapshot_id, format, title,
       file_name, mime_type, status, created_by
     )
     values (
       $1, $2, $3, $4, $5, $6, $7, $8, 'queued',
       case when exists (select 1 from users where id = $9::uuid) then $9::uuid else null end
     )
     returning ${documentExportColumns}`,
    [
      input.projectId,
      input.documentType,
      input.documentId,
      input.snapshotId,
      input.format,
      input.title,
      input.fileName,
      input.mimeType,
      input.createdBy ?? null,
    ]
  );

  return mapDocumentExport(result.rows[0]);
}

export async function listProjectDocumentExports(projectId: string, documentType?: DocumentExportDocumentType) {
  const result = await query<DocumentExportRow>(
    `select ${documentExportColumns}
     from document_exports
     where project_id = $1
       and ($2::text is null or document_type = $2)
     order by updated_at desc, created_at desc
     limit 50`,
    [projectId, documentType ?? null]
  );

  return result.rows.map(mapDocumentExport);
}

export async function getDocumentExport(input: { projectId: string; exportId: string }) {
  const result = await query<DocumentExportRow>(
    `select ${documentExportColumns}
     from document_exports
     where project_id = $1 and id = $2
     limit 1`,
    [input.projectId, input.exportId]
  );

  return result.rows[0] ? mapDocumentExport(result.rows[0]) : null;
}

export async function getDocumentExportByJobId(jobId: string) {
  const result = await query<DocumentExportRow>(
    `select ${documentExportColumns}
     from document_exports
     where source_job_id = $1
     limit 1`,
    [jobId]
  );

  return result.rows[0] ? mapDocumentExport(result.rows[0]) : null;
}

export async function updateDocumentExportSourceJob(input: { exportId: string; sourceJobId: string }) {
  const result = await query<DocumentExportRow>(
    `update document_exports
     set source_job_id = $2,
         updated_at = now()
     where id = $1
     returning ${documentExportColumns}`,
    [input.exportId, input.sourceJobId]
  );

  return mapDocumentExport(result.rows[0]);
}

export async function markDocumentExportProcessing(input: { exportId: string }) {
  await query(
    `update document_exports
     set status = 'processing',
         failure_reason = null,
         updated_at = now()
     where id = $1`,
    [input.exportId]
  );
}

export async function markDocumentExportSucceeded(input: {
  exportId: string;
  ossKey: string;
  ossUrl: string;
  fileSize: number;
}) {
  const result = await query<DocumentExportRow>(
    `update document_exports
     set status = 'succeeded',
         oss_key = $2,
         oss_url = $3,
         file_size = $4,
         failure_reason = null,
         completed_at = now(),
         updated_at = now()
     where id = $1
     returning ${documentExportColumns}`,
    [input.exportId, input.ossKey, input.ossUrl, input.fileSize]
  );

  return mapDocumentExport(result.rows[0]);
}

export async function markDocumentExportFailed(input: { exportId: string; failureReason: string }) {
  await query(
    `update document_exports
     set status = 'failed',
         failure_reason = $2,
         retry_count = retry_count + 1,
         updated_at = now()
     where id = $1`,
    [input.exportId, input.failureReason]
  );
}

const documentExportColumns = [
  "id",
  "project_id",
  "document_type",
  "document_id",
  "snapshot_id",
  "format",
  "title",
  "file_name",
  "mime_type",
  "file_size",
  "status",
  "oss_key",
  "oss_url",
  "source_job_id",
  "failure_reason",
  "retry_count",
  "version",
  "completed_at",
  "created_at",
  "updated_at",
].join(", ");

function mapDocumentExport(row: DocumentExportRow): DocumentExportView {
  return {
    id: row.id,
    projectId: row.project_id,
    documentType: row.document_type,
    documentId: row.document_id,
    snapshotId: row.snapshot_id,
    format: row.format,
    title: row.title,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    status: row.status,
    ossKey: row.oss_key,
    ossUrl: row.oss_url,
    sourceJobId: row.source_job_id,
    failureReason: row.failure_reason,
    retryCount: row.retry_count,
    version: row.version,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
