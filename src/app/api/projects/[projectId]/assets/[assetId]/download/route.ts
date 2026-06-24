import { jsonError } from "@/lib/errors";
import { requireProjectAccess } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { createControlledAssetAccess } from "@/server/use-cases/controlled-file-access";

export async function POST(request: Request, context: { params: Promise<{ projectId: string; assetId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId, assetId } = await context.params;
    await requireProjectAccess(user, projectId);
    const access = await createControlledAssetAccess({ projectId, assetId, actor: user, mode: "download" });
    return Response.json({
      ok: true,
      data: {
        ...access,
        message: access.expiresInSeconds ? "已生成临时下载链接。系统已记录本次访问。" : "已记录外部资料下载操作。",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
