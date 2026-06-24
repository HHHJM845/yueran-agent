import { query } from "@/lib/db";
import type { Role } from "@/domain/types";

export type AuthUser = {
  id: string;
  name: string;
  email: string | null;
  role: Role;
  isActive: boolean;
};

type UserRow = {
  id: string;
  name: string;
  email: string | null;
  password_hash: string | null;
  role: Role;
  is_active: boolean;
};

export async function findUserByEmail(email: string) {
  const result = await query<UserRow>(
    `select id, name, email, password_hash, role, is_active
     from users
     where lower(email) = lower($1)
     limit 1`,
    [email]
  );

  const row = result.rows[0];
  return row ? { user: mapUser(row), passwordHash: row.password_hash } : null;
}

export async function findUserById(userId: string) {
  const result = await query<UserRow>(
    `select id, name, email, password_hash, role, is_active
     from users
     where id = $1
     limit 1`,
    [userId]
  );

  const row = result.rows[0];
  return row ? mapUser(row) : null;
}

export async function upsertUser(input: {
  name: string;
  email: string;
  role: Role;
  passwordHash: string;
}) {
  const result = await query<UserRow>(
    `insert into users (name, email, role, password_hash, is_active)
     values ($1, lower($2), $3, $4, true)
     on conflict (email)
     do update set
       name = excluded.name,
       role = excluded.role,
       password_hash = excluded.password_hash,
       is_active = true,
       updated_at = now()
     returning id, name, email, password_hash, role, is_active`,
    [input.name, input.email, input.role, input.passwordHash]
  );

  return mapUser(result.rows[0]);
}

export async function listActiveUsers() {
  const result = await query<UserRow>(
    `select id, name, email, password_hash, role, is_active
     from users
     where is_active = true
     order by role asc, name asc
     limit 200`
  );

  return result.rows.map(mapUser);
}

export async function countUsers() {
  const result = await query<{ count: string }>(`select count(*)::text as count from users`);
  return Number(result.rows[0]?.count ?? 0);
}

export async function recordLastLogin(userId: string) {
  await query(`update users set last_login_at = now(), updated_at = now() where id = $1`, [userId]);
}

function mapUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    isActive: row.is_active,
  };
}
