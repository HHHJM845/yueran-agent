import assert from "node:assert/strict";
import test from "node:test";

test("Round 2 deepening jobs preserve outline, script, confirmation, and storyboard split operations", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("./generate-creative-expansions.ts", import.meta.url), "utf8");

  assert.match(source, /round2_outline/);
  assert.match(source, /round2_script/);
  assert.match(source, /round2_split_storyboard/);
  assert.match(source, /round2_deepening_outline/);
  assert.match(source, /round2_deepening_script/);
  assert.match(source, /round2_deepening_storyboard_split/);
  assert.match(source, /confirmRound2DeepeningScript/);
  assert.match(source, /scriptArtifact\.status !== "confirmed"/);
  assert.match(source, /请先确认完整故事/);
  assert.match(source, /700-800 字完整故事/);
});

test("findLatestRound2Artifact only reads matching Round 2 artifacts for the retained direction", async () => {
  const { findLatestRound2Artifact, readArtifactString } = await import("./generate-creative-expansions.ts");

  const artifacts = [
    {
      id: "ignored-asset",
      kind: "asset",
      status: "confirmed",
      data: {
        sop3ArtifactType: "round2_deepening_script",
        directionId: "direction-1",
        script: "不应被读取",
      },
    },
    {
      id: "wrong-direction",
      kind: "proposal",
      status: "confirmed",
      data: {
        sop3ArtifactType: "round2_deepening_script",
        directionId: "direction-2",
        script: "另一个方向的完整故事",
      },
    },
    {
      id: "script-latest",
      kind: "proposal",
      status: "confirmed",
      data: {
        sop3ArtifactType: "round2_deepening_script",
        directionId: "direction-1",
        script: "  最新完整故事  ",
      },
    },
    {
      id: "script-older",
      kind: "proposal",
      status: "draft",
      data: {
        sop3ArtifactType: "round2_deepening_script",
        directionId: "direction-1",
        script: "旧完整故事",
      },
    },
  ];

  const matched = findLatestRound2Artifact(artifacts, "direction-1", "round2_deepening_script");

  assert.equal(matched?.id, "script-latest");
  assert.equal(readArtifactString(matched, "script"), "最新完整故事");
  assert.equal(findLatestRound2Artifact(artifacts, "direction-1", "round2_deepening_storyboard_split"), null);
});

test("parseCreativeExpansionResponse accepts storyboard scene aliases from the model", async () => {
  const { parseCreativeExpansionResponse } = await import("./generate-creative-expansions.ts");

  const parsed = parseCreativeExpansionResponse({
    scenes: [
      {
        sceneTitle: "光带从写字楼落下",
        sceneDescription: "金棕色冷萃光带从玻璃幕墙滑落，串起第一个深夜工作者。",
        keyVisuals: ["玻璃幕墙", "冷萃光带"],
        style: "写实商业广告",
      },
      {
        shotTitle: "老巷里的合同桌",
        visualDescription: "光带飘进老巷共享办公区，落在摊开的合同和冷萃瓶身上。",
        visualElements: ["老巷", "合同", "冷萃瓶"],
      },
      {
        title: "出租屋设计稿",
        summary: "自由设计师抬头看到光带绕过数位板，屏幕色调突然变得清晰。",
        visuals: ["数位板", "桌角冷萃"],
      },
      {
        name: "便利店休整",
        description: "护士在便利店冷柜旁喝下冷萃，城市四角的光带闭合成圆。",
        highlights: ["便利店冷柜", "闭合光圈"],
      },
    ],
  });

  assert.equal(parsed.expansions.length, 4);
  assert.equal(parsed.expansions[0].title, "光带从写字楼落下");
  assert.equal(parsed.expansions[1].oneLiner, "光带飘进老巷共享办公区，落在摊开的合同和冷萃瓶身上。");
  assert.deepEqual(parsed.expansions[2].visualHighlights, ["数位板", "桌角冷萃"]);
  assert.equal(parsed.expansions[3].storyArc.beginning, "护士在便利店冷柜旁喝下冷萃，城市四角的光带闭合成圆。");
});

test("parseCreativeExpansionResponse accepts a direct array response", async () => {
  const { parseCreativeExpansionResponse } = await import("./generate-creative-expansions.ts");

  const parsed = parseCreativeExpansionResponse([
    {
      title: "场景一",
      description: "第一段画面",
      beginning: "人物疲惫",
      development: "冷萃出现",
    },
  ]);

  assert.equal(parsed.expansions.length, 1);
  assert.equal(parsed.expansions[0].title, "场景一");
  assert.equal(parsed.expansions[0].storyArc.beginning, "人物疲惫");
  assert.equal(parsed.expansions[0].storyArc.development, "冷萃出现");
});

test("parseCreativeExpansionResponse unwraps nested storyboard scene payloads", async () => {
  const { parseCreativeExpansionResponse } = await import("./generate-creative-expansions.ts");

  const parsed = parseCreativeExpansionResponse({
    result: {
      storyboard_scenes: [
        { scene_title: "场景一", scene_description: "写字楼玻璃幕墙出现冷萃光带。" },
        { scene_title: "场景二", scene_description: "老巷共享办公区被光带点亮。" },
        { scene_title: "场景三", scene_description: "出租屋桌面上的设计稿被光带掠过。" },
        { scene_title: "场景四", scene_description: "便利店冷柜前四条光带汇合。" },
      ],
    },
  });

  assert.equal(parsed.expansions.length, 4);
  assert.equal(parsed.expansions[0].title, "场景一");
  assert.equal(parsed.expansions[3].oneLiner, "便利店冷柜前四条光带汇合。");
});

test("parseCreativeExpansionResponse accepts Chinese visual scene field names", async () => {
  const { parseCreativeExpansionResponse } = await import("./generate-creative-expansions.ts");

  const parsed = parseCreativeExpansionResponse({
    "精彩场景": [
      {
        "场景标题": "城市四角同步抬头",
        "画面描述": "四位夜航者在不同夜景中同时被金棕色光带吸引。",
        "视觉亮点": ["分屏构图", "金棕色光带"],
        "开端": "疲惫的深夜工作者低头忙碌",
      },
    ],
  });

  assert.equal(parsed.expansions.length, 1);
  assert.equal(parsed.expansions[0].title, "城市四角同步抬头");
  assert.equal(parsed.expansions[0].storyArc.beginning, "疲惫的深夜工作者低头忙碌");
  assert.deepEqual(parsed.expansions[0].visualHighlights, ["分屏构图", "金棕色光带"]);
});

test("parseCreativeExpansionResponse does not mistake visual highlight arrays for scenes", async () => {
  const { parseCreativeExpansionResponse } = await import("./generate-creative-expansions.ts");

  const parsed = parseCreativeExpansionResponse({
    result: {
      scenes: [
        {
          title: "四人同时触碰冷萃",
          description: "四位夜航者在城市不同角落同时伸手触碰手边冷萃。",
          visualHighlights: ["四格构图", "不同色温", "冷萃瓶身"],
        },
      ],
    },
  });

  assert.equal(parsed.expansions.length, 1);
  assert.equal(parsed.expansions[0].title, "四人同时触碰冷萃");
  assert.deepEqual(parsed.expansions[0].visualHighlights, ["四格构图", "不同色温", "冷萃瓶身"]);
});

test("Round 2 scene selection falls back from one combined scene to four usable scenes", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("./generate-creative-expansions.ts", import.meta.url), "utf8");

  assert.match(source, /buildFallbackRound2StoryboardScenes/);
  assert.match(source, /visualHighlights/);
  assert.match(source, /splitTextIntoFourParts/);
  assert.match(source, /不要把 4 个画面写成 visualHighlights 数组/);
});
