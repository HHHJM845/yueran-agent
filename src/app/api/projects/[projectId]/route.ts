import { z } from "zod";
import { AppError, jsonError } from "@/lib/errors";
import { withTransaction } from "@/lib/db";
import { createAuditLog } from "@/server/repositories/audit-logs";
import { requireCanEditProjectBasics, requireProjectAccess } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import {
  archiveProjectWithTransaction,
  getProjectDeletionSnapshot,
  getProjectDeletionSnapshotWithTransaction,
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
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      throw new AppError({
        status: 400,
        code: "invalid_request",
        userMessage: "删除请求的 JSON 格式不正确，请重新提交后再试。",
      });
    }

    const parsedBody = deleteProjectSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      throw new AppError({
        status: 400,
        code: "invalid_request",
        userMessage: "删除方式不正确，请刷新页面后重试。",
      });
    }

    const mode: ProjectDeleteMode = parsedBody.data.mode;
    const project = await getProjectDeletionSnapshot(projectId);
    assertCanDeleteProject({ user, project, mode });

    if (mode === "archive") {
      const archivedProject = await withTransaction(async (transactionQuery) => {
        const projectSnapshot = await getProjectDeletionSnapshotWithTransaction(transactionQuery, projectId);
        const allowedSnapshot = assertCanDeleteProject({ user, project: projectSnapshot, mode });
        const archivedSnapshot = await archiveProjectWithTransaction(transactionQuery, projectId);

        if (!archivedSnapshot) {
          return null;
        }

        await createAuditLog({
          actorId: user.id,
          projectId,
          action: "project.archived",
          objectType: "project",
          objectId: projectId,
          before: allowedSnapshot,
          after: archivedSnapshot,
          transactionQuery,
        });

        return archivedSnapshot;
      });

      if (!archivedProject) {
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
          message: "项目已移出列表，资料和流程记录仍会保留。",
        },
      });
    }

    const deletedProject = await withTransaction(async (transactionQuery) => {
      const projectSnapshot = await getProjectDeletionSnapshotWithTransaction(transactionQuery, projectId);
      const allowedSnapshot = assertCanDeleteProject({ user, project: projectSnapshot, mode });

      const deleteResult = await transactionQuery<{ id: string }>(
        `delete from projects where id = $1 returning id`,
        [projectId]
      );

      const deletedRow = deleteResult.rows[0] ?? null;
      if (!deletedRow) {
        throw new AppError({
          status: 404,
          code: "project_not_found",
          userMessage: "项目已经不存在，列表将自动刷新。",
        });
      }

      await createAuditLog({
        actorId: user.id,
        projectId,
        action: "project.deleted",
        objectType: "project",
        objectId: projectId,
        before: allowedSnapshot,
        transactionQuery,
      });

      return projectSnapshot;
    });

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
