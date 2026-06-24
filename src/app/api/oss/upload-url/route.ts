import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { createUploadUrl, getOssObjectUrl } from "@/server/providers/oss";

const uploadUrlSchema = z.object({
  objectKey: z.string().min(1, "请提供文件对象路径"),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    requireRole(user, ["admin"]);
    const body = uploadUrlSchema.parse(await request.json());
    const uploadUrl = createUploadUrl(body.objectKey);
    return Response.json({
      ok: true,
      data: {
        uploadUrl,
        objectUrl: getOssObjectUrl(body.objectKey),
        objectKey: body.objectKey,
        method: "PUT",
        expiresInSeconds: 900,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
