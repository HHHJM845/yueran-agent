import { jsonError } from "@/lib/errors";
import { requireProjectAccess } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { createControlledAssetAccess } from "@/server/use-cases/controlled-file-access";

export async function POST(request: Request, context: { params: Promise<{ projectId: string; assetId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId, assetId } = await context.params;
    await requireProjectAccess(user, projectId);
    const body = (await request.json().catch(() => ({}))) as { mode?: string };
    const mode = body.mode === "download" ? "download" : "preview";
    const access = await createControlledAssetAccess({ projectId, assetId, actor: user, mode });
    return Response.json({
      ok: true,
      data: {
        ...access,
        message: access.expiresInSeconds
          ? mode === "download"
            ? "已生成临时下载链接。链接短时间内有效，系统已记录本次访问。"
            : "已生成临时预览链接。链接短时间内有效，请不要转发给无关人员。"
          : "已记录外部资料打开操作。",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
