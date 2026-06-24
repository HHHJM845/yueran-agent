import OpenAI from "openai";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { assertAtmosphereImageReady } from "@/server/providers/ai";

type OpenAIImageSdkError = {
  status?: number;
  code?: string | number;
  name?: string;
  constructor?: {
    name?: string;
  };
  error?: {
    code?: string;
    message?: string;
  };
  message?: string;
};

type ImageTelemetryContext = {
  projectId: string;
  jobId?: string | null;
  callId: string;
  provider: string;
  operation: string;
  attempt?: number;
  metadata?: Record<string, unknown>;
};

export async function generateOpenAIImage(input: {
  prompt: string;
  model: string;
  size?: string;
  timeoutMs?: number;
  telemetry?: ImageTelemetryContext;
}) {
  const config = assertAtmosphereImageReady();
  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    baseURL: config.baseUrl || undefined,
    timeout: input.timeoutMs ?? 180_000,
    maxRetries: 0,
  });

  const startedAt = Date.now();
  try {
    const response = await client.images.generate(
      {
        model: input.model,
        prompt: input.prompt,
        n: 1,
        size: input.size ?? "1536x1024",
        quality: "medium",
        output_format: "png",
      },
      { signal: AbortSignal.timeout(input.timeoutMs ?? 180_000) }
    );

    const image = response.data?.[0];
    if (image?.b64_json) {
      await recordImageTelemetry({
        telemetry: input.telemetry,
        model: input.model,
        status: "succeeded",
        startedAt,
        response,
        inputChars: input.prompt.length,
        imageCount: 1,
        metadata: { size: input.size ?? "1536x1024", delivery: "base64" },
      });
      return {
        bytes: Buffer.from(image.b64_json, "base64"),
        mimeType: "image/png",
        extension: "png",
        revisedPrompt: image.revised_prompt ?? null,
      };
    }

    if (image?.url) {
      const imageResponse = await fetch(image.url, { signal: AbortSignal.timeout(60_000) });
      if (!imageResponse.ok) {
        throw new AppError({
          status: 502,
          code: "openai_image_download_failed",
          userMessage: "氛围图模型返回了图片地址，但系统暂时无法下载图片。请稍后重试。",
        });
      }
      await recordImageTelemetry({
        telemetry: input.telemetry,
        model: input.model,
        status: "succeeded",
        startedAt,
        response,
        inputChars: input.prompt.length,
        imageCount: 1,
        metadata: { size: input.size ?? "1536x1024", delivery: "url" },
      });
      return {
        bytes: Buffer.from(await imageResponse.arrayBuffer()),
        mimeType: imageResponse.headers.get("content-type") ?? "image/png",
        extension: inferExtension(imageResponse.headers.get("content-type")),
        revisedPrompt: image.revised_prompt ?? null,
      };
    }

    throw new AppError({
      status: 502,
      code: "openai_image_empty_response",
      userMessage: "氛围图模型没有返回可用图片。你可以调整故事大纲描述后重新生成。",
    });
  } catch (error) {
    if (error instanceof AppError) {
      await recordImageTelemetry({
        telemetry: input.telemetry,
        model: input.model,
        status: "failed",
        startedAt,
        error,
        inputChars: input.prompt.length,
      });
      throw error;
    }

    const sdkError = normalizeOpenAIImageError(error);
    console.error("OpenAI image request failed", {
      status: sdkError.status,
      code: sdkError.code,
      message: sdkError.message?.slice(0, 240),
    });
    await recordImageTelemetry({
      telemetry: input.telemetry,
      model: input.model,
      status: "failed",
      startedAt,
      errorCode: sdkError.code?.toString(),
      errorMessage: sdkError.message,
      inputChars: input.prompt.length,
    });
    throw mapOpenAIImageError(sdkError.code);
  }
}

function inferExtension(contentType: string | null) {
  if (contentType?.includes("webp")) return "webp";
  if (contentType?.includes("jpeg") || contentType?.includes("jpg")) return "jpg";
  return "png";
}

function normalizeOpenAIImageError(error: unknown) {
  const sdkError = error as OpenAIImageSdkError;
  return {
    status: sdkError.status,
    code: sdkError.error?.code ?? sdkError.constructor?.name ?? sdkError.name ?? sdkError.code?.toString() ?? "OpenAIImageRequestFailed",
    message: sdkError.error?.message ?? sdkError.message ?? "OpenAI image request failed",
  };
}

function mapOpenAIImageError(code: string | undefined) {
  if (code === "APITimeoutError" || code === "TimeoutError" || code === "AbortError" || code === "APIUserAbortError") {
    return new AppError({
      status: 504,
      code: "openai_image_timeout",
      userMessage: "氛围图生成响应超时。系统已保存失败状态，你可以稍后重试或缩短故事描述。",
    });
  }

  return new AppError({
    status: 502,
    code: "openai_image_request_failed",
    userMessage: "氛围图生成失败。请检查图片模型配置是否可用，或稍后重试。",
  });
}

async function recordImageTelemetry(input: {
  telemetry?: ImageTelemetryContext;
  model: string;
  status: "succeeded" | "failed";
  startedAt: number;
  response?: unknown;
  error?: AppError;
  errorCode?: string | null;
  errorMessage?: string | null;
  inputChars?: number | null;
  imageCount?: number | null;
  metadata?: Record<string, unknown>;
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
      providerResponseId: extractResponseId(input.response),
      inputChars: input.inputChars ?? null,
      imageCount: input.imageCount ?? null,
      durationMs: Date.now() - input.startedAt,
      attempt: input.telemetry.attempt ?? 1,
      errorCode: input.error?.code ?? input.errorCode ?? null,
      errorMessage: input.error?.userMessage ?? input.errorMessage ?? null,
      metadata: {
        ...input.telemetry.metadata,
        ...input.metadata,
      },
    });
  } catch (error) {
    console.error("AI image telemetry log write failed", sanitizeTelemetryError(error));
  }
}

function extractResponseId(response: unknown) {
  const id = (response as { id?: unknown } | undefined)?.id;
  return typeof id === "string" ? id : null;
}

function sanitizeTelemetryError(error: unknown) {
  if (error instanceof Error) return { name: error.name, message: error.message.slice(0, 240) };
  return { message: "Unknown telemetry error" };
}
