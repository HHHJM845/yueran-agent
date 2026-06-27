import { AppError } from "@/lib/errors";
import type { AuthUser } from "@/server/repositories/users";
import type { ProjectRecord } from "@/server/repositories/projects";

export type ProjectDeleteMode = "archive" | "permanent";

export function assertCanDeleteProject(input: {
  user: AuthUser;
  project: ProjectRecord | null;
  mode: ProjectDeleteMode;
}): ProjectRecord {
  if (!input.project) {
    throw new AppError({
      status: 404,
      code: "project_not_found",
      userMessage: "项目已经不存在，列表将自动刷新。",
    });
  }

  if (input.mode === "permanent") {
    if (input.user.role === "admin") return input.project;
    throw new AppError({
      status: 403,
      code: "project_delete_forbidden",
      userMessage: "只有管理员可以永久删除项目。",
    });
  }

  if (input.user.role === "admin") return input.project;
  if (input.user.role === "business" && input.project.ownerId === input.user.id) return input.project;

  throw new AppError({
    status: 403,
    code: "project_delete_forbidden",
    userMessage: "你没有删除这个项目的权限，请联系管理员处理。",
  });
}
