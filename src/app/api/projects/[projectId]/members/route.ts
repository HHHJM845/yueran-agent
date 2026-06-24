import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { addProjectMember, listProjectMembers } from "@/server/repositories/project-members";
import { listActiveUsers } from "@/server/repositories/users";

const addMemberSchema = z.object({
  userId: z.string().uuid("请选择有效成员"),
  role: z.enum(["business", "creative", "admin"]),
});

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["admin"]);

    const [members, users] = await Promise.all([listProjectMembers(projectId), listActiveUsers()]);
    return Response.json({ ok: true, data: { members, users } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["admin"]);

    const body = addMemberSchema.parse(await request.json());
    await addProjectMember({ projectId, userId: body.userId, role: body.role });
    const members = await listProjectMembers(projectId);

    return Response.json({ ok: true, data: { members } });
  } catch (error) {
    return jsonError(error);
  }
}
