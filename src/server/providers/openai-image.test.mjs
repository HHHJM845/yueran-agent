import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./openai-image.ts", import.meta.url), "utf8");

test("OpenAI image timeout handling includes connection timeout errors", () => {
  assert.match(source, /APIConnectionTimeoutError/);
  assert.match(source, /openai_image_timeout/);
});
