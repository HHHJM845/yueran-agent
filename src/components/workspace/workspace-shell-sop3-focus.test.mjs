import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./workspace-shell.tsx", import.meta.url), "utf8");
const apiSource = readFileSync(new URL("./api.ts", import.meta.url), "utf8");

function componentSource(name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  const next = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

function stageSource(stage) {
  const start = source.indexOf(`<StagePanel stage="${stage}"`);
  assert.notEqual(start, -1, `${stage} stage should exist`);
  const end = source.indexOf("</StagePanel>", start);
  assert.notEqual(end, -1, `${stage} stage should close`);
  return source.slice(start, end);
}

test("SOP3 stage renders one focused creative proposal workspace instead of stacked workflow cards", () => {
  const stage = stageSource("creative_direction_proposal");

  assert.match(stage, /<CreativeDirectionsCard/);
  assert.doesNotMatch(stage, /<AssetAnalysisResults/);
  assert.doesNotMatch(stage, /<ProposalEditorCard/);
  assert.doesNotMatch(stage, /title="资料解析与标签评分结果"/);
  assert.doesNotMatch(stage, /title="四个创意方向与两轮视觉提案"/);
  assert.doesNotMatch(stage, /title="最终提案整理与版本快照"/);
});

test("CreativeDirectionsCard uses focused view-model and does not permanently stack all SOP3 panels", () => {
  const card = componentSource("CreativeDirectionsCard");

  assert.match(card, /buildSop3FocusedFlow/);
  assert.match(card, /Sop3CurrentTaskBody/);
  assert.match(card, /Sop3ProgressMap/);
  assert.doesNotMatch(card, /<Sop3FlowStrip/);
  assert.doesNotMatch(card, /<CreativeExpansionBoard[\s\S]*<CreativeProposalRoundsPanel/);
  assert.doesNotMatch(card, /Round 提案包与甲方审核[\s\S]*完整流转是/);
});

test("SOP3 focused copy follows current-task language", () => {
  const card = componentSource("CreativeDirectionsCard");

  assert.match(card, /选择进入 Round 1 的方向/);
  assert.match(card, /等待甲方 Round 1 反馈/);
  assert.match(card, /generate_round_1_materials/);
  assert.match(card, /发送 Round 1 完整提案包/);
  assert.match(card, /深化已确认方向/);
  assert.doesNotMatch(card, /发送给甲方初筛/);
  assert.doesNotMatch(card, /四个方向与两轮视觉提案/);
  assert.doesNotMatch(card, /生成 4 个创意方向，完成方向初选、故事大纲、氛围图和两轮甲方反馈/);
});

test("SOP3 focused body reuses material board for Round 1 preparation without stacking old panels", () => {
  const body = componentSource("Sop3CurrentTaskBody");

  assert.match(body, /flow\.currentTask\.key === "prepare_round_1_materials"/);
  assert.match(body, /<Round1MaterialPreparation/);
  assert.doesNotMatch(body, /<CreativeProposalRoundsPanel/);
});

test("SOP3 creative proposal UI follows structured Brief-style hierarchy", () => {
  const header = componentSource("Sop3FocusedHeader");
  const directionCard = componentSource("CreativeDirectionCard");
  const round1Board = componentSource("Round1StyleImageBoard");
  const feedbackPanel = componentSource("CreativeProposalReviewFeedback");
  const deepeningPanel = componentSource("Round2DeepeningScriptPanel");
  const atmosphereCard = componentSource("CreativeDirectionAtmosphereCard");
  const sceneCell = componentSource("CreativeStoryAtmosphereCell");
  const miniMetric = componentSource("MiniMetric");

  assert.match(header, /text-lg font-semibold tracking-tight/);
  assert.match(round1Board, /text-base font-semibold tracking-tight/);
  assert.match(directionCard, /text-lg font-semibold leading-6 tracking-tight/);
  assert.match(directionCard, /核心概念/);
  assert.match(directionCard, /text-sm font-semibold tracking-tight text-\[var\(--text-secondary\)\]/);
  assert.match(directionCard, /故事大纲/);
  assert.match(directionCard, /起承转合/);
  assert.match(directionCard, /画面风格/);
  assert.match(feedbackPanel, /审核结论/);
  assert.match(feedbackPanel, /方向优先级/);
  assert.match(feedbackPanel, /md:grid-cols-2/);
  assert.match(deepeningPanel, /700-800 字完整故事/);
  assert.match(deepeningPanel, /text-sm font-medium leading-6 text-\[var\(--text-primary\)\]/);
  assert.match(atmosphereCard, /核心概念/);
  assert.match(sceneCell, /小分镜/);
  assert.match(sceneCell, /视觉重点/);
  assert.match(sceneCell, /画面风格/);
  assert.doesNotMatch(sceneCell, /风险备注/);
  assert.doesNotMatch(sceneCell, /productionDifficulty/);
  assert.match(miniMetric, /text-sm font-semibold tracking-tight text-\[var\(--text-secondary\)\]/);
  assert.match(miniMetric, /text-base font-medium leading-7 text-\[var\(--text-primary\)\]/);
  assert.doesNotMatch(header, /<Sparkles size=\{18\} \/>/);
  assert.doesNotMatch(header, /text-sm font-medium">\{flow\.currentTask\.title\}/);
});

test("Round 1 material preparation keeps direction selection visible before client feedback", () => {
  const round1 = componentSource("Round1MaterialPreparation");

  assert.match(round1, /Round 1 方向选择/);
  assert.match(round1, /flow\.selectedDirections/);
  assert.match(round1, /onSelection/);
  assert.match(round1, /<CreativeDirectionCard/);
  assert.match(round1, /<Round1StyleImageBoard/);
  assert.doesNotMatch(round1, /深化已确认方向/);
});

test("SOP3 direction selection renders a fixed Round 1 material action below direction cards", () => {
  const body = componentSource("Sop3CurrentTaskBody");
  const selection = componentSource("Round1DirectionSelectionPanel");

  assert.match(body, /flow\.currentTask\.key === "select_directions"/);
  assert.match(body, /<Round1DirectionSelectionPanel/);
  assert.match(selection, /<CreativeDirectionCard/);
  assert.match(selection, /onPrimaryAction/);
  assert.match(selection, /primaryAction\.label/);
});

test("Round 1 material board exposes an explicit client review handoff once materials are ready", () => {
  const round1 = componentSource("Round1MaterialPreparation");
  const board = componentSource("Round1StyleImageBoard");
  const card = componentSource("CreativeDirectionsCard");

  assert.match(round1, /onPrimaryAction/);
  assert.match(board, /发送给甲方审核/);
  assert.match(board, /进入甲方反馈/);
  assert.match(card, /user\.role === "creative" \|\| user\.role === "business" \|\| user\.role === "admin"/);
});

test("waiting for client feedback can regenerate a lost review link and code", () => {
  const body = componentSource("Sop3CurrentTaskBody");
  const panel = componentSource("Sop3WaitingForClientPanel");

  assert.match(body, /onRegenerateRoundReview\(reviewRoundNumber\)/);
  assert.match(panel, /重新生成审核链接/);
  assert.match(panel, /历史链接和验证码不会再次明文展示/);
  assert.match(panel, /onRegenerateReview/);
});

test("creative round review links include the verification code in the copied URL", () => {
  const accessBox = componentSource("CreativeRoundReviewAccessBox");

  assert.match(accessBox, /const reviewUrl = buildReviewLinkWithVerificationCode\(review\.url, review\.code\)/);
  assert.match(accessBox, /navigator\.clipboard\.writeText\(reviewUrl\)/);
  assert.match(accessBox, /复制完整链接/);
  assert.match(accessBox, /链接已包含验证码，甲方打开后仍需手动进入审核。/);
  assert.doesNotMatch(accessBox, /navigator\.clipboard\.writeText\(review\.url\)/);
});

test("Round 1 material generation uses direction style images instead of story-card expansion images", () => {
  const card = componentSource("CreativeDirectionsCard");
  const start = card.indexOf("async function handleGenerateSelectedAtmosphereImages");
  assert.notEqual(start, -1, "handleGenerateSelectedAtmosphereImages should exist");
  const end = card.indexOf("\n  async function handleSendRound1Review", start);
  assert.notEqual(end, -1, "handleGenerateSelectedAtmosphereImages should end before review handler");
  const handler = card.slice(start, end);

  assert.match(handler, /isRound1StyleGenerationStep/);
  assert.match(handler, /ROUND_1_STYLE_VARIANTS/);
  assert.match(handler, /generateDirectionStyleImage/);
  assert.doesNotMatch(handler, /Round 1 故事卡任务/);
});

test("Round 1 material action does not spin before the user starts generation", () => {
  const card = componentSource("CreativeDirectionsCard");

  assert.match(card, /directionGenerationBlocksCurrentStep/);
  assert.match(card, /focusedFlow\.currentTask\.key === "generate_directions" &&\s*hasRunningDirectionGenerationJob/);
  assert.match(card, /isRound1StyleGenerationStep[\s\S]*latestCreativeAssetJob\?\.type === "atmosphere_image_generation"[\s\S]*selectedStyleTargetCount > 0/);
  assert.match(card, /primaryActionBackendBusy[\s\S]*focusedFlow\.primaryAction\.key === "generate_round_1_materials" \? false : creativeAssetJobBlocksCurrentStep/);
  assert.match(card, /generalPrimaryActionBusy[\s\S]*directionGenerationBlocksCurrentStep[\s\S]*primaryActionBackendBusy/);
  assert.match(card, /const \[generatingRound1Materials, setGeneratingRound1Materials\] = useState\(false\)/);
  assert.match(card, /primaryActionBusy[\s\S]*focusedFlow\.primaryAction\.key === "generate_round_1_materials"[\s\S]*generatingRound1Materials[\s\S]*generalPrimaryActionBusy/);
  assert.doesNotMatch(card, /primaryActionBusy[\s\S]*focusedFlow\.primaryAction\.key === "generate_round_1_materials"[\s\S]*generatingSelectedAtmosphere[\s\S]*generalPrimaryActionBusy/);
  assert.doesNotMatch(card, /primaryActionBusy =[\s\S]*hasRunningDirectionGenerationJob \|\|[\s\S]*creativeAssetJobBlocksCurrentStep/);
});

test("creative direction generation action releases its local busy state independently from job polling", () => {
  const card = componentSource("CreativeDirectionsCard");
  const start = card.indexOf("async function handleGenerate()");
  assert.notEqual(start, -1, "handleGenerate should exist");
  const end = card.indexOf("\n  async function handleSelection", start);
  assert.notEqual(end, -1, "handleGenerate should end before selection handler");
  const handler = card.slice(start, end);

  assert.match(card, /creativeDirectionActionRef/);
  assert.match(handler, /const actionId = creativeDirectionActionRef\.current \+ 1/);
  assert.match(handler, /creativeDirectionActionRef\.current = actionId/);
  assert.match(handler, /if \(creativeDirectionActionRef\.current === actionId\)[\s\S]*setGenerating\(false\)/);
  assert.doesNotMatch(handler, /if \(creativeDirectionJobPollRef\.current === pollId\)[\s\S]*setGenerating\(false\)/);
});

test("Round 1 style image task creation has a timeout instead of spinning forever", () => {
  const start = apiSource.indexOf("export async function generateDirectionStyleImage");
  assert.notEqual(start, -1, "generateDirectionStyleImage should exist");
  const end = apiSource.indexOf("\nexport async function reviewGeneratedImage", start);
  assert.notEqual(end, -1, "generateDirectionStyleImage should end before reviewGeneratedImage");
  const functionSource = apiSource.slice(start, end);

  assert.match(functionSource, /AbortController/);
  assert.match(functionSource, /setTimeout\(\(\) => controller\.abort\(\), 60_000\)/);
  assert.match(functionSource, /round1_style_image_request_timeout/);
  assert.match(functionSource, /创建 Round 1 风格图任务超时/);
});

test("Round 1 direction cards render bundled story outlines and hide standalone outline generation", () => {
  const card = componentSource("CreativeDirectionCard");
  const viewModelSource = readFileSync(new URL("./sop3-focused-flow-view-model.ts", import.meta.url), "utf8");

  assert.match(card, /storyOutlinePreview/);
  assert.match(card, /expansion\.oneLiner/);
  assert.match(card, /formatCreativeStoryArcEntries\(expansion\.storyArc\)/);
  assert.match(card, /creativeStoryArcLabel\(key\)/);
  assert.match(card, /expansion\.visualHighlights\.join\("、"\)/);
  assert.match(card, /expansion\.visualStyle/);
  assert.match(card, /故事大纲/);
  assert.doesNotMatch(card, /生成故事大纲|重新生成大纲/);
  assert.doesNotMatch(card, /onGenerateExpansions/);
  assert.match(viewModelSource, /方向卡片生成/);
  assert.doesNotMatch(viewModelSource, /key: "story_outline"/);
});

test("Round 1 direction story outline is shown as full internal content", () => {
  const helperSource = `${componentSource("formatCreativeStoryArcEntries")}\n${componentSource("creativeStoryArcLabel")}`;

  assert.match(helperSource, /Object\.entries\(storyArc\)/);
  assert.match(helperSource, /beginning: "起"/);
  assert.match(helperSource, /development: "承"/);
  assert.match(helperSource, /turn: "转"/);
  assert.match(helperSource, /ending: "合"/);
});

test("SOP3 creative cards hide cost, cycle, and difficulty metrics from the workspace", () => {
  const directionCard = componentSource("CreativeDirectionCard");
  const deepeningCard = componentSource("CreativeDirectionAtmosphereCard");

  assert.doesNotMatch(directionCard, /MiniMetric label="成本"/);
  assert.doesNotMatch(directionCard, /MiniMetric label="周期"/);
  assert.doesNotMatch(directionCard, /MiniMetric label="难度"/);
  assert.doesNotMatch(deepeningCard, /MiniMetric label="成本"/);
  assert.doesNotMatch(deepeningCard, /MiniMetric label="周期"/);
  assert.doesNotMatch(deepeningCard, /MiniMetric label="难度"/);
});

test("Round 1 direction cards support full-card selection without inner button double toggles", () => {
  const card = componentSource("CreativeDirectionCard");
  const selection = componentSource("Round1DirectionSelectionPanel");

  assert.match(card, /const selectableCard = canSelect && !editing/);
  assert.match(card, /onClick=\{selectableCard \? handleCardSelection : undefined\}/);
  assert.match(card, /role=\{selectableCard \? "button" : undefined\}/);
  assert.match(card, /tabIndex=\{selectableCard \? 0 : undefined\}/);
  assert.match(card, /event\.key === "Enter" \|\| event\.key === " "/);
  assert.match(card, /event\.stopPropagation\(\)[\s\S]*onSelection\(\)/);
  assert.match(card, /event\.stopPropagation\(\)[\s\S]*onToggleEdit\(\)/);
  assert.match(selection, /canSelect=\{!selectionLocked\}/);
});

test("Round 1 style image cells can regenerate a single style image through the existing job flow", () => {
  const cell = componentSource("Round1StyleImageCell");
  const board = componentSource("Round1StyleImageBoard");

  assert.match(board, /onRegenerateStyleImage/);
  assert.match(cell, /重新生成/);
  assert.match(cell, /RefreshCcw/);
  assert.match(cell, /onRegenerateStyleImage/);
});

test("manual Round 1 story outline fallback still waits for backend jobs when used for repair", () => {
  const card = componentSource("CreativeDirectionsCard");
  const start = card.indexOf("async function handleGenerateRound1StoryOutlines");
  assert.notEqual(start, -1, "handleGenerateRound1StoryOutlines should exist");
  const end = card.indexOf("\n  async function handleRegenerateRound1StyleImage", start);
  assert.notEqual(end, -1, "handleGenerateRound1StoryOutlines should end before style image handler");
  const handler = card.slice(start, end);

  assert.match(handler, /waitForCreativeJobs\(jobIds, "故事大纲"/);
  assert.match(handler, /方向卡片内容已补齐/);
  assert.match(handler, /timedOutCount/);
});

test("single atmosphere image generation waits for completion and refreshes automatically", () => {
  const card = componentSource("CreativeDirectionsCard");
  const start = card.indexOf("async function handleGenerateAtmosphereImage");
  assert.notEqual(start, -1, "handleGenerateAtmosphereImage should exist");
  const end = card.indexOf("\n  async function waitForCreativeJobs", start);
  assert.notEqual(end, -1, "handleGenerateAtmosphereImage should end before shared wait helper");
  const handler = card.slice(start, end);

  assert.match(handler, /waitForCreativeJobs\(\[result\.data\.jobId\], "氛围图"/);
  assert.match(handler, /氛围图已生成，工作台已刷新。/);
  assert.match(handler, /timedOutCount/);
});

test("Round 1 style image cells rank succeeded images ahead of older failed or retrying records", () => {
  const sourceText = componentSource("findRound1DirectionStyleImage");
  const rankerSource = componentSource("rankGeneratedImagesForDisplay");
  const rankValueSource = componentSource("generatedImageDisplayRank");

  assert.match(sourceText, /rankGeneratedImagesForDisplay/);
  assert.match(rankerSource, /Date\.parse\(right\.updatedAt\) - Date\.parse\(left\.updatedAt\)/);
  assert.match(rankValueSource, /image\.status === "succeeded" && image\.ossUrl/);
  assert.match(rankValueSource, /image\.status === "failed"/);
});

test("deepening atmosphere cells render the ranked primary image instead of the first raw record", () => {
  const cell = componentSource("CreativeStoryAtmosphereCell");

  assert.match(cell, /const rankedGeneratedImages = rankGeneratedImagesForDisplay\(generatedImages\)/);
  assert.match(cell, /const primaryGeneratedImage = rankedGeneratedImages\[0\] \?\? null/);
  assert.match(cell, /rankedGeneratedImages\.slice\(0, 1\)/);
  assert.doesNotMatch(cell, /generatedImages\.slice\(0, 1\)/);
});

test("SOP3 review resubmission scopes Round 2 revisions to visible retained directions", () => {
  const card = componentSource("CreativeDirectionsCard");

  assert.match(card, /focusedFlow\.currentTask\.key === "repair_incomplete_data" &&\s*focusedFlow\.primaryAction\.key === "send_round_2_review"/);
  assert.doesNotMatch(card, /const shouldScopeToFocusedDirections =[\s\S]*currentTask\.key === "deepen_confirmed_direction"[\s\S]*currentTask\.key === "wait_round_2_feedback"[\s\S]*currentTask\.key === "finalize_proposal";/);
});

test("Round 2 deepening generates one image per selected scene instead of four candidates", () => {
  const card = componentSource("CreativeDirectionsCard");
  const board = componentSource("CreativeExpansionBoard");
  const cell = componentSource("CreativeStoryAtmosphereCell");

  assert.match(card, /selectedAtmosphereTargetCount = selectedExpansionCount;/);
  assert.match(card, /Math\.max\(0, 1 - existingImageCount\)/);
  assert.match(board, /每个场景目标生成 1 张深化视觉图/);
  assert.match(cell, /候选 \{generatedCount\}\/1/);
  assert.doesNotMatch(cell, /generatedCount >= 4/);
  assert.doesNotMatch(cell, /Array\.from\(\{ length: Math\.max\(0, 4 - generatedImages\.length\) \}\)/);
});

test("Round 2 deepening image job creation is sent concurrently", () => {
  const card = componentSource("CreativeDirectionsCard");
  const imageStart = card.indexOf("async function handleGenerateSelectedAtmosphereImages");
  assert.notEqual(imageStart, -1, "handleGenerateSelectedAtmosphereImages should exist");
  const imageEnd = card.indexOf("\n  async function handleSendRound1Review", imageStart);
  assert.notEqual(imageEnd, -1, "handleGenerateSelectedAtmosphereImages should end before review handler");
  const imageHandler = card.slice(imageStart, imageEnd);
  const round2Start = imageHandler.indexOf("const workspaceResult = await fetchWorkspace(project.id)");
  assert.notEqual(round2Start, -1, "Round 2 branch should fetch fresh workspace data");
  const round2Branch = imageHandler.slice(round2Start);

  assert.match(round2Branch, /const imageRequests = freshExpansions\.flatMap/);
  assert.match(round2Branch, /await Promise\.all\(\s*imageRequests\.map/);
  assert.doesNotMatch(round2Branch, /for \(const expansion of freshExpansions\)[\s\S]*await generateAtmosphereImage/);
});

test("Round 2 deepening requires full script confirmation before selecting two visual scenes", () => {
  const card = componentSource("CreativeDirectionsCard");
  const body = componentSource("Sop3CurrentTaskBody");
  const scriptPanel = componentSource("Round2DeepeningScriptPanel");
  const focusedModel = readFileSync(
    new URL("./sop3-focused-flow-view-model.ts", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(card, /generateRound2DeepeningOutline/);
  assert.doesNotMatch(apiSource, /generateRound2DeepeningOutline/);
  assert.match(card, /generateRound2DeepeningScript/);
  assert.match(card, /confirmRound2DeepeningScript/);
  assert.match(card, /splitRound2DeepeningStoryboard/);
  assert.match(body, /<Round2DeepeningScriptPanel/);
  assert.match(scriptPanel, /Round 2 方向深化故事/);
  assert.match(scriptPanel, /700-800 字完整故事/);
  assert.match(scriptPanel, /人工确认后/);
  assert.match(scriptPanel, /精选 \{ROUND_2_DEEPENING_SCENE_COUNT\} 个精彩场景/);
  assert.match(source, /ROUND_2_DEEPENING_SCENE_COUNT = 2/);
  assert.match(focusedModel, /ROUND_2_DEEPENING_SCENE_COUNT = 2/);
  assert.match(focusedModel, /精选 \$\{ROUND_2_DEEPENING_SCENE_COUNT\} 个精彩场景/);
  assert.doesNotMatch(scriptPanel, /精彩分镜场景/);
  assert.doesNotMatch(focusedModel, /精彩分镜场景/);
  assert.doesNotMatch(scriptPanel, /深化故事稿与 700-800 字完整故事/);
});

test("AI job progress panel keeps failed generation tasks visible with retry", () => {
  const panel = componentSource("AiJobProgressPanel");
  const item = componentSource("AiJobProgressItem");

  assert.match(panel, /job\.status === "failed"/);
  assert.match(panel, /failedCount/);
  assert.match(panel, /onRefresh/);
  assert.match(item, /retryJob\(job\.id\)/);
  assert.match(item, /重试/);
  assert.match(item, /job\.status === "failed"/);
  assert.doesNotMatch(panel, /runningJobs\.length === 0\) return null/);
});

test("Round 2 deepening keeps the bottom action and hides the duplicate global action", () => {
  const card = componentSource("CreativeDirectionsCard");
  const scriptPanel = componentSource("Round2DeepeningScriptPanel");

  assert.match(card, /focusedFlow\.currentTask\.key === "deepen_confirmed_direction" &&\s*focusedFlow\.primaryAction\.key !== "generate_deepening_assets"/);
  assert.match(scriptPanel, /onClick=\{onPrimaryAction\}/);
  assert.match(scriptPanel, /\{flow\.primaryAction\.label\}/);
});

test("Round 2 scene selection automatically continues into deepening image generation", () => {
  const card = componentSource("CreativeDirectionsCard");
  const splitStart = card.indexOf("async function handleSplitRound2Storyboard");
  const splitEnd = card.indexOf("\n  async function handleRunRound2JobAction", splitStart);
  const splitHandler = card.slice(splitStart, splitEnd);
  const imageStart = card.indexOf("async function handleGenerateSelectedAtmosphereImages");
  const imageEnd = card.indexOf("\n  async function handleSendRound1Review", imageStart);
  const imageHandler = card.slice(imageStart, imageEnd);

  assert.match(splitHandler, /const splitCompleted = await handleRunRound2JobAction/);
  assert.match(splitHandler, /if \(splitCompleted\)[\s\S]*await handleGenerateSelectedAtmosphereImages\(\)/);
  assert.match(imageHandler, /const workspaceResult = await fetchWorkspace\(project\.id\)/);
  assert.match(imageHandler, /const missingStoryboardDirections = currentGenerationDirections\.filter/);
  assert.ok(imageHandler.indexOf("const workspaceResult = await fetchWorkspace(project.id)") < imageHandler.indexOf("const missingStoryboardDirections = currentGenerationDirections.filter"));
});

test("Round 2 deepening scenes render as horizontal scene cards instead of a four-column grid", () => {
  const directionCard = componentSource("CreativeDirectionAtmosphereCard");
  const sceneCell = componentSource("CreativeStoryAtmosphereCell");

  assert.match(directionCard, /<CreativeStoryAtmosphereCell/);
  assert.doesNotMatch(directionCard, /md:grid-cols-2 lg:grid-cols-4/);
  assert.match(sceneCell, /md:grid-cols-\[minmax\(0,1fr\)_minmax\(16rem,22rem\)\]/);
  assert.match(sceneCell, /小分镜/);
  assert.match(sceneCell, /画面风格/);
  assert.doesNotMatch(sceneCell, /风险备注/);
  assert.doesNotMatch(sceneCell, /productionDifficulty/);
  assert.match(sceneCell, /深化视觉图/);
});

test("Round 2 final confirmation appears as a bottom action after deepening is complete", () => {
  const body = componentSource("Sop3CurrentTaskBody");
  const board = componentSource("CreativeExpansionBoard");
  const viewModel = readFileSync(new URL("./sop3-focused-flow-view-model.ts", import.meta.url), "utf8");

  assert.match(body, /canLaunchFinalConfirmation=\{flow\.currentTask\.statusLabel === "已补齐" && flow\.primaryAction\.disabledReason === null\}/);
  assert.match(board, /深化内容已补齐/);
  assert.match(board, /发起最终确认/);
  assert.match(board, /onFinalConfirmation/);
  assert.match(viewModel, /key: "generate_deepening_assets"/);
  assert.doesNotMatch(viewModel, /primaryAction = round2MaterialStats\.isComplete/);
});

test("SOP3 progress map switches the workspace into read-only historical views", () => {
  const card = componentSource("CreativeDirectionsCard");
  const map = componentSource("Sop3ProgressMap");
  const preview = componentSource("Sop3ProgressPreviewWorkspace");

  assert.match(map, /流程进展/);
  assert.match(map, /selectedNodeKey/);
  assert.match(map, /onSelectNode\(node\.key\)/);
  assert.doesNotMatch(map, /点击节点可在上方回看对应历史生成界面/);
  assert.doesNotMatch(map, /不改变当前项目状态/);
  assert.match(map, /xl:grid-cols-6/);
  assert.match(card, /previewProgressNodeKey/);
  assert.match(card, /<Sop3ProgressPreviewWorkspace/);
  assert.match(card, /<Sop3ProgressMap[\s\S]*selectedNodeKey=\{previewProgressNodeKey\}/);
  assert.match(preview, /历史回溯 · \{node\.label\}/);
  assert.match(preview, /<Sop3DirectionHistoryGrid/);
  assert.match(preview, /<Round1StyleImageBoard/);
  assert.match(preview, /<Sop3WaitingForClientPanel/);
  assert.match(preview, /<CreativeExpansionBoard/);
  assert.match(preview, /<Sop3FinalProposalSummary/);
  assert.match(preview, /readOnly/);
  assert.doesNotMatch(map, /setExpandedNode/);
  assert.doesNotMatch(map, /onRollback/);
  assert.doesNotMatch(map, /回滚/);
});
