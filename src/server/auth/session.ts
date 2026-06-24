import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { createSession, findSessionUser, revokeSession } from "@/server/repositories/sessions";

export async function requireUser(request: Request) {
  const token = readSessionToken(request);
  if (!token) {
    throw new AppError({
      status: 401,
      code: "not_authenticated",
      userMessage: "请先登录内部工作台，再继续操作。",
    });
  }

  const session = await findSessionUser(token);
  if (!session) {
    throw new AppError({
      status: 401,
      code: "session_expired",
      userMessage: "登录状态已过期。请重新登录后再继续操作。",
    });
  }

  return session.user;
}

export async function getOptionalUser(request: Request) {
  const token = readSessionToken(request);
  if (!token) return null;
  const session = await findSessionUser(token);
  return session?.user ?? null;
}

export async function issueSessionCookie(userId: string) {
  const token = await createSession(userId);
  return buildSessionCookie(token, env.SESSION_TTL_DAYS * 24 * 60 * 60);
}

export async function clearSessionCookie(request: Request) {
  const token = readSessionToken(request);
  if (token) await revokeSession(token);
  return `${env.SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function readSessionToken(request: Request) {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;

  for (const part of cookie.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === env.SESSION_COOKIE_NAME) {
      return decodeURIComponent(rawValue.join("="));
    }
  }

  return null;
}

function buildSessionCookie(token: string, maxAgeSeconds: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${env.SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}
