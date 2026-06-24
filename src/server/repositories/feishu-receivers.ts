import { query } from "@/lib/db";
import type { FeishuReceiverType } from "@/server/repositories/feishu-deliveries";

export type FeishuReceiverView = {
  id: string;
  projectId: string;
  receiverType: FeishuReceiverType;
  receiverId: string;
  displayName: string;
  companyName: string;
  contactRole: string;
  contactPhone: string | null;
  contactEmail: string | null;
  isPrimary: boolean;
  isActive: boolean;
  lastDeliveryId: string | null;
  lastSentAt: string | null;
  failureReason: string | null;
  notes: string;
  updatedAt: string;
};

type FeishuReceiverRow = {
  id: string;
  project_id: string;
  receiver_type: FeishuReceiverType;
  receiver_id: string;
  display_name: string;
  company_name: string;
  contact_role: string;
  contact_phone: string | null;
  contact_email: string | null;
  is_primary: boolean;
  is_active: boolean;
  last_delivery_id: string | null;
  last_sent_at: string | null;
  failure_reason: string | null;
  notes: string;
  updated_at: string;
};

export type SaveFeishuReceiverInput = {
  projectId: string;
  receiverType: FeishuReceiverType;
  receiverId: string;
  displayName?: string | null;
  companyName?: string | null;
  contactRole?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  isPrimary?: boolean;
  notes?: string | null;
  actorId?: string | null;
};

export async function listProjectFeishuReceivers(projectId: string) {
  const result = await query<FeishuReceiverRow>(
    `select ${feishuReceiverColumns}
     from project_feishu_receivers
     where project_id = $1
       and is_active = true
     order by is_primary desc, updated_at desc, created_at desc
     limit 100`,
    [projectId]
  );

  return result.rows.map(mapFeishuReceiver);
}

export async function getProjectFeishuReceiver(input: { projectId: string; receiverId: string }) {
  const result = await query<FeishuReceiverRow>(
    `select ${feishuReceiverColumns}
     from project_feishu_receivers
     where project_id = $1
       and id = $2
       and is_active = true
     limit 1`,
    [input.projectId, input.receiverId]
  );

  return result.rows[0] ? mapFeishuReceiver(result.rows[0]) : null;
}

export async function upsertProjectFeishuReceiver(input: SaveFeishuReceiverInput) {
  if (input.isPrimary) {
    await query(
      `update project_feishu_receivers
       set is_primary = false,
           updated_by = case when exists (select 1 from users where id = $2::uuid) then $2::uuid else updated_by end,
           updated_at = now()
       where project_id = $1
         and receiver_type = $3
         and is_primary = true`,
      [input.projectId, input.actorId ?? null, input.receiverType]
    );
  }

  const result = await query<FeishuReceiverRow>(
    `insert into project_feishu_receivers (
       project_id, receiver_type, receiver_id, display_name, company_name,
       contact_role, contact_phone, contact_email, is_primary, notes,
       created_by, updated_by
     )
     values (
       $1, $2, $3, coalesce($4, ''), coalesce($5, ''),
       coalesce($6, ''), $7, $8, $9, coalesce($10, ''),
       case when exists (select 1 from users where id = $11::uuid) then $11::uuid else null end,
       case when exists (select 1 from users where id = $11::uuid) then $11::uuid else null end
     )
     on conflict (project_id, receiver_type, receiver_id)
     do update set
       display_name = excluded.display_name,
       company_name = excluded.company_name,
       contact_role = excluded.contact_role,
       contact_phone = excluded.contact_phone,
       contact_email = excluded.contact_email,
       is_primary = excluded.is_primary,
       is_active = true,
       notes = excluded.notes,
       updated_by = excluded.updated_by,
       updated_at = now()
     returning ${feishuReceiverColumns}`,
    [
      input.projectId,
      input.receiverType,
      input.receiverId,
      input.displayName ?? "",
      input.companyName ?? "",
      input.contactRole ?? "",
      normalizeBlank(input.contactPhone),
      normalizeBlank(input.contactEmail),
      Boolean(input.isPrimary),
      input.notes ?? "",
      input.actorId ?? null,
    ]
  );

  return mapFeishuReceiver(result.rows[0]);
}

export async function archiveProjectFeishuReceiver(input: { projectId: string; receiverId: string; actorId?: string | null }) {
  const result = await query<FeishuReceiverRow>(
    `update project_feishu_receivers
     set is_active = false,
         is_primary = false,
         updated_by = case when exists (select 1 from users where id = $3::uuid) then $3::uuid else updated_by end,
         updated_at = now()
     where project_id = $1
       and id = $2
       and is_active = true
     returning ${feishuReceiverColumns}`,
    [input.projectId, input.receiverId, input.actorId ?? null]
  );

  return result.rows[0] ? mapFeishuReceiver(result.rows[0]) : null;
}

export async function markFeishuReceiverDeliveryResult(input: {
  projectId: string;
  receiverId: string | null;
  deliveryId: string;
  sentAt?: string | null;
  failureReason?: string | null;
}) {
  if (!input.receiverId) return;

  await query(
    `update project_feishu_receivers
     set last_delivery_id = $3,
         last_sent_at = case when $4::timestamptz is not null then $4::timestamptz else last_sent_at end,
         failure_reason = $5,
         updated_at = now()
     where project_id = $1
       and id = $2`,
    [input.projectId, input.receiverId, input.deliveryId, input.sentAt ?? null, input.failureReason ?? null]
  );
}

export function maskReceiverId(receiverId: string) {
  if (receiverId.length <= 8) return `${receiverId.slice(0, 2)}***`;
  return `${receiverId.slice(0, 4)}***${receiverId.slice(-4)}`;
}

function normalizeBlank(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

const feishuReceiverColumns = [
  "id",
  "project_id",
  "receiver_type",
  "receiver_id",
  "display_name",
  "company_name",
  "contact_role",
  "contact_phone",
  "contact_email",
  "is_primary",
  "is_active",
  "last_delivery_id",
  "last_sent_at",
  "failure_reason",
  "notes",
  "updated_at",
].join(", ");

function mapFeishuReceiver(row: FeishuReceiverRow): FeishuReceiverView {
  return {
    id: row.id,
    projectId: row.project_id,
    receiverType: row.receiver_type,
    receiverId: row.receiver_id,
    displayName: row.display_name,
    companyName: row.company_name,
    contactRole: row.contact_role,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    isPrimary: row.is_primary,
    isActive: row.is_active,
    lastDeliveryId: row.last_delivery_id,
    lastSentAt: row.last_sent_at,
    failureReason: row.failure_reason,
    notes: row.notes,
    updatedAt: row.updated_at,
  };
}
