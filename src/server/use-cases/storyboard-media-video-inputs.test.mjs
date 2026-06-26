import assert from "node:assert/strict";
import test from "node:test";

test("validateStoryboardVideoInput enforces image counts by mode", async () => {
  const { validateStoryboardVideoInput } = await import("./storyboard-media.ts");
  assert.doesNotThrow(() => validateStoryboardVideoInput({ mode: "single_image", imageIds: ["img-1"] }));
  assert.doesNotThrow(() => validateStoryboardVideoInput({ mode: "start_end_frame", imageIds: ["img-1", "img-2"] }));
  assert.doesNotThrow(() => validateStoryboardVideoInput({ mode: "multi_reference", imageIds: ["img-1", "img-2", "img-3"] }));
  assert.throws(() => validateStoryboardVideoInput({ mode: "single_image", imageIds: ["img-1", "img-2"] }), /单图生成需要且只需要 1 张图/);
  assert.throws(() => validateStoryboardVideoInput({ mode: "start_end_frame", imageIds: ["img-1"] }), /首尾帧生成需要 2 张图/);
});
