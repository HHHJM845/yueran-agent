import { z } from "zod";
import { AppError, jsonError } from "@/lib/errors";
import { createAuditLog } from "@/server/repositories/audit-logs";
import { requireCanEditProjectBasics, requireProjectAccess } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import {
  archiveProject,
  getProjectDeletionSnapshot,
  permanentlyDeleteProject,
  updateProjectBasics,
} from "@/server/repositories/projects";
import { assertCanDeleteProject, type ProjectDeleteMode } from "@/server/use-cases/project-delete";

const updateProjectSchema = z.object({
  brandName: z.string().trim().min(1, "请输入品牌名"),
  projectName: z.string().trim().min(1, "请输入项目名"),
  ownerName: z.string().trim().min(1, "请输入负责人"),
  dueDate: z.string().trim().optional().nullable(),
});

const deleteProjectSchema = z.object({
  mode: z.enum(["archive", "permanent"]).default("archive"),
});

export async function PATCH(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    await requireCanEditProjectBasics(user, projectId);

    const body = updateProjectSchema.parse(await request.json());
    const project = await updateProjectBasics(
      projectId,
      {
        ...body,
        dueDate: body.dueDate || null,
      },
      user
    );

    if (!project) {
      throw new AppError({
        status: 404,
        code: "project_not_found",
        userMessage: "没有找到这个项目。它可能已被归档，或你没有权限编辑。",
      });
    }

    return Response.json({
      ok: true,
      data: {
        project,
        message: "项目基础信息已保存，项目列表和阶段负责人会同步刷新。",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    const body = deleteProjectSchema.parse(await request.json().catch(() => ({})));
    const mode = body.mode as ProjectDeleteMode;
    const project = await getProjectDeletionSnapshot(projectId);
    const allowedProject = assertCanDeleteProject({ user, project, mode });

    if (mode === "archive") {
      const archivedProject = await archiveProject(projectId);
      if (!archivedProject) {
        throw new AppError({
          status: 404,
          code: "project_not_found",
          userMessage: "项目已经不存在，列表将自动刷新。",
        });
      }

      await createAuditLog({
        actorId: user.id,
        projectId,
        action: "project.archived",
        objectType: "project",
        objectId: projectId,
        before: allowedProject,
        after: archivedProject,
      });

      return Response.json({
        ok: true,
        data: {
          projectId,
          mode,
          message: "项目已移出列表，资料和流程记录仍会保留。",
        },
      });
    }

    await createAuditLog({
      actorId: user.id,
      projectId,
      action: "project.deleted",
      objectType: "project",
      objectId: projectId,
      before: allowedProject,
    });
    const deletedProject = await permanentlyDeleteProject(projectId);
    if (!deletedProject) {
      throw new AppError({
        status: 404,
        code: "project_not_found",
        userMessage: "项目已经不存在，列表将自动刷新。",
      });
    }

    return Response.json({
      ok: true,
      data: {
        projectId,
        mode,
        message: "项目已永久删除。",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
