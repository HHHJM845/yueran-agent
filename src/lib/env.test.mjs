import assert from "node:assert/strict";
import test from "node:test";
import { isConfiguredDatabaseUrl } from "./env.ts";

test("Supabase database URL validation rejects placeholders", () => {
  assert.equal(isConfiguredDatabaseUrl(undefined, "supabase"), false);
  assert.equal(isConfiguredDatabaseUrl("", "supabase"), false);
  assert.equal(isConfiguredDatabaseUrl("PASTE_SUPABASE_POSTGRES_CONNECTION_STRING_HERE", "supabase"), false);
  assert.equal(
    isConfiguredDatabaseUrl(
      "postgresql://postgres.your-project-ref:YOUR_DATABASE_PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres?sslmode=require",
      "supabase",
    ),
    false,
  );
  assert.equal(
    isConfiguredDatabaseUrl(
      "postgresql://postgres.jrzyddeijiltyruiawvc:REPLACE_WITH_SUPABASE_DATABASE_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require",
      "supabase",
    ),
    false,
  );
});

test("Supabase database URL validation accepts real Supabase hosts", () => {
  assert.equal(
    isConfiguredDatabaseUrl(
      "postgresql://postgres.jrzyddeijiltyruiawvc:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require",
      "supabase",
    ),
    true,
  );
  assert.equal(
    isConfiguredDatabaseUrl(
      "postgresql://postgres:secret@db.jrzyddeijiltyruiawvc.supabase.co:5432/postgres?sslmode=require",
      "supabase",
    ),
    true,
  );
});
