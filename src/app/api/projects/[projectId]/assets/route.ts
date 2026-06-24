import { z } from "zod";
import { AppError } from "@/lib/errors";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { createAuditLog } from "@/server/repositories/audit-logs";
import { createExternalAsset, createUploadedAsset, listProjectAssets } from "@/server/repositories/assets";
import { assertOssObjectUploaded, getOssObjectUrl, isAllowedFeishuUrl } from "@/server/providers/oss";

const assetTypeSchema = z.enum(["pdf", "word", "image", "video", "feishu_doc", "text", "other"]);

const createAssetSchema = z.discriminatedUnion("sourceType", [
  z.object({
    sourceType: z.literal("upload"),
    assetType: assetTypeSchema,
    ossKey: z.string().min(1, "缺少 OSS 对象路径"),
    fileName: z.string().min(1, "缺少文件名"),
    fileSize: z.number().int().nonnegative("文件大小不能为负数"),
    mimeType: z.string().min(1, "缺少文件 MIME 类型"),
  }),
  z.object({
    sourceType: z.literal("external_link"),
    assetType: z.literal("feishu_doc"),
    externalProvider: z.literal("feishu"),
    externalUrl: z.string().url("请输入有效链接"),
    fileName: z.string().optional().nullable(),
  }),
]);

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    const assets = await listProjectAssets(projectId);
    return Response.json({ ok: true, data: assets });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    const body = createAssetSchema.parse(await request.json());
    const asset = body.sourceType === "upload" ? await createUploaded(projectId, user.id, body) : await createExternal(projectId, user.id, body);
    await createAuditLog({
      actorId: user.id,
      projectId,
      action: body.sourceType === "upload" ? "asset.upload_registered" : "asset.external_registered",
      objectType: "asset",
      objectId: asset.id,
      after: {
        projectId,
        assetType: asset.assetType,
        sourceType: asset.sourceType,
        fileName: asset.fileName,
        fileSize: asset.fileSize,
        externalProvider: asset.externalProvider,
      },
    });

    return Response.json({ ok: true, data: asset }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

async function createUploaded(projectId: string, uploadedBy: string, body: Extract<z.infer<typeof createAssetSchema>, { sourceType: "upload" }>) {
  await assertOssObjectUploaded({
    objectKey: body.ossKey,
    expectedSize: body.fileSize,
    projectId,
  });

  return createUploadedAsset({
    projectId,
    uploadedBy,
    assetType: body.assetType,
    ossKey: body.ossKey,
    ossUrl: getOssObjectUrl(body.ossKey),
    fileName: body.fileName,
    fileSize: body.fileSize,
    mimeType: body.mimeType,
  });
}

async function createExternal(projectId: string, uploadedBy: string, body: Extract<z.infer<typeof createAssetSchema>, { sourceType: "external_link" }>) {
  if (!isAllowedFeishuUrl(body.externalUrl)) {
    throw new AppError({
      status: 400,
      code: "invalid_feishu_url",
      userMessage: "请输入有效的飞书文档链接。",
    });
  }

  return createExternalAsset({
    projectId,
    uploadedBy,
    assetType: body.assetType,
    externalProvider: body.externalProvider,
    externalUrl: body.externalUrl,
    fileName: body.fileName,
  });
}
