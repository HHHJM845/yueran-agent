import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { createAiTaskLog } from "@/server/repositories/ai-task-logs";

type ArkVideoTelemetry = {
  projectId: string;
  jobId?: string | null;
  callId: string;
  operation: string;
  attempt?: number;
  metadata?: Record<string, unknown>;
};

type ArkVideoTaskPayload = {
  id?: unknown;
  task_id?: unknown;
  status?: unknown;
  error?: {
    code?: string;
    message?: string;
  };
  data?: unknown;
  output?: unknown;
  result?: unknown;
  content?: unknown;
};

type ArkVideoGenerationResult = {
  bytes: Buffer;
  mimeType: string;
  extension: string;
  providerTaskId: string;
};

const VIDEO_TASK_POLL_INTERVAL_MS = 6_000;
const VIDEO_TASK_TIMEOUT_MS = 12 * 60_000;

export function assertArkVideoGenerationReady() {
  if (env.VIDEO_GENERATION_PROVIDER !== "volcengine_ark") {
    throw new AppError({
      status: 503,
      code: "video_provider_unsupported",
      userMessage: "当前视频生成 provider 不是火山方舟。请先把 VIDEO_GENERATION_PROVIDER 配置为 volcengine_ark。",
    });
  }

  if (!env.ARK_API_KEY) {
    throw new AppError({
      status: 503,
      code: "ark_video_not_configured",
      userMessage: "火山方舟视频生成还没有配置 API Key。请配置 ARK_API_KEY 后再生成视频。",
    });
  }

  return {
    provider: env.VIDEO_GENERATION_PROVIDER,
    model: env.ARK_VIDEO_GENERATION_MODEL,
  };
}

export async function generateArkImageToVideo(input: {
  model: string;
  prompt: string;
  imageUrl: string;
  durationSeconds?: number;
  telemetry?: ArkVideoTelemetry;
  timeoutMs?: number;
}): Promise<ArkVideoGenerationResult> {
  const startedAt = Date.now();
  const timeoutMs = input.timeoutMs ?? VIDEO_TASK_TIMEOUT_MS;

  try {
    const created = await createArkVideoTask({
      model: input.model,
      prompt: input.prompt,
      imageUrl: input.imageUrl,
      durationSeconds: input.durationSeconds,
      timeoutMs: Math.min(timeoutMs, 90_000),
    });

    const completed = await pollArkVideoTask({
      taskId: created.taskId,
      timeoutMs,
      startedAt,
    });

    const downloaded = await downloadGeneratedVideo(completed.videoUrl);
    await recordArkVideoTelemetry({
      telemetry: input.telemetry,
      model: input.model,
      status: "succeeded",
      startedAt,
      providerResponseId: created.taskId,
      metadata: {
        providerTaskId: created.taskId,
        terminalStatus: completed.status,
      },
    });

    return {
      ...downloaded,
      providerTaskId: created.taskId,
    };
  } catch (error) {
    const normalized = normalizeArkVideoError(error);
    await recordArkVideoTelemetry({
      telemetry: input.telemetry,
      model: input.model,
      status: "failed",
      startedAt,
      errorCode: normalized.code,
      errorMessage: normalized.userMessage,
    });
    throw normalized;
  }
}

async function createArkVideoTask(input: {
  model: string;
  prompt: string;
  imageUrl: string;
  durationSeconds?: number;
  timeoutMs: number;
}) {
  const response = await fetch(`${arkBaseUrl()}/contents/generations/tasks`, {
    method: "POST",
    headers: arkHeaders(),
    body: JSON.stringify({
      model: input.model,
      content: [
        {
          type: "text",
          text: input.prompt.trim(),
        },
        {
          type: "image_url",
          role: "first_frame",
          image_url: {
            url: input.imageUrl,
          },
        },
      ],
      resolution: "720p",
      ratio: "16:9",
      duration: input.durationSeconds ?? 5,
      watermark: false,
      generate_audio: false,
    }),
    signal: AbortSignal.timeout(input.timeoutMs),
  });
  const payload = await parseArkVideoPayload(response);
  const taskId = extractTaskId(payload);

  if (!taskId) {
    throw new AppError({
      status: 502,
      code: "ark_video_task_id_missing",
      userMessage: "火山方舟已响应视频生成请求，但没有返回任务 ID。系统不会把这次请求标记为成功，请稍后重试或检查接口版本。",
    });
  }

  return { taskId };
}

async function pollArkVideoTask(input: { taskId: string; timeoutMs: number; startedAt: number }) {
  let lastStatus = "queued";

  while (Date.now() - input.startedAt < input.timeoutMs) {
    await delay(VIDEO_TASK_POLL_INTERVAL_MS);
    const response = await fetch(`${arkBaseUrl()}/contents/generations/tasks/${encodeURIComponent(input.taskId)}`, {
      method: "GET",
      headers: arkHeaders(),
      signal: AbortSignal.timeout(90_000),
    });
    const payload = await parseArkVideoPayload(response);
    const status = normalizeTaskStatus(extractTaskStatus(payload));
    lastStatus = status;

    if (status === "succeeded") {
      const videoUrl = extractVideoUrl(payload);
      if (!videoUrl) {
        throw new AppError({
          status: 502,
          code: "ark_video_url_missing",
          userMessage: "火山方舟视频任务已完成，但响应里没有可下载的视频地址。系统已保存失败状态，请检查方舟任务结果。",
        });
      }
      return { status, videoUrl };
    }

    if (status === "failed" || status === "cancelled" || status === "expired") {
      const providerMessage = extractProviderErrorMessage(payload);
      throw new AppError({
        status: 502,
        code: status === "expired" ? "ark_video_task_expired" : "ark_video_task_failed",
        userMessage:
          providerMessage ??
          (status === "expired"
            ? "火山方舟视频任务已超时过期。系统已保存失败状态，请重新发起生成。"
            : "火山方舟视频任务生成失败。请检查分镜图片是否可公开读取、Prompt 是否包含不支持内容，调整后重试。"),
      });
    }
  }

  throw new AppError({
    status: 504,
    code: "ark_video_task_timeout",
    userMessage: `火山方舟视频任务仍在${describeTaskStatus(lastStatus)}，本次等待已超时。系统没有伪造成成功，请稍后从失败任务重试或检查方舟控制台任务状态。`,
  });
}

async function parseArkVideoPayload(response: Response): Promise<ArkVideoTaskPayload> {
  const payload = (await response.json().catch(() => ({}))) as ArkVideoTaskPayload;

  if (!response.ok || payload.error) {
    throw new AppError({
      status: response.status >= 400 ? response.status : 502,
      code: normalizeArkVideoErrorCode(payload.error?.code),
      userMessage: mapArkVideoUserMessage(payload.error?.code),
    });
  }

  return payload;
}

async function downloadGeneratedVideo(videoUrl: string) {
  const response = await fetch(videoUrl, {
    method: "GET",
    signal: AbortSignal.timeout(5 * 60_000),
  });

  if (!response.ok) {
    throw new AppError({
      status: 502,
      code: "ark_video_download_failed",
      userMessage: "火山方舟视频已生成，但系统暂时无法下载视频文件。请稍后重试，或检查视频结果地址是否仍有效。",
    });
  }

  const mimeType = response.headers.get("content-type") ?? "video/mp4";
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    mimeType,
    extension: inferVideoExtension(mimeType, videoUrl),
  };
}

function arkBaseUrl() {
  return env.ARK_BASE_URL.replace(/\/$/, "");
}

function arkHeaders() {
  return {
    Authorization: `Bearer ${env.ARK_API_KEY}`,
    "Content-Type": "application/json",
  };
}

function extractTaskId(payload: ArkVideoTaskPayload): string | null {
  return firstString(
    payload.id,
    payload.task_id,
    getNested(payload.data, "id"),
    getNested(payload.data, "task_id"),
    getNested(payload.data, "taskId")
  );
}

function extractTaskStatus(payload: ArkVideoTaskPayload): string {
  return (
    firstString(
      payload.status,
      getNested(payload.data, "status"),
      getNested(payload.output, "status"),
      getNested(payload.result, "status"),
      getNested(payload.content, "status")
    ) ?? "processing"
  );
}

function normalizeTaskStatus(status: string) {
  const normalized = status.toLowerCase();
  if (["succeeded", "success", "completed", "done"].includes(normalized)) return "succeeded";
  if (["failed", "error"].includes(normalized)) return "failed";
  if (["cancelled", "canceled"].includes(normalized)) return "cancelled";
  return normalized || "processing";
}

function extractVideoUrl(payload: ArkVideoTaskPayload): string | null {
  return firstString(getNested(payload.content, "video_url"), getNested(payload.content, "videoUrl")) ?? findVideoUrl(payload);
}

function extractProviderErrorMessage(payload: ArkVideoTaskPayload) {
  return firstString(payload.error?.message, getNested(payload.error, "message"));
}

function findVideoUrl(value: unknown, keyPath = ""): string | null {
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value) && (keyPath.toLowerCase().includes("video") || /\.(mp4|mov|webm)(\?|$)/i.test(value))) {
      return value;
    }
    return null;
  }

  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = findVideoUrl(item, `${keyPath}[${index}]`);
      if (found) return found;
    }
    return null;
  }

  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      const lowerKey = key.toLowerCase();
      const preferred =
        ["video_url", "videourl", "download_url", "downloadurl", "output_url", "outputurl", "url"].includes(lowerKey) ||
        lowerKey.includes("video");
      const found = findVideoUrl(item, preferred ? `${keyPath}.${key}.video` : `${keyPath}.${key}`);
      if (found) return found;
    }
  }

  return null;
}

function getNested(value: unknown, key: string) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return (value as Record<string, unknown>)[key];
  }
  return undefined;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function inferVideoExtension(mimeType: string, url: string) {
  const fromMime = mimeType.toLowerCase().match(/video\/([a-z0-9.+-]+)/)?.[1];
  if (fromMime) {
    if (fromMime.includes("quicktime")) return "mov";
    if (fromMime.includes("webm")) return "webm";
    return fromMime.replace(/[^a-z0-9]/g, "") || "mp4";
  }

  const fromUrl = new URL(url).pathname.match(/\.([a-z0-9]+)$/i)?.[1];
  return fromUrl?.toLowerCase() ?? "mp4";
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeArkVideoError(error: unknown) {
  if (error instanceof AppError) return error;

  if (error instanceof DOMException && error.name === "TimeoutError") {
    return new AppError({
      status: 504,
      code: "ark_video_timeout",
      userMessage: "火山方舟视频生成请求超时。系统已保存失败状态，请稍后重试。",
    });
  }

  return new AppError({
    status: 502,
    code: "ark_video_request_failed",
    userMessage: "火山方舟视频生成调用失败。请检查模型是否开通、图片是否可访问，或稍后重试。",
  });
}

function normalizeArkVideoErrorCode(code: string | undefined) {
  if (!code) return "ark_video_request_failed";
  return `ark_video_${code.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
}

function mapArkVideoUserMessage(code: string | undefined) {
  if (code === "ModelNotOpen") {
    return "Doubao-Seedance 视频模型还没有在火山方舟控制台开通。请开通后再重试。";
  }

  if (code === "InvalidEndpointOrModel.NotFound") {
    return "当前 Doubao-Seedance 模型 ID 或接入点不存在，或账号没有权限。请在火山方舟控制台复制准确模型 ID。";
  }

  return "火山方舟视频生成请求失败。请检查模型权限、API Key、分镜图片公开可读性和 Prompt 后重试。";
}

function describeTaskStatus(status: string) {
  if (status === "queued" || status === "pending") return "排队中";
  if (status === "processing" || status === "running") return "生成中";
  return `状态 ${status}`;
}

async function recordArkVideoTelemetry(input: {
  telemetry?: ArkVideoTelemetry;
  model: string;
  status: "succeeded" | "failed";
  startedAt: number;
  providerResponseId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (!input.telemetry) return;

  try {
    await createAiTaskLog({
      projectId: input.telemetry.projectId,
      jobId: input.telemetry.jobId ?? null,
      callId: input.telemetry.callId,
      provider: env.VIDEO_GENERATION_PROVIDER,
      modelName: input.model,
      operation: input.telemetry.operation,
      status: input.status,
      providerResponseId: input.providerResponseId ?? null,
      inputChars: null,
      outputChars: null,
      imageCount: null,
      durationMs: Date.now() - input.startedAt,
      attempt: input.telemetry.attempt ?? 1,
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null,
      metadata: {
        ...input.telemetry.metadata,
        ...input.metadata,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error("AI video telemetry log write failed", { name: error.name, message: error.message.slice(0, 240) });
    } else {
      console.error("AI video telemetry log write failed", { message: "Unknown telemetry error" });
    }
  }
}
