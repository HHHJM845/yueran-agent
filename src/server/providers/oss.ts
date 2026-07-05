import { createHmac, randomUUID } from "node:crypto";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

function assertOssConfigured() {
  if (!env.ALIYUN_OSS_REGION || !env.ALIYUN_OSS_ACCESS_KEY_ID || !env.ALIYUN_OSS_ACCESS_KEY_SECRET || !env.ALIYUN_OSS_BUCKET) {
    throw new AppError({
      status: 503,
      code: "oss_not_configured",
      userMessage: "阿里云 OSS 还没有配置完整。请补齐 OSS 区域、Bucket 和服务端 AccessKey 后再上传资料。",
    });
  }

  return {
    endpoint: env.ALIYUN_OSS_ENDPOINT ?? `https://${env.ALIYUN_OSS_REGION}.aliyuncs.com`,
    bucket: env.ALIYUN_OSS_BUCKET,
    accessKeyId: env.ALIYUN_OSS_ACCESS_KEY_ID,
    accessKeySecret: env.ALIYUN_OSS_ACCESS_KEY_SECRET,
  };
}

export function createUploadUrl(objectKey: string, options: { contentType?: string | null } = {}) {
  const config = assertOssConfigured();
  const expires = Math.floor(Date.now() / 1000) + 900;
  const normalizedObjectKey = objectKey.replace(/^\/+/, "");
  const contentType = options.contentType ?? "";
  const canonicalResource = `/${config.bucket}/${normalizedObjectKey}`;
  const stringToSign = ["PUT", "", contentType, String(expires), canonicalResource].join("\n");
  const signature = createHmac("sha1", config.accessKeySecret).update(stringToSign).digest("base64");
  const url = new URL(buildObjectUrl(config.endpoint, config.bucket, normalizedObjectKey));
  url.searchParams.set("OSSAccessKeyId", config.accessKeyId);
  url.searchParams.set("Expires", String(expires));
  url.searchParams.set("Signature", signature);

  return url.toString();
}

type ReadUrlOptions = {
  disposition?: "inline" | "attachment";
  fileName?: string | null;
  contentType?: string | null;
};

export function createReadUrl(objectKey: string, expiresInSeconds = 900, options: ReadUrlOptions = {}) {
  const config = assertOssConfigured();
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const normalizedObjectKey = objectKey.replace(/^\/+/, "");
  const responseOverrides = buildReadUrlResponseOverrides(options);
  const canonicalResource = buildCanonicalizedResource(`/${config.bucket}/${normalizedObjectKey}`, responseOverrides);
  const stringToSign = ["GET", "", "", String(expires), canonicalResource].join("\n");
  const signature = createHmac("sha1", config.accessKeySecret).update(stringToSign).digest("base64");
  const url = new URL(buildObjectUrl(config.endpoint, config.bucket, normalizedObjectKey));
  url.searchParams.set("OSSAccessKeyId", config.accessKeyId);
  url.searchParams.set("Expires", String(expires));
  url.searchParams.set("Signature", signature);
  for (const [key, value] of Object.entries(responseOverrides)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

export function createReadUrlFromOssUrl(ossUrl: string, expiresInSeconds = 900, options: ReadUrlOptions = {}) {
  const objectKey = getOssObjectKeyFromUrl(ossUrl);
  return objectKey ? createReadUrl(objectKey, expiresInSeconds, options) : ossUrl;
}

export function getOssObjectKeyFromUrl(ossUrl: string) {
  try {
    const url = new URL(ossUrl);
    const objectKey = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    return objectKey || null;
  } catch {
    return null;
  }
}

export async function downloadOssObject(objectKey: string) {
  const readUrl = createReadUrl(objectKey, 300);
  const response = await fetch(readUrl);

  if (!response.ok) {
    throw new AppError({
      status: 502,
      code: "oss_download_failed",
      userMessage: "暂时无法读取 OSS 中的资料。请稍后重试，或联系管理员检查 OSS 读取权限。",
    });
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function uploadOssObject(input: { objectKey: string; body: Buffer; contentType: string }) {
  const config = assertOssConfigured();
  const normalizedObjectKey = input.objectKey.replace(/^\/+/, "");
  const uploadUrl = new URL(buildObjectUrl(config.endpoint, config.bucket, normalizedObjectKey));
  const date = new Date().toUTCString();
  const canonicalResource = `/${config.bucket}/${normalizedObjectKey}`;
  const stringToSign = ["PUT", "", input.contentType, date, canonicalResource].join("\n");
  const signature = createHmac("sha1", config.accessKeySecret).update(stringToSign).digest("base64");

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Date: date,
      "Content-Type": input.contentType,
      Authorization: `OSS ${config.accessKeyId}:${signature}`,
    },
    body: new Uint8Array(input.body),
  });

  if (!response.ok) {
    throw new AppError({
      status: 502,
      code: "oss_upload_failed",
      userMessage: "氛围图已生成，但暂时无法保存到 OSS。系统已保存失败状态，请稍后重试。",
    });
  }

  return {
    ossKey: normalizedObjectKey,
    ossUrl: getOssObjectUrl(normalizedObjectKey),
  };
}

export function getOssObjectUrl(objectKey: string) {
  const config = assertOssConfigured();
  const normalizedObjectKey = objectKey.replace(/^\/+/, "");
  return buildObjectUrl(config.endpoint, config.bucket, normalizedObjectKey);
}

export function createGeneratedImageObjectKey(projectId: string, imageId: string, extension = "png") {
  const safeExtension = extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "png";
  return `projects/${projectId}/generated-images/${imageId}/atmosphere.${safeExtension}`;
}

export function createStoryboardVideoObjectKey(projectId: string, videoId: string, extension = "mp4") {
  const safeExtension = extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "mp4";
  return `projects/${projectId}/storyboard-videos/${videoId}/candidate.${safeExtension}`;
}

export function createDocumentExportObjectKey(projectId: string, exportId: string, fileName: string) {
  const safeName = fileName.replace(/[^\w.\-\u4e00-\u9fa5]+/g, "_") || `document-export-${exportId}`;
  return `projects/${projectId}/document-exports/${exportId}/${safeName}`;
}

export async function assertOssObjectUploaded(input: {
  objectKey: string;
  expectedSize: number;
  projectId: string;
}) {
  const config = assertOssConfigured();
  const normalizedObjectKey = input.objectKey.replace(/^\/+/, "");

  if (!normalizedObjectKey.startsWith(`projects/${input.projectId}/assets/`)) {
    throw new AppError({
      status: 400,
      code: "asset_path_mismatch",
      userMessage: "上传文件路径和当前项目不匹配。请重新选择文件上传，避免保存到错误项目。",
    });
  }

  const headUrl = new URL(buildObjectUrl(config.endpoint, config.bucket, normalizedObjectKey));
  const date = new Date().toUTCString();
  const canonicalResource = `/${config.bucket}/${normalizedObjectKey}`;
  const stringToSign = ["HEAD", "", "", date, canonicalResource].join("\n");
  const signature = createHmac("sha1", config.accessKeySecret).update(stringToSign).digest("base64");

  const response = await fetch(headUrl, {
    method: "HEAD",
    headers: {
      Date: date,
      Authorization: `OSS ${config.accessKeyId}:${signature}`,
    },
  });

  if (response.status === 404) {
    throw new AppError({
      status: 400,
      code: "oss_object_not_found",
      userMessage: "没有在 OSS 中找到刚上传的文件。请确认上传完成后再保存资料。",
    });
  }

  if (!response.ok) {
    throw new AppError({
      status: 502,
      code: "oss_head_failed",
      userMessage: "暂时无法校验 OSS 文件。请稍后重试，或联系管理员检查 OSS 权限。",
    });
  }

  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (contentLength !== input.expectedSize) {
    throw new AppError({
      status: 400,
      code: "oss_object_size_mismatch",
      userMessage: "上传文件信息和保存请求不一致。请重新上传，避免保存错误文件。",
    });
  }
}

export function assertSupportedAssetFile(input: { fileName: string; fileSize: number; mimeType: string }) {
  const maxBytes = Number(process.env.ASSET_UPLOAD_MAX_BYTES ?? 1024 * 1024 * 500);
  if (input.fileSize <= 0) {
    throw new AppError({
      status: 400,
      code: "empty_file",
      userMessage: "这个文件是空文件。请重新选择包含内容的资料。",
    });
  }

  if (input.fileSize > maxBytes) {
    throw new AppError({
      status: 400,
      code: "file_too_large",
      userMessage: "这个文件超过当前上传上限。请压缩后重新上传，或联系管理员调整上传限制。",
    });
  }

  const supportedExtensions = [".pdf", ".doc", ".docx", ".txt", ".md", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".mp4", ".mov", ".m4v", ".avi"];
  const lowerName = input.fileName.toLowerCase();
  const supportedByExtension = supportedExtensions.some((extension) => lowerName.endsWith(extension));
  const supportedByMime = /^(image|video)\//.test(input.mimeType) || /pdf|word|text|markdown|officedocument/.test(input.mimeType);

  if (!supportedByExtension && !supportedByMime) {
    throw new AppError({
      status: 400,
      code: "unsupported_file_type",
      userMessage: "当前只支持 PDF、Word、图片、视频和文本资料。请更换资料类型后重试。",
    });
  }

  return { maxBytes };
}

export function createProjectAssetObjectKey(projectId: string, fileName: string) {
  const randomId = randomUUID();
  const safeName = fileName.replace(/[^\w.\-\u4e00-\u9fa5]+/g, "_");
  return `projects/${projectId}/assets/${randomId}/${safeName}`;
}

export function isAllowedFeishuUrl(rawUrl: string) {
  const host = new URL(rawUrl).hostname;
  return ["feishu.cn", "larksuite.com", "feishu-pre.cn", "doubao.com"].some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function buildObjectUrl(endpoint: string, bucket: string, objectKey: string) {
  const endpointUrl = new URL(endpoint);
  endpointUrl.hostname = `${bucket}.${endpointUrl.hostname}`;
  endpointUrl.pathname = `/${encodePath(objectKey)}`;
  endpointUrl.search = "";
  return endpointUrl.toString();
}

function buildReadUrlResponseOverrides(options: ReadUrlOptions) {
  const overrides: Record<string, string> = {};

  if (options.disposition && options.fileName) {
    overrides["response-content-disposition"] = buildContentDisposition(options.disposition, options.fileName);
  }

  if (options.contentType) {
    overrides["response-content-type"] = options.contentType;
  }

  return overrides;
}

function buildCanonicalizedResource(resourcePath: string, parameters: Record<string, string>) {
  const entries = Object.entries(parameters).sort(([left], [right]) => (left > right ? 1 : left < right ? -1 : 0));
  if (entries.length === 0) return resourcePath;

  return `${resourcePath}?${entries.map(([key, value]) => `${key}=${value}`).join("&")}`;
}

function buildContentDisposition(disposition: "inline" | "attachment", fileName: string) {
  const fallbackName = buildAsciiFallbackFileName(fileName);
  return `${disposition}; filename="${fallbackName}"; filename*=UTF-8''${encodeRfc5987Value(fileName)}`;
}

function buildAsciiFallbackFileName(fileName: string) {
  const fallback = fileName
    .replace(/[^\x20-\x7e]+/g, "_")
    .replace(/[\\"]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  return fallback || "download";
}

function encodeRfc5987Value(value: string) {
  return encodeURIComponent(value).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodePath(path: string) {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}
