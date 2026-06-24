import { ZodError } from "zod";

export class AppError extends Error {
  status: number;
  code: string;
  userMessage: string;
  recoverable: boolean;

  constructor({
    status,
    code,
    userMessage,
    recoverable = true,
  }: {
    status: number;
    code: string;
    userMessage: string;
    recoverable?: boolean;
  }) {
    super(userMessage);
    this.status = status;
    this.code = code;
    this.userMessage = userMessage;
    this.recoverable = recoverable;
  }
}

export function toPublicError(error: unknown) {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.userMessage,
      recoverable: error.recoverable,
    };
  }

  if (error instanceof ZodError) {
    return {
      code: "invalid_request",
      message: error.issues[0]?.message ?? "提交内容不完整或格式不正确，请检查后再保存。",
      recoverable: true,
    };
  }

  return {
    code: "unexpected_error",
    message: "系统遇到了未预期的问题。请稍后重试，如果持续出现，请联系管理员查看服务端日志。",
    recoverable: true,
  };
}

export function jsonError(error: unknown) {
  const publicError = toPublicError(error);
  const status = error instanceof AppError ? error.status : error instanceof ZodError ? 400 : 500;

  return Response.json({ ok: false, error: publicError }, { status });
}

export function requireConfig(value: string | undefined, name: string) {
  if (!value) {
    throw new AppError({
      status: 503,
      code: "missing_configuration",
      userMessage: `${name} 还没有配置。请在服务端环境变量中补齐后再执行这个动作。`,
    });
  }

  return value;
}
