import OpenAI from "openai";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

type ArkSdkError = {
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

type AiTelemetryContext = {
  projectId: string;
  jobId?: string | null;
  callId: string;
  provider: string;
  operation: string;
  attempt?: number;
  metadata?: Record<string, unknown>;
};

type ArkAudioTranscriptionResponse = {
  text?: string;
  transcript?: string;
  transcription?: string;
  data?: {
    text?: string;
    transcript?: string;
  };
  error?: {
    code?: string;
    message?: string;
  };
  id?: string;
  usage?: Record<string, unknown>;
};

export async function callArkJson<T>(input: {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  telemetry?: AiTelemetryContext;
}) {
  if (!env.ARK_API_KEY) {
    throw new AppError({
      status: 503,
      code: "ark_not_configured",
      userMessage: "火山方舟 API Key 还没有配置。请配置后再发起需求结构化。",
    });
  }

  const client = new OpenAI({
    baseURL: env.ARK_BASE_URL,
    apiKey: env.ARK_API_KEY,
    timeout: input.timeoutMs ?? 150_000,
    maxRetries: 0,
  });

  const startedAt = Date.now();
  try {
    const abortSignal = AbortSignal.timeout(input.timeoutMs ?? 150_000);
    const response = await client.chat.completions.create(
      {
        model: input.model,
        messages: input.messages,
        temperature: input.temperature ?? 0.2,
        max_tokens: input.maxOutputTokens ?? 12000,
        response_format: { type: "json_object" },
      },
      { signal: abortSignal }
    );

    const content = response.choices[0]?.message?.content ?? "";
    if (!content) {
      throw new AppError({
        status: 502,
        code: "ark_empty_response",
        userMessage: "豆包模型没有返回可用内容，可能是本次推理消耗了全部输出额度。请稍后重试，或缩短输入内容后再试。",
      });
    }

    const parsed = parseJsonContent<T>(content);
    await recordArkTelemetry({
      telemetry: input.telemetry,
      model: input.model,
      status: "succeeded",
      startedAt,
      response,
      inputChars: countMessagesChars(input.messages),
      outputChars: content.length,
    });
    return parsed;
  } catch (error) {
    if (error instanceof AppError) {
      await recordArkTelemetry({
        telemetry: input.telemetry,
        model: input.model,
        status: "failed",
        startedAt,
        error,
        inputChars: countMessagesChars(input.messages),
      });
      throw error;
    }

    const arkError = normalizeArkSdkError(error);
    console.error("Ark SDK request failed", {
      status: arkError.status,
      code: arkError.code,
      message: arkError.message?.slice(0, 240),
    });
    await recordArkTelemetry({
      telemetry: input.telemetry,
      model: input.model,
      status: "failed",
      startedAt,
      errorCode: arkError.code?.toString(),
      errorMessage: arkError.message,
      inputChars: countMessagesChars(input.messages),
    });
    throw mapArkError(arkError.code);
  }
}

export async function transcribeArkAudio(input: {
  model: string;
  audio: Buffer;
  mimeType: string;
  timeoutMs?: number;
  telemetry?: AiTelemetryContext;
}) {
  if (!env.ARK_API_KEY) {
    throw new AppError({
      status: 503,
      code: "ark_not_configured",
      userMessage: "火山方舟 API Key 还没有配置。请配置后再使用语音输入。",
    });
  }

  if (input.audio.length === 0) {
    throw new AppError({
      status: 422,
      code: "speech_audio_empty",
      userMessage: "没有收到可转写的语音内容。请重新录音后再试。",
    });
  }

  const startedAt = Date.now();
  try {
    const response = await fetch(`${env.ARK_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.ARK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "请将这段中文语音准确转写为普通文本，只输出转写文字，不要解释，不要加标点说明。",
              },
              {
                type: "input_audio",
                input_audio: {
                  data: input.audio.toString("base64"),
                  format: normalizeAudioFormat(input.mimeType),
                },
              },
            ],
          },
        ],
        temperature: 0,
      }),
      signal: AbortSignal.timeout(input.timeoutMs ?? 90_000),
    });
    const payload = (await response.json().catch(() => ({}))) as ArkAudioTranscriptionResponse & {
      choices?: Array<{ message?: { content?: unknown } }>;
    };

    if (!response.ok || payload.error) {
      const normalized = normalizeArkSdkError({
        status: response.status,
        error: payload.error,
        message: payload.error?.message ?? "Ark audio transcription request failed",
      });
      await recordArkTelemetry({
        telemetry: input.telemetry,
        model: input.model,
        status: "failed",
        startedAt,
        response: payload,
        errorCode: normalized.code?.toString(),
        errorMessage: normalized.message,
        metadata: { audioBytes: input.audio.length, mimeType: input.mimeType },
      });
      throw mapArkError(normalized.code?.toString());
    }

    const transcript = extractAudioTranscript(payload);
    if (!transcript) {
      throw new AppError({
        status: 502,
        code: "ark_speech_empty_response",
        userMessage: "豆包语音转写没有返回可用文字。请靠近麦克风重新录一遍，或改用文字输入。",
      });
    }

    await recordArkTelemetry({
      telemetry: input.telemetry,
      model: input.model,
      status: "succeeded",
      startedAt,
      response: payload,
      inputChars: null,
      outputChars: transcript.length,
      metadata: { audioBytes: input.audio.length, mimeType: input.mimeType },
    });
    return transcript;
  } catch (error) {
    if (error instanceof AppError) {
      await recordArkTelemetry({
        telemetry: input.telemetry,
        model: input.model,
        status: "failed",
        startedAt,
        error,
        metadata: { audioBytes: input.audio.length, mimeType: input.mimeType },
      });
      throw error;
    }

    const arkError = normalizeArkSdkError(error);
    console.error("Ark audio transcription request failed", {
      status: arkError.status,
      code: arkError.code,
      message: arkError.message?.slice(0, 240),
    });
    await recordArkTelemetry({
      telemetry: input.telemetry,
      model: input.model,
      status: "failed",
      startedAt,
      errorCode: arkError.code?.toString(),
      errorMessage: arkError.message,
      metadata: { audioBytes: input.audio.length, mimeType: input.mimeType },
    });
    throw mapArkError(arkError.code?.toString());
  }
}

export async function callArkResponseJson<T>(input: {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  thinking?: "disabled" | "auto";
  telemetry?: AiTelemetryContext;
}) {
  if (!env.ARK_API_KEY) {
    throw new AppError({
      status: 503,
      code: "ark_not_configured",
      userMessage: "火山方舟 API Key 还没有配置。请配置后再发起文档草稿生成。",
    });
  }

  const client = new OpenAI({
    baseURL: env.ARK_BASE_URL,
    apiKey: env.ARK_API_KEY,
    timeout: input.timeoutMs ?? 150_000,
    maxRetries: 0,
  });

  const startedAt = Date.now();
  try {
    const abortSignal = AbortSignal.timeout(input.timeoutMs ?? 150_000);
    const response = await client.responses.create(
      {
        model: input.model,
        input: input.messages.map((message) => ({
          role: message.role,
          content: [
            {
              type: "input_text",
              text: `${message.content}\n\n请只输出严格 JSON，不要输出 Markdown。`,
            },
          ],
        })),
        thinking: { type: input.thinking ?? "disabled" },
        temperature: input.temperature ?? 0.2,
        max_output_tokens: input.maxOutputTokens ?? 4096,
      } as Parameters<typeof client.responses.create>[0],
      { signal: abortSignal }
    );
    const content = extractResponseOutputText(response);

    if (!content) {
      throw new AppError({
        status: 502,
        code: "ark_empty_response",
        userMessage: "豆包模型没有返回可用的文档草稿。请稍后重试，或缩短项目资料后再试。",
      });
    }

    const parsed = parseJsonContent<T>(content);
    await recordArkTelemetry({
      telemetry: input.telemetry,
      model: input.model,
      status: "succeeded",
      startedAt,
      response,
      inputChars: countMessagesChars(input.messages),
      outputChars: content.length,
    });
    return parsed;
  } catch (error) {
    if (error instanceof AppError) {
      await recordArkTelemetry({
        telemetry: input.telemetry,
        model: input.model,
        status: "failed",
        startedAt,
        error,
        inputChars: countMessagesChars(input.messages),
      });
      throw error;
    }

    const arkError = normalizeArkSdkError(error);
    console.error("Ark Responses SDK request failed", {
      status: arkError.status,
      code: arkError.code,
      message: arkError.message?.slice(0, 240),
    });
    await recordArkTelemetry({
      telemetry: input.telemetry,
      model: input.model,
      status: "failed",
      startedAt,
      errorCode: arkError.code?.toString(),
      errorMessage: arkError.message,
      inputChars: countMessagesChars(input.messages),
    });
    throw mapArkError(arkError.code);
  }
}

export async function callArkMultimodalJson<T>(input: {
  model: string;
  prompt: string;
  media: Array<{ type: "image" | "video"; url: string }>;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  telemetry?: AiTelemetryContext;
}) {
  if (!env.ARK_API_KEY) {
    throw new AppError({
      status: 503,
      code: "ark_not_configured",
      userMessage: "火山方舟 API Key 还没有配置。请配置后再发起样片分析。",
    });
  }

  const client = new OpenAI({
    baseURL: env.ARK_BASE_URL,
    apiKey: env.ARK_API_KEY,
    timeout: input.timeoutMs ?? 180_000,
    maxRetries: 0,
  });

  const startedAt = Date.now();
  try {
    const abortSignal = AbortSignal.timeout(input.timeoutMs ?? 180_000);
    const response = await client.responses.create(
      {
        model: input.model,
        input: [
          {
            role: "user",
            content: [
              ...input.media.map((media) =>
                media.type === "image"
                  ? {
                      type: "input_image",
                      image_url: media.url,
                    }
                  : {
                      type: "input_video",
                      video_url: media.url,
                    }
              ),
              {
                type: "input_text",
                text: `${input.prompt}\n\n请只输出严格 JSON，不要输出 Markdown。`,
              },
            ],
          },
        ],
        temperature: input.temperature ?? 0.2,
        max_output_tokens: input.maxOutputTokens ?? 4096,
      } as Parameters<typeof client.responses.create>[0],
      { signal: abortSignal }
    );

    const content = extractResponseOutputText(response);
    if (!content) {
      throw new AppError({
        status: 502,
        code: "ark_empty_response",
        userMessage: "豆包多模态模型没有返回可用内容。请稍后重试，或换一个更清晰的样片资料。",
      });
    }

    const parsed = parseJsonContent<T>(content);
    await recordArkTelemetry({
      telemetry: input.telemetry,
      model: input.model,
      status: "succeeded",
      startedAt,
      response,
      inputChars: input.prompt.length,
      outputChars: content.length,
      metadata: { mediaCount: input.media.length },
    });
    return parsed;
  } catch (error) {
    if (error instanceof AppError) {
      await recordArkTelemetry({
        telemetry: input.telemetry,
        model: input.model,
        status: "failed",
        startedAt,
        error,
        inputChars: input.prompt.length,
        metadata: { mediaCount: input.media.length },
      });
      throw error;
    }

    const arkError = normalizeArkSdkError(error);
    console.error("Ark multimodal SDK request failed", {
      status: arkError.status,
      code: arkError.code,
      message: arkError.message?.slice(0, 240),
    });
    await recordArkTelemetry({
      telemetry: input.telemetry,
      model: input.model,
      status: "failed",
      startedAt,
      errorCode: arkError.code?.toString(),
      errorMessage: arkError.message,
      inputChars: input.prompt.length,
      metadata: { mediaCount: input.media.length },
    });
    throw mapArkError(arkError.code);
  }
}

export async function callArkEmbedding(input: {
  model: string;
  text: string;
  timeoutMs?: number;
  telemetry?: AiTelemetryContext;
}) {
  if (!env.ARK_API_KEY) {
    throw new AppError({
      status: 503,
      code: "ark_not_configured",
      userMessage: "火山方舟 API Key 还没有配置。请配置后再发起素材语义检索。",
    });
  }

  if (isMultimodalEmbeddingModel(input.model)) {
    return callArkMultimodalEmbedding(input);
  }

  const startedAt = Date.now();
  try {
    const client = new OpenAI({
      baseURL: env.ARK_BASE_URL,
      apiKey: env.ARK_API_KEY,
      timeout: input.timeoutMs ?? 90_000,
      maxRetries: 0,
    });
    const abortSignal = AbortSignal.timeout(input.timeoutMs ?? 90_000);
    const response = await client.embeddings.create(
      {
        model: input.model,
        input: input.text.slice(0, 8000),
      },
      { signal: abortSignal }
    );
    const embedding = response.data[0]?.embedding;
    if (!embedding || embedding.length === 0) {
      throw new AppError({
        status: 502,
        code: "ark_empty_embedding",
        userMessage: "豆包 embedding 模型没有返回可用向量。请稍后重试，或缩短检索文本后再试。",
      });
    }

    await recordArkTelemetry({
      telemetry: input.telemetry,
      model: input.model,
      status: "succeeded",
      startedAt,
      response,
      inputChars: input.text.length,
      embeddingDimensions: embedding.length,
    });
    return embedding;
  } catch (error) {
    if (error instanceof AppError) {
      await recordArkTelemetry({
        telemetry: input.telemetry,
        model: input.model,
        status: "failed",
        startedAt,
        error,
        inputChars: input.text.length,
      });
      throw error;
    }

    const arkError = normalizeArkSdkError(error);
    console.error("Ark embedding SDK request failed", {
      status: arkError.status,
      code: arkError.code,
      message: arkError.message?.slice(0, 240),
    });
    await recordArkTelemetry({
      telemetry: input.telemetry,
      model: input.model,
      status: "failed",
      startedAt,
      errorCode: arkError.code?.toString(),
      errorMessage: arkError.message,
      inputChars: input.text.length,
    });
    throw mapArkError(arkError.code);
  }
}

async function callArkMultimodalEmbedding(input: {
  model: string;
  text: string;
  timeoutMs?: number;
  telemetry?: AiTelemetryContext;
}) {
  const startedAt = Date.now();
  try {
    const response = await fetch(`${env.ARK_BASE_URL.replace(/\/$/, "")}/embeddings/multimodal`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.ARK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        input: [
          {
            type: "text",
            text: input.text.slice(0, 8000),
          },
        ],
      }),
      signal: AbortSignal.timeout(input.timeoutMs ?? 90_000),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: { code?: string; message?: string };
      data?: Array<{ embedding?: unknown }> | { embedding?: unknown };
    };

    if (!response.ok || payload.error) {
      throw normalizeArkSdkError({
        status: response.status,
        error: payload.error,
        message: payload.error?.message ?? "Ark multimodal embedding request failed",
      });
    }

    const embedding = normalizeEmbedding(Array.isArray(payload.data) ? payload.data[0]?.embedding : payload.data?.embedding);
    if (embedding.length === 0) {
      throw new AppError({
        status: 502,
        code: "ark_empty_embedding",
        userMessage: "豆包多模态 embedding 模型没有返回可用向量。请稍后重试，或缩短检索文本后再试。",
      });
    }

    await recordArkTelemetry({
      telemetry: input.telemetry,
      model: input.model,
      status: "succeeded",
      startedAt,
      response: payload,
      providerResponseId: response.headers.get("x-request-id") ?? response.headers.get("x-tt-logid"),
      inputChars: input.text.length,
      embeddingDimensions: embedding.length,
      metadata: { httpStatus: response.status },
    });
    return embedding;
  } catch (error) {
    if (error instanceof AppError) {
      await recordArkTelemetry({
        telemetry: input.telemetry,
        model: input.model,
        status: "failed",
        startedAt,
        error,
        inputChars: input.text.length,
      });
      throw error;
    }

    const arkError = normalizeArkSdkError(error);
    console.error("Ark multimodal embedding request failed", {
      status: arkError.status,
      code: arkError.code,
      message: arkError.message?.slice(0, 240),
    });
    await recordArkTelemetry({
      telemetry: input.telemetry,
      model: input.model,
      status: "failed",
      startedAt,
      errorCode: arkError.code?.toString(),
      errorMessage: arkError.message,
      inputChars: input.text.length,
    });
    throw mapArkError(arkError.code);
  }
}

function isMultimodalEmbeddingModel(model: string) {
  const normalized = model.toLowerCase();
  return normalized.includes("embedding") && (normalized.includes("vision") || normalized.includes("multimodal"));
}

function normalizeEmbedding(value: unknown): number[] {
  if (Array.isArray(value) && Array.isArray(value[0])) {
    return value[0].map(Number).filter(Number.isFinite);
  }

  if (Array.isArray(value)) {
    return value.map(Number).filter(Number.isFinite);
  }

  return [];
}

function extractResponseOutputText(response: unknown) {
  const outputText = (response as { output_text?: string }).output_text;
  if (outputText) return outputText;

  const output = (response as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }).output ?? [];
  for (const item of output) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  return "";
}

export function parseJsonContent<T>(content: string) {
  const trimmed = content.trim();
  const jsonBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1]?.trim();
  const candidates = [jsonBlock, trimmed, extractEmbeddedJson(trimmed)].filter(
    (candidate): candidate is string => Boolean(candidate)
  );

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // Try the next candidate before surfacing a user-facing provider error.
    }
  }

  console.error("Ark returned non-json content", { contentLength: trimmed.length });
  throw new AppError({
    status: 502,
    code: "ark_invalid_json",
    userMessage: "豆包模型返回的结构化内容格式不正确。请稍后重试，或减少输入中的无关内容。",
  });
}

function extractEmbeddedJson(content: string) {
  const starts = [...content.matchAll(/[\[{]/g)].map((match) => match.index ?? -1).filter((index) => index >= 0);

  for (const start of starts) {
    const candidate = readBalancedJsonValue(content, start);
    if (!candidate) continue;
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // Keep scanning in case an earlier bracket belonged to normal prose.
    }
  }

  return null;
}

function readBalancedJsonValue(content: string, start: number) {
  const opening = content[start];
  if (opening !== "{" && opening !== "[") return null;

  const stack: string[] = [opening === "{" ? "}" : "]"];
  let inString = false;
  let escaped = false;

  for (let index = start + 1; index < content.length; index += 1) {
    const char = content[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      stack.push(char === "{" ? "}" : "]");
      continue;
    }

    if (char === "}" || char === "]") {
      if (stack.pop() !== char) return null;
      if (stack.length === 0) return content.slice(start, index + 1);
    }
  }

  return null;
}

function normalizeAudioFormat(mimeType: string) {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("wav")) return "wav";
  if (normalized.includes("mpeg") || normalized.includes("mp3")) return "mp3";
  if (normalized.includes("ogg")) return "ogg";
  if (normalized.includes("mp4") || normalized.includes("m4a")) return "mp4";
  return "webm";
}

function extractAudioTranscript(payload: ArkAudioTranscriptionResponse & { choices?: Array<{ message?: { content?: unknown } }> }) {
  const direct = payload.text ?? payload.transcript ?? payload.transcription ?? payload.data?.text ?? payload.data?.transcript;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const joined = content
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "text" in item) {
          const text = (item as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .join("")
      .trim();
    if (joined) return joined;
  }
  return "";
}

async function recordArkTelemetry(input: {
  telemetry?: AiTelemetryContext;
  model: string;
  status: "succeeded" | "failed";
  startedAt: number;
  response?: unknown;
  providerResponseId?: string | null;
  error?: AppError;
  errorCode?: string | null;
  errorMessage?: string | null;
  inputChars?: number | null;
  outputChars?: number | null;
  embeddingDimensions?: number | null;
  metadata?: Record<string, unknown>;
}) {
  if (!input.telemetry) return;

  try {
    const { createAiTaskLog } = await import("@/server/repositories/ai-task-logs");
    const usage = extractUsage(input.response);
    await createAiTaskLog({
      projectId: input.telemetry.projectId,
      jobId: input.telemetry.jobId ?? null,
      callId: input.telemetry.callId,
      provider: input.telemetry.provider,
      modelName: input.model,
      operation: input.telemetry.operation,
      status: input.status,
      providerResponseId: input.providerResponseId ?? extractResponseId(input.response),
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      inputChars: input.inputChars ?? null,
      outputChars: input.outputChars ?? null,
      embeddingDimensions: input.embeddingDimensions ?? null,
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
    console.error("AI telemetry log write failed", sanitizeTelemetryError(error));
  }
}

function extractUsage(response: unknown) {
  const usage = (response as { usage?: Record<string, unknown> } | undefined)?.usage ?? {};
  const inputTokens = numberFromUnknown(usage.prompt_tokens) ?? numberFromUnknown(usage.input_tokens);
  const outputTokens = numberFromUnknown(usage.completion_tokens) ?? numberFromUnknown(usage.output_tokens);
  const totalTokens = numberFromUnknown(usage.total_tokens) ?? sumNullable(inputTokens, outputTokens);
  return { inputTokens, outputTokens, totalTokens };
}

function extractResponseId(response: unknown) {
  const id = (response as { id?: unknown } | undefined)?.id;
  return typeof id === "string" ? id : null;
}

function numberFromUnknown(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sumNullable(left: number | null, right: number | null) {
  if (left === null && right === null) return null;
  return (left ?? 0) + (right ?? 0);
}

function countMessagesChars(messages: ChatMessage[]) {
  return messages.reduce((sum, message) => sum + message.content.length, 0);
}

function sanitizeTelemetryError(error: unknown) {
  if (error instanceof Error) return { name: error.name, message: error.message.slice(0, 240) };
  return { message: "Unknown telemetry error" };
}

function normalizeArkSdkError(error: unknown) {
  const sdkError = error as ArkSdkError;
  return {
    status: sdkError.status,
    code: sdkError.error?.code ?? sdkError.constructor?.name ?? sdkError.name ?? sdkError.code?.toString() ?? "ArkRequestFailed",
    message: sdkError.error?.message ?? sdkError.message ?? "Ark request failed",
  };
}

function mapArkError(code: string | undefined) {
  if (code === "ModelNotOpen") {
    return new AppError({
      status: 502,
      code: "ark_model_not_open",
      userMessage: "豆包模型还没有在火山方舟控制台开通。请开通当前模型后再重试。",
    });
  }

  if (code === "InvalidEndpointOrModel.NotFound") {
    return new AppError({
      status: 502,
      code: "ark_model_not_found",
      userMessage: "当前豆包模型 ID 或接入点不存在，或你的账号没有权限。请在火山方舟控制台复制准确的模型 ID 或 endpoint ID。",
    });
  }

  if (code === "APITimeoutError" || code === "TimeoutError" || code === "AbortError" || code === "APIUserAbortError") {
    return new AppError({
      status: 504,
      code: "ark_timeout",
      userMessage: "豆包模型响应超时。系统已保存失败状态，你可以缩短输入内容后重试，或稍后再试。",
    });
  }

  return new AppError({
    status: 502,
    code: "ark_request_failed",
    userMessage: "豆包模型调用失败。请检查模型是否已开通、API Key 是否有效，或稍后重试。",
  });
}
