import { z } from "zod";
import { createAuditLog } from "@/server/repositories/audit-logs";
import { hashPassword } from "@/server/auth/password";
import { upsertUser } from "@/server/repositories/users";

export const createUserInputSchema = z.object({
  name: z.string().trim().min(1, "请输入成员姓名").max(80, "成员姓名最多 80 个字符"),
  email: z.string().trim().email("请输入有效邮箱"),
  password: z.string().min(12, "密码至少需要 12 位"),
  role: z.enum(["business", "creative", "admin"]),
});

export async function createUser(input: {
  actorId: string;
  name: string;
  email: string;
  password: string;
  role: "business" | "creative" | "admin";
}, dependencies: {
  hash: typeof hashPassword;
  upsert: typeof upsertUser;
  audit: typeof createAuditLog;
} = {
  hash: hashPassword,
  upsert: upsertUser,
  audit: createAuditLog,
}) {
  const parsed = createUserInputSchema.parse(input);
  const user = await dependencies.upsert({
    name: parsed.name,
    email: parsed.email,
    role: parsed.role,
    passwordHash: await dependencies.hash(parsed.password),
  });

  await dependencies.audit({
    actorId: input.actorId,
    action: "user.upserted",
    objectType: "user",
    objectId: user.id,
    after: {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    },
  });

  return {
    user,
    message: "成员账号已创建或更新。现在可以把这位成员加入项目。",
  };
}
