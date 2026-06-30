import { z } from "zod";

const envSchema = z.object({
  DATABASE_PROVIDER: z.string().default("postgres"),
  DATABASE_URL: z.string().optional(),
  ASSET_STORAGE_PROVIDER: z.string().default("aliyun_oss"),
  ALIYUN_OSS_REGION: z.string().optional(),
  ALIYUN_OSS_ENDPOINT: z.string().optional(),
  ALIYUN_OSS_BUCKET: z.string().optional(),
  ALIYUN_OSS_ACCESS_KEY_ID: z.string().optional(),
  ALIYUN_OSS_ACCESS_KEY_SECRET: z.string().optional(),
  TEXT_STRUCTURING_PROVIDER: z.string().default("volcengine_ark"),
  IMAGE_VIDEO_UNDERSTANDING_PROVIDER: z.string().default("volcengine_ark"),
  ATMOSPHERE_IMAGE_PROVIDER: z.string().default("openai"),
  STORYBOARD_IMAGE_PROVIDER: z.string().default("volcengine_ark"),
  VIDEO_GENERATION_PROVIDER: z.string().default("volcengine_ark"),
  MATERIAL_EMBEDDING_PROVIDER: z.string().default("volcengine_ark"),
  ARK_API_KEY: z.string().optional(),
  ARK_BASE_URL: z.string().default("https://ark.cn-beijing.volces.com/api/v3"),
  ARK_TEXT_STRUCTURING_MODEL: z.string().default("doubao-seed-2-1-pro-260628"),
  ARK_IMAGE_VIDEO_UNDERSTANDING_MODEL: z.string().default("doubao-seed-2-0-lite-260215"),
  ARK_IMAGE_GENERATION_MODEL: z.string().default("doubao-seedream-4-0-250828"),
  ARK_VIDEO_GENERATION_MODEL: z.string().default("doubao-seedance-1-5-pro-251215"),
  ARK_MATERIAL_EMBEDDING_MODEL: z.string().default("doubao-embedding-vision-251215"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().optional(),
  OPENAI_IMAGE_MODEL: z.string().default("gpt-image-2-all"),
  FEISHU_APP_ID: z.string().optional(),
  FEISHU_APP_SECRET: z.string().optional(),
  FEISHU_DEFAULT_TENANT_KEY: z.string().optional(),
  SESSION_COOKIE_NAME: z.string().default("augc_session"),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(14),
});

export const env = envSchema.parse(process.env);

export function getConfigurationStatus() {
  const checks = [
    { key: "DATABASE_URL", label: "Postgres 数据库连接", configured: Boolean(env.DATABASE_URL) },
    {
      key: "ALIYUN_OSS_ACCESS_KEY_ID",
      label: "阿里云 OSS AccessKey ID",
      configured: Boolean(env.ALIYUN_OSS_ACCESS_KEY_ID),
    },
    {
      key: "ALIYUN_OSS_ACCESS_KEY_SECRET",
      label: "阿里云 OSS AccessKey Secret",
      configured: Boolean(env.ALIYUN_OSS_ACCESS_KEY_SECRET),
    },
    { key: "ALIYUN_OSS_BUCKET", label: "阿里云 OSS Bucket", configured: Boolean(env.ALIYUN_OSS_BUCKET) },
    { key: "ARK_API_KEY", label: "火山方舟 API Key", configured: Boolean(env.ARK_API_KEY) },
    { key: "OPENAI_API_KEY", label: "OpenAI API Key", configured: Boolean(env.OPENAI_API_KEY) },
    { key: "OPENAI_BASE_URL", label: "生图中转站 API Base URL", configured: Boolean(env.OPENAI_BASE_URL) },
    { key: "FEISHU_APP_ID", label: "飞书 App ID", configured: Boolean(env.FEISHU_APP_ID) },
    { key: "FEISHU_APP_SECRET", label: "飞书 App Secret", configured: Boolean(env.FEISHU_APP_SECRET) },
  ];

  return {
    ready: checks.every((check) => check.configured),
    checks,
    models: {
      textStructuring: env.ARK_TEXT_STRUCTURING_MODEL,
      imageVideoUnderstanding: env.ARK_IMAGE_VIDEO_UNDERSTANDING_MODEL,
      atmosphereImage: env.OPENAI_IMAGE_MODEL,
      storyboardImage: env.ARK_IMAGE_GENERATION_MODEL,
      videoGeneration: env.ARK_VIDEO_GENERATION_MODEL,
      materialEmbedding: env.ARK_MATERIAL_EMBEDDING_MODEL,
    },
  };
}
