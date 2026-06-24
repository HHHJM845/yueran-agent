import { query } from "@/lib/db";

export type ContractTemplateFields = {
  partyAName: string;
  partyBName: string;
  projectName: string;
  quoteTitle: string;
  quoteTotalAmount: number;
  quoteCurrency: string;
  deliveryScope: string;
  paymentTerms: string;
  effectiveDate: string;
};

export type ContractView = {
  id: string;
  projectId: string;
  proposalId: string | null;
  quoteId: string | null;
  clientContractAssetId: string | null;
  title: string;
  templateKey: string;
  templateFields: ContractTemplateFields;
  content: string;
  status: string;
  version: number;
  latestSnapshotId: string | null;
  updatedAt: string;
};

type ContractRow = {
  id: string;
  project_id: string;
  proposal_id: string | null;
  quote_id: string | null;
  client_contract_asset_id: string | null;
  title: string;
  template_key: string;
  template_fields_json: unknown;
  content: string;
  status: string;
  version: number;
  latest_snapshot_id: string | null;
  updated_at: string;
};

export async function getProjectContract(projectId: string) {
  const result = await query<ContractRow>(
    `select id, project_id, proposal_id, quote_id, client_contract_asset_id, title,
            template_key, template_fields_json, content, status, version,
            latest_snapshot_id, updated_at
     from contracts
     where project_id = $1
     limit 1`,
    [projectId]
  );

  return result.rows[0] ? mapContract(result.rows[0]) : null;
}

export async function upsertProjectContract(input: {
  projectId: string;
  proposalId?: string | null;
  quoteId?: string | null;
  clientContractAssetId?: string | null;
  title: string;
  templateKey: string;
  templateFields: ContractTemplateFields;
  content: string;
  status: string;
  actorId?: string | null;
}) {
  const result = await query<ContractRow>(
    `insert into contracts (
       project_id, proposal_id, quote_id, client_contract_asset_id, title,
       template_key, template_fields_json, content, status, version,
       created_by, updated_by
     )
     values (
       $1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, 1,
       case when exists (select 1 from users where id = $10::uuid) then $10::uuid else null end,
       case when exists (select 1 from users where id = $10::uuid) then $10::uuid else null end
     )
     on conflict (project_id)
     do update set
       proposal_id = excluded.proposal_id,
       quote_id = excluded.quote_id,
       client_contract_asset_id = excluded.client_contract_asset_id,
       title = excluded.title,
       template_key = excluded.template_key,
       template_fields_json = excluded.template_fields_json,
       content = excluded.content,
       status = excluded.status,
       version = contracts.version + 1,
       updated_by = excluded.updated_by,
       updated_at = now()
     returning id, project_id, proposal_id, quote_id, client_contract_asset_id,
               title, template_key, template_fields_json, content, status, version,
               latest_snapshot_id, updated_at`,
    [
      input.projectId,
      input.proposalId ?? null,
      input.quoteId ?? null,
      input.clientContractAssetId ?? null,
      input.title,
      input.templateKey,
      JSON.stringify(input.templateFields),
      input.content,
      input.status,
      input.actorId ?? null,
    ]
  );

  return mapContract(result.rows[0]);
}

export async function updateContractLatestSnapshot(input: { contractId: string; snapshotId: string }) {
  await query(
    `update contracts
     set latest_snapshot_id = $2,
         updated_at = now()
     where id = $1`,
    [input.contractId, input.snapshotId]
  );
}

export async function updateContractStatus(input: { projectId: string; contractId: string; status: string; actorId?: string | null }) {
  const result = await query<ContractRow>(
    `update contracts
     set status = $3,
         updated_by = case when exists (select 1 from users where id = $4::uuid) then $4::uuid else updated_by end,
         updated_at = now()
     where project_id = $1
       and id = $2
     returning id, project_id, proposal_id, quote_id, client_contract_asset_id,
               title, template_key, template_fields_json, content, status, version,
               latest_snapshot_id, updated_at`,
    [input.projectId, input.contractId, input.status, input.actorId ?? null]
  );

  return result.rows[0] ? mapContract(result.rows[0]) : null;
}

function mapContract(row: ContractRow): ContractView {
  return {
    id: row.id,
    projectId: row.project_id,
    proposalId: row.proposal_id,
    quoteId: row.quote_id,
    clientContractAssetId: row.client_contract_asset_id,
    title: row.title,
    templateKey: row.template_key,
    templateFields: normalizeTemplateFields(row.template_fields_json),
    content: row.content,
    status: row.status,
    version: row.version,
    latestSnapshotId: row.latest_snapshot_id,
    updatedAt: row.updated_at,
  };
}

function normalizeTemplateFields(value: unknown): ContractTemplateFields {
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return {
    partyAName: String(record.partyAName ?? ""),
    partyBName: String(record.partyBName ?? ""),
    projectName: String(record.projectName ?? ""),
    quoteTitle: String(record.quoteTitle ?? ""),
    quoteTotalAmount: Number(record.quoteTotalAmount ?? 0),
    quoteCurrency: String(record.quoteCurrency ?? "CNY"),
    deliveryScope: String(record.deliveryScope ?? ""),
    paymentTerms: String(record.paymentTerms ?? ""),
    effectiveDate: String(record.effectiveDate ?? ""),
  };
}
