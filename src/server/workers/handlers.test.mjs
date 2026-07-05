import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("worker retry path uses retry wording instead of failure wording for recoverable jobs", () => {
  const source = readFileSync(new URL("./handlers.ts", import.meta.url), "utf8");

  assert.match(source, /系统会自动重试/);
  assert.doesNotMatch(source, /任务处理失败。系统已保存失败状态，你可以稍后重试或联系管理员。/);
});
