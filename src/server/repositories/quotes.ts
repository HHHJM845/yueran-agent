import { query } from "@/lib/db";

export type QuoteItem = {
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

export type QuoteView = {
  id: string;
  projectId: string;
  title: string;
  currency: string;
  items: QuoteItem[];
  notes: string;
  totalAmount: number;
  status: string;
  version: number;
  latestSnapshotId: string | null;
  updatedAt: string;
};

type QuoteRow = {
  id: string;
  project_id: string;
  title: string;
  currency: string;
  items_json: unknown;
  notes: string;
  total_amount: string | number;
  status: string;
  version: number;
  latest_snapshot_id: string | null;
  updated_at: string;
};

export async function getProjectQuote(projectId: string) {
  const result = await query<QuoteRow>(
    `select id, project_id, title, currency, items_json, notes, total_amount,
            status, version, latest_snapshot_id, updated_at
     from quotes
     where project_id = $1
     limit 1`,
    [projectId]
  );

  return result.rows[0] ? mapQuote(result.rows[0]) : null;
}

export async function upsertProjectQuote(input: {
  projectId: string;
  title: string;
  currency: string;
  items: QuoteItem[];
  notes: string;
  totalAmount: number;
  status: string;
  actorId?: string | null;
}) {
  const result = await query<QuoteRow>(
    `insert into quotes (
       project_id, title, currency, items_json, notes, total_amount,
       status, version, created_by, updated_by
     )
     values (
       $1, $2, $3, $4::jsonb, $5, $6, $7, 1,
       case when exists (select 1 from users where id = $8::uuid) then $8::uuid else null end,
       case when exists (select 1 from users where id = $8::uuid) then $8::uuid else null end
     )
     on conflict (project_id)
     do update set
       title = excluded.title,
       currency = excluded.currency,
       items_json = excluded.items_json,
       notes = excluded.notes,
       total_amount = excluded.total_amount,
       status = excluded.status,
       version = quotes.version + 1,
       updated_by = excluded.updated_by,
       updated_at = now()
     returning id, project_id, title, currency, items_json, notes, total_amount,
               status, version, latest_snapshot_id, updated_at`,
    [
      input.projectId,
      input.title,
      input.currency,
      JSON.stringify(input.items),
      input.notes,
      input.totalAmount,
      input.status,
      input.actorId ?? null,
    ]
  );

  return mapQuote(result.rows[0]);
}

export async function updateQuoteLatestSnapshot(input: { quoteId: string; snapshotId: string }) {
  await query(
    `update quotes
     set latest_snapshot_id = $2,
         updated_at = now()
     where id = $1`,
    [input.quoteId, input.snapshotId]
  );
}

export async function updateQuoteStatus(input: { projectId: string; quoteId: string; status: string; actorId?: string | null }) {
  const result = await query<QuoteRow>(
    `update quotes
     set status = $3,
         updated_by = case when exists (select 1 from users where id = $4::uuid) then $4::uuid else updated_by end,
         updated_at = now()
     where project_id = $1
       and id = $2
     returning id, project_id, title, currency, items_json, notes, total_amount,
               status, version, latest_snapshot_id, updated_at`,
    [input.projectId, input.quoteId, input.status, input.actorId ?? null]
  );

  return result.rows[0] ? mapQuote(result.rows[0]) : null;
}

function mapQuote(row: QuoteRow): QuoteView {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    currency: row.currency,
    items: normalizeQuoteItems(row.items_json),
    notes: row.notes,
    totalAmount: Number(row.total_amount),
    status: row.status,
    version: row.version,
    latestSnapshotId: row.latest_snapshot_id,
    updatedAt: row.updated_at,
  };
}

function normalizeQuoteItems(value: unknown): QuoteItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      return {
        name: String(record.name ?? ""),
        description: String(record.description ?? ""),
        quantity: Number(record.quantity ?? 0),
        unitPrice: Number(record.unitPrice ?? 0),
      };
    })
    .filter((item) => item.name && item.quantity > 0 && item.unitPrice >= 0);
}
