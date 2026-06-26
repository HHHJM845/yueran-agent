import { query, withTransaction, type TransactionQuery } from "@/lib/db";
import { AppError } from "@/lib/errors";

export type DeliveryChecklistItemKind =
  | "horizontal_final"
  | "vertical_final"
  | "no_subtitle_final"
  | "cover"
  | "project_file"
  | "generated_assets"
  | "other";

export type DeliveryChecklistItemStatus = "planned" | "confirmed" | "changed" | "delivered" | "cancelled";

export type DeliveryChecklistItemView = {
  id: string;
  projectId: string;
  checklistId: string;
  itemKind: DeliveryChecklistItemKind;
  title: string;
  description: string;
  quantity: number;
  status: DeliveryChecklistItemStatus;
  changeRequestId: string | null;
  sortOrder: number;
  metadata: Record<string, unknown>;
  updatedAt: string;
};

export type DeliveryChecklistView = {
  id: string;
  projectId: string;
  estimateId: string | null;
  status: "draft" | "confirmed" | "changed" | "archived";
  version: number;
  notes: string;
  confirmedBy: string | null;
  confirmedAt: string | null;
  updatedAt: string;
  items: DeliveryChecklistItemView[];
};

export type SaveDeliveryChecklistItemInput = {
  id?: string;
  itemKind: DeliveryChecklistItemKind;
  title: string;
  description?: string;
  quantity: number;
  status?: DeliveryChecklistItemStatus;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
};

export type SaveDeliveryChecklistInput = {
  projectId: string;
  estimateId?: string | null;
  status?: DeliveryChecklistView["status"];
  notes?: string;
  items: SaveDeliveryChecklistItemInput[];
  removedItemIds?: string[];
  actorId?: string | null;
};

export type UpdateDeliveryChecklistItemInput = {
  projectId: string;
  itemId: string;
  itemKind?: DeliveryChecklistItemKind;
  title?: string;
  description?: string;
  quantity?: number;
  status?: DeliveryChecklistItemStatus;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
  actorId?: string | null;
};

type DeliveryChecklistRow = {
  id: string;
  project_id: string;
  estimate_id: string | null;
  status: DeliveryChecklistView["status"];
  version: number;
  notes: string;
  confirmed_by: string | null;
  confirmed_at: string | null;
  updated_at: string;
};

type DeliveryChecklistItemRow = {
  id: string;
  project_id: string;
  checklist_id: string;
  item_kind: DeliveryChecklistItemKind;
  title: string;
  description: string;
  quantity: number;
  status: DeliveryChecklistItemStatus;
  change_request_id: string | null;
  sort_order: number;
  metadata_json: unknown;
  updated_at: string;
};

export const DELIVERY_CHECKLIST_ITEM_SAVE_UPDATE_SQL = `
      update delivery_checklist_items
        set item_kind = $4,
            title = $5,
            description = $6,
            quantity = $7,
            status = $8,
            sort_order = $9,
            metadata_json = $10::jsonb,
            updated_by = case when exists (select 1 from users where id = $11::uuid) then $11::uuid else updated_by end,
            updated_at = now()
      where project_id = $1
        and checklist_id = $2
        and id = $3`;

export const DELIVERY_CHECKLIST_ITEM_REMOVE_SQL = `
      update delivery_checklist_items
         set status = 'cancelled',
             updated_by = case when exists (select 1 from users where id = $4::uuid) then $4::uuid else updated_by end,
             updated_at = now()
       where project_id = $1
         and checklist_id = $2
         and id = any($3::uuid[])`;

export const DELIVERY_CHECKLIST_ITEM_LIST_SQL = `
    select id, project_id, checklist_id, item_kind, title, description, quantity,
           status, change_request_id, sort_order, metadata_json, updated_at
      from delivery_checklist_items
     where checklist_id = $1
       and status <> 'cancelled'
     order by sort_order asc, updated_at asc`;

export const DELIVERY_CHECKLIST_ITEM_LIST_WITH_CANCELLED_SQL = `
    select id, project_id, checklist_id, item_kind, title, description, quantity,
           status, change_request_id, sort_order, metadata_json, updated_at
      from delivery_checklist_items
     where checklist_id = $1
     order by sort_order asc, updated_at asc`;

export async function getProjectDeliveryChecklist(projectId: string): Promise<DeliveryChecklistView | null> {
  const checklistResult = await query<DeliveryChecklistRow>(
    `select id, project_id, estimate_id, status, version, notes, confirmed_by, confirmed_at, updated_at
       from delivery_checklists
      where project_id = $1
      limit 1`,
    [projectId]
  );
  const checklist = checklistResult.rows[0];
  if (!checklist) return null;

  const items = await listChecklistItems(checklist.id);
  return mapChecklist(checklist, items);
}

export async function getProjectDeliveryChecklistWithCancelled(projectId: string): Promise<DeliveryChecklistView | null> {
  const checklistResult = await query<DeliveryChecklistRow>(
    `select id, project_id, estimate_id, status, version, notes, confirmed_by, confirmed_at, updated_at
       from delivery_checklists
      where project_id = $1
      limit 1`,
    [projectId]
  );
  const checklist = checklistResult.rows[0];
  if (!checklist) return null;

  const items = await listChecklistItemsWithCancelled(checklist.id);
  return mapChecklist(checklist, items);
}

export async function createOrUpdateDeliveryChecklist(input: SaveDeliveryChecklistInput): Promise<DeliveryChecklistView> {
  return withTransaction(async (tx) => {
    const checklistResult = await tx<DeliveryChecklistRow>(
      `insert into delivery_checklists (
         project_id, estimate_id, status, version, notes, confirmed_by, confirmed_at,
         created_by, updated_by
       )
       values (
         $1, $2, $3, 1, $4,
         case when $3 = 'confirmed' and exists (select 1 from users where id = $5::uuid) then $5::uuid else null end,
         case when $3 = 'confirmed' then now() else null end,
         case when exists (select 1 from users where id = $5::uuid) then $5::uuid else null end,
         case when exists (select 1 from users where id = $5::uuid) then $5::uuid else null end
       )
       on conflict (project_id)
       do update set
         estimate_id = excluded.estimate_id,
         status = excluded.status,
         version = delivery_checklists.version + 1,
         notes = excluded.notes,
         confirmed_by = excluded.confirmed_by,
         confirmed_at = excluded.confirmed_at,
         updated_by = excluded.updated_by,
         updated_at = now()
       returning id, project_id, estimate_id, status, version, notes, confirmed_by, confirmed_at, updated_at`,
      [input.projectId, input.estimateId ?? null, input.status ?? "draft", input.notes ?? "", input.actorId ?? null]
    );
    const checklist = checklistResult.rows[0];

    if (input.removedItemIds?.length) {
      await tx(
        DELIVERY_CHECKLIST_ITEM_REMOVE_SQL,
        [input.projectId, checklist.id, input.removedItemIds, input.actorId ?? null]
      );
    }

    for (const [index, item] of input.items.entries()) {
      const saved = item.id
        ? await updateChecklistItemForSave(tx, {
            projectId: input.projectId,
            checklistId: checklist.id,
            item,
            actorId: input.actorId ?? null,
            sortOrder: item.sortOrder ?? index,
          })
        : null;

      if (!saved) {
        await insertChecklistItem(tx, {
          projectId: input.projectId,
          checklistId: checklist.id,
          item,
          actorId: input.actorId ?? null,
          sortOrder: item.sortOrder ?? index,
        });
      }
    }

    const items = await listChecklistItems(checklist.id, tx);
    return mapChecklist(checklist, items);
  });
}

async function updateChecklistItemForSave(
  tx: TransactionQuery,
  input: {
    projectId: string;
    checklistId: string;
    item: SaveDeliveryChecklistItemInput;
    actorId: string | null;
    sortOrder: number;
  }
) {
  const result = await tx(
    DELIVERY_CHECKLIST_ITEM_SAVE_UPDATE_SQL,
    [
      input.projectId,
      input.checklistId,
      input.item.id,
      input.item.itemKind,
      input.item.title,
      input.item.description ?? "",
      input.item.quantity,
      input.item.status ?? "planned",
      input.sortOrder,
      JSON.stringify(input.item.metadata ?? {}),
      input.actorId,
    ]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function updateDeliveryChecklistItem(input: UpdateDeliveryChecklistItemInput): Promise<DeliveryChecklistItemView> {
  const result = await query<DeliveryChecklistItemRow>(
    `update delivery_checklist_items
        set item_kind = coalesce($3, item_kind),
            title = coalesce($4, title),
            description = coalesce($5, description),
            quantity = coalesce($6, quantity),
            status = coalesce($7, status),
            sort_order = coalesce($8, sort_order),
            metadata_json = coalesce($9::jsonb, metadata_json),
            updated_by = case when exists (select 1 from users where id = $10::uuid) then $10::uuid else updated_by end,
            updated_at = now()
      where project_id = $1
        and id = $2
      returning id, project_id, checklist_id, item_kind, title, description, quantity,
                status, change_request_id, sort_order, metadata_json, updated_at`,
    [
      input.projectId,
      input.itemId,
      input.itemKind ?? null,
      input.title ?? null,
      input.description ?? null,
      input.quantity ?? null,
      input.status ?? null,
      input.sortOrder ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
      input.actorId ?? null,
    ]
  );

  if (!result.rows[0]) {
    throw new AppError({
      status: 404,
      code: "delivery_checklist_item_not_found",
      userMessage: "没有找到这条交付清单项。请刷新项目工作台后重试。",
    });
  }

  return mapChecklistItem(result.rows[0]);
}

async function insertChecklistItem(
  tx: TransactionQuery,
  input: {
    projectId: string;
    checklistId: string;
    item: SaveDeliveryChecklistItemInput;
    actorId: string | null;
    sortOrder: number;
  }
) {
  await tx(
    `insert into delivery_checklist_items (
       project_id, checklist_id, item_kind, title, description, quantity, status,
       sort_order, metadata_json, created_by, updated_by
     )
     values (
       $1, $2, $3, $4, $5, $6, $7,
       $8, $9::jsonb,
       case when exists (select 1 from users where id = $10::uuid) then $10::uuid else null end,
       case when exists (select 1 from users where id = $10::uuid) then $10::uuid else null end
     )`,
    [
      input.projectId,
      input.checklistId,
      input.item.itemKind,
      input.item.title,
      input.item.description ?? "",
      input.item.quantity,
      input.item.status ?? "planned",
      input.sortOrder,
      JSON.stringify(input.item.metadata ?? {}),
      input.actorId,
    ]
  );
}

async function listChecklistItems(checklistId: string, tx: TransactionQuery = query) {
  const result = await tx<DeliveryChecklistItemRow>(
    DELIVERY_CHECKLIST_ITEM_LIST_SQL,
    [checklistId]
  );
  return result.rows.map(mapChecklistItem);
}

async function listChecklistItemsWithCancelled(checklistId: string, tx: TransactionQuery = query) {
  const result = await tx<DeliveryChecklistItemRow>(
    DELIVERY_CHECKLIST_ITEM_LIST_WITH_CANCELLED_SQL,
    [checklistId]
  );
  return result.rows.map(mapChecklistItem);
}

function mapChecklist(row: DeliveryChecklistRow, items: DeliveryChecklistItemView[]): DeliveryChecklistView {
  return {
    id: row.id,
    projectId: row.project_id,
    estimateId: row.estimate_id,
    status: row.status,
    version: row.version,
    notes: row.notes,
    confirmedBy: row.confirmed_by,
    confirmedAt: row.confirmed_at,
    updatedAt: row.updated_at,
    items,
  };
}

function mapChecklistItem(row: DeliveryChecklistItemRow): DeliveryChecklistItemView {
  return {
    id: row.id,
    projectId: row.project_id,
    checklistId: row.checklist_id,
    itemKind: row.item_kind,
    title: row.title,
    description: row.description,
    quantity: row.quantity,
    status: row.status,
    changeRequestId: row.change_request_id,
    sortOrder: row.sort_order,
    metadata: normalizeRecord(row.metadata_json),
    updatedAt: row.updated_at,
  };
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
