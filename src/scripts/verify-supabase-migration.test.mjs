import assert from "node:assert/strict";
import test from "node:test";
import { isPlaceholderDatabaseUrl, isSupabaseDatabaseUrl } from "./verify-supabase-migration.ts";

test("verify-supabase-migration rejects empty and placeholder database URLs", () => {
  assert.equal(isPlaceholderDatabaseUrl(""), true);
  assert.equal(isPlaceholderDatabaseUrl("PASTE_SUPABASE_POSTGRES_CONNECTION_STRING_HERE"), true);
  assert.equal(
    isPlaceholderDatabaseUrl(
      "postgresql://postgres.your-project-ref:YOUR_DATABASE_PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres?sslmode=require",
    ),
    true,
  );
  assert.equal(
    isPlaceholderDatabaseUrl(
      "postgresql://postgres.jrzyddeijiltyruiawvc:REPLACE_WITH_SUPABASE_DATABASE_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require",
    ),
    true,
  );
});

test("verify-supabase-migration recognizes Supabase Postgres hosts", () => {
  assert.equal(
    isSupabaseDatabaseUrl(
      "postgresql://postgres.jrzyddeijiltyruiawvc:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require",
    ),
    true,
  );
  assert.equal(
    isSupabaseDatabaseUrl("postgresql://postgres:secret@db.jrzyddeijiltyruiawvc.supabase.co:5432/postgres"),
    true,
  );
  assert.equal(isSupabaseDatabaseUrl("postgresql://postgres:secret@example.com:5432/postgres"), false);
});
