import test from "node:test";
import assert from "node:assert/strict";

test("buildAtmosphereImagePrompt includes expansion story and direction context", async () => {
  const { buildAtmosphereImagePrompt } = await import("./generate-atmosphere-image.ts");

  const prompt = buildAtmosphereImagePrompt({
    direction: {
      title: "绿茵高速传切",
      coreIdea: "用高速传切呈现品牌速度感",
      referenceTags: ["写实", "足球", "动感"],
      atmospherePrompt: "cinematic football commercial mood",
    },
    expansion: {
      title: "雨战湿滑传切链",
      oneLiner: "雨夜球场里鞋底抓地与传切形成连续节奏。",
      storyArc: {
        beginning: "雨幕落下",
        development: "球员快速传切",
        turn: "防线被撕开",
        ending: "射门定格",
      },
      visualStyle: "写实广告片质感",
      visualHighlights: ["雨水飞溅", "草皮反光"],
    },
  });

  assert.match(prompt, /绿茵高速传切/);
  assert.match(prompt, /雨战湿滑传切链/);
  assert.match(prompt, /雨水飞溅/);
  assert.match(prompt, /不要出现文字/);
});
