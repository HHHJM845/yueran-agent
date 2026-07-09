import assert from "node:assert/strict";
import test from "node:test";

process.env.ALIYUN_OSS_REGION ??= "oss-cn-test";
process.env.ALIYUN_OSS_ENDPOINT ??= "https://oss-cn-test.aliyuncs.com";
process.env.ALIYUN_OSS_BUCKET ??= "yueran-test";
process.env.ALIYUN_OSS_ACCESS_KEY_ID ??= "test-access-key";
process.env.ALIYUN_OSS_ACCESS_KEY_SECRET ??= "test-secret";

test("normalizes generic review metadata for SOP scenes", async () => {
  const { normalizeClientReviewMetadata } = await import("./client-review.ts");

  assert.deepEqual(
    normalizeClientReviewMetadata({
      reviewType: "project_proposal",
      sopKey: "sop_3",
      reviewScene: "creative_round_1",
      roundNumber: 1,
      batchNumber: null,
      payloadVersion: 2,
    }),
    {
      sopKey: "sop_3",
      reviewScene: "creative_round_1",
      roundNumber: 1,
      batchNumber: null,
      payloadVersion: 2,
    }
  );
});

test("rejects invalid reviewScene values at the use-case schema boundary", async () => {
  const { createClientReviewInputSchema } = await import("./client-review.ts");

  assert.throws(
    () =>
      createClientReviewInputSchema.parse({
        reviewType: "project_proposal",
        reviewScene: "totally_not_real",
      }),
    /Invalid option/
  );
});

test("builds explicit client review task metadata for repository input", async () => {
  const { buildClientReviewTaskMetadataInput } = await import("./client-review.ts");

  assert.deepEqual(
    buildClientReviewTaskMetadataInput({
      reviewType: "project_proposal",
      sopKey: "sop_3",
      reviewScene: "creative_round_1",
      roundNumber: 2,
      batchNumber: 3,
      payloadVersion: 4,
    }),
    {
      sopKey: "sop_3",
      reviewScene: "creative_round_1",
      roundNumber: 2,
      batchNumber: 3,
      reviewPayloadVersion: 4,
    }
  );
});

test("builds default client review task metadata when optional values are omitted", async () => {
  const { buildClientReviewTaskMetadataInput } = await import("./client-review.ts");

  assert.deepEqual(
    buildClientReviewTaskMetadataInput({
      reviewType: "project_proposal",
    }),
    {
      sopKey: null,
      reviewScene: null,
      roundNumber: null,
      batchNumber: null,
      reviewPayloadVersion: 1,
    }
  );
});

test("client review links require server-side key unlock before exposing payload", async () => {
  const { readFileSync } = await import("node:fs");
  const useCaseSource = readFileSync(new URL("./client-review.ts", import.meta.url), "utf8");
  const routeSource = readFileSync(new URL("../../app/api/client-review/[token]/route.ts", import.meta.url), "utf8");
  const unlockRouteSource = readFileSync(new URL("../../app/api/client-review/[token]/unlock/route.ts", import.meta.url), "utf8");
  const versionRouteSource = readFileSync(new URL("../../app/api/client-review/[token]/versions/[taskId]/route.ts", import.meta.url), "utf8");

  assert.match(routeSource, /loadClientReviewUnlockPrompt/);
  assert.doesNotMatch(routeSource, /loadClientReviewByToken/);
  assert.match(unlockRouteSource, /unlockClientReviewByToken/);
  assert.match(versionRouteSource, /loadClientReviewVersionByToken/);
  assert.match(versionRouteSource, /x-client-review-code/);
  assert.match(useCaseSource, /getClientReviewSecretByTaskId/);
  assert.match(useCaseSource, /hashSecretWithSalt/);
  assert.match(useCaseSource, /timingSafeEqual/);
  assert.match(useCaseSource, /assertClientReviewVerificationCode\(baseTask\.id/);
  assert.match(useCaseSource, /loadClientReviewContent\(baseTask\)/);
  assert.match(useCaseSource, /task\.projectId !== baseTask\.projectId/);
});

test("new client review links include the verification code hash fragment", async () => {
  const { buildReviewUrlWithVerificationCode } = await import("./client-review.ts");
  const { readFileSync } = await import("node:fs");
  const useCaseSource = readFileSync(new URL("./client-review.ts", import.meta.url), "utf8");

  assert.equal(
    buildReviewUrlWithVerificationCode("http://localhost:3000", "review-token", "AB CD"),
    "http://localhost:3000/client-review/review-token#key=AB%20CD"
  );
  assert.match(useCaseSource, /reviewUrl: buildReviewUrlWithVerificationCode\(input\.origin, credentials\.token, credentials\.code\)/);
  assert.doesNotMatch(useCaseSource, /reviewUrl: `\$\{getLocalReviewOrigin\(input\.origin\)\}\/client-review\/\$\{credentials\.token\}`/);
});

test("creating a new client review version expires older active tasks in the same series", async () => {
  const { readFileSync } = await import("node:fs");
  const repositorySource = readFileSync(new URL("../repositories/client-reviews.ts", import.meta.url), "utf8");
  const useCaseSource = readFileSync(new URL("./client-review.ts", import.meta.url), "utf8");

  assert.match(repositorySource, /export async function expirePriorActiveClientReviews/);
  assert.match(repositorySource, /status = 'expired'/);
  assert.match(repositorySource, /status = 'active'/);
  assert.match(repositorySource, /id <> \$4/);
  assert.match(repositorySource, /target_scope_id = \$3/);
  assert.match(useCaseSource, /expirePriorActiveClientReviews\(\{/);
  assert.match(useCaseSource, /exceptTaskId: review\.task\.id/);
});

test("client review archive groups nodes in business order and keeps all non-draft versions", async () => {
  const { resolveReviewNode, isTextReviewNode, shouldIncludeReviewTaskInArchive } = await import("./client-review.ts");
  const { readFileSync } = await import("node:fs");
  const useCaseSource = readFileSync(new URL("./client-review.ts", import.meta.url), "utf8");

  const nodeCases = [
    [{ reviewType: "brief_confirmation" }, { nodeKey: "brief_confirmation", nodeLabel: "Brief 确认", order: 1 }],
    [{ reviewType: "project_proposal", reviewScene: "creative_round_1" }, { nodeKey: "creative_round_1", nodeLabel: "创意提案 Round 1", order: 2 }],
    [{ reviewType: "project_proposal", reviewScene: "creative_round_2" }, { nodeKey: "creative_round_2", nodeLabel: "创意提案 Round 2", order: 3 }],
    [{ reviewType: "quote_confirmation" }, { nodeKey: "quote_confirmation", nodeLabel: "报价确认", order: 4 }],
    [{ reviewType: "contract_confirmation" }, { nodeKey: "contract_confirmation", nodeLabel: "合同确认", order: 5 }],
    [{ reviewType: "script_package", reviewScene: null }, { nodeKey: "script_package", nodeLabel: "完整剧本确认", order: 6 }],
    [{ reviewType: "script_package", reviewScene: "production_setup" }, { nodeKey: "production_setup", nodeLabel: "人物/场景设定", order: 7 }],
    [{ reviewType: "storyboard_image_batch" }, { nodeKey: "storyboard_image_batch", nodeLabel: "分镜图片审核", order: 8 }],
    [{ reviewType: "a_copy_review" }, { nodeKey: "a_copy_review", nodeLabel: "A copy 审核", order: 9 }],
    [{ reviewType: "b_copy_review" }, { nodeKey: "b_copy_review", nodeLabel: "B copy 定稿", order: 10 }],
  ];

  for (const [input, expected] of nodeCases) {
    assert.deepEqual(resolveReviewNode(input), expected);
  }

  assert.equal(isTextReviewNode({ reviewType: "brief_confirmation" }), true);
  assert.equal(isTextReviewNode({ reviewType: "quote_confirmation" }), true);
  assert.equal(isTextReviewNode({ reviewType: "contract_confirmation" }), true);
  assert.equal(isTextReviewNode({ reviewType: "script_package", reviewScene: null }), true);
  assert.equal(isTextReviewNode({ reviewType: "script_package", reviewScene: "production_setup" }), false);
  assert.equal(isTextReviewNode({ reviewType: "storyboard_image_batch" }), false);

  assert.equal(shouldIncludeReviewTaskInArchive({ status: "draft" }), false);
  assert.equal(shouldIncludeReviewTaskInArchive({ status: "active" }), true);
  assert.equal(shouldIncludeReviewTaskInArchive({ status: "expired" }), true);
  assert.equal(shouldIncludeReviewTaskInArchive({ status: "revoked" }), true);

  assert.match(useCaseSource, /archive: await buildClientReviewArchive\(task\)/);
  assert.match(useCaseSource, /items\?: ExternalReviewItem\[\]/);
  assert.match(useCaseSource, /isTextNode/);
  assert.doesNotMatch(useCaseSource, /isExternallyVisibleReviewTask\(task\)[\s\S]*revoked/);
});

test("non-text client review archive versions hydrate from frozen item metadata", async () => {
  const { hydrateFrozenReviewItems } = await import("./client-review.ts");
  const { readFileSync } = await import("node:fs");
  const useCaseSource = readFileSync(new URL("./client-review.ts", import.meta.url), "utf8");
  const frozenHydrateSource = useCaseSource.slice(
    useCaseSource.indexOf("export function hydrateFrozenReviewItems"),
    useCaseSource.indexOf("async function hydrateClientReviewItems"),
  );

  const frozenItems = hydrateFrozenReviewItems(
    {
      id: "task-old",
      projectId: "project-1",
      reviewType: "project_proposal",
      reviewScene: "creative_round_1",
      targetScopeType: "proposal",
      targetScopeId: "round-1",
    },
    [
      {
        id: "item-1",
        reviewTaskId: "task-old",
        projectId: "project-1",
        itemType: "proposal",
        itemId: "concept-1",
        itemLabel: "旧版故事场景",
        decision: "pending",
        score: null,
        feedback: "",
        metadata: {
          candidateImages: [
            {
              id: "old-image",
              ossUrl: "https://yueran-test.oss-cn-test.aliyuncs.com/projects/project-1/generated-images/old-image/atmosphere.png",
              imageUrl: "https://expired.example.com/signed-newer-image.png",
              prompt: "旧版画面",
              status: "succeeded",
              sortOrder: 1,
            },
          ],
        },
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "item-2",
        reviewTaskId: "task-old",
        projectId: "project-1",
        itemType: "storyboard_shot_image",
        itemId: "shot-1",
        itemLabel: "1-1-1",
        decision: "pending",
        score: null,
        feedback: "",
        metadata: {
          imageUrl: "https://yueran-test.oss-cn-test.aliyuncs.com/projects/project-1/storyboard-images/shot-1.png",
        },
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "item-3",
        reviewTaskId: "task-old",
        projectId: "project-1",
        itemType: "review_cut_video",
        itemId: "cut-1",
        itemLabel: "A copy v1",
        decision: "pending",
        score: null,
        feedback: "",
        metadata: {
          videoUrl: "https://yueran-test.oss-cn-test.aliyuncs.com/projects/project-1/review-cuts/a-copy-v1.mp4",
        },
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  );

  const candidate = frozenItems[0].metadata.candidateImages[0];
  assert.equal(candidate.ossUrl, "https://yueran-test.oss-cn-test.aliyuncs.com/projects/project-1/generated-images/old-image/atmosphere.png");
  assert.match(candidate.imageUrl, /OSSAccessKeyId=test-access-key/);
  assert.match(candidate.imageUrl, /generated-images\/old-image\/atmosphere\.png/);
  assert.doesNotMatch(candidate.imageUrl, /signed-newer-image/);
  assert.match(String(frozenItems[1].metadata.imageUrl), /storyboard-images\/shot-1\.png/);
  assert.match(String(frozenItems[2].metadata.videoUrl), /review-cuts\/a-copy-v1\.mp4/);
  assert.match(useCaseSource, /function summarizeClientReviewItemMetadata[\s\S]*"ossUrl"/);
  assert.doesNotMatch(frozenHydrateSource, /buildProjectCreativeReviewImageSource|getCreativeProposalRound|freshImages/);
});

test("brief confirmation approval auto-generates risk check after client approval", async () => {
  const { readFileSync } = await import("node:fs");
  const useCaseSource = readFileSync(new URL("./client-review.ts", import.meta.url), "utf8");

  assert.match(useCaseSource, /generateRiskCheckAfterBriefApproval/);
  assert.match(useCaseSource, /generateRiskCheckFromProject/);
  assert.match(useCaseSource, /input\.reviewType === "brief_confirmation" && approved/);
  assert.match(useCaseSource, /risk_check_auto_generation_failed/);
  assert.match(useCaseSource, /接单风险评估已自动生成/);
});

test("script package client review only requires non-empty standardized script", async () => {
  const { assertScriptPackageReviewReady } = await import("./client-review.ts");

  assert.doesNotThrow(() =>
    assertScriptPackageReviewReady({
      standardizedScript: "《示例片》\n第一场：办公室 / 日 / 内\n画面：产品亮相。",
    })
  );

  assert.throws(
    () => assertScriptPackageReviewReady({ standardizedScript: "   " }),
    (error) =>
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "script_package_standardized_script_required" &&
      "userMessage" in error &&
      /请先生成标准剧本/.test(String(error.userMessage))
  );
});

test("production setup client review excludes ignored entities from external payload", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("./client-review.ts", import.meta.url), "utf8");

  const productionSetupBranch = source.match(/if \(input\.reviewType === "script_package" && input\.reviewScene === "production_setup"\) \{[\s\S]*?\n  \}/)?.[0] ?? "";
  assert.match(productionSetupBranch, /const activeEntities = entities\.filter\(\(entity\) => entity\.inclusionStatus !== "ignored"\)/);
  assert.match(productionSetupBranch, /const activeEntityIds = new Set\(activeEntities\.map\(\(entity\) => entity\.id\)\)/);
  assert.match(productionSetupBranch, /const activeReferenceSets = referenceSets\.filter\(\(set\) => activeEntityIds\.has\(set\.entityId\)\)/);
  assert.match(productionSetupBranch, /payload: \{ project, productionEntities: activeEntities, productionReferenceSets: activeReferenceSets \}/);
  assert.match(productionSetupBranch, /items: activeEntities\.map\(\(entity\) =>/);
  assert.match(productionSetupBranch, /targetScopeId = input\.targetScopeId && activeEntityIds\.has\(input\.targetScopeId\) \? input\.targetScopeId : activeEntities\[0\]\.id/);
  assert.doesNotMatch(productionSetupBranch, /items: entities\.map/);

  const hydrateSource = source.match(/async function hydrateClientReviewItems[\s\S]*?const round = await getCreativeProposalRound/)?.[0] ?? "";
  assert.match(hydrateSource, /task\.reviewType === "script_package" && task\.reviewScene === "production_setup"/);
  assert.match(hydrateSource, /const activeEntityIds = new Set\(entities\.filter\(\(entity\) => entity\.inclusionStatus !== "ignored"\)\.map\(\(entity\) => entity\.id\)\)/);
  assert.match(hydrateSource, /return items\.filter\(\(item\) => activeEntityIds\.has\(item\.itemId\)\)/);
});

test("creative Round 1 review items are scene concepts with candidate images", async () => {
  const { buildCreativeProposalReviewItems } = await import("./client-review.ts");

  const items = buildCreativeProposalReviewItems({
    round: {
      id: "round-1",
      roundNumber: 1,
      directionIds: ["direction-2", "direction-1"],
      concepts: [
        {
          id: "concept-1",
          title: "故事卡 1",
          directionId: "direction-1",
          sceneIndex: 1,
          requiredImageCount: 1,
          description: "用轻盈画面表达产品效率。",
          sourceText: "故事内容：主角进入办公室，产品让工作流变轻。",
          imagePrompt: "清透科技感办公室",
          snapshot: { directionTitle: "清透科技", storyContent: "主角进入办公室，产品让工作流变轻。" },
          images: [
            {
              id: "scene-image-1",
              ossUrl: null,
              prompt: "清透科技感办公室",
              status: "generated",
              isSelected: true,
              sortOrder: 1,
            },
          ],
        },
      ],
    },
    directions: [
      {
        id: "direction-1",
        title: "清透科技",
        coreIdea: "用轻盈画面表达产品效率。",
        fitReason: "匹配客户想要的清爽感。",
        riskNotes: "需要避免过度抽象。",
        sortOrder: 1,
      },
      {
        id: "direction-2",
        title: "真实生活",
        coreIdea: "用真实办公场景建立信任。",
        fitReason: "适合 B 端客户决策链路。",
        riskNotes: "",
        sortOrder: 2,
      },
    ],
    generatedImages: [],
    expansions: [],
  });

  assert.deepEqual(items.map((item) => item.itemId), ["concept-1"]);
  assert.equal(items[0].itemLabel, "故事卡 1");
  assert.equal(items[0].metadata.directionId, "direction-1");
  assert.equal(items[0].metadata.roundNumber, 1);
  assert.equal(items[0].metadata.sceneIndex, 1);
  assert.deepEqual(items[0].metadata.candidateImages, []);
  assert.match(items[0].metadata.storyContent, /工作流变轻/);
  assert.match(items[0].metadata.previewText, /轻盈画面/);
  assert.match(items[0].metadata.previewText, /主角进入办公室/);
});

test("creative Round 1 review items recover story content from existing outlines for older proposal snapshots", async () => {
  const { buildCreativeProposalReviewItems } = await import("./client-review.ts");

  const items = buildCreativeProposalReviewItems({
    round: {
      id: "round-1",
      roundNumber: 1,
      directionIds: ["direction-1"],
      concepts: [
        {
          id: "concept-1",
          title: "清透科技 - 写实风格",
          directionId: "direction-1",
          sceneIndex: 1,
          requiredImageCount: 1,
          description: "写实风格：用真实办公场景建立信任。",
          sourceText: "",
          imagePrompt: "清透办公室",
          snapshot: { directionTitle: "清透科技", styleVariant: "realistic", styleLabel: "写实风格" },
          images: [],
        },
      ],
    },
    directions: [],
    generatedImages: [],
    expansions: [
      {
        id: "expansion-1",
        projectId: "project-1",
        directionId: "direction-1",
        title: "办公室开场",
        oneLiner: "客户经理进入办公室，产品让复杂流程变清晰。",
        storyArc: { beginning: "推门进入", development: "流程自动归档", turn: "风险提醒出现", ending: "团队快速决策" },
        visualStyle: "真实办公广告片",
        visualHighlights: ["办公室", "屏幕信息流"],
        productionDifficulty: "中",
        riskNotes: "",
        sortOrder: 1,
        sourceJobId: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  });

  assert.match(items[0].metadata.storyContent, /办公室开场/);
  assert.match(items[0].metadata.previewText, /复杂流程变清晰/);
});

test("creative proposal candidate image snapshots keep durable ossUrl references", async () => {
  const { buildCreativeProposalReviewItems } = await import("./client-review.ts");

  const items = buildCreativeProposalReviewItems({
    round: {
      id: "round-1",
      roundNumber: 1,
      directionIds: ["direction-1"],
      concepts: [
        {
          id: "concept-1",
          title: "清透科技 - 二维风格",
          directionId: "direction-1",
          sceneIndex: 1,
          requiredImageCount: 1,
          description: "二维风格：用插画讲清楚效率。",
          sourceText: "",
          imagePrompt: "清透办公室",
          snapshot: { directionTitle: "清透科技", styleLabel: "二维风格" },
          images: [
            {
              id: "snapshot-image-1",
              ossUrl: "https://yueran-test.oss-cn-test.aliyuncs.com/projects/project-1/generated-images/snapshot-image-1/atmosphere.png",
              prompt: "清透办公室",
              status: "succeeded",
              isSelected: true,
              sortOrder: 1,
            },
          ],
        },
      ],
    },
    directions: [],
    generatedImages: [],
    expansions: [],
  });

  const candidate = items[0].metadata.candidateImages[0];
  assert.equal(candidate.id, "snapshot-image-1");
  assert.equal(candidate.ossUrl, "https://yueran-test.oss-cn-test.aliyuncs.com/projects/project-1/generated-images/snapshot-image-1/atmosphere.png");
  assert.match(candidate.imageUrl, /OSSAccessKeyId=test-access-key/);
});

test("creative Round 2 review items stay scoped to scene concepts", async () => {
  const { buildCreativeProposalReviewItems } = await import("./client-review.ts");

  const items = buildCreativeProposalReviewItems({
    round: {
      id: "round-2",
      roundNumber: 2,
      directionIds: ["direction-1"],
      concepts: [
        {
          id: "concept-1",
          title: "开场吸引",
          directionId: "direction-1",
          sceneIndex: 1,
          requiredImageCount: 4,
          description: "开场先建立产品场景。",
          sourceText: "完整剧本拆出的第一场。",
          imagePrompt: "清透科技感办公室",
          snapshot: { directionTitle: "清透科技" },
          images: [],
        },
      ],
    },
    directions: [],
    generatedImages: [],
    expansions: [],
  });

  assert.deepEqual(items.map((item) => item.itemId), ["concept-1"]);
  assert.equal(items[0].metadata.directionId, "direction-1");
  assert.equal(items[0].metadata.sceneIndex, 1);
  assert.match(items[0].metadata.previewText, /开场先建立产品场景/);
});

test("storyboard image batch review shots are ordered by scene and storyboard sequence", async () => {
  const { sortStoryboardBatchReviewShots } = await import("./client-review.ts");

  const shots = sortStoryboardBatchReviewShots(
    [
      { id: "shot-2-1", sceneId: "scene-2", shotNumber: "2-1-1", sortOrder: 0 },
      { id: "shot-1-2", sceneId: "scene-1", shotNumber: "1-1-2", sortOrder: 2 },
      { id: "shot-1-1", sceneId: "scene-1", shotNumber: "1-1-1", sortOrder: 1 },
    ],
    [
      { id: "scene-2", sceneNumber: 2 },
      { id: "scene-1", sceneNumber: 1 },
    ],
    ["scene-2", "scene-1"],
  );

  assert.deepEqual(shots.map((shot) => shot.id), ["shot-1-1", "shot-1-2", "shot-2-1"]);
});

test("storyboard review items are exposed in shot number order for existing links", async () => {
  const { sortExternalReviewItemsForDisplay } = await import("./client-review.ts");

  const items = sortExternalReviewItemsForDisplay(
    { reviewType: "storyboard_image_batch" },
    [
      { itemLabel: "1-2-1｜球场", metadata: { shotNumber: "1-2-1" } },
      { itemLabel: "1-1-2｜进车", metadata: { shotNumber: "1-1-2" } },
      { itemLabel: "1-1-1｜开门", metadata: { shotNumber: "1-1-1" } },
    ],
  );

  assert.deepEqual(items.map((item) => item.metadata.shotNumber), ["1-1-1", "1-1-2", "1-2-1"]);
});

test("storyboard scene review keeps per-shot scores when the whole scene is rejected", async () => {
  const { normalizeReviewItemsForSubmission } = await import("./client-review.ts");

  const result = normalizeReviewItemsForSubmission({
    reviewType: "storyboard_scene_images",
    decision: "rejected",
    existingItems: [{ itemId: "11111111-1111-4111-8111-111111111111" }, { itemId: "22222222-2222-4222-8222-222222222222" }],
    submittedItems: [
      {
        itemId: "11111111-1111-4111-8111-111111111111",
        decision: "approved",
        score: 5,
        feedback: "这一条可以保留。",
      },
      {
        itemId: "22222222-2222-4222-8222-222222222222",
        decision: "rejected",
        score: 2,
        feedback: "人物表情和前一镜不连贯。",
      },
    ],
  });

  assert.equal(result.length, 2);
  assert.equal(result[0].decision, "approved");
  assert.equal(result[0].score, 5);
  assert.equal(result[1].decision, "rejected");
  assert.equal(result[1].score, 2);
  assert.match(result[1].feedback, /不连贯/);
});

test("storyboard scene review defaults missing item decisions from the scene decision", async () => {
  const { normalizeReviewItemsForSubmission } = await import("./client-review.ts");

  const result = normalizeReviewItemsForSubmission({
    reviewType: "storyboard_scene_images",
    decision: "approved",
    existingItems: [{ itemId: "11111111-1111-4111-8111-111111111111" }],
    submittedItems: [],
  });

  assert.equal(result[0].decision, "approved");
  assert.equal(result[0].score, 5);
});

test("storyboard image batch review requires every shot decision without scores", async () => {
  const { normalizeReviewItemsForSubmission } = await import("./client-review.ts");

  const result = normalizeReviewItemsForSubmission({
    reviewType: "storyboard_image_batch",
    decision: "rejected",
    existingItems: [{ itemId: "11111111-1111-4111-8111-111111111111" }, { itemId: "22222222-2222-4222-8222-222222222222" }],
    submittedItems: [
      {
        itemId: "11111111-1111-4111-8111-111111111111",
        decision: "approved",
        score: 5,
        feedback: "",
      },
      {
        itemId: "22222222-2222-4222-8222-222222222222",
        decision: "rejected",
        score: 2,
        feedback: "鞋身角度不对，需要重生成。",
      },
    ],
  });

  assert.deepEqual(result.map((item) => item.decision), ["approved", "rejected"]);
  assert.deepEqual(result.map((item) => item.score), [null, null]);
  assert.match(result[1].feedback, /重生成/);
});

test("storyboard image batch review rejects missing shot decisions and rejected feedback", async () => {
  const { normalizeReviewItemsForSubmission } = await import("./client-review.ts");

  assert.throws(
    () =>
      normalizeReviewItemsForSubmission({
        reviewType: "storyboard_image_batch",
        decision: "approved",
        existingItems: [{ itemId: "11111111-1111-4111-8111-111111111111" }],
        submittedItems: [],
      }),
    /请逐张分镜选择 OK 或不 OK/,
  );

  assert.throws(
    () =>
      normalizeReviewItemsForSubmission({
        reviewType: "storyboard_image_batch",
        decision: "rejected",
        existingItems: [{ itemId: "11111111-1111-4111-8111-111111111111" }],
        submittedItems: [
          {
            itemId: "11111111-1111-4111-8111-111111111111",
            decision: "rejected",
            feedback: "",
          },
        ],
      }),
    /请为不 OK 的分镜填写原因和修改意见/,
  );
});

test("full cut review defaults missing item decisions without per-shot scores", async () => {
  const { normalizeReviewItemsForSubmission } = await import("./client-review.ts");

  const result = normalizeReviewItemsForSubmission({
    reviewType: "a_copy_review",
    decision: "rejected",
    existingItems: [{ itemId: "33333333-3333-4333-8333-333333333333" }],
    submittedItems: [],
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].decision, "rejected");
  assert.equal(result[0].score, null);
  assert.equal(result[0].feedback, "");
});

test("b-copy approval advances into settlement delivery without completing the project", async () => {
  const { reviewSubmittedStage } = await import("./client-review.ts");

  const stage = reviewSubmittedStage("b_copy_review", "approved");

  assert.equal(stage.stageKey, "b_copy_final_confirmation");
  assert.equal(stage.status, "approved");
  assert.equal(stage.currentStage, "settlement_delivery_archive");
  assert.equal(stage.projectStatus, "in_progress");
  assert.match(stage.userMessage, /结算交付与完整归档/);
});

test("setting-image (production_setup) approval advances into storyboard image production", async () => {
  const { reviewSubmittedStage } = await import("./client-review.ts");

  const approved = reviewSubmittedStage("script_package", "approved", "production_setup");
  assert.equal(approved.currentStage, "storyboard_image_canvas");
  assert.equal(approved.status, "approved");

  // Rejection keeps the project in SOP5 for revision.
  const rejected = reviewSubmittedStage("script_package", "rejected", "production_setup");
  assert.equal(rejected.currentStage, "script_storyboard_confirmation");
});

test("contract client approval returns to SOP4 delivery checklist", async () => {
  const { reviewSubmittedStage, workflowReviewDocumentStatus } = await import("./client-review.ts");

  const approved = reviewSubmittedStage("contract_confirmation", "approved");

  assert.equal(approved.stageKey, "selection_quote_contract");
  assert.equal(approved.status, "in_progress");
  assert.equal(approved.currentStage, "selection_quote_contract");
  assert.equal(approved.projectStatus, "in_progress");
  assert.match(approved.userMessage, /交付清单/);
  assert.equal(workflowReviewDocumentStatus("contract_confirmation", true), "signed");
});

test("timecode annotations map to storyboard shots by accumulated duration", async () => {
  const { mapTimecodeToStoryboard } = await import("../repositories/review-cuts.ts");

  const scenes = [
    { id: "scene-2", sceneNumber: 2 },
    { id: "scene-1", sceneNumber: 1 },
  ];
  const shots = [
    { id: "shot-1", sceneId: "scene-1", sortOrder: 1, durationSeconds: 4 },
    { id: "shot-2", sceneId: "scene-1", sortOrder: 2, durationSeconds: 5 },
    { id: "shot-3", sceneId: "scene-2", sortOrder: 1, durationSeconds: 3 },
  ];

  const mapped = mapTimecodeToStoryboard({ timeSeconds: 7, scenes, shots });

  assert.equal(mapped.sceneId, "scene-1");
  assert.equal(mapped.shotId, "shot-2");
  assert.equal(mapped.confidence, 0.72);
});

test("timecode annotations beyond known duration fall back to last storyboard shot", async () => {
  const { mapTimecodeToStoryboard } = await import("../repositories/review-cuts.ts");

  const scenes = [{ id: "scene-1", sceneNumber: 1 }];
  const shots = [{ id: "shot-1", sceneId: "scene-1", sortOrder: 1, durationSeconds: 2 }];

  const mapped = mapTimecodeToStoryboard({ timeSeconds: 99, scenes, shots });

  assert.equal(mapped.sceneId, "scene-1");
  assert.equal(mapped.shotId, "shot-1");
  assert.equal(mapped.confidence, 0.38);
});
