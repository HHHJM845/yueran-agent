import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const supabaseMigrationPath = "supabase/migrations/20260630000000_initial_backend_schema.sql";
export const backendSchemaPath = "src/server/database/schema.sql";

export function readSupabaseMigrationSql() {
  return readFileSync(supabaseMigrationPath, "utf8");
}

export function getSupabaseMigrationManifest() {
  const sql = readSupabaseMigrationSql();
  const backendSchema = readFileSync(backendSchemaPath, "utf8");
  const backendTables = [...backendSchema.matchAll(/create table if not exists\s+([a-zA-Z_][a-zA-Z0-9_]*)\b/g)].map(
    (match) => match[1],
  );
  const migrationTables = [...sql.matchAll(/create table if not exists\s+([a-zA-Z_][a-zA-Z0-9_]*)\b/g)].map(
    (match) => match[1],
  );

  return {
    projectRef: "jrzyddeijiltyruiawvc",
    sqlPath: supabaseMigrationPath,
    sha256: createHash("sha256").update(sql).digest("hex"),
    bytes: Buffer.byteLength(sql),
    lines: sql.split("\n").length,
    backendTables: backendTables.length,
    supabaseMetadataTables: migrationTables.filter((table) => !backendTables.includes(table)),
  };
}

const isMain = process.argv[1] ? import.meta.url === new URL(process.argv[1], "file:").href : false;

if (isMain) {
  if (process.argv.includes("--manifest")) {
    process.stdout.write(`${JSON.stringify(getSupabaseMigrationManifest(), null, 2)}\n`);
  } else {
    process.stdout.write(readSupabaseMigrationSql());
  }
}
