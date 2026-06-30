import assert from "node:assert/strict";
import test from "node:test";

test("storyboard split normalization accepts standard script scene labels", async () => {
  const { normalizeStoryboardSplitResponse } = await import("./script-storyboard-normalization.ts");

  const normalized = normalizeStoryboardSplitResponse({
    scenes: [
      {
        sceneNumber: "1-1",
        title: "城市地铁",
        description: "阿辰赶往球场。",
        shots: [
          {
            shotNumber: "1-1-1",
            visualDescription: "阿辰抱着足球冲进地铁。",
            characterRefs: ["阿辰"],
            sceneRefs: ["城市地铁"],
          },
        ],
      },
      {
        sceneNumber: "第 1-2 场",
        title: "校园球场",
        shots: [
          {
            镜号: "1-2-1",
            画面描述: "小雨完成射门。",
            涉及人物: ["小雨"],
            涉及场景: ["校园球场"],
          },
        ],
      },
    ],
  });

  assert.deepEqual(
    normalized.scenes.map((scene) => scene.sceneNumber),
    [1, 2]
  );
  assert.equal(normalized.scenes[0].shots[0].shotNumber, "1-1-1");
  assert.equal(normalized.scenes[1].shots[0].visualDescription, "小雨完成射门。");
});
