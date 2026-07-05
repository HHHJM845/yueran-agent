import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getSupabaseMigrationManifest, readSupabaseMigrationSql, supabaseMigrationPath } from "./print-supabase-sql.ts";

test("print-supabase-sql returns the exact migration SQL", () => {
  assert.equal(readSupabaseMigrationSql(), readFileSync(supabaseMigrationPath, "utf8"));
});

test("print-supabase-sql reports a stable migration manifest", () => {
  const manifest = getSupabaseMigrationManifest();

  assert.equal(manifest.projectRef, "jrzyddeijiltyruiawvc");
  assert.equal(manifest.sqlPath, supabaseMigrationPath);
  assert.equal(manifest.sha256.length, 64);
  assert.equal(manifest.backendTables, 54);
  assert.deepEqual(manifest.supabaseMetadataTables, ["app_settings"]);
  assert.ok(manifest.bytes > 0);
  assert.ok(manifest.lines > 0);
});
