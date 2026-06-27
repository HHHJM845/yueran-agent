import type { TransactionQuery } from "@/lib/db";
import { query } from "@/lib/db";

export type AuditLogView = {
  id: string;
  actorId: string | null;
  projectId: string | null;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  objectType: string;
  objectId: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
};

export type AuditLogPageView = {
  items: AuditLogView[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

type AuditLogRow = {
  id: string;
  actor_id: string | null;
  project_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  object_type: string;
  object_id: string | null;
  before_json: unknown;
  after_json: unknown;
  created_at: string;
};

export async function createAuditLog(input: {
  actorId?: string | null;
  projectId?: string | null;
  action: string;
  objectType: string;
  objectId?: string | null;
  before?: unknown;
  after?: unknown;
  transactionQuery?: TransactionQuery;
}) {
  const params = [
    input.actorId ?? null,
    input.projectId ?? null,
    input.action,
    input.objectType,
    input.objectId ?? null,
    JSON.stringify(input.before ?? null),
    JSON.stringify(input.after ?? null),
  ];

  const sql = `insert into audit_logs (actor_id, project_id, action, object_type, object_id, before_json, after_json, created_at)
     values (
       case when exists (select 1 from users where id = $1::uuid) then $1::uuid else null end,
       case when $2::uuid is not null and exists (select 1 from projects where id = $2::uuid) then $2::uuid else null end,
       $3, $4, $5, $6::jsonb, $7::jsonb, now()
     )`;

  if (input.transactionQuery) {
    await input.transactionQuery(sql, params);
    return;
  }

  await query(
    sql,
    params
  );
}

export async function listAuditLogs(input: {
  limit?: number;
  offset?: number;
  objectType?: string | null;
  projectId?: string | null;
  action?: string | null;
  actorId?: string | null;
  from?: string | null;
  to?: string | null;
}) {
  const page = await listAuditLogsPage(input);
  return page.items;
}

export async function listAuditLogsPage(input: {
  limit?: number;
  offset?: number;
  objectType?: string | null;
  projectId?: string | null;
  action?: string | null;
  actorId?: string | null;
  from?: string | null;
  to?: string | null;
}): Promise<AuditLogPageView> {
  const limit = clampLimit(input.limit);
  const offset = Math.max(0, input.offset ?? 0);

  const result = await query<AuditLogRow>(
    `select al.id, al.actor_id, al.project_id, u.name as actor_name, u.role as actor_role,
            al.action, al.object_type, al.object_id, al.before_json, al.after_json, al.created_at
     from audit_logs al
     left join users u on u.id = al.actor_id
     where ($1::text is null or al.object_type = $1)
       and ($2::uuid is null or al.project_id = $2)
       and ($3::text is null or al.action = $3)
       and ($4::uuid is null or al.actor_id = $4)
       and ($5::timestamptz is null or al.created_at >= $5)
       and ($6::timestamptz is null or al.created_at <= $6)
     order by al.created_at desc
     limit $7
     offset $8`,
    [
      input.objectType ?? null,
      input.projectId ?? null,
      input.action ?? null,
      input.actorId ?? null,
      input.from ?? null,
      input.to ?? null,
      limit,
      offset,
    ]
  );

  const totalResult = await query<{ count: string }>(
    `select count(*)::text as count
     from audit_logs al
     where ($1::text is null or al.object_type = $1)
       and ($2::uuid is null or al.project_id = $2)
       and ($3::text is null or al.action = $3)
       and ($4::uuid is null or al.actor_id = $4)
       and ($5::timestamptz is null or al.created_at >= $5)
       and ($6::timestamptz is null or al.created_at <= $6)`,
    [
      input.objectType ?? null,
      input.projectId ?? null,
      input.action ?? null,
      input.actorId ?? null,
      input.from ?? null,
      input.to ?? null,
    ]
  );

  const total = Number(totalResult.rows[0]?.count ?? 0);
  return {
    items: result.rows.map(mapAuditLog),
    total,
    limit,
    offset,
    hasMore: offset + result.rows.length < total,
  };
}

function clampLimit(limit: number | undefined) {
  if (!limit || !Number.isFinite(limit)) return 80;
  return Math.min(200, Math.max(1, Math.round(limit)));
}

function mapAuditLog(row: AuditLogRow): AuditLogView {
  return {
    id: row.id,
    actorId: row.actor_id,
    projectId: row.project_id,
    actorName: row.actor_name,
    actorRole: row.actor_role,
    action: row.action,
    objectType: row.object_type,
    objectId: row.object_id,
    before: row.before_json,
    after: row.after_json,
    createdAt: row.created_at,
  };
}
