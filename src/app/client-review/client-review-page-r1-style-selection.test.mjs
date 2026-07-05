import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./[token]/page.tsx", import.meta.url), "utf8");

function componentSource(name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  const next = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

test("Round 1 creative review uses direction multi-select with one style radio per direction", () => {
  const page = componentSource("ClientReviewPage");
  const selector = componentSource("CreativeRound1DirectionStyleSelector");

  assert.match(page, /isCreativeRound1Review/);
  assert.match(page, /round1StyleSelection=\{isCreativeRound1Review\}/);
  assert.match(selector, /type="radio"/);
  assert.match(selector, /选择这个风格/);
  assert.match(selector, /readCreativeRound1StoryOutline\(group\.items\)/);
  assert.match(selector, /故事大纲/);
  assert.match(selector, /至少选择一个方向后即可提交进入深化/);
  assert.match(source, /computeCreativeRound1Decision/);
  assert.doesNotMatch(selector, /<select/);
});

test("Round 1 creative review reads the bundled story outline from item metadata", () => {
  assert.match(source, /function readCreativeRound1StoryOutline/);
  assert.match(source, /readMetadataString\(item\.metadata, "storyContent"\)/);
  assert.match(source, /readMetadataString\(item\.metadata, "previewText"\)/);
});
