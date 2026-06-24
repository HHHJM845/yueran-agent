import { query } from "@/lib/db";
import type { Role } from "@/domain/types";

export type ProjectMemberView = {
  userId: string;
  name: string;
  email: string | null;
  role: Role;
  membershipRole: Role;
  createdAt: string;
};

type ProjectMemberRow = {
  user_id: string;
  name: string;
  email: string | null;
  role: Role;
  membership_role: Role;
  created_at: string;
};

export async function addProjectMember(input: { projectId: string; userId: string; role: Role }) {
  await query(
    `insert into project_members (project_id, user_id, role)
     values ($1, $2, $3)
     on conflict (project_id, user_id)
     do update set role = excluded.role`,
    [input.projectId, input.userId, input.role]
  );
}

export async function hasProjectAccess(input: { projectId: string; userId: string }) {
  const result = await query<{ exists: boolean }>(
    `select exists (
       select 1
       from project_members
       where project_id = $1 and user_id = $2
     )`,
    [input.projectId, input.userId]
  );

  return Boolean(result.rows[0]?.exists);
}

export async function getProjectMembership(input: { projectId: string; userId: string }) {
  const result = await query<{ role: Role }>(
    `select role
     from project_members
     where project_id = $1 and user_id = $2
     limit 1`,
    [input.projectId, input.userId]
  );

  return result.rows[0] ?? null;
}

export async function listAccessibleProjectIds(userId: string) {
  const result = await query<{ project_id: string }>(
    `select project_id
     from project_members
     where user_id = $1`,
    [userId]
  );

  return result.rows.map((row) => row.project_id);
}

export async function listProjectMembers(projectId: string): Promise<ProjectMemberView[]> {
  const result = await query<ProjectMemberRow>(
    `select u.id as user_id, u.name, u.email, u.role, m.role as membership_role, m.created_at
     from project_members m
     join users u on u.id = m.user_id
     where m.project_id = $1
     order by m.created_at asc`,
    [projectId]
  );

  return result.rows.map((row) => ({
    userId: row.user_id,
    name: row.name,
    email: row.email,
    role: row.role,
    membershipRole: row.membership_role,
    createdAt: row.created_at,
  }));
}
