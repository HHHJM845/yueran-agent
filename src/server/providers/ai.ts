import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

export function assertTextStructuringReady() {
  if (!env.ARK_API_KEY) {
    throw new AppError({
      status: 503,
      code: "ark_not_configured",
      userMessage: "豆包文本结构化模型还不能调用。请先配置 ARK_API_KEY，再重新发起需求整理。",
    });
  }

  return {
    provider: env.TEXT_STRUCTURING_PROVIDER,
    baseUrl: env.ARK_BASE_URL,
    model: env.ARK_TEXT_STRUCTURING_MODEL,
  };
}

export function assertSpeechTranscriptionReady() {
  if (env.SPEECH_TRANSCRIPTION_PROVIDER !== "volcengine_ark") {
    throw new AppError({
      status: 503,
      code: "speech_provider_unsupported",
      userMessage: "当前语音转写 provider 不是火山方舟。请先把 SPEECH_TRANSCRIPTION_PROVIDER 配置为 volcengine_ark。",
    });
  }

  if (!env.ARK_API_KEY) {
    throw new AppError({
      status: 503,
      code: "ark_speech_not_configured",
      userMessage: "豆包语音转写还没有配置 API Key。请配置 ARK_API_KEY 后再使用语音输入。",
    });
  }

  return {
    provider: env.SPEECH_TRANSCRIPTION_PROVIDER,
    baseUrl: env.ARK_BASE_URL,
    model: env.ARK_SPEECH_TRANSCRIPTION_MODEL,
  };
}

export function assertAtmosphereImageReady() {
  if (!env.OPENAI_API_KEY) {
    throw new AppError({
      status: 503,
      code: "openai_not_configured",
      userMessage: "氛围图生成模型还不能调用。请先配置 OPENAI_API_KEY，再重新生成氛围图。",
    });
  }

  return {
    provider: env.ATMOSPHERE_IMAGE_PROVIDER,
    baseUrl: env.OPENAI_BASE_URL ?? "",
    model: env.OPENAI_IMAGE_MODEL,
  };
}
