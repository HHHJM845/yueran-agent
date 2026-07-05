import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getDevProcessSpecs, isMainModule } from "./dev-with-worker.ts";

test("dev runner starts Next dev and the job worker together", () => {
  const specs = getDevProcessSpecs("/repo", "darwin");

  assert.deepEqual(
    specs.map((spec) => ({ name: spec.name, args: spec.args })),
    [
      { name: "web", args: ["dev"] },
      { name: "worker", args: ["src/scripts/job-worker.ts"] },
    ]
  );
  assert.ok(specs[0].command.endsWith("/node_modules/.bin/next"));
  assert.ok(specs[1].command.endsWith("/node_modules/.bin/tsx"));
});

test("npm run dev uses the combined runner while web-only and worker scripts remain available", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));

  assert.equal(packageJson.scripts.dev, "tsx src/scripts/dev-with-worker.ts");
  assert.equal(packageJson.scripts["dev:web"], "next dev");
  assert.equal(packageJson.scripts.worker, "tsx src/scripts/job-worker.ts");
});

test("dev runner main guard accepts tsx relative argv script paths", () => {
  assert.equal(
    isMainModule("file:///repo/src/scripts/dev-with-worker.ts", "src/scripts/dev-with-worker.ts", "/repo"),
    true
  );
  assert.equal(
    isMainModule("file:///repo/src/scripts/dev-with-worker.ts", "src/scripts/other.ts", "/repo"),
    false
  );
});
