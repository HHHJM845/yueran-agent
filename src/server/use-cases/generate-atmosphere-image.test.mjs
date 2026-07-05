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

test("buildAtmosphereImagePrompt can inherit the client selected Round 1 style for deepening", async () => {
  const { buildAtmosphereImagePrompt } = await import("./generate-atmosphere-image.ts");

  const prompt = buildAtmosphereImagePrompt({
    direction: {
      title: "地铁冲向球场",
      coreIdea: "世界杯倒计时把通勤者变成临场球员。",
      referenceTags: ["足球", "城市"],
      atmospherePrompt: "",
    },
    expansion: {
      title: "车门打开",
      oneLiner: "主角抱球冲出地铁。",
      storyArc: {
        beginning: "电子屏倒计时",
        development: "人群抬头",
        turn: "主角起跑",
        ending: "冲向球场",
      },
      visualStyle: "都市广告片",
      visualHighlights: ["地铁", "倒计时"],
    },
    selectedStyle: {
      styleVariant: "pixar_3d",
      styleLabel: "三维皮克斯风格",
    },
  });

  assert.match(prompt, /甲方在 R1 选择的视觉风格/);
  assert.match(prompt, /三维皮克斯风格/);
});

test("Round 1 style image prompt is direction-level and does not require an expansion", async () => {
  const { buildRound1StyleImagePrompt } = await import("./generate-atmosphere-image.ts");

  const prompt = buildRound1StyleImagePrompt({
    direction: {
      title: "巷弄野球启赛",
      coreIdea: "把街头足球和世界杯开场感融合成第一眼方向判断。",
      referenceTags: ["二维风格", "商业广告"],
      atmospherePrompt: "bright alley football commercial key visual",
    },
    styleVariant: {
      key: "2d",
      label: "二维风格",
      prompt: "二维商业概念插画。",
    },
  });

  assert.match(prompt, /Round 1/);
  assert.match(prompt, /巷弄野球启赛/);
  assert.match(prompt, /二维风格/);
  assert.doesNotMatch(prompt, /故事大纲/);
});

test("Round 1 fixed style prompts separate illustration, 3D animation, and realistic photography", async () => {
  const useCaseSource = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("./generate-atmosphere-image.ts", import.meta.url), "utf8")
  );

  assert.match(useCaseSource, /扁平图形/);
  assert.match(useCaseSource, /动画电影级 3D/);
  assert.match(useCaseSource, /真实商业摄影/);
  assert.match(useCaseSource, /避免摄影写实材质/);
  assert.match(useCaseSource, /不要二维线稿/);
  assert.match(useCaseSource, /真实镜头语言/);
});

test("atmosphere image job schema accepts Round 1 direction style inputs without expansion ids", async () => {
  const { parseAtmosphereImageJobInput } = await import("./generate-atmosphere-image.ts");

  const parsed = parseAtmosphereImageJobInput({
    directionId: "124ce088-e0a5-4b8a-8378-2617d562369c",
    expansionId: null,
    styleVariant: "2d",
    generatedImageId: "581e4227-5667-427a-8c5d-bfc97fd0b671",
  });

  assert.equal(parsed.expansionId, null);
  assert.equal(parsed.styleVariant, "2d");
});

test("worker-managed atmosphere image failures keep generated image records in retrying state before final failure", async () => {
  const useCaseSource = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("./generate-atmosphere-image.ts", import.meta.url), "utf8")
  );
  const repositorySource = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("../repositories/generated-images.ts", import.meta.url), "utf8")
  );

  assert.match(useCaseSource, /markGeneratedImageRetrying/);
  assert.match(useCaseSource, /workerManagedFailure/);
  assert.match(repositorySource, /status = 'retrying'/);
});
