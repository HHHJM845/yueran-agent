import { jsonError } from "@/lib/errors";
import { requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { listActiveUsers } from "@/server/repositories/users";
import { createUser, createUserInputSchema } from "@/server/use-cases/create-user";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    requireRole(user, ["admin"]);

    const users = await listActiveUsers();
    return Response.json({ ok: true, data: { users } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireUser(request);
    requireRole(actor, ["admin"]);

    const body = createUserInputSchema.parse(await request.json());
    const result = await createUser({
      actorId: actor.id,
      name: body.name,
      email: body.email,
      password: body.password,
      role: body.role,
    });

    return Response.json(
      {
        ok: true,
        data: result,
      },
      { status: 201 }
    );
  } catch (error) {
    return jsonError(error);
  }
}
