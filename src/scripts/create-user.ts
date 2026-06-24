import { loadEnvConfig } from "@next/env";
import { z } from "zod";

loadEnvConfig(process.cwd());

const inputSchema = z.object({
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(12),
  ADMIN_NAME: z.string().min(1).default("管理员"),
  ADMIN_ROLE: z.enum(["business", "creative", "admin"]).default("admin"),
});

const input = inputSchema.parse({
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  ADMIN_NAME: process.env.ADMIN_NAME,
  ADMIN_ROLE: process.env.ADMIN_ROLE,
});

async function main() {
  const { hashPassword } = await import("@/server/auth/password");
  const { upsertUser } = await import("@/server/repositories/users");

  const user = await upsertUser({
    name: input.ADMIN_NAME,
    email: input.ADMIN_EMAIL,
    role: input.ADMIN_ROLE,
    passwordHash: await hashPassword(input.ADMIN_PASSWORD),
  });

  console.log(JSON.stringify({ id: user.id, email: user.email, role: user.role }, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "User creation failed");
  process.exit(1);
});
