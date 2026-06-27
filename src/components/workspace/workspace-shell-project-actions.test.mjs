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

test("delete action calls real deleteProject api and refreshes stale permissions", () => {
  assert.match(source, /deleteProject\(/);
  assert.match(source, /mode: "archive"/);
  assert.match(source, /mode: "permanent"/);
  assert.match(source, /project_delete_forbidden/);
});
