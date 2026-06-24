import { createHash, randomBytes } from "node:crypto";
import { query } from "@/lib/db";
import { env } from "@/lib/env";
import type { AuthUser } from "@/server/repositories/users";

type SessionUserRow = {
  session_id: string;
  user_id: string;
  name: string;
  email: string | null;
  role: AuthUser["role"];
  is_active: boolean;
};

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export async function createSession(userId: string) {
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  await query(
    `insert into user_sessions (user_id, token_hash, expires_at)
     values ($1, $2, now() + ($3::text || ' days')::interval)`,
    [userId, tokenHash, env.SESSION_TTL_DAYS]
  );
  return token;
}

export async function findSessionUser(token: string) {
  const result = await query<SessionUserRow>(
    `select s.id as session_id, u.id as user_id, u.name, u.email, u.role, u.is_active
     from user_sessions s
     join users u on u.id = s.user_id
     where s.token_hash = $1
       and s.revoked_at is null
       and s.expires_at > now()
     limit 1`,
    [hashSessionToken(token)]
  );

  const row = result.rows[0];
  if (!row || !row.is_active) return null;

  return {
    sessionId: row.session_id,
    user: {
      id: row.user_id,
      name: row.name,
      email: row.email,
      role: row.role,
      isActive: row.is_active,
    },
  };
}

export async function revokeSession(token: string) {
  await query(
    `update user_sessions
     set revoked_at = now()
     where token_hash = $1 and revoked_at is null`,
    [hashSessionToken(token)]
  );
}
