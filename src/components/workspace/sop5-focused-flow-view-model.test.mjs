import assert from "node:assert/strict";
import { test } from "node:test";
import { createSop5FocusedFlowViewModel, resolveSop5ActiveTab } from "./sop5-focused-flow-view-model.ts";

const baseInput = {
  scriptPackages: [],
  storyboardScenes: [],
  storyboardShots: [],
  productionEntities: [],
};

test("SOP5 exposes two focused sub-tabs and compact read-only progress nodes", () => {
  const view = createSop5FocusedFlowViewModel(baseInput);

  assert.deepEqual(
    view.tabs.map((tab) => tab.label),
    ["脚本设定（完整剧本）", "文字分镜拆解"]
  );
  assert.equal(view.activeTab, "script_setup");
  assert.deepEqual(
    view.progressNodes.map((node) => node.label),
    ["合同签约", "大白话剧本", "对话修订", "标准剧本", "文字分镜", "人物场景", "分镜图生成"]
  );
  assert.equal(view.progressNodes.every((node) => node.readOnly), true);
});

test("SOP5 script setup starts from AI generated plain-language script workflow", () => {
  const view = createSop5FocusedFlowViewModel(baseInput);

  assert.equal(view.scriptSetup.mode, "needs_plain_script_generation");
  assert.match(view.scriptSetup.primaryActionLabel, /生成大白话剧本/);
  assert.equal(view.legacyCopyBanned.includes("标准格式检查"), true);
  assert.equal(view.legacyCopyBanned.includes("甲方完整剧本确认"), true);
});

test("SOP5 switches to storyboard split tab after standardized script exists", () => {
  const view = createSop5FocusedFlowViewModel({
    ...baseInput,
    scriptPackages: [
      {
        id: "pkg-1",
        projectId: "project-1",
        directionId: null,
        title: "测试剧本",
        concept: "SOP5",
        fullScript: "大白话剧本",
        plainScript: "大白话剧本",
        standardizedScript: "《测试》\n第一集\n1-1 日 外 球场\n人物：主角\n△ 主角起跑。",
        status: "internal_review",
        version: 1,
        selectedAt: null,
        lockedAt: null,
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    ],
  });

  assert.equal(view.scriptSetup.mode, "standardized_ready");
  assert.equal(view.storyboardSplit.canGenerateStoryboard, true);
  assert.equal(view.tabs.find((tab) => tab.key === "storyboard_split").disabled, false);
});

test("SOP5 keeps storyboard confirmation current until every split shot is confirmed", () => {
  const view = createSop5FocusedFlowViewModel({
    ...baseInput,
    scriptPackages: [
      {
        id: "pkg-1",
        projectId: "project-1",
        directionId: null,
        title: "测试剧本",
        concept: "SOP5",
        fullScript: "大白话剧本",
        plainScript: "大白话剧本",
        standardizedScript: "《测试》\n第一集\n1-1 日 外 球场\n人物：主角\n△ 主角起跑。",
        status: "internal_review",
        version: 1,
        selectedAt: null,
        lockedAt: null,
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    ],
    storyboardScenes: [{ id: "scene-1", projectId: "project-1", packageId: "pkg-1", sceneNumber: "1-1", title: "球场", description: "", status: "draft", lockedVersion: null, updatedAt: "2026-07-01T00:00:00.000Z" }],
    storyboardShots: [
      {
        id: "shot-1",
        projectId: "project-1",
        sceneId: "scene-1",
        packageId: "pkg-1",
        shotNumber: "1-1-1",
        visualDescription: "主角起跑",
        shotSize: "",
        actionExpression: "",
        cameraMovement: "",
        durationSeconds: null,
        soundTransition: "",
        notes: "",
        characterRefs: ["主角"],
        sceneRefs: ["球场"],
        imagePrompt: "",
        videoPrompt: "",
        status: "draft",
        version: 1,
        sortOrder: 0,
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    ],
  });

  assert.equal(view.storyboardSplit.isStoryboardSequenceConfirmed, false);
  assert.equal(view.progressNodes.find((node) => node.key === "storyboard")?.status, "current");
  assert.equal(view.progressNodes.find((node) => node.key === "entities")?.status, "pending");
});

test("SOP5 switches from script setup to storyboard split after script package client approval", () => {
  assert.equal(
    resolveSop5ActiveTab({
      requestedTab: "script_setup",
      packageId: "pkg-1",
      clientReviewTasks: [
        {
          reviewType: "script_package",
          reviewScene: null,
          targetScopeId: "pkg-1",
          status: "approved",
        },
      ],
    }),
    "storyboard_split"
  );

  assert.equal(
    resolveSop5ActiveTab({
      requestedTab: "script_setup",
      packageId: "pkg-1",
      clientReviewTasks: [
        {
          reviewType: "script_package",
          reviewScene: "production_setup",
          targetScopeId: "pkg-1",
          status: "approved",
        },
      ],
    }),
    "script_setup"
  );
});
