import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireCanCreateProject } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { createAuditLog } from "@/server/repositories/audit-logs";
import { createProject, listProjects } from "@/server/repositories/projects";

const createProjectSchema = z.object({
  brandName: z.string().min(1, "请输入品牌名"),
  projectName: z.string().min(1, "请输入项目名"),
  ownerName: z.string().min(1, "请输入负责人"),
  dueDate: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const projects = await listProjects(user);
    return Response.json({ ok: true, data: projects });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    requireCanCreateProject(user);
    const body = createProjectSchema.parse(await request.json());
    const project = await createProject(body, user);
    await createAuditLog({
      actorId: user.id,
      projectId: project.id,
      action: "project.created",
      objectType: "project",
      objectId: project.id,
      after: {
        brandName: project.brandName,
        projectName: project.projectName,
        ownerName: project.ownerName,
        dueDate: project.dueDate,
        currentStage: project.currentStage,
        status: project.status,
      },
    });
    return Response.json({ ok: true, data: project }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
