import { query } from "@/lib/db";

export type ProposalView = {
  id: string;
  projectId: string;
  title: string;
  content: string;
  status: string;
  version: number;
  latestSnapshotId: string | null;
  updatedAt: string;
};

export type DocumentSnapshotView = {
  id: string;
  projectId: string;
  documentType: string;
  documentId: string;
  title: string;
  version: number;
  status: string;
  content: string;
  summary: string;
  snapshot: unknown;
  createdAt: string;
};

type ProposalRow = {
  id: string;
  project_id: string;
  title: string;
  content: string;
  status: string;
  version: number;
  latest_snapshot_id: string | null;
  updated_at: string;
};

type DocumentSnapshotRow = {
  id: string;
  project_id: string;
  document_type: string;
  document_id: string;
  title: string;
  version: number;
  status: string;
  content: string;
  summary: string;
  snapshot_json: unknown;
  created_at: string;
};

export async function getProjectProposal(projectId: string) {
  const result = await query<ProposalRow>(
    `select id, project_id, title, content, status, version, latest_snapshot_id, updated_at
     from proposals
     where project_id = $1
     limit 1`,
    [projectId]
  );

  return result.rows[0] ? mapProposal(result.rows[0]) : null;
}

export async function upsertProjectProposal(input: {
  projectId: string;
  title: string;
  content: string;
  status: string;
  actorId?: string | null;
}) {
  const result = await query<ProposalRow>(
    `insert into proposals (project_id, title, content, status, version, created_by, updated_by)
     values (
       $1, $2, $3, $4, 1,
       case when exists (select 1 from users where id = $5::uuid) then $5::uuid else null end,
       case when exists (select 1 from users where id = $5::uuid) then $5::uuid else null end
     )
     on conflict (project_id)
     do update set
       title = excluded.title,
       content = excluded.content,
       status = excluded.status,
       version = proposals.version + 1,
       updated_by = excluded.updated_by,
       updated_at = now()
     returning id, project_id, title, content, status, version, latest_snapshot_id, updated_at`,
    [input.projectId, input.title, input.content, input.status, input.actorId ?? null]
  );

  return mapProposal(result.rows[0]);
}

export async function createDocumentSnapshot(input: {
  projectId: string;
  documentType: string;
  documentId: string;
  title: string;
  version: number;
  status: string;
  content: string;
  summary: string;
  snapshot: unknown;
  createdBy?: string | null;
}) {
  const result = await query<DocumentSnapshotRow>(
    `insert into document_snapshots (
       project_id, document_type, document_id, title, version, status, content,
       summary, snapshot_json, created_by
     )
     values (
       $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb,
       case when exists (select 1 from users where id = $10::uuid) then $10::uuid else null end
     )
     returning id, project_id, document_type, document_id, title, version, status,
               content, summary, snapshot_json, created_at`,
    [
      input.projectId,
      input.documentType,
      input.documentId,
      input.title,
      input.version,
      input.status,
      input.content,
      input.summary,
      JSON.stringify(input.snapshot),
      input.createdBy ?? null,
    ]
  );

  return mapDocumentSnapshot(result.rows[0]);
}

export async function updateProposalLatestSnapshot(input: { proposalId: string; snapshotId: string }) {
  await query(
    `update proposals
     set latest_snapshot_id = $2,
         updated_at = now()
     where id = $1`,
    [input.proposalId, input.snapshotId]
  );
}

export async function updateProposalStatus(input: {
  projectId: string;
  proposalId: string;
  status: string;
  actorId?: string | null;
}) {
  const result = await query<ProposalRow>(
    `update proposals
     set status = $3,
         updated_by = case when exists (select 1 from users where id = $4::uuid) then $4::uuid else updated_by end,
         updated_at = now()
     where project_id = $1
       and id = $2
     returning id, project_id, title, content, status, version, latest_snapshot_id, updated_at`,
    [input.projectId, input.proposalId, input.status, input.actorId ?? null]
  );

  return result.rows[0] ? mapProposal(result.rows[0]) : null;
}

export async function listProjectDocumentSnapshots(projectId: string, documentType?: string) {
  const result = await query<DocumentSnapshotRow>(
    `select id, project_id, document_type, document_id, title, version, status,
            content, summary, snapshot_json, created_at
     from document_snapshots
     where project_id = $1
       and ($2::text is null or document_type = $2)
     order by version desc, created_at desc
     limit 50`,
    [projectId, documentType ?? null]
  );

  return result.rows.map(mapDocumentSnapshot);
}

function mapProposal(row: ProposalRow): ProposalView {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    content: row.content,
    status: row.status,
    version: row.version,
    latestSnapshotId: row.latest_snapshot_id,
    updatedAt: row.updated_at,
  };
}

function mapDocumentSnapshot(row: DocumentSnapshotRow): DocumentSnapshotView {
  return {
    id: row.id,
    projectId: row.project_id,
    documentType: row.document_type,
    documentId: row.document_id,
    title: row.title,
    version: row.version,
    status: row.status,
    content: row.content,
    summary: row.summary,
    snapshot: row.snapshot_json,
    createdAt: row.created_at,
  };
}
