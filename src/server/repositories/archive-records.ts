import { query } from "@/lib/db";

export type CaseStudyPermission = "allowed" | "not_allowed" | "pending";
export type ArchiveRecordStatus = "draft" | "ready" | "completed" | "blocked" | "archived";

export type ArchiveRecordView = {
  id: string;
  projectId: string;
  status: ArchiveRecordStatus;
  finalFilesReady: boolean;
  finalTechnicalCheckPassed: boolean;
  tailPaymentConfirmed: boolean;
  clientReceivedConfirmed: boolean;
  rightsConfirmed: boolean;
  caseStudyPermission: CaseStudyPermission;
  nasArchiveCompleted: boolean;
  deliveryChannel: string;
  archiveLocation: string;
  afterSalesNote: string;
  completedBy: string | null;
  completedAt: string | null;
  updatedAt: string;
};

export type SaveArchiveRecordInput = {
  projectId: string;
  finalFilesReady?: boolean;
  finalTechnicalCheckPassed?: boolean;
  tailPaymentConfirmed?: boolean;
  clientReceivedConfirmed?: boolean;
  rightsConfirmed?: boolean;
  caseStudyPermission?: CaseStudyPermission;
  nasArchiveCompleted?: boolean;
  deliveryChannel?: string;
  archiveLocation?: string;
  afterSalesNote?: string;
  actorId?: string | null;
};

export type CompleteArchiveRecordInput = {
  projectId: string;
  archiveRecordId: string;
  actorId: string;
};

type ArchiveRecordRow = {
  id: string;
  project_id: string;
  status: ArchiveRecordStatus;
  final_files_ready: boolean;
  final_technical_check_passed: boolean;
  tail_payment_confirmed: boolean;
  client_received_confirmed: boolean;
  rights_confirmed: boolean;
  case_study_permission: CaseStudyPermission;
  nas_archive_completed: boolean;
  delivery_channel: string;
  archive_location: string;
  after_sales_note: string;
  completed_by: string | null;
  completed_at: string | null;
  updated_at: string;
};

export async function getProjectArchiveRecord(projectId: string): Promise<ArchiveRecordView | null> {
  const result = await query<ArchiveRecordRow>(
    `select id, project_id, status, final_files_ready, final_technical_check_passed,
            tail_payment_confirmed, client_received_confirmed, rights_confirmed,
            case_study_permission, nas_archive_completed, delivery_channel,
            archive_location, after_sales_note, completed_by, completed_at, updated_at
       from archive_records
      where project_id = $1
      limit 1`,
    [projectId]
  );

  return result.rows[0] ? mapArchiveRecord(result.rows[0]) : null;
}

export async function saveArchiveRecord(input: SaveArchiveRecordInput): Promise<ArchiveRecordView> {
  const result = await query<ArchiveRecordRow>(
    `insert into archive_records (
       project_id, status, final_files_ready, final_technical_check_passed,
       tail_payment_confirmed, client_received_confirmed, rights_confirmed,
       case_study_permission, nas_archive_completed, delivery_channel,
       archive_location, after_sales_note, created_by, updated_by
     )
     values (
       $1, 'draft', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
       case when exists (select 1 from users where id = $12::uuid) then $12::uuid else null end,
       case when exists (select 1 from users where id = $12::uuid) then $12::uuid else null end
     )
     on conflict (project_id)
     do update set
       status = case when archive_records.status = 'completed' then archive_records.status else 'draft' end,
       final_files_ready = excluded.final_files_ready,
       final_technical_check_passed = excluded.final_technical_check_passed,
       tail_payment_confirmed = excluded.tail_payment_confirmed,
       client_received_confirmed = excluded.client_received_confirmed,
       rights_confirmed = excluded.rights_confirmed,
       case_study_permission = excluded.case_study_permission,
       nas_archive_completed = excluded.nas_archive_completed,
       delivery_channel = excluded.delivery_channel,
       archive_location = excluded.archive_location,
       after_sales_note = excluded.after_sales_note,
       updated_by = excluded.updated_by,
       updated_at = now()
     returning id, project_id, status, final_files_ready, final_technical_check_passed,
               tail_payment_confirmed, client_received_confirmed, rights_confirmed,
               case_study_permission, nas_archive_completed, delivery_channel,
               archive_location, after_sales_note, completed_by, completed_at, updated_at`,
    [
      input.projectId,
      input.finalFilesReady ?? false,
      input.finalTechnicalCheckPassed ?? false,
      input.tailPaymentConfirmed ?? false,
      input.clientReceivedConfirmed ?? false,
      input.rightsConfirmed ?? false,
      input.caseStudyPermission ?? "pending",
      input.nasArchiveCompleted ?? false,
      input.deliveryChannel ?? "",
      input.archiveLocation ?? "",
      input.afterSalesNote ?? "",
      input.actorId ?? null,
    ]
  );

  return mapArchiveRecord(result.rows[0]);
}

export async function completeArchiveRecord(input: CompleteArchiveRecordInput): Promise<ArchiveRecordView | null> {
  const result = await query<ArchiveRecordRow>(
    `update archive_records
        set status = 'completed',
            completed_by = case when exists (select 1 from users where id = $3::uuid) then $3::uuid else completed_by end,
            completed_at = now(),
            updated_by = case when exists (select 1 from users where id = $3::uuid) then $3::uuid else updated_by end,
            updated_at = now()
      where project_id = $1
        and id = $2
      returning id, project_id, status, final_files_ready, final_technical_check_passed,
                tail_payment_confirmed, client_received_confirmed, rights_confirmed,
                case_study_permission, nas_archive_completed, delivery_channel,
                archive_location, after_sales_note, completed_by, completed_at, updated_at`,
    [input.projectId, input.archiveRecordId, input.actorId]
  );

  return result.rows[0] ? mapArchiveRecord(result.rows[0]) : null;
}

function mapArchiveRecord(row: ArchiveRecordRow): ArchiveRecordView {
  return {
    id: row.id,
    projectId: row.project_id,
    status: row.status,
    finalFilesReady: row.final_files_ready,
    finalTechnicalCheckPassed: row.final_technical_check_passed,
    tailPaymentConfirmed: row.tail_payment_confirmed,
    clientReceivedConfirmed: row.client_received_confirmed,
    rightsConfirmed: row.rights_confirmed,
    caseStudyPermission: row.case_study_permission,
    nasArchiveCompleted: row.nas_archive_completed,
    deliveryChannel: row.delivery_channel,
    archiveLocation: row.archive_location,
    afterSalesNote: row.after_sales_note,
    completedBy: row.completed_by,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  };
}
