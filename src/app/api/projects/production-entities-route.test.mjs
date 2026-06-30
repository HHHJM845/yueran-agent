import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("production entity route exposes AI prompt regeneration action", async () => {
  const route = await readFile(new URL("./[projectId]/production-entities/route.ts", import.meta.url), "utf8");
  const api = await readFile(new URL("../../../components/workspace/api.ts", import.meta.url), "utf8");

  assert.match(route, /generateProductionReferencePrompts/);
  assert.match(route, /action: z\.literal\("regenerate_prompts"\)/);
  assert.match(route, /await generateProductionReferencePrompts\(\{ projectId, actorId: user\.id, force: true \}\)/);
  assert.match(api, /regenerateProductionReferencePrompts/);
  assert.match(api, /action: "regenerate_prompts"/);
  assert.match(api, /referenceSets: ProductionReferenceSetView\[\]/);
});
