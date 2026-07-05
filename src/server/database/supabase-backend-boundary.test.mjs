import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const backendEntrypointRoots = [
  "src/app/api",
  "src/scripts",
  "src/server",
];

const bannedDatabaseBypassPatterns = [
  { name: "sqlite", pattern: /\b(sqlite3?|better-sqlite3)\b/i },
  { name: "mysql", pattern: /\b(mysql2?|mariadb)\b/i },
  { name: "mongodb", pattern: /\b(mongodb|mongoose)\b/i },
  { name: "prisma", pattern: /@prisma\/client|\bnew\s+PrismaClient\b/i },
  { name: "drizzle", pattern: /\bdrizzle-orm\b/i },
  { name: "knex", pattern: /\bknex\b/i },
  { name: "neon", pattern: /@neondatabase\/serverless/i },
  { name: "direct supabase-js table client", pattern: /@supabase\/supabase-js|\bcreateClient\s*\(/i },
];

test("backend cloud entrypoints do not bypass the Supabase Postgres data layer", () => {
  const files = backendEntrypointRoots.flatMap((root) => collectTypescriptFiles(resolve(repoRoot, root)));

  assert.ok(files.length > 0, "Expected backend entrypoints to be present");

  const violations = [];
  for (const file of files) {
    const source = readFileSync(resolve(repoRoot, file), "utf8");
    for (const banned of bannedDatabaseBypassPatterns) {
      if (banned.pattern.test(source)) {
        violations.push(`${relative(repoRoot, resolve(repoRoot, file))}: ${banned.name}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

function collectTypescriptFiles(root) {
  const entries = readdirSync(root);
  return entries.flatMap((entry) => {
    const path = resolve(root, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      return collectTypescriptFiles(path);
    }

    if (!path.endsWith(".ts") || path.endsWith(".test.ts")) {
      return [];
    }

    return [relative(repoRoot, path)];
  });
}
