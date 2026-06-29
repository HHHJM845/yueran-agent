import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("production reference image generation is wired to jobs and reference sets", async () => {
  const useCase = await readFile(new URL("./production-reference-images.ts", import.meta.url), "utf8").catch(() => "");
  const types = await readFile(new URL("../../domain/types.ts", import.meta.url), "utf8");
  const handlers = await readFile(new URL("../workers/handlers.ts", import.meta.url), "utf8");

  assert.match(types, /production_reference_image_generation/);
  assert.match(handlers, /runProductionReferenceImageGenerationJob/);
  assert.match(useCase, /enqueueProductionReferenceImages/);
  assert.match(useCase, /runProductionReferenceImageGenerationJob/);
  assert.match(useCase, /createGeneratedImage/);
  assert.match(useCase, /upsertReferenceSet/);
  assert.match(useCase, /generatingReference/);
  assert.match(useCase, /referenceSetId: generatingReference\.id/);
  assert.match(useCase, /appendProductionReferenceImage/);
});

test("production reference image generation uses current prompt count and ratio", async () => {
  const useCase = await readFile(new URL("./production-reference-images.ts", import.meta.url), "utf8");
  const route = await readFile(new URL("../../app/api/projects/[projectId]/production-entities/reference-images/route.ts", import.meta.url), "utf8");

  assert.match(route, /count: z\.coerce\.number\(\)\.int\(\)\.min\(1\)\.max\(8\)/);
  assert.match(route, /ratio: z\.enum\(\["1:1", "3:4", "4:3", "16:9", "9:16"\]\)/);
  assert.match(route, /prompt: z\.string\(\)\.trim\(\)\.min\(1/);
  assert.match(useCase, /ratioToOpenAIImageSize/);
  assert.match(useCase, /currentPrompt/);
  assert.match(useCase, /lastGenerationCount/);
  assert.match(useCase, /Number\.isInteger\(input\.count\)/);
  assert.match(useCase, /input\.count < 1 \|\| input\.count > 8/);
  assert.match(useCase, /production_reference_count_invalid/);
  assert.match(useCase, /请一次生成 1 到 8 张设定图/);
  assert.match(useCase, /metadata: \{[\s\S]*purpose: "production_reference"/);
  assert.match(useCase, /prompt: input\.prompt/);
  assert.match(useCase, /size: input\.size/);
  assert.doesNotMatch(useCase, /function buildProductionReferencePrompt/);
});
