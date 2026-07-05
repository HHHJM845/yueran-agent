import { query } from "@/lib/db";
import type { ArtifactKind } from "@/domain/types";

export type ArtifactSummary = {
  id: string;
  projectId: string;
  kind: ArtifactKind;
  title: string;
  status: string;
  data: unknown;
  ossUrl: string | null;
  sourceJobId: string | null;
  version: number;
  updatedAt: string;
};

type ArtifactRow = {
  id: string;
  project_id: string;
  kind: ArtifactKind;
  title: string;
  status: string;
  data_json: unknown;
  oss_url: string | null;
  source_job_id: string | null;
  version: number;
  updated_at: string;
};

export async function listProjectArtifacts(projectId: string) {
  const result = await query<ArtifactRow>(
    `select id, project_id, kind, title, status, data_json, oss_url, source_job_id, version, updated_at
     from artifacts
     where project_id = $1
     order by updated_at desc
     limit 100`,
    [projectId]
  );

  return result.rows.map(mapArtifact);
}

export async function createArtifact(input: {
  projectId: string;
  kind: ArtifactKind;
  title: string;
  status?: string;
  data: unknown;
  sourceJobId?: string | null;
  ossUrl?: string | null;
  createdBy?: string | null;
}) {
  const result = await query<ArtifactRow>(
    `insert into artifacts (project_id, kind, title, status, data_json, source_job_id, oss_url, created_by)
     values (
       $1, $2, $3, $4, $5::jsonb, $6, $7,
       case when exists (select 1 from users where id = $8::uuid) then $8::uuid else null end
     )
     returning id, project_id, kind, title, status, data_json, oss_url, source_job_id, version, updated_at`,
    [
      input.projectId,
      input.kind,
      input.title,
      input.status ?? "draft",
      JSON.stringify(input.data),
      input.sourceJobId ?? null,
      input.ossUrl ?? null,
      input.createdBy ?? null,
    ]
  );

  return mapArtifact(result.rows[0]);
}

export async function updateArtifactStatus(input: {
  projectId: string;
  artifactId: string;
  status: string;
}) {
  const result = await query<ArtifactRow>(
    `update artifacts
     set status = $3,
         updated_at = now()
     where project_id = $1
       and id = $2
     returning id, project_id, kind, title, status, data_json, oss_url, source_job_id, version, updated_at`,
    [input.projectId, input.artifactId, input.status]
  );

  return result.rows[0] ? mapArtifact(result.rows[0]) : null;
}

function mapArtifact(row: ArtifactRow): ArtifactSummary {
  return {
    id: row.id,
    projectId: row.project_id,
    kind: row.kind,
    title: row.title,
    status: row.status,
    data: row.data_json,
    ossUrl: row.oss_url,
    sourceJobId: row.source_job_id,
    version: row.version,
    updatedAt: row.updated_at,
  };
}
