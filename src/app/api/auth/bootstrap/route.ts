import { z } from "zod";
import { AppError, jsonError } from "@/lib/errors";
import { hashPassword } from "@/server/auth/password";
import { issueSessionCookie } from "@/server/auth/session";
import { countUsers, upsertUser } from "@/server/repositories/users";

const bootstrapSchema = z.object({
  name: z.string().min(1, "请输入管理员姓名"),
  email: z.string().email("请输入有效邮箱"),
  password: z.string().min(12, "管理员密码至少需要 12 位"),
});

export async function GET() {
  try {
    const users = await countUsers();
    return Response.json({ ok: true, data: { needsBootstrap: users === 0 } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const users = await countUsers();
    if (users > 0) {
      throw new AppError({
        status: 409,
        code: "bootstrap_closed",
        userMessage: "系统已经创建过内部账号。请使用已有管理员账号登录后再管理成员。",
      });
    }

    const body = bootstrapSchema.parse(await request.json());
    const user = await upsertUser({
      name: body.name,
      email: body.email,
      role: "admin",
      passwordHash: await hashPassword(body.password),
    });
    const cookie = await issueSessionCookie(user.id);

    return Response.json(
      { ok: true, data: { user } },
      {
        status: 201,
        headers: {
          "Set-Cookie": cookie,
        },
      }
    );
  } catch (error) {
    return jsonError(error);
  }
}
