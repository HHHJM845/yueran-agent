import { jsonError } from "@/lib/errors";
import { requireRole, requireProjectAccess } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { createControlledDocumentExportAccess } from "@/server/use-cases/controlled-file-access";

export async function POST(request: Request, context: { params: Promise<{ projectId: string; exportId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId, exportId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["business", "admin"]);
    const body = (await request.json().catch(() => ({}))) as { mode?: string };
    const mode = body.mode === "preview" ? "preview" : "download";
    const access = await createControlledDocumentExportAccess({ projectId, exportId, actor: user, mode });
    return Response.json({
      ok: true,
      data: {
        ...access,
        message:
          mode === "preview"
            ? "已生成临时预览链接。合同和报价文件属于敏感资料，系统已记录本次访问。"
            : "已生成临时下载链接。合同和报价文件属于敏感资料，系统已记录本次访问。",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
