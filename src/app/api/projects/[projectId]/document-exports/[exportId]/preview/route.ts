import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { createControlledDocumentExportAccess } from "@/server/use-cases/controlled-file-access";

export async function POST(request: Request, context: { params: Promise<{ projectId: string; exportId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId, exportId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["business", "admin"]);
    const access = await createControlledDocumentExportAccess({ projectId, exportId, actor: user, mode: "preview" });
    return Response.json({
      ok: true,
      data: {
        ...access,
        message: "已生成临时预览链接。合同和报价文件属于敏感资料，系统已记录本次访问。",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
