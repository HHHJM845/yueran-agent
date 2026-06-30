import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

type ImageTelemetryContext = {
  projectId: string;
  jobId?: string | null;
  callId: string;
  provider: string;
  operation: string;
  attempt?: number;
  metadata?: Record<string, unknown>;
};

export function assertArkImageReady() {
  if (!env.ARK_API_KEY) {
    throw new AppError({
      status: 503,
      code: "ark_image_not_configured",
      userMessage: "火山方舟 API Key 还没有配置，暂时不能生成分镜图片。请配置 ARK_API_KEY 后重试。",
    });
  }
  return {
    provider: env.STORYBOARD_IMAGE_PROVIDER,
    model: env.ARK_IMAGE_GENERATION_MODEL,
    baseUrl: env.ARK_BASE_URL,
  };
}

/**
 * Generate one storyboard image with 火山方舟 Seedream. When `referenceImageUrls` is non-empty the
 * model runs reference-driven generation (image-to-image / multi-image fusion), keeping the locked
 * character/scene setting images consistent. References are passed by URL — no multipart upload — so
 * presigned OSS read URLs can be sent directly.
 */
export async function generateArkSeedreamImage(input: {
  prompt: string;
  model: string;
  referenceImageUrls?: string[];
  size?: string;
  timeoutMs?: number;
  telemetry?: ImageTelemetryContext;
}) {
  const config = assertArkImageReady();
  const referenceImageUrls = input.referenceImageUrls?.filter((url) => Boolean(url)) ?? [];
  const startedAt = Date.now();

  const body: Record<string, unknown> = {
    model: input.model,
    prompt: input.prompt,
    size: input.size ?? "2K",
    response_format: "url",
    watermark: false,
  };
  if (referenceImageUrls.length > 0) {
    // Seedream accepts a single string or an array; always send an array for multi-reference.
    body.image = referenceImageUrls;
  }

  try {
    const response = await fetch(`${config.baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.ARK_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(input.timeoutMs ?? 180_000),
    });

    if (!response.ok) {
      const errorText = await safeReadText(response);
      console.error("Ark Seedream image request failed", { status: response.status, body: errorText.slice(0, 400) });
      throw new AppError({
        status: 502,
        code: "ark_image_request_failed",
        userMessage: "豆包 Seedream 生成分镜图片失败。请检查图片模型配置是否可用，或稍后重试。",
      });
    }

    const payload = (await response.json()) as ArkImageResponse;
    const item = payload.data?.[0];

    if (item?.b64_json) {
      await recordImageTelemetry({ telemetry: input.telemetry, model: input.model, status: "succeeded", startedAt, payload, referenceCount: referenceImageUrls.length, delivery: "base64" });
      return { bytes: Buffer.from(item.b64_json, "base64"), mimeType: "image/png", extension: "png", revisedPrompt: null };
    }

    if (item?.url) {
      const imageResponse = await fetch(item.url, { signal: AbortSignal.timeout(60_000) });
      if (!imageResponse.ok) {
        throw new AppError({
          status: 502,
          code: "ark_image_download_failed",
          userMessage: "Seedream 返回了图片地址，但系统暂时无法下载图片。请稍后重试。",
        });
      }
      await recordImageTelemetry({ telemetry: input.telemetry, model: input.model, status: "succeeded", startedAt, payload, referenceCount: referenceImageUrls.length, delivery: "url" });
      const contentType = imageResponse.headers.get("content-type") ?? "image/png";
      return {
        bytes: Buffer.from(await imageResponse.arrayBuffer()),
        mimeType: contentType,
        extension: inferExtension(contentType),
        revisedPrompt: null,
      };
    }

    throw new AppError({
      status: 502,
      code: "ark_image_empty_response",
      userMessage: "Seedream 没有返回可用图片。请稍后重试或调整分镜提示词。",
    });
  } catch (error) {
    if (error instanceof AppError) {
      await recordImageTelemetry({ telemetry: input.telemetry, model: input.model, status: "failed", startedAt, error, referenceCount: referenceImageUrls.length });
      throw error;
    }
    const isTimeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    const mapped = new AppError({
      status: isTimeout ? 504 : 502,
      code: isTimeout ? "ark_image_timeout" : "ark_image_request_failed",
      userMessage: isTimeout
        ? "Seedream 生成分镜图片响应超时。系统已保存失败状态，你可以稍后重试。"
        : "豆包 Seedream 生成分镜图片失败。请检查图片模型配置是否可用，或稍后重试。",
    });
    await recordImageTelemetry({ telemetry: input.telemetry, model: input.model, status: "failed", startedAt, error: mapped, referenceCount: referenceImageUrls.length });
    throw mapped;
  }
}

type ArkImageResponse = {
  id?: string;
  data?: Array<{ url?: string; b64_json?: string }>;
};

async function safeReadText(response: Response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function inferExtension(contentType: string | null) {
  if (contentType?.includes("webp")) return "webp";
  if (contentType?.includes("jpeg") || contentType?.includes("jpg")) return "jpg";
  return "png";
}

async function recordImageTelemetry(input: {
  telemetry?: ImageTelemetryContext;
  model: string;
  status: "succeeded" | "failed";
  startedAt: number;
  payload?: ArkImageResponse;
  error?: AppError;
  referenceCount?: number;
  delivery?: string;
}) {
  if (!input.telemetry) return;
  try {
    const { createAiTaskLog } = await import("@/server/repositories/ai-task-logs");
    await createAiTaskLog({
      projectId: input.telemetry.projectId,
      jobId: input.telemetry.jobId ?? null,
      callId: input.telemetry.callId,
      provider: input.telemetry.provider,
      modelName: input.model,
      operation: input.telemetry.operation,
      status: input.status,
      providerResponseId: typeof input.payload?.id === "string" ? input.payload.id : null,
      imageCount: input.status === "succeeded" ? 1 : null,
      durationMs: Date.now() - input.startedAt,
      attempt: input.telemetry.attempt ?? 1,
      errorCode: input.error?.code ?? null,
      errorMessage: input.error?.userMessage ?? null,
      metadata: { ...input.telemetry.metadata, referenceCount: input.referenceCount ?? 0, delivery: input.delivery },
    });
  } catch (error) {
    console.error("Ark image telemetry log write failed", error instanceof Error ? error.message : "unknown");
  }
}
