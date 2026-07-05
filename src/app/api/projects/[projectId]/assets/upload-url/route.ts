import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { assertSupportedAssetFile, createProjectAssetObjectKey, createUploadUrl, getOssObjectUrl } from "@/server/providers/oss";

const assetTypeSchema = z.enum(["pdf", "word", "image", "video", "text", "other"]);

const uploadUrlSchema = z.object({
  fileName: z.string().min(1, "缺少文件名"),
  fileSize: z.number().int().nonnegative("文件大小不能为负数"),
  mimeType: z.string().min(1, "缺少文件 MIME 类型"),
  assetType: assetTypeSchema,
});

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    const body = uploadUrlSchema.parse(await request.json());
    const { maxBytes } = assertSupportedAssetFile(body);
    const objectKey = createProjectAssetObjectKey(projectId, body.fileName);
    const uploadUrl = createUploadUrl(objectKey, { contentType: body.mimeType });

    return Response.json({
      ok: true,
      data: {
        uploadUrl,
        objectUrl: getOssObjectUrl(objectKey),
        objectKey,
        method: "PUT",
        headers: { "Content-Type": body.mimeType },
        expiresInSeconds: 900,
        maxBytes,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
