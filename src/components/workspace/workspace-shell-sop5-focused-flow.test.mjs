import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./workspace-shell.tsx", import.meta.url), "utf8");
const apiSource = readFileSync(new URL("./api.ts", import.meta.url), "utf8");
const globalStyleSource = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

test("SOP5 workspace uses focused flow view model and two sub-tabs", () => {
  assert.match(source, /createSop5FocusedFlowViewModel/);
  assert.match(source, /activeSubStage={selectedSubStage === "script_storyboard_split" \? "storyboard_split" : "script_setup"}/);
  assert.match(source, /resolveSop5ActiveTab/);
  assert.match(source, /requestedTab: activeSubStage/);
  assert.match(source, /clientReviewTasks/);
  assert.doesNotMatch(source, /selectedSubStageDisabled/);
  assert.match(source, /脚本设定（完整剧本）/);
  assert.match(source, /文字分镜拆解/);
  assert.match(source, /activeSop5Tab === "script_setup"/);
  assert.match(source, /activeSop5Tab === "storyboard_split"/);
  assert.doesNotMatch(source, /aria-label="SOP5 聚焦工作区"/);
  assert.doesNotMatch(source, /sop5Flow\.tabs\.map/);
});

test("SOP5 removes legacy paste check and client-confirm copy", () => {
  assert.doesNotMatch(source, /checkScriptPackageFormat/);
  assert.doesNotMatch(source, /标准格式检查/);
  assert.doesNotMatch(source, /甲方完整剧本确认/);
  assert.doesNotMatch(source, /点击“检查”/);
});

test("SOP5 script setup exposes plain script revision and standardized script actions", () => {
  assert.match(source, /generatePlainScriptPackage\(project\.id\)/);
  assert.match(source, /revisePlainScriptPackage\(project\.id, packageId, \{\s*instruction/);
  assert.match(source, /startRevisionVoiceInput/);
  assert.match(source, /MediaRecorder/);
  assert.match(source, /transcribeScriptRevisionAudio\(project\.id/);
  assert.match(source, /inputMode: revisionInputMode/);
  assert.match(source, /语音输入/);
  assert.doesNotMatch(source, /语音输入暂未接入/);
  assert.doesNotMatch(source, /webkitSpeechRecognition/);
  assert.match(source, /scriptRevisionMessages={scriptRevisionMessages}/);
  assert.match(source, /currentRevisionMessages\.map/);
  assert.match(source, /AI 修订稿/);
  assert.match(source, /暂无修订对话/);
  assert.match(source, /generateStandardizedScriptFromPlain\(project\.id, packageId\)/);
  assert.match(source, /saveStandardizedScriptEdit\(project\.id, packageId/);
  assert.match(source, /重新生成标准剧本/);
  assert.match(source, /window\.confirm\("重新生成会用当前大白话剧本覆盖现有标准剧本。确认继续吗？"\)/);
  assert.match(source, /发送标准剧本给甲方/);
});

test("SOP5 script setup separates plain script revision and standardized script cards", () => {
  const scriptSetupStart = source.indexOf('activeSop5Tab === "script_setup"');
  assert.notEqual(scriptSetupStart, -1, "script setup branch should exist");
  const storyboardSplitStart = source.indexOf('activeSop5Tab === "storyboard_split"', scriptSetupStart);
  assert.notEqual(storyboardSplitStart, -1, "storyboard split branch should follow script setup");
  const scriptSetup = source.slice(scriptSetupStart, storyboardSplitStart);

  assert.match(scriptSetup, /<WorkspaceCard variant="stage">[\s\S]*生成的大白话剧本[\s\S]*连续修订[\s\S]*<\/WorkspaceCard>\s*<WorkspaceCard variant="stage">[\s\S]*标准剧本/);
  assert.match(scriptSetup, /标准剧本[\s\S]*<ClientReviewLaunchBox/);
});

test("storyboard media rails use storyboard split order instead of raw response order", () => {
  assert.match(source, /sortStoryboardShotsForNavigation/);
  assert.match(source, /orderedShots = sortStoryboardShotsForNavigation\(shots, scenes\)/);
  assert.match(source, /<StoryboardAssetRail[\s\S]*shots={orderedShots}/);
});

test("storyboard video canvas uses approved storyboard images as pre-video reference posters", () => {
  assert.match(source, /isStoryboardImageUsableForVideo/);
  assert.match(source, /isStoryboardImageUsableForVideo\(image, activeShot\)/);
  assert.match(source, /selectedStoryboardImage\.ossUrl/);
  assert.match(source, /当前分镜待生成视频/);
  assert.match(source, /buildConfirmedStoryboardImageMap\(images, shots\)/);
  assert.match(source, /image\.isSelected \|\| shot\.status === "client_approved" \|\| image\.internalReviewStatus === "confirmed"/);
});

test("storyboard video director handoff is a compact multi-select download step", () => {
  assert.match(source, /selectedDownloadVideoIds/);
  assert.match(source, /toggleDownloadVideoSelection/);
  assert.match(source, /downloadSelectedVideos/);
  assert.match(source, /downloadStoryboardVideosZip\(project\.id/);
  assert.match(source, /URL\.createObjectURL/);
  assert.match(source, /enterACopyRevision/);
  assert.match(source, /进入下一轮/);
  assert.doesNotMatch(source, /导演素材下发/);
  assert.doesNotMatch(source, /视频生成阶段不发甲方/);
  assert.doesNotMatch(source, /设为正式内部视频/);
  assert.doesNotMatch(source, /读取本场视频包/);
  assert.doesNotMatch(source, /下载本场全部/);
});

test("storyboard video generation runs requests concurrently and sends selected duration", () => {
  assert.match(source, /videoDurationSeconds/);
  assert.match(source, /generatingVideoShotIds/);
  assert.match(source, /activeShotGenerating/);
  assert.match(source, /Promise\.all\(/);
  assert.match(source, /durationSeconds: videoDurationSeconds/);
  assert.match(source, /waitForStoryboardVideoJobs/);
  assert.match(source, /视频已生成，已自动刷新到当前分镜。/);
  assert.match(source, /aria-label="视频时长"/);
  assert.match(source, /disabled=\{!canOperate \|\| Boolean\(generateVideoDisabledReason\) \|\| activeShotGenerating\}/);
  assert.doesNotMatch(source, /busyKey === "generate-video"/);
  assert.doesNotMatch(source, /for \(let index = 0; index < generateCount; index \+= 1\) \{\s*const result = await generateStoryboardVideo/);
});

test("storyboard image generation busy state is scoped to the selected shot", () => {
  assert.match(source, /generatingImageShotIds/);
  assert.match(source, /runStoryboardImageGeneration\(activeShot\.id\)/);
  assert.match(source, /waitForStoryboardImageJobs/);
  assert.match(source, /分镜图片已生成，候选图已自动刷新。/);
  assert.match(source, /disabled=\{!canOperate \|\| !activeShot \|\| activeShotGenerating\}/);
  assert.match(source, /busyShotIds=\{generatingImageShotIds\}/);
  assert.doesNotMatch(source, /busyKey === "generate-image"/);
});

test("storyboard image and video stages use separate workbench and submit/download cards", () => {
  assert.match(source, /<WorkspaceCard variant="stage">[\s\S]*分镜图片生成[\s\S]*<div className="storyboard-image-layout">/);
  assert.match(source, /<\/WorkspaceCard>\s*<div className="grid gap-4">\s*<WorkspaceCard variant="stage">[\s\S]*分镜图片全量提交审核/);
  assert.match(source, /<WorkspaceCard variant="stage">[\s\S]*AI 视频生成[\s\S]*<div className="storyboard-video-layout">/);
  assert.match(source, /<section className="storyboard-video-stage"[\s\S]*storyboard-video-version-strip[\s\S]*<StoryboardAssetRail[\s\S]*title="全部分镜导航"[\s\S]*<\/section>/);
  assert.doesNotMatch(source, /storyboard-video-side-rail/);
  assert.match(source, /<\/WorkspaceCard>\s*<WorkspaceCard variant="stage">[\s\S]*视频素材/);
});

test("storyboard image canvas follows structured Brief-style hierarchy", () => {
  const imageCanvasStart = source.indexOf("function StoryboardImageCanvasModule");
  assert.notEqual(imageCanvasStart, -1, "storyboard image canvas module should exist");
  const videoCanvasStart = source.indexOf("function StoryboardVideoCanvasModule", imageCanvasStart);
  assert.notEqual(videoCanvasStart, -1, "storyboard video canvas module should follow image canvas");
  const imageCanvas = source.slice(imageCanvasStart, videoCanvasStart);

  assert.match(imageCanvas, /text-lg font-semibold tracking-tight text-\[var\(--text-primary\)\][\s\S]*分镜图片生成/);
  assert.match(imageCanvas, /storyboard-shot-summary/);
  assert.match(imageCanvas, /场次 \$\{activeScene\.sceneNumber\} · 镜头 \$\{activeShot\.shotNumber\}/);
  assert.match(imageCanvas, /<section className="storyboard-image-stage"[\s\S]*storyboard-candidate-strip[\s\S]*<StoryboardAssetRail[\s\S]*title="全部分镜导航"[\s\S]*<\/section>/);
  assert.doesNotMatch(imageCanvas, />当前分镜</);
  assert.doesNotMatch(imageCanvas, />画面内容</);
  assert.match(imageCanvas, /storyboard-generation-console/);
  assert.match(imageCanvas, /storyboard-reference-dock/);
  assert.match(imageCanvas, /添加额外参考图/);
  assert.match(imageCanvas, /const \[storyboardImagePreview, setStoryboardImagePreview\]/);
  assert.match(imageCanvas, /className="storyboard-main-preview"[\s\S]*setStoryboardImagePreview\(selectedImage\)[\s\S]*当前主图全图预览/);
  assert.match(imageCanvas, /alt=\{`\$\{activeShot\?\.shotNumber \?\? "分镜"\} 当前主图`\} className="h-full w-full object-cover"/);
  assert.match(imageCanvas, /storyboardImagePreview\?\.ossUrl && typeof document !== "undefined" && createPortal/);
  assert.match(imageCanvas, /storyboardImagePreview\?\.ossUrl[\s\S]*z-\[120\][\s\S]*role="dialog"[\s\S]*全图预览[\s\S]*object-contain/);
  assert.match(imageCanvas, /storyboard-generation-toolbar[\s\S]*storyboard-generate-button[\s\S]*<ArrowUp/);
  assert.match(imageCanvas, /createUploadUrl\(project\.id/);
  assert.match(imageCanvas, /registerUploadedAsset\(project\.id/);
  assert.match(imageCanvas, /extraReferenceImageUrls/);
  assert.match(imageCanvas, /保存当前全量包后生成甲方审核链接/);
  assert.match(imageCanvas, /可提交图片/);
  assert.match(imageCanvas, /提交记录/);
  assert.match(imageCanvas, /逐条保留甲方 OK \/ 不 OK 结果和修改意见。/);
  assert.match(imageCanvas, /修改意见/);
  assert.doesNotMatch(imageCanvas, /每次保存都会把当前所有分镜图片打成一轮全量审核包/);
  assert.doesNotMatch(imageCanvas, /如需一致性，建议先在 SOP5 设定图卡片中生成并“设为采用”后再生成/);
  assert.doesNotMatch(imageCanvas, /SOP 6 按场内每条分镜逐条确认/);
  assert.doesNotMatch(imageCanvas, /这条分镜上一轮已通过甲方确认/);
  assert.doesNotMatch(imageCanvas, /选择分镜、确认参考图，再生成当前镜头候选图。/);
  assert.doesNotMatch(imageCanvas, /<MiniMetric label="分镜总数"/);
  assert.doesNotMatch(imageCanvas, /<MiniMetric label="可提交"/);
  assert.doesNotMatch(imageCanvas, /<MiniMetric label="已通过"/);
  assert.doesNotMatch(imageCanvas, />提示词</);
  assert.match(globalStyleSource, /\.storyboard-generation-console\s*\{/);
  assert.match(globalStyleSource, /\.storyboard-reference-dock\s*\{/);
  assert.match(globalStyleSource, /\.storyboard-extra-reference-tile\s*\{/);
  assert.match(globalStyleSource, /\.storyboard-image-shell\s*\{[\s\S]*height: auto;[\s\S]*min-height: min\(50rem, max\(38rem, calc\(100vh - 10rem\)\)\);/);
  assert.match(globalStyleSource, /\.storyboard-image-workbench\s*\{[\s\S]*height: auto;[\s\S]*grid-template-rows: auto clamp\(24rem, 32vw, 28\.5rem\) auto;/);
  assert.match(globalStyleSource, /\.storyboard-image-stage,\s*[\s\S]*\.storyboard-video-stage\s*\{[\s\S]*gap: 0\.6rem;/);
  assert.match(globalStyleSource, /\.storyboard-image-stage\s*\{[\s\S]*min-height: clamp\(24rem, 32vw, 28\.5rem\);[\s\S]*grid-template-columns: minmax\(0, 1fr\) clamp\(8\.25rem, 10vw, 10\.75rem\) clamp\(7\.25rem, 12vw, 9\.5rem\);/);
  assert.match(globalStyleSource, /\.storyboard-main-preview\s*\{[\s\S]*min-height: clamp\(24rem, 32vw, 28\.5rem\);[\s\S]*height: clamp\(24rem, 32vw, 28\.5rem\);/);
  assert.match(globalStyleSource, /button\.storyboard-main-preview\s*\{[\s\S]*cursor: zoom-in;/);
  assert.match(globalStyleSource, /\.storyboard-image-stage \.storyboard-candidate-strip\s*\{[\s\S]*min-height: clamp\(24rem, 32vw, 28\.5rem\);/);
  assert.match(globalStyleSource, /\.storyboard-image-stage \.storyboard-image-nav-rail\s*\{[\s\S]*min-height: clamp\(24rem, 32vw, 28\.5rem\);[\s\S]*height: auto;/);
  assert.match(globalStyleSource, /\.storyboard-candidate-thumb\s*\{[\s\S]*aspect-ratio: 16 \/ 9;/);
  assert.match(globalStyleSource, /\.storyboard-rail-thumb\s*\{[\s\S]*aspect-ratio: 16 \/ 9;/);
  assert.match(globalStyleSource, /\.storyboard-image-controls \.storyboard-controls-inner\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(globalStyleSource, /\.storyboard-generation-console\s*\{[\s\S]*min-height: 8\.6rem;[\s\S]*grid-template-rows: auto minmax\(3\.2rem, 1fr\) auto;/);
  assert.match(globalStyleSource, /\.storyboard-reference-dock\s*\{[\s\S]*flex-wrap: wrap;/);
  assert.match(globalStyleSource, /\.storyboard-prompt-field,\s*[\s\S]*\.storyboard-video-prompt-field\s*\{[\s\S]*min-height: 4\.4rem;/);
  assert.match(globalStyleSource, /\.storyboard-generate-button\[data-slot="button"\]\s*\{[\s\S]*width: 3\.35rem;[\s\S]*border-radius: var\(--radius-pill\);[\s\S]*background: var\(--accent\);/);
});

test("storyboard video canvas follows the image generation workbench and supports full preview", () => {
  const videoCanvasStart = source.indexOf("function StoryboardVideoCanvasModule");
  assert.notEqual(videoCanvasStart, -1, "storyboard video canvas module should exist");
  const videoCanvasEnd = source.indexOf("function buildDefaultStoryboardVideoPrompt", videoCanvasStart);
  assert.notEqual(videoCanvasEnd, -1, "video prompt helper should follow video canvas");
  const videoCanvas = source.slice(videoCanvasStart, videoCanvasEnd);

  assert.match(videoCanvas, /const \[storyboardVideoPreview, setStoryboardVideoPreview\]/);
  assert.match(videoCanvas, /text-lg font-semibold tracking-tight text-\[var\(--text-primary\)\][\s\S]*AI 视频生成/);
  assert.match(videoCanvas, /storyboard-shot-summary/);
  assert.match(videoCanvas, /场次 \$\{activeScene\.sceneNumber\} · 镜头 \$\{activeShot\.shotNumber\}/);
  assert.doesNotMatch(videoCanvas, /storyboard-shot-index/);
  assert.match(videoCanvas, /<section className="storyboard-video-stage"[\s\S]*storyboard-video-version-strip[\s\S]*<StoryboardAssetRail[\s\S]*title="全部分镜导航"[\s\S]*<\/section>/);
  assert.match(videoCanvas, /className="storyboard-video-player"[\s\S]*setStoryboardVideoPreview\(selectedVideo\)[\s\S]*当前视频全屏预览/);
  assert.match(videoCanvas, /storyboard-generation-console/);
  assert.match(videoCanvas, /storyboard-reference-dock/);
  assert.match(videoCanvas, /storyboard-generation-toolbar[\s\S]*storyboard-generate-button[\s\S]*<ArrowUp/);
  assert.match(videoCanvas, /storyboardVideoPreview\?\.ossUrl && typeof document !== "undefined" && createPortal/);
  assert.match(videoCanvas, /storyboardVideoPreview\?\.ossUrl[\s\S]*z-\[120\][\s\S]*role="dialog"[\s\S]*全屏预览[\s\S]*<video[\s\S]*controls[\s\S]*object-contain/);
  assert.match(globalStyleSource, /\.storyboard-video-layout\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(globalStyleSource, /\.storyboard-video-shell\s*\{[\s\S]*height: auto;[\s\S]*min-height: min\(50rem, max\(38rem, calc\(100vh - 10rem\)\)\);/);
  assert.match(globalStyleSource, /\.storyboard-video-workbench\s*\{[\s\S]*height: auto;[\s\S]*grid-template-rows: auto clamp\(24rem, 32vw, 28\.5rem\) auto;/);
  assert.match(globalStyleSource, /\.storyboard-video-stage\s*\{[\s\S]*min-height: clamp\(24rem, 32vw, 28\.5rem\);[\s\S]*grid-template-columns: minmax\(0, 1fr\) clamp\(8\.25rem, 10vw, 10\.75rem\) clamp\(7\.25rem, 12vw, 9\.5rem\);/);
  assert.match(globalStyleSource, /\.storyboard-video-player\s*\{[\s\S]*min-height: clamp\(24rem, 32vw, 28\.5rem\);[\s\S]*height: clamp\(24rem, 32vw, 28\.5rem\);/);
  assert.match(globalStyleSource, /button\.storyboard-video-player\s*\{[\s\S]*cursor: zoom-in;/);
  assert.match(globalStyleSource, /\.storyboard-video-stage \.storyboard-video-version-strip\s*\{[\s\S]*min-height: clamp\(24rem, 32vw, 28\.5rem\);/);
  assert.match(globalStyleSource, /\.storyboard-video-stage \.storyboard-video-nav-rail\s*\{[\s\S]*min-height: clamp\(24rem, 32vw, 28\.5rem\);[\s\S]*height: auto;/);
  assert.match(globalStyleSource, /\.storyboard-video-controls \.storyboard-video-controls-inner\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\);/);
});

test("storyboard video navigation thumbnails recover the source image from generated videos", () => {
  assert.match(source, /function buildStoryboardVideoNavigationImageMap\(images: StoryboardImageView\[], videos: StoryboardVideoView\[], shots: StoryboardShotView\[]\)/);
  assert.match(source, /const imageById = new Map\(images\.map\(\(image\) => \[image\.id, image\]\)\)/);
  assert.match(source, /const sourceImage = imageById\.get\(video\.imageId\)/);
  assert.match(source, /selectedByShotId\.set\(video\.shotId, sourceImage\.ossUrl\)/);
  assert.match(source, /selectedByShotId=\{buildStoryboardVideoNavigationImageMap\(images, videos, shots\)\}/);
});

test("storyboard image batch review link uses the standard access card instead of a success toast", () => {
  const batchReviewStart = source.indexOf("分镜图片全量提交审核");
  assert.notEqual(batchReviewStart, -1, "batch review card should exist");
  const batchReviewCard = source.slice(batchReviewStart, source.indexOf("提交记录", batchReviewStart));

  assert.match(source, /const \[createdBatchReview, setCreatedBatchReview\]/);
  assert.match(source, /async function handleCreateBatchReview\(batchId: string\)/);
  assert.match(batchReviewCard, /createdBatchReview &&/);
  assert.match(batchReviewCard, /审核链接/);
  assert.match(batchReviewCard, /验证码 \/ 密钥/);
  assert.match(batchReviewCard, /buildReviewLinkWithVerificationCode\(createdBatchReview\.url, createdBatchReview\.code\)/);
  assert.match(batchReviewCard, /createdBatchReview\.code/);
  assert.match(batchReviewCard, /链接已包含验证码，甲方打开后仍需手动进入审核。/);
  assert.doesNotMatch(batchReviewCard, /验证码：\$\{data\.verificationCode\}；链接：\$\{data\.reviewUrl\}/);
});

test("production setup review link includes the verification code in the displayed URL", () => {
  const setupReviewStart = source.indexOf("createdSetupReview &&");
  assert.notEqual(setupReviewStart, -1, "setup review access card should exist");
  const setupReviewCard = source.slice(setupReviewStart, source.indexOf("SOP5 只读流程进展图", setupReviewStart));

  assert.match(setupReviewCard, /审核链接/);
  assert.match(setupReviewCard, /buildReviewLinkWithVerificationCode\(createdSetupReview\.url, createdSetupReview\.code\)/);
  assert.match(setupReviewCard, /链接已包含验证码，甲方打开后仍需手动进入审核。/);
});

test("review cut flow keeps transition cards below timestamp feedback", () => {
  const reviewCut = source.slice(source.indexOf("function ReviewCutStageModule"), source.indexOf("function Feedback"));
  const uploadIndex = reviewCut.indexOf("A copy 成片审核");
  const timestampIndex = reviewCut.indexOf("甲方时间戳回传");
  const bCopyIndex = reviewCut.indexOf("B Copy 流转");
  const archiveIndex = reviewCut.indexOf("完整归档流转");

  assert.ok(uploadIndex >= 0, "upload card should exist");
  assert.ok(timestampIndex > uploadIndex, "timestamp card should be after upload card");
  assert.ok(bCopyIndex > timestampIndex, "B Copy transition should be below timestamp card");
  assert.ok(archiveIndex > timestampIndex, "archive transition should be below timestamp card");
});

test("review cut workspace follows structured Brief-style text hierarchy", () => {
  const reviewCut = source.slice(source.indexOf("function ReviewCutStageModule"), source.indexOf("function Feedback"));

  assert.match(reviewCut, /stageTitle = cutType === "a_copy" \? "A copy 成片审核" : "B copy 定稿确认"/);
  assert.match(reviewCut, /<h3 className="text-lg font-semibold tracking-tight text-\[var\(--text-primary\)\]">\{stageTitle\}<\/h3>/);
  assert.match(reviewCut, />当前版本</);
  assert.match(reviewCut, />审核状态</);
  assert.match(reviewCut, /uploadTitle = cutType === "a_copy" \? "上传 A copy" : "上传 B copy"/);
  assert.match(reviewCut, /\{uploadBusy \? reviewCutUploadLabel\(uploadState\) : uploadTitle\}/);
  assert.match(reviewCut, />内部说明</);
  assert.match(reviewCut, />时间点</);
  assert.match(reviewCut, />修改意见</);
  assert.match(reviewCut, />定位状态</);
  assert.match(reviewCut, />场次</);
  assert.match(reviewCut, />分镜</);
  assert.match(reviewCut, />当前阶段</);
  assert.match(reviewCut, />下一步</);
  assert.doesNotMatch(reviewCut, /这里只收导演剪出的 A copy 成片/);
  assert.doesNotMatch(reviewCut, /这里只收 B copy 近最终成片/);
  assert.doesNotMatch(reviewCut, /系统会把秒数粗定位到场次\/分镜/);
  assert.doesNotMatch(reviewCut, /生成审核链接后，甲方可观看完整视频并提交时间戳批注/);
  assert.doesNotMatch(reviewCut, /人工确认 A Copy 已完成交付后/);
  assert.doesNotMatch(reviewCut, /B Copy 通过后，可人工确认进入结算交付与完整归档/);
});

test("archive workspace is framed by one stage card", () => {
  const archiveStart = source.indexOf("function ArchiveRecordCard");
  const archiveEnd = source.indexOf("function ArchiveCheckbox", archiveStart);
  const archiveSource = source.slice(archiveStart, archiveEnd);

  assert.match(archiveSource, /return \(\s*<WorkspaceCard variant="stage">[\s\S]*完成归档检查/);
  assert.match(archiveSource, /<\/div>\s*<\/WorkspaceCard>\s*\);/);
});

test("archive workspace follows structured Brief-style text hierarchy", () => {
  const archiveStart = source.indexOf("function ArchiveRecordCard");
  const archiveEnd = source.indexOf("function ArchiveCheckbox", archiveStart);
  const archiveSource = source.slice(archiveStart, archiveEnd);

  assert.match(archiveSource, /<h3 className="ds-text-section-title">完整归档<\/h3>/);
  assert.match(archiveSource, /grid gap-2 text-sm md:grid-cols-3/);
  assert.match(archiveSource, /text-sm font-semibold tracking-tight text-\[var\(--text-secondary\)\]/);
  assert.match(archiveSource, /text-base font-medium leading-7 text-\[var\(--text-primary\)\]/);
  assert.match(archiveSource, />归档条件</);
  assert.match(archiveSource, />交付渠道</);
  assert.match(archiveSource, />NAS 归档位置</);
  assert.match(archiveSource, />案例展示权</);
  assert.match(archiveSource, />售后说明</);
  assert.match(archiveSource, />完成归档检查</);
  assert.doesNotMatch(archiveSource, /缺项清空后才可以关闭项目/);
  assert.doesNotMatch(archiveSource, /关闭会写入阶段状态机/);
  assert.doesNotMatch(archiveSource, /尾款已确认到账，结算金额没有待核对项/);
  assert.doesNotMatch(archiveSource, /成片、封面、工程文件和约定素材已准备完整/);
  assert.doesNotMatch(archiveSource, /格式、分辨率、字幕、音画同步和命名规范已复核/);
  assert.doesNotMatch(archiveSource, /最终文件、源文件、合同和交付记录已归档到 NAS/);
});

test("storyboard rejected feedback is shown from thumbnail hover cards", () => {
  assert.match(source, /storyboard-rail-thumb group relative/);
  assert.match(source, /rejectedFeedback && "is-rejected"/);
  assert.match(source, /storyboard-rail-feedback-card/);
  assert.match(source, /甲方修改批注/);
  assert.match(source, /rejectedFeedback\.feedback \|\| "甲方未填写单条批注"/);
  assert.doesNotMatch(source, /批次甲方反馈/);
  assert.doesNotMatch(source, /latestBatchFeedback/);
  assert.doesNotMatch(source, /批注：\{rejectedFeedback\.feedback/);
});

test("SOP5 storyboard split depends on standardized script instead of client approval", () => {
  assert.match(source, /sop5Flow\.storyboardSplit\.canGenerateStoryboard/);
  assert.match(source, /标准剧本生成后即可调用文本模型拆解详细文字分镜/);
  assert.doesNotMatch(source, /scriptReviewApproved/);
  assert.doesNotMatch(source, /经甲方确认后/);
});

test("SOP5 storyboard split follows structured Brief-style hierarchy", () => {
  const storyboardSplitStart = source.indexOf('activeSop5Tab === "storyboard_split"');
  assert.notEqual(storyboardSplitStart, -1, "storyboard split branch should exist");
  const productionSetupStart = source.indexOf("人物场景设定", storyboardSplitStart);
  assert.notEqual(productionSetupStart, -1, "production setup card should follow storyboard split card");
  const storyboardSplit = source.slice(storyboardSplitStart, productionSetupStart);

  assert.match(storyboardSplit, /text-lg font-semibold tracking-tight text-\[var\(--text-primary\)\]/);
  assert.match(storyboardSplit, /max-w-3xl text-sm font-medium leading-6 text-\[var\(--text-secondary\)\]/);
  assert.match(storyboardSplit, /场次/);
  assert.match(storyboardSplit, /分镜/);
  assert.match(storyboardSplit, /状态/);
  assert.match(storyboardSplit, /场次说明/);
  assert.match(storyboardSplit, /分镜列表/);
  assert.match(storyboardSplit, /镜号/);
  assert.match(storyboardSplit, /画面内容/);
  assert.match(storyboardSplit, /确认后同步人物\/场景引用/);
  assert.doesNotMatch(storyboardSplit, /并同步抽取人物和场景设定清单/);
  assert.doesNotMatch(storyboardSplit, /通常需要几十秒/);
});

test("SOP5 storyboard auto split action uses the primary blue button style", () => {
  const storyboardSplitStart = source.indexOf('activeSop5Tab === "storyboard_split"');
  assert.notEqual(storyboardSplitStart, -1, "storyboard split branch should exist");
  const buttonStart = source.indexOf('<Button\n                type="button"', storyboardSplitStart);
  assert.notEqual(buttonStart, -1, "auto split button should exist");
  const autoSplitButton = source.slice(
    buttonStart,
    source.indexOf("自动拆分文字分镜", buttonStart)
  );

  assert.match(autoSplitButton, /<Button[\s\S]*type="button"[\s\S]*onClick=\{\(\) => void handleSplit\(latestPackage\.id\)\}/);
  assert.doesNotMatch(autoSplitButton, /variant="outline"/);
});

test("SOP5 keeps storyboard sequence and production entity controls with read-only progress map", () => {
  assert.match(source, /编辑序列/);
  assert.match(source, /保存序列/);
  assert.match(source, /新增分镜/);
  assert.match(source, /确认文字分镜/);
  assert.match(source, /handleConfirmStoryboardSequence/);
  assert.match(source, /confirmStoryboardSequence\(project\.id\)/);
  assert.match(apiSource, /export async function confirmStoryboardSequence/);
  assert.match(apiSource, /\/storyboard-scenes\/confirm-sequence/);
  assert.match(source, /isStoryboardSequenceConfirmed/);
  assert.match(source, /disabled=\{!canEdit \|\| storyboardShots\.length === 0 \|\| isStoryboardSequenceConfirmed/);
  assert.match(source, /disabled=\{!canEdit \|\| !isStoryboardSequenceConfirmed \|\| activeProductionEntities\.length === 0/);
  assert.match(source, /清单确认区/);
  assert.match(source, /移入忽略列表/);
  assert.match(source, /设定图生成区/);
  assert.match(source, /设为采用/);
  assert.match(source, /generatingReferenceEntityIds/);
  assert.match(source, /generatingReferenceEntityIds\.has\(entity\.id\)/);
  assert.match(source, /disabled=\{!canEdit \|\| !isStoryboardSequenceConfirmed \|\| !isEntityListConfirmed \|\| !activeReference \|\| isGeneratingThisEntity \|\| entity\.status === "locked"\}/);
  assert.doesNotMatch(source, /isGeneratingReferenceImages/);
  assert.match(source, /请先确认文字分镜，再确认人物和场景设定。/);
  assert.match(source, /sop5Flow\.progressNodes\.map/);
  assert.match(source, /只读进度节点/);
});
