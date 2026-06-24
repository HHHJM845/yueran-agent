import { z } from "zod";
import { AppError, jsonError } from "@/lib/errors";
import { issueSessionCookie } from "@/server/auth/session";
import { verifyPassword } from "@/server/auth/password";
import { findUserByEmail, recordLastLogin } from "@/server/repositories/users";

const loginSchema = z.object({
  email: z.string().email("请输入有效邮箱"),
  password: z.string().min(1, "请输入密码"),
});

export async function POST(request: Request) {
  try {
    const body = loginSchema.parse(await request.json());
    const result = await findUserByEmail(body.email);
    const valid = result ? await verifyPassword(body.password, result.passwordHash) : false;

    if (!result || !valid || !result.user.isActive) {
      throw new AppError({
        status: 401,
        code: "invalid_credentials",
        userMessage: "邮箱或密码不正确，请检查后重新登录。",
      });
    }

    await recordLastLogin(result.user.id);
    const cookie = await issueSessionCookie(result.user.id);

    return Response.json(
      { ok: true, data: { user: result.user } },
      {
        headers: {
          "Set-Cookie": cookie,
        },
      }
    );
  } catch (error) {
    return jsonError(error);
  }
}
