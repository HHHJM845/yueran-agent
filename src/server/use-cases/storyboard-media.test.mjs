import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("storyboard image generation uses Ark Seedream with locked setting images as references", async () => {
  const source = await readFile(new URL("./storyboard-media.ts", import.meta.url), "utf8");
  const provider = await readFile(new URL("../providers/ark-image.ts", import.meta.url), "utf8");

  // Switched off the text-only OpenAI path onto Ark Seedream.
  assert.match(source, /generateArkSeedreamImage/);
  assert.doesNotMatch(source, /generateOpenAIImage/);
  assert.match(source, /env\.ARK_IMAGE_GENERATION_MODEL/);

  // Resolves the shot's locked setting images; missing ones are surfaced but never block generation.
  assert.match(source, /resolveShotReferenceImages\(\{ projectId: input\.projectId, shotId: shot\.id \}\)/);
  assert.doesNotMatch(source, /storyboard_reference_image_missing/);
  assert.match(source, /missingReferenceNames/);

  // Reference images are passed by presigned OSS URL, not bytes.
  assert.match(source, /createReadUrlFromOssUrl\(reference\.ossUrl/);
  assert.match(source, /referenceImageUrls,/);

  // The provider sends references in the JSON `image` array.
  assert.match(provider, /body\.image = referenceImageUrls/);
  assert.match(provider, /\/images\/generations/);
  assert.match(provider, /response_format: "url"/);
});

test("storyboard image prompt describes each reference image role instead of stringifying refs", async () => {
  const source = await readFile(new URL("./storyboard-media.ts", import.meta.url), "utf8");

  assert.match(source, /buildReferenceInstruction/);
  assert.match(source, /严格保持其外观、服饰、材质与空间特征一致/);
  // The old JSON.stringify(refs) consistency hack is gone.
  assert.doesNotMatch(source, /JSON\.stringify\(shot\.characterRefs\)/);
  assert.doesNotMatch(source, /JSON\.stringify\(shot\.sceneRefs\)/);
});
