import { query } from "@/lib/db";
import type { JobStatus } from "@/domain/types";

export type FeishuDeliveryDocumentType = "proposal" | "quote" | "contract";
export type FeishuReceiverType = "user" | "chat";

export type FeishuDeliveryView = {
  id: string;
  projectId: string;
  documentType: FeishuDeliveryDocumentType;
  documentId: string;
  snapshotId: string | null;
  title: string;
  content: string;
  receiverType: FeishuReceiverType;
  receiverId: string;
  receiverName: string;
  receiverRefId: string | null;
  status: JobStatus;
  feishuDocumentToken: string | null;
  feishuDocumentUrl: string | null;
  feishuMessageId: string | null;
  sourceJobId: string | null;
  failureReason: string | null;
  retryCount: number;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type FeishuDeliveryRow = {
  id: string;
  project_id: string;
  document_type: FeishuDeliveryDocumentType;
  document_id: string;
  snapshot_id: string | null;
  title: string;
  content: string;
  receiver_type: FeishuReceiverType;
  receiver_id: string;
  receiver_name: string;
  receiver_ref_id: string | null;
  status: JobStatus;
  feishu_document_token: string | null;
  feishu_document_url: string | null;
  feishu_message_id: string | null;
  source_job_id: string | null;
  failure_reason: string | null;
  retry_count: number;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function createFeishuDelivery(input: {
  projectId: string;
  documentType: FeishuDeliveryDocumentType;
  documentId: string;
  snapshotId: string;
  title: string;
  content: string;
  receiverType: FeishuReceiverType;
  receiverId: string;
  receiverName?: string | null;
  receiverRefId?: string | null;
  createdBy?: string | null;
}) {
  const result = await query<FeishuDeliveryRow>(
    `insert into feishu_deliveries (
       project_id, document_type, document_id, snapshot_id, title, content,
       receiver_type, receiver_id, receiver_name, receiver_ref_id, status, created_by
     )
     values (
       $1, $2, $3, $4, $5, $6, $7, $8, coalesce($9, ''),
       case when $10::uuid is not null and exists (
         select 1 from project_feishu_receivers where id = $10::uuid and project_id = $1
       ) then $10::uuid else null end,
       'queued',
       case when exists (select 1 from users where id = $11::uuid) then $11::uuid else null end
     )
     returning ${feishuDeliveryColumns}`,
    [
      input.projectId,
      input.documentType,
      input.documentId,
      input.snapshotId,
      input.title,
      input.content,
      input.receiverType,
      input.receiverId,
      input.receiverName ?? "",
      input.receiverRefId ?? null,
      input.createdBy ?? null,
    ]
  );

  return mapFeishuDelivery(result.rows[0]);
}

export async function listProjectFeishuDeliveries(projectId: string) {
  const result = await query<FeishuDeliveryRow>(
    `select ${feishuDeliveryColumns}
     from feishu_deliveries
     where project_id = $1
     order by updated_at desc, created_at desc
     limit 50`,
    [projectId]
  );

  return result.rows.map(mapFeishuDelivery);
}

export async function getFeishuDeliveryByJobId(jobId: string) {
  const result = await query<FeishuDeliveryRow>(
    `select ${feishuDeliveryColumns}
     from feishu_deliveries
     where source_job_id = $1
     limit 1`,
    [jobId]
  );

  return result.rows[0] ? mapFeishuDelivery(result.rows[0]) : null;
}

export async function getProjectFeishuDelivery(input: { projectId: string; deliveryId: string }) {
  const result = await query<FeishuDeliveryRow>(
    `select ${feishuDeliveryColumns}
     from feishu_deliveries
     where project_id = $1 and id = $2
     limit 1`,
    [input.projectId, input.deliveryId]
  );

  return result.rows[0] ? mapFeishuDelivery(result.rows[0]) : null;
}

export async function updateFeishuDeliverySourceJob(input: { deliveryId: string; sourceJobId: string }) {
  const result = await query<FeishuDeliveryRow>(
    `update feishu_deliveries
     set source_job_id = $2,
         updated_at = now()
     where id = $1
     returning ${feishuDeliveryColumns}`,
    [input.deliveryId, input.sourceJobId]
  );

  return mapFeishuDelivery(result.rows[0]);
}

export async function markFailedFeishuDeliveryRetrying(input: {
  projectId: string;
  deliveryId: string;
  sourceJobId: string;
  receiverType: FeishuReceiverType;
  receiverId: string;
  receiverName: string;
  receiverRefId?: string | null;
  retryMessage: string;
}) {
  const result = await query<FeishuDeliveryRow>(
    `update feishu_deliveries
     set status = 'retrying',
         receiver_type = $4,
         receiver_id = $5,
         receiver_name = $6,
         receiver_ref_id = case when $8::uuid is not null and exists (
           select 1 from project_feishu_receivers where id = $8::uuid and project_id = $1
         ) then $8::uuid else null end,
         source_job_id = $3,
         feishu_message_id = null,
         sent_at = null,
         failure_reason = $7,
         updated_at = now()
     where project_id = $1
       and id = $2
       and status = 'failed'
     returning ${feishuDeliveryColumns}`,
    [
      input.projectId,
      input.deliveryId,
      input.sourceJobId,
      input.receiverType,
      input.receiverId,
      input.receiverName,
      input.retryMessage,
      input.receiverRefId ?? null,
    ]
  );

  return result.rows[0] ? mapFeishuDelivery(result.rows[0]) : null;
}

export async function markFeishuDeliveryProcessing(input: { deliveryId: string }) {
  await query(
    `update feishu_deliveries
     set status = 'processing',
         failure_reason = null,
         updated_at = now()
     where id = $1`,
    [input.deliveryId]
  );
}

export async function markFeishuDeliveryDocumentCreated(input: {
  deliveryId: string;
  feishuDocumentToken: string;
  feishuDocumentUrl: string;
}) {
  const result = await query<FeishuDeliveryRow>(
    `update feishu_deliveries
     set feishu_document_token = $2,
         feishu_document_url = $3,
         updated_at = now()
     where id = $1
     returning ${feishuDeliveryColumns}`,
    [input.deliveryId, input.feishuDocumentToken, input.feishuDocumentUrl]
  );

  return mapFeishuDelivery(result.rows[0]);
}

export async function markFeishuDeliverySucceeded(input: {
  deliveryId: string;
  feishuDocumentToken: string;
  feishuDocumentUrl: string;
  feishuMessageId: string;
}) {
  const result = await query<FeishuDeliveryRow>(
    `update feishu_deliveries
     set status = 'succeeded',
         feishu_document_token = $2,
         feishu_document_url = $3,
         feishu_message_id = $4,
         failure_reason = null,
         sent_at = now(),
         updated_at = now()
     where id = $1
     returning ${feishuDeliveryColumns}`,
    [input.deliveryId, input.feishuDocumentToken, input.feishuDocumentUrl, input.feishuMessageId]
  );

  return mapFeishuDelivery(result.rows[0]);
}

export async function markFeishuDeliveryFailed(input: { deliveryId: string; failureReason: string }) {
  await query(
    `update feishu_deliveries
     set status = 'failed',
         failure_reason = $2,
         retry_count = retry_count + 1,
         updated_at = now()
     where id = $1`,
    [input.deliveryId, input.failureReason]
  );
}

const feishuDeliveryColumns = [
  "id",
  "project_id",
  "document_type",
  "document_id",
  "snapshot_id",
  "title",
  "content",
  "receiver_type",
  "receiver_id",
  "receiver_name",
  "receiver_ref_id",
  "status",
  "feishu_document_token",
  "feishu_document_url",
  "feishu_message_id",
  "source_job_id",
  "failure_reason",
  "retry_count",
  "sent_at",
  "created_at",
  "updated_at",
].join(", ");

function mapFeishuDelivery(row: FeishuDeliveryRow): FeishuDeliveryView {
  return {
    id: row.id,
    projectId: row.project_id,
    documentType: row.document_type,
    documentId: row.document_id,
    snapshotId: row.snapshot_id,
    title: row.title,
    content: row.content,
    receiverType: row.receiver_type,
    receiverId: row.receiver_id,
    receiverName: row.receiver_name,
    receiverRefId: row.receiver_ref_id,
    status: row.status,
    feishuDocumentToken: row.feishu_document_token,
    feishuDocumentUrl: row.feishu_document_url,
    feishuMessageId: row.feishu_message_id,
    sourceJobId: row.source_job_id,
    failureReason: row.failure_reason,
    retryCount: row.retry_count,
    sentAt: row.sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
