import type { JobType, Role } from "@/domain/types";
import { AppError } from "@/lib/errors";
import type { AuthUser } from "@/server/repositories/users";
import { hasProjectAccess } from "@/server/repositories/project-members";
import { getProjectById } from "@/server/repositories/projects";

export function requireRole(user: AuthUser, allowed: Role[]) {
  if (!allowed.includes(user.role)) {
    throw new AppError({
      status: 403,
      code: "forbidden_role",
      userMessage: "你的当前角色没有执行这个操作的权限。如需处理，请联系管理员调整权限或项目分工。",
    });
  }
}

export async function requireProjectAccess(user: AuthUser, projectId: string) {
  if (user.role === "admin") return;
  const allowed = await hasProjectAccess({ projectId, userId: user.id });
  if (!allowed) {
    throw new AppError({
      status: 403,
      code: "project_access_denied",
      userMessage: "你还不是这个项目的成员，暂时不能查看或操作该项目。",
    });
  }
}

export function requireCanCreateProject(user: AuthUser) {
  requireRole(user, ["business", "admin"]);
}

export async function requireCanEditProjectBasics(user: AuthUser, projectId: string) {
  if (user.role === "admin") return;
  if (user.role !== "business") {
    throw new AppError({
      status: 403,
      code: "project_edit_forbidden",
      userMessage: "当前角色不能编辑项目基础信息。请联系商务负责人或管理员处理。",
    });
  }

  const project = await getProjectById(projectId);
  if (!project || project.ownerId !== user.id) {
    throw new AppError({
      status: 403,
      code: "project_edit_forbidden",
      userMessage: "只有项目商务负责人可以编辑项目基础信息。如需调整负责人，请联系管理员处理。",
    });
  }
}

export function requireCanStartJob(user: AuthUser, type: JobType) {
  if (type === "asset_understanding" || type === "tag_scoring") {
    requireRole(user, ["business", "creative", "admin"]);
    return;
  }

  if (type === "requirement_structuring") {
    requireRole(user, ["business", "admin"]);
    return;
  }

  if (type === "creative_direction_generation" || type === "creative_expansion_generation" || type === "atmosphere_image_generation") {
    requireRole(user, ["creative", "admin"]);
    return;
  }

  requireRole(user, ["admin"]);
}
