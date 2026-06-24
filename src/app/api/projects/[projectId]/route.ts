import { z } from "zod";
import { AppError, jsonError } from "@/lib/errors";
import { requireCanEditProjectBasics, requireProjectAccess } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { updateProjectBasics } from "@/server/repositories/projects";

const updateProjectSchema = z.object({
  brandName: z.string().trim().min(1, "请输入品牌名"),
  projectName: z.string().trim().min(1, "请输入项目名"),
  ownerName: z.string().trim().min(1, "请输入负责人"),
  dueDate: z.string().trim().optional().nullable(),
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
