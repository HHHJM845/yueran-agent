import assert from "node:assert/strict";
import test from "node:test";

test("validateCreativeDirectionCount requires exactly four directions", async () => {
  const { validateCreativeDirectionCount } = await import("./creative-proposal-rounds.ts");

  assert.doesNotThrow(() => validateCreativeDirectionCount([1, 2, 3, 4]));
  assert.throws(() => validateCreativeDirectionCount([1, 2, 3]), /exactly 4/);
  assert.throws(() => validateCreativeDirectionCount([1, 2, 3, 4, 5]), /exactly 4/);
});

test("creative proposal rounds use confirmed scene and candidate counts", async () => {
  const {
    getRequiredSceneCountForRound,
    getImageCandidateCountPerScene,
    getRequiredStyleVariantsForRound,
    getMaxSelectedImageCountPerScene,
  } = await import("./creative-proposal-rounds.ts");

  assert.equal(getRequiredSceneCountForRound(1), 0);
  assert.equal(getRequiredSceneCountForRound(2), 4);
  assert.equal(getImageCandidateCountPerScene(), 1);
  assert.deepEqual(getRequiredStyleVariantsForRound(1).map((item) => item.key), ["2d", "pixar_3d", "realistic"]);
  assert.deepEqual(getRequiredStyleVariantsForRound(2), []);
  assert.equal(getMaxSelectedImageCountPerScene(), 2);
});

test("creative proposal round copy keeps Round 1 as a complete proposal package", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("./creative-proposal-rounds.ts", import.meta.url), "utf8");

  assert.match(source, /第一轮提案至少需要选择一个创意方向/);
  assert.match(source, /第二轮提案至少需要保留一个创意方向/);
  assert.match(source, /styleVariants/);
  assert.match(source, /derived_from_direction_style_variant/);
  assert.doesNotMatch(source, /directionOnlyScreening/);
  assert.doesNotMatch(source, /Top 5/);
});

test("Round 2 deepening inherits the client selected style from Round 1 feedback", async () => {
  const { buildRound2StyleSelectionMapForTest, buildSceneConceptInputsForTest } = await import("./creative-proposal-rounds.ts");

  const styleSelections = buildRound2StyleSelectionMapForTest([
    {
      roundNumber: 1,
      clientFeedback: {
        decisionPayload: {
          selectedDirectionStyles: [
            {
              directionId: "direction-1",
              directionTitle: "方向 A",
              styleVariant: "realistic",
              styleLabel: "写实风格",
              selectedImageId: "image-realistic",
              itemId: "concept-realistic",
            },
          ],
        },
      },
    },
  ]);

  const concepts = buildSceneConceptInputsForTest({
    roundNumber: 2,
    directions: [
      {
        id: "direction-1",
        title: "方向 A",
        coreIdea: "城市球场里普通人突然被世界杯气氛点燃。",
        fitReason: "适合大众情绪。",
        riskNotes: "",
        atmospherePrompt: "地铁、球场、真实光影",
      },
    ],
    expansions: [
      {
        id: "expansion-1",
        directionId: "direction-1",
        title: "地铁开场",
        oneLiner: "电子屏亮起，主角握紧足球。",
        storyArc: { beginning: "屏幕倒计时", development: "人群抬头", turn: "主角冲出车厢", ending: "抵达球场" },
        visualStyle: "明亮都市广告片",
        visualHighlights: ["地铁", "电子屏", "足球"],
        riskNotes: "",
        sortOrder: 1,
      },
    ],
    selectedDirectionStyles: styleSelections,
  });

  assert.equal(concepts[0].snapshot.styleVariant, "realistic");
  assert.equal(concepts[0].snapshot.styleLabel, "写实风格");
  assert.match(concepts[0].description, /写实风格/);
  assert.match(concepts[0].imagePrompt, /写实风格/);
});

test("creative proposal round creation enforces Round 1 three style images per selected direction", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("./creative-proposal-rounds.ts", import.meta.url), "utf8");

  assert.match(source, /creative_round_style_images_incomplete/);
  assert.match(source, /二维风格、三维皮克斯风格、写实风格/);
  assert.match(source, /assertCreativeRoundStyleImagesComplete/);
});

test("creative proposal round creation requires Round 1 story outlines before client review", async () => {
  const { assertCreativeRoundStoryOutlinesComplete, buildSceneConceptInputsForTest } = await import("./creative-proposal-rounds.ts");

  const directions = [
    {
      id: "direction-1",
      title: "方向 A",
      coreIdea: "城市球场里普通人突然被世界杯气氛点燃。",
      fitReason: "适合大众情绪。",
      riskNotes: "",
      atmospherePrompt: "地铁、球场、真实光影",
      detail: {},
    },
  ];
  assert.throws(
    () => assertCreativeRoundStoryOutlinesComplete({ directions, expansions: [] }),
    (error) => error?.code === "creative_round_story_outline_required"
  );

  const expansions = [
    {
      id: "expansion-1",
      projectId: "project-1",
      directionId: "direction-1",
      title: "地铁开场",
      oneLiner: "电子屏亮起，主角握紧足球。",
      storyArc: { beginning: "屏幕倒计时", development: "人群抬头", turn: "主角冲出车厢", ending: "抵达球场" },
      visualStyle: "明亮都市广告片",
      visualHighlights: ["地铁", "电子屏", "足球"],
      productionDifficulty: "中",
      riskNotes: "",
      sortOrder: 1,
      sourceJobId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ];

  assert.doesNotThrow(() => assertCreativeRoundStoryOutlinesComplete({ directions, expansions }));
  const concepts = buildSceneConceptInputsForTest({
    roundNumber: 1,
    directions,
    expansions,
  });

  assert.equal(concepts.length, 3);
  assert.match(concepts[0].description, /故事内容/);
  assert.match(concepts[0].sourceText, /屏幕倒计时/);
  assert.match(concepts[0].snapshot.storyContent, /地铁开场/);
});

test("creative proposal round creation requires confirmed Round 2 scripts before final proposal", async () => {
  const { assertRound2DeepeningScriptsConfirmed } = await import("./creative-proposal-rounds.ts");

  const directions = [{ id: "direction-1", title: "方向 A" }];
  assert.throws(
    () =>
      assertRound2DeepeningScriptsConfirmed({
        directions,
        artifacts: [],
      }),
    (error) => error?.code === "creative_round_script_confirmation_required"
  );

  assert.throws(
    () =>
      assertRound2DeepeningScriptsConfirmed({
        directions,
        artifacts: [
          {
            kind: "proposal",
            status: "draft",
            data: { sop3ArtifactType: "round2_deepening_script", directionId: "direction-1", script: "完整剧本" },
          },
        ],
      }),
    (error) => error?.code === "creative_round_script_confirmation_required"
  );

  assert.doesNotThrow(() =>
    assertRound2DeepeningScriptsConfirmed({
      directions,
      artifacts: [
        {
          kind: "proposal",
          status: "confirmed",
          data: { sop3ArtifactType: "round2_deepening_script", directionId: "direction-1", script: "完整剧本" },
        },
      ],
    })
  );
});

test("creative proposal review launch keeps Round 1 selection locked but allows Round 2 retained subsets", async () => {
  const { assertCreativeRoundClientReviewDirectionSnapshot } = await import("./creative-proposal-rounds.ts");

  assert.throws(
    () =>
      assertCreativeRoundClientReviewDirectionSnapshot({
        roundNumber: 1,
        roundDirectionIds: ["direction-1", "direction-2"],
        selectedDirectionIds: ["direction-1"],
        projectDirectionIds: ["direction-1", "direction-2", "direction-3", "direction-4"],
      }),
    (error) => error?.code === "creative_round_selection_changed"
  );

  assert.doesNotThrow(() =>
    assertCreativeRoundClientReviewDirectionSnapshot({
      roundNumber: 2,
      roundDirectionIds: ["direction-1"],
      selectedDirectionIds: ["direction-1", "direction-2", "direction-3"],
      projectDirectionIds: ["direction-1", "direction-2", "direction-3", "direction-4"],
    })
  );

  assert.throws(
    () =>
      assertCreativeRoundClientReviewDirectionSnapshot({
        roundNumber: 2,
        roundDirectionIds: ["direction-missing"],
        selectedDirectionIds: ["direction-1"],
        projectDirectionIds: ["direction-1", "direction-2", "direction-3", "direction-4"],
      }),
    (error) => error?.code === "creative_direction_selection_invalid"
  );
});

test("creative review payload summarizes direction priority by direction while keeping scene notes", async () => {
  const { formatCreativeReviewDecisionPayload } = await import("./client-review.ts");

  const payload = formatCreativeReviewDecisionPayload({
    overallFeedback: "整体更偏明亮、有科技感。",
    items: [
      {
        itemId: "direction-low-scene-1",
        itemLabel: "方向 B - 视觉场景 1",
        decision: "rejected",
        score: 2,
        feedback: "人物情绪太弱。",
        metadata: { directionId: "direction-low", directionTitle: "方向 B", sceneIndex: 1, sortOrder: 2 },
      },
      {
        itemId: "direction-high-scene-1",
        itemLabel: "方向 A - 视觉场景 1",
        decision: "approved",
        score: 5,
        feedback: "保留清透色调。",
        metadata: { directionId: "direction-high", directionTitle: "方向 A", sceneIndex: 1, sortOrder: 1 },
      },
      {
        itemId: "direction-high-scene-2",
        itemLabel: "方向 A - 视觉场景 2",
        decision: "approved",
        score: 4,
        feedback: "第二个场景节奏可以更轻快。",
        metadata: { directionId: "direction-high", directionTitle: "方向 A", sceneIndex: 2, sortOrder: 1 },
      },
    ],
  });

  assert.equal(payload.directionPriority, "方向 A（通过 2/2，平均评分 4.5 分）；方向 B（通过 0/1，平均评分 2 分）");
  assert.deepEqual(payload.retainedDirectionIds, ["direction-high"]);
  assert.equal(
    payload.visualPreferenceNotes,
    "方向 B - 视觉场景 1：人物情绪太弱。；方向 A - 视觉场景 1：保留清透色调。；方向 A - 视觉场景 2：第二个场景节奏可以更轻快。；整体更偏明亮、有科技感。"
  );
});

test("creative Round 1 feedback records one selected style per retained direction", async () => {
  const { formatCreativeReviewDecisionPayload } = await import("./client-review.ts");

  const payload = formatCreativeReviewDecisionPayload({
    overallFeedback: "就按这两个方向继续深化。",
    items: [
      {
        itemId: "direction-a-2d",
        itemLabel: "方向 A - 二维风格",
        decision: "approved",
        feedback: "这个方向用二维最有记忆点。",
        metadata: {
          roundNumber: 1,
          directionId: "direction-a",
          directionTitle: "方向 A",
          styleVariant: "2d",
          styleLabel: "二维风格",
          candidateImages: [{ id: "image-a-2d", imageUrl: "https://oss/a-2d.png" }],
          sortOrder: 1,
        },
      },
      {
        itemId: "direction-a-realistic",
        itemLabel: "方向 A - 写实风格",
        decision: "rejected",
        feedback: "",
        metadata: {
          roundNumber: 1,
          directionId: "direction-a",
          directionTitle: "方向 A",
          styleVariant: "realistic",
          styleLabel: "写实风格",
          candidateImages: [{ id: "image-a-realistic", imageUrl: "https://oss/a-realistic.png" }],
          sortOrder: 1,
        },
      },
      {
        itemId: "direction-b-pixar",
        itemLabel: "方向 B - 三维皮克斯风格",
        decision: "approved",
        feedback: "",
        metadata: {
          roundNumber: 1,
          directionId: "direction-b",
          directionTitle: "方向 B",
          styleVariant: "pixar_3d",
          styleLabel: "三维皮克斯风格",
          candidateImages: [{ id: "image-b-pixar", imageUrl: "https://oss/b-pixar.png" }],
          sortOrder: 2,
        },
      },
    ],
  });

  assert.deepEqual(payload.retainedDirectionIds, ["direction-a", "direction-b"]);
  assert.deepEqual(payload.selectedDirectionStyles, [
    {
      directionId: "direction-a",
      directionTitle: "方向 A",
      styleVariant: "2d",
      styleLabel: "二维风格",
      selectedImageId: "image-a-2d",
      itemId: "direction-a-2d",
    },
    {
      directionId: "direction-b",
      directionTitle: "方向 B",
      styleVariant: "pixar_3d",
      styleLabel: "三维皮克斯风格",
      selectedImageId: "image-b-pixar",
      itemId: "direction-b-pixar",
    },
  ]);
});

test("creative Round 1 feedback rejects multiple approved styles for the same direction", async () => {
  const { formatCreativeReviewDecisionPayload } = await import("./client-review.ts");

  assert.throws(
    () =>
      formatCreativeReviewDecisionPayload({
        items: [
          {
            itemId: "direction-a-2d",
            itemLabel: "方向 A - 二维风格",
            decision: "approved",
            metadata: { roundNumber: 1, directionId: "direction-a", directionTitle: "方向 A", styleVariant: "2d", styleLabel: "二维风格" },
          },
          {
            itemId: "direction-a-realistic",
            itemLabel: "方向 A - 写实风格",
            decision: "approved",
            metadata: { roundNumber: 1, directionId: "direction-a", directionTitle: "方向 A", styleVariant: "realistic", styleLabel: "写实风格" },
          },
        ],
      }),
    (error) => error?.code === "creative_round_direction_style_single_choice_required"
  );
});

test("creative round approval requires at least one retained direction", async () => {
  const { assertCreativeRoundApprovalHasRetainedDirections } = await import("./client-review.ts");

  assert.doesNotThrow(() => assertCreativeRoundApprovalHasRetainedDirections({ decision: "approved", retainedDirectionIds: ["direction-1"] }));
  assert.doesNotThrow(() => assertCreativeRoundApprovalHasRetainedDirections({ decision: "rejected", retainedDirectionIds: [] }));
  assert.throws(
    () => assertCreativeRoundApprovalHasRetainedDirections({ decision: "approved", retainedDirectionIds: [] }),
    (error) => error?.code === "creative_round_retained_direction_required"
  );
});

test("creative proposal client decision persistence stores retained direction ids", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("../repositories/creative-proposals.ts", import.meta.url), "utf8");

  assert.match(source, /retainedDirectionIds\?: string\[\]/);
  assert.match(source, /retained_direction_ids = \$5::jsonb/);
});
