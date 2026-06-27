import { query, withTransaction, type TransactionQuery } from "@/lib/db";
import { projectStages, type ProjectSummary, type ProjectStage, type StageStatus } from "@/domain/types";
import type { AuthUser } from "@/server/repositories/users";
import { addProjectMember } from "@/server/repositories/project-members";
import { upsertProjectStageState } from "@/server/repositories/project-stages";
import { createAuditLog } from "@/server/repositories/audit-logs";

type ProjectRow = {
  id: string;
  brand_name: string;
  project_name: string;
  current_stage: ProjectStage;
  owner_id: string | null;
  owner_name: string;
  due_date: string | null;
  status: StageStatus;
  updated_at: string;
};

export type ProjectRecord = ProjectSummary & {
  ownerId: string | null;
};

export type ProjectBasicsInput = {
  brandName: string;
  projectName: string;
  ownerName: string;
  dueDate?: string | null;
};

export async function listProjects(user: AuthUser): Promise<ProjectSummary[]> {
  const result =
    user.role === "admin"
      ? await query<ProjectRow>(
          `select id, brand_name, project_name, current_stage, owner_id, owner_name, due_date, status, updated_at
           from projects
           where archived_at is null
           order by updated_at desc
           limit 50`
        )
      : await query<ProjectRow>(
          `select p.id, p.brand_name, p.project_name, p.current_stage, p.owner_id, p.owner_name, p.due_date, p.status, p.updated_at
           from projects p
           join project_members m on m.project_id = p.id
           where p.archived_at is null
             and m.user_id = $1
           order by p.updated_at desc
           limit 50`,
          [user.id]
        );

  return result.rows.map(mapProject);
}

export async function createProject(input: ProjectBasicsInput, actor: AuthUser) {
  const result = await query<ProjectRow>(
    `insert into projects (brand_name, project_name, current_stage, owner_id, owner_name, due_date, status)
     values ($1, $2, 'brand_requirement_intake', $3, $4, $5, 'in_progress')
     returning id, brand_name, project_name, current_stage, owner_id, owner_name, due_date, status, updated_at`,
    [input.brandName, input.projectName, actor.id, input.ownerName, input.dueDate ?? null]
  );

  const project = mapProject(result.rows[0]);
  await addProjectMember({ projectId: project.id, userId: actor.id, role: actor.role });
  await Promise.all(
    projectStages.map((stage, index) =>
      upsertProjectStageState({
        projectId: project.id,
        stageKey: stage,
        status: index === 0 ? "in_progress" : "not_started",
        ownerName: input.ownerName,
      })
    )
  );
  return project;
}

export async function updateProjectBasics(projectId: string, input: ProjectBasicsInput, actor: AuthUser) {
  const existing = await getProjectById(projectId);
  if (!existing) return null;

  const result = await query<ProjectRow>(
    `update projects
     set brand_name = $2,
         project_name = $3,
         owner_name = $4,
         due_date = $5,
         updated_at = now()
     where id = $1
       and archived_at is null
     returning id, brand_name, project_name, current_stage, owner_id, owner_name, due_date, status, updated_at`,
    [projectId, input.brandName, input.projectName, input.ownerName, input.dueDate ?? null]
  );

  const project = result.rows[0] ? mapProject(result.rows[0]) : null;
  if (!project) return null;

  await Promise.all([
    upsertProjectStageState({
      projectId,
      stageKey: project.currentStage,
      status: project.status,
      ownerName: input.ownerName,
      snapshot: {
        reason: "project_basics_updated",
        brandName: input.brandName,
        projectName: input.projectName,
        dueDate: input.dueDate ?? null,
      },
    }),
    createAuditLog({
      actorId: actor.id,
      projectId,
      action: "project.updated",
      objectType: "project",
      objectId: projectId,
      before: {
        brandName: existing.brandName,
        projectName: existing.projectName,
        ownerName: existing.ownerName,
        dueDate: existing.dueDate,
      },
      after: {
        brandName: project.brandName,
        projectName: project.projectName,
        ownerName: project.ownerName,
        dueDate: project.dueDate,
      },
    }),
  ]);

  return project;
}

export async function getProjectDeletionSnapshot(projectId: string) {
  const result = await query<ProjectRow>(
    `select id, brand_name, project_name, current_stage, owner_id, owner_name, due_date, status, updated_at
     from projects
     where id = $1
     limit 1`,
    [projectId]
  );

  return result.rows[0] ? mapProject(result.rows[0]) : null;
}

export async function getProjectDeletionSnapshotWithTransaction(transactionQuery: TransactionQuery, projectId: string) {
  const result = await transactionQuery<ProjectRow>(
    `select id, brand_name, project_name, current_stage, owner_id, owner_name, due_date, status, updated_at
     from projects
     where id = $1
     limit 1`,
    [projectId]
  );

  return result.rows[0] ? mapProject(result.rows[0]) : null;
}

export async function archiveProject(projectId: string) {
  return withTransaction(async (transactionQuery) => archiveProjectWithTransaction(transactionQuery, projectId));
}

export async function archiveProjectWithTransaction(transactionQuery: TransactionQuery, projectId: string) {
  const result = await transactionQuery<ProjectRow>(
    `update projects
     set archived_at = now(),
         status = 'archived',
         updated_at = now()
     where id = $1
       and archived_at is null
     returning id, brand_name, project_name, current_stage, owner_id, owner_name, due_date, status, updated_at`,
    [projectId]
  );

  return result.rows[0] ? mapProject(result.rows[0]) : null;
}

export async function permanentlyDeleteProject(projectId: string) {
  return withTransaction(async (transactionQuery) => permanentlyDeleteProjectWithTransaction(transactionQuery, projectId));
}

export async function permanentlyDeleteProjectWithTransaction(transactionQuery: TransactionQuery, projectId: string) {
  const existing = await getProjectDeletionSnapshotWithTransaction(transactionQuery, projectId);
  if (!existing) return null;

  const deleteResult = await transactionQuery<{ id: string }>(
    `delete from projects where id = $1 returning id`,
    [projectId]
  );

  if (!deleteResult.rows[0]) return null;

  return existing;
}

export async function getProjectById(projectId: string) {
  const result = await query<ProjectRow>(
    `select id, brand_name, project_name, current_stage, owner_id, owner_name, due_date, status, updated_at
     from projects
     where id = $1
       and archived_at is null
     limit 1`,
    [projectId]
  );

  return result.rows[0] ? mapProject(result.rows[0]) : null;
}

function mapProject(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    brandName: row.brand_name,
    projectName: row.project_name,
    currentStage: row.current_stage,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    dueDate: row.due_date,
    status: row.status,
    updatedAt: row.updated_at,
  };
}
