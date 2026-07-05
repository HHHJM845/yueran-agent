import { readFileSync } from "node:fs";
import { loadEnvConfig } from "@next/env";
import { Pool } from "pg";

loadEnvConfig(process.cwd());

const schemaSql = readFileSync("src/server/database/schema.sql", "utf8");
const expectedTables = [...schemaSql.matchAll(/create table if not exists\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g)].map(
  (match) => match[1],
);

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";

export function isPlaceholderDatabaseUrl(value: string) {
  return (
    !value ||
    value.includes("PASTE_SUPABASE_POSTGRES_CONNECTION_STRING_HERE") ||
    value.includes("YOUR_DATABASE_PASSWORD") ||
    value.includes("REPLACE_WITH_SUPABASE_DATABASE_PASSWORD") ||
    value.includes("your-project-ref") ||
    value.includes("aws-0-region")
  );
}

export function isSupabaseDatabaseUrl(value: string) {
  return value.includes("supabase.co") || value.includes("pooler.supabase.com");
}

async function main() {
  if (isPlaceholderDatabaseUrl(databaseUrl) || !isSupabaseDatabaseUrl(databaseUrl)) {
    throw new Error("DATABASE_URL 还不是可用的 Supabase Postgres 连接串。请先从 Supabase Dashboard 复制真实连接串。");
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("sslmode=require") ? undefined : { rejectUnauthorized: false },
  });

  try {
    const [tables, rls, policies, appSettings, health] = await Promise.all([
      pool.query<{ table_name: string }>(
        `
          select table_name
          from information_schema.tables
          where table_schema = 'public'
            and table_type = 'BASE TABLE'
            and table_name = any($1::text[])
          order by table_name
        `,
        [expectedTables],
      ),
      pool.query<{ relname: string }>(
        `
          select c.relname
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public'
            and c.relname = any($1::text[])
            and c.relrowsecurity = true
          order by c.relname
        `,
        [expectedTables],
      ),
      pool.query<{ tablename: string; policyname: string }>(
        `
          select tablename, policyname
          from pg_policies
          where schemaname = 'public'
            and tablename = any($1::text[])
            and policyname = tablename || '_service_role_all'
          order by tablename
        `,
        [expectedTables],
      ),
      pool.query<{ provider: string; project_ref: string }>(
        `
          select
            value_json->>'provider' as provider,
            value_json->>'project_ref' as project_ref
          from app_settings
          where key = 'database_provider'
          limit 1
        `,
      ),
      pool.query("select * from backend_migration_health limit 1"),
    ]);

    const foundTables = new Set(tables.rows.map((row) => row.table_name));
    const rlsTables = new Set(rls.rows.map((row) => row.relname));
    const policyTables = new Set(policies.rows.map((row) => row.tablename));
    const missingTables = expectedTables.filter((table) => !foundTables.has(table));
    const missingRls = expectedTables.filter((table) => !rlsTables.has(table));
    const missingPolicies = expectedTables.filter((table) => !policyTables.has(table));
    const settings = appSettings.rows[0];

    const failures = [
      missingTables.length ? `缺少表：${missingTables.join(", ")}` : null,
      missingRls.length ? `缺少 RLS：${missingRls.join(", ")}` : null,
      missingPolicies.length ? `缺少 service_role policy：${missingPolicies.join(", ")}` : null,
      settings?.provider === "supabase" && settings.project_ref === "jrzyddeijiltyruiawvc"
        ? null
        : "app_settings.database_provider 未写入 Supabase 项目元数据",
      health.rowCount === 1 ? null : "backend_migration_health 视图不可用",
    ].filter((failure): failure is string => Boolean(failure));

    if (failures.length > 0) {
      throw new Error(`Supabase 迁移验收未通过：${failures.join("；")}`);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          checkedTables: expectedTables.length,
          rlsEnabledTables: rls.rowCount,
          serviceRolePolicies: policies.rowCount,
          projectRef: settings.project_ref,
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}

const isMain = process.argv[1] ? import.meta.url === new URL(process.argv[1], "file:").href : false;

if (isMain) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Supabase 迁移验收失败。");
    process.exit(1);
  });
}
