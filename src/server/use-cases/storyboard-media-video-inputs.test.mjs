import assert from "node:assert/strict";
import test from "node:test";

test("validateStoryboardVideoInput enforces image counts by mode", async () => {
  const { validateStoryboardVideoInput } = await import("./storyboard-media.ts");
  assert.doesNotThrow(() => validateStoryboardVideoInput({ mode: "single_image", imageIds: ["img-1"] }));
  assert.doesNotThrow(() => validateStoryboardVideoInput({ mode: "start_end_frame", imageIds: ["img-1", "img-2"] }));
  assert.doesNotThrow(() => validateStoryboardVideoInput({ mode: "multi_reference", imageIds: ["img-1", "img-2", "img-3"] }));
  assert.throws(() => validateStoryboardVideoInput({ mode: "single_image", imageIds: ["img-1", "img-2"] }), /单图生成需要且只需要 1 张图/);
  assert.throws(() => validateStoryboardVideoInput({ mode: "start_end_frame", imageIds: ["img-1"] }), /首尾帧生成需要 2 张图/);
  assert.throws(() => validateStoryboardVideoInput({ mode: "multi_reference", imageIds: [] }), /多图参考生成至少需要 2 张图/);
});

test("legacy storyboard video jobs defer count validation until selected image fallback is resolved", async () => {
  const { resolveStoryboardVideoInputCandidate, validateStoryboardVideoInput } = await import("./storyboard-media.ts");

  const candidate = resolveStoryboardVideoInputCandidate({
    persistedInput: null,
    jobMode: undefined,
    jobImageIds: undefined,
  });

  assert.deepEqual(candidate, {
    mode: "single_image",
    imageIds: [],
    source: "legacy_selected_image",
  });
  assert.throws(
    () => validateStoryboardVideoInput({ mode: candidate.mode, imageIds: candidate.imageIds }),
    /单图生成需要且只需要 1 张图/,
  );
});

test("storyboard video input accepts selected or client-approved storyboard images", async () => {
  const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("./storyboard-media.ts", import.meta.url), "utf8"));
  assert.match(source, /function isStoryboardImageUsableForVideo/);
  assert.match(source, /image\.isSelected \|\| shot\.status === "client_approved" \|\| image\.internalReviewStatus === "confirmed"/);
  assert.match(source, /!isStoryboardImageUsableForVideo\(image, shot\)/);
});

test("confirming storyboard video advances the project to A-copy revision", async () => {
  const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("./storyboard-media.ts", import.meta.url), "utf8"));
  assert.match(source, /stageKey: "ai_video_canvas"/);
  assert.match(source, /status: "completed"/);
  assert.match(source, /currentStage: "a_copy_revision"/);
  assert.doesNotMatch(source, /视频候选已内部确认/);
  assert.doesNotMatch(source, /正式内部资产/);
});

test("storyboard video generation persists selected duration and passes it to provider", async () => {
  const mediaSource = await import("node:fs/promises").then((fs) => fs.readFile(new URL("./storyboard-media.ts", import.meta.url), "utf8"));
  assert.match(mediaSource, /durationSeconds\?: number/);
  assert.match(mediaSource, /durationSeconds: input\.durationSeconds/);
  assert.match(mediaSource, /durationSeconds: input\.durationSeconds/);
  assert.match(mediaSource, /durationSeconds: input\.durationSeconds/);
  assert.match(mediaSource, /durationSeconds: input\.durationSeconds/);
  assert.match(mediaSource, /persistedInput\?\.metadata\.durationSeconds/);
  assert.match(mediaSource, /const durationSeconds = input\.durationSeconds \?\? persistedDurationSeconds \?\? 5/);

  const providerSource = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../providers/ark-video.ts", import.meta.url), "utf8"));
  assert.match(providerSource, /durationSeconds\?: number/);
  assert.match(providerSource, /duration: input\.durationSeconds \?\? 5/);
});

test("storyboard video zip download builds a server-side archive from selected videos", async () => {
  const mediaSource = await import("node:fs/promises").then((fs) => fs.readFile(new URL("./storyboard-media.ts", import.meta.url), "utf8"));
  assert.match(mediaSource, /export async function createStoryboardVideoZipDownload/);
  assert.match(mediaSource, /videoIds: string\[\]/);
  assert.match(mediaSource, /downloadOssObject/);
  assert.match(mediaSource, /createStoredZip/);
  assert.match(mediaSource, /视频素材 ZIP/);
});
