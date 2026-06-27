import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./workspace-shell.tsx", import.meta.url), "utf8");

test("project sidebar supports right-click project actions", () => {
  assert.match(source, /onContextMenu=/);
  assert.match(source, /project-context-menu/);
  assert.match(source, /打开项目/);
  assert.match(source, /移出项目列表/);
  assert.match(source, /永久删除/);
  assert.doesNotMatch(source, /hover\s*\.\.\./);
});

test("permanent delete uses two confirmation states", () => {
  assert.match(source, /永久删除项目/);
  assert.match(source, /再次确认永久删除/);
  assert.match(source, /确认永久删除/);
  assert.match(source, /canPermanentlyDeleteProject = user\.role === "admin"/);
});

test("archive visibility uses stable owner identity for business users", () => {
  assert.match(source, /canArchiveProject = \(project: ProjectSummary\) => user\.role === "admin" \|\| \(user\.role === "business" && project\.ownerId === user\.id\)/);
  assert.doesNotMatch(source, /project\.ownerName === user\.name/);
});

test("delete action calls real deleteProject api and refreshes stale permissions", () => {
  assert.match(source, /deleteProject\(/);
  assert.match(source, /mode: "archive"/);
  assert.match(source, /mode: "permanent"/);
  assert.match(source, /project_delete_forbidden/);
  assert.match(source, /fetchCurrentUser\(\)/);
  assert.match(source, /setUser\(permissionResult\.data\.user\)/);
});

test("project creation closes sheet only after successful create and shows success copy", () => {
  assert.match(source, /setCreateSheetOpen\(false\)/);
  assert.match(source, /项目已创建，可以开始录入 Brief。/);
  assert.match(source, /Promise<boolean>/);
  assert.match(source, /onSubmit=\{/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /new FormData\(event\.currentTarget\)/);
});
