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
