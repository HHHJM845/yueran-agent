import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

let pool: Pool | null = null;

function getPool() {
  if (!env.DATABASE_URL) {
    throw new AppError({
      status: 503,
      code: "database_not_configured",
      userMessage: "Postgres 数据库连接还没有配置。请在 DATABASE_URL 中填入数据库连接后再查看真实项目数据。",
    });
  }

  if (!pool) {
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      ssl: env.DATABASE_URL.includes("sslmode=require") ? undefined : { rejectUnauthorized: false },
    });

    pool.on("error", (error) => {
      console.error("Database idle connection error", sanitizeDiagnostic(error));
    });
  }

  return pool;
}

export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []) {
  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await getPool().query<T>(text, params);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (attempt < maxAttempts && isTransientDatabaseError(error)) {
        console.warn("Database query transient failure, retrying", sanitizeDiagnostic(error));
        await delay(500);
        continue;
      }

      console.error("Database query failed", sanitizeDiagnostic(error));
      throw new AppError({
        status: 500,
        code: "database_query_failed",
        userMessage: "数据库操作失败。请稍后重试，或联系管理员检查数据库连接和表结构。",
      });
    }
  }

  throw new AppError({
    status: 500,
    code: "database_query_failed",
    userMessage: "数据库操作失败。请稍后重试，或联系管理员检查数据库连接和表结构。",
  });
}

export type TransactionQuery = <T extends QueryResultRow>(
  text: string,
  params?: unknown[]
) => Promise<QueryResult<T>>;

export async function withTransaction<T>(work: (transactionQuery: TransactionQuery) => Promise<T>) {
  let client: PoolClient;

  try {
    client = await getPool().connect();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error("Database connection failed", sanitizeDiagnostic(error));
    throw new AppError({
      status: 503,
      code: "database_connection_failed",
      userMessage: "暂时无法连接数据库。请稍后重试，或联系管理员检查数据库服务状态。",
    });
  }

  try {
    await client.query("begin");
    const result = await work(<Row extends QueryResultRow>(text: string, params: unknown[] = []) =>
      client.query<Row>(text, params)
    );
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch((rollbackError) => {
      console.error("Database rollback failed", sanitizeDiagnostic(rollbackError));
    });

    if (error instanceof AppError) {
      throw error;
    }

    console.error("Database transaction failed", sanitizeDiagnostic(error));
    throw new AppError({
      status: 500,
      code: "database_transaction_failed",
      userMessage: "数据库事务处理失败。请稍后重试，或联系管理员检查数据库连接和表结构。",
    });
  } finally {
    client.release();
  }
}

function sanitizeDiagnostic(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }

  return { message: "Unknown database error" };
}

function isTransientDatabaseError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("connection terminated") || message.includes("connection timeout") || message.includes("socket") || message.includes("econnreset");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
