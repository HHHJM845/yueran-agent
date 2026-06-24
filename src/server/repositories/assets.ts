import { query } from "@/lib/db";

export type AssetRecord = {
  id: string;
  projectId: string;
  assetType: string;
  sourceType: string;
  ossKey: string | null;
  ossUrl: string | null;
  externalUrl: string | null;
  externalProvider: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  parseStatus: string;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

type AssetRow = {
  id: string;
  project_id: string;
  asset_type: string;
  source_type: string;
  oss_key: string | null;
  oss_url: string | null;
  external_url: string | null;
  external_provider: string | null;
  file_name: string | null;
  file_size: string | null;
  mime_type: string | null;
  parse_status: string;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
};

export async function listProjectAssets(projectId: string) {
  const result = await query<AssetRow>(
    `select id, project_id, asset_type, source_type, oss_key, oss_url, external_url, external_provider,
            file_name, file_size, mime_type, parse_status, failure_reason, created_at, updated_at
     from assets
     where project_id = $1
     order by created_at desc
     limit 100`,
    [projectId]
  );

  return result.rows.map(mapAsset);
}

export async function getProjectAsset(projectId: string, assetId: string) {
  const result = await query<AssetRow>(
    `select id, project_id, asset_type, source_type, oss_key, oss_url, external_url, external_provider,
            file_name, file_size, mime_type, parse_status, failure_reason, created_at, updated_at
     from assets
     where project_id = $1 and id = $2
     limit 1`,
    [projectId, assetId]
  );

  const row = result.rows[0];
  return row ? mapAsset(row) : null;
}

export async function updateAssetParseStatus(input: {
  assetId: string;
  parseStatus: string;
  failureReason?: string | null;
}) {
  await query(
    `update assets
     set parse_status = $2,
         failure_reason = $3,
         updated_at = now()
     where id = $1`,
    [input.assetId, input.parseStatus, input.failureReason ?? null]
  );
}

export async function createUploadedAsset(input: {
  projectId: string;
  uploadedBy: string;
  assetType: string;
  ossKey: string;
  ossUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}) {
  const result = await query<AssetRow>(
    `insert into assets (project_id, uploaded_by, asset_type, source_type, oss_key, oss_url, file_name, file_size, mime_type, parse_status)
     values ($1, $2, $3, 'upload', $4, $5, $6, $7, $8, 'queued')
     returning id, project_id, asset_type, source_type, oss_key, oss_url, external_url, external_provider,
               file_name, file_size, mime_type, parse_status, failure_reason, created_at, updated_at`,
    [input.projectId, input.uploadedBy, input.assetType, input.ossKey, input.ossUrl, input.fileName, input.fileSize, input.mimeType]
  );

  return mapAsset(result.rows[0]);
}

export async function createExternalAsset(input: {
  projectId: string;
  uploadedBy: string;
  assetType: string;
  externalUrl: string;
  externalProvider: string;
  fileName?: string | null;
}) {
  const result = await query<AssetRow>(
    `insert into assets (project_id, uploaded_by, asset_type, source_type, external_url, external_provider, file_name, parse_status)
     values ($1, $2, $3, 'external_link', $4, $5, $6, 'queued')
     returning id, project_id, asset_type, source_type, oss_key, oss_url, external_url, external_provider,
               file_name, file_size, mime_type, parse_status, failure_reason, created_at, updated_at`,
    [input.projectId, input.uploadedBy, input.assetType, input.externalUrl, input.externalProvider, input.fileName ?? null]
  );

  return mapAsset(result.rows[0]);
}

function mapAsset(row: AssetRow): AssetRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    assetType: row.asset_type,
    sourceType: row.source_type,
    ossKey: row.oss_key,
    ossUrl: row.oss_url,
    externalUrl: row.external_url,
    externalProvider: row.external_provider,
    fileName: row.file_name,
    fileSize: row.file_size ? Number(row.file_size) : null,
    mimeType: row.mime_type,
    parseStatus: row.parse_status,
    failureReason: row.failure_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
