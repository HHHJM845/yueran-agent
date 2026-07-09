import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./workspace-shell.tsx", import.meta.url), "utf8");
const globalStyles = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
const structureRequirementSource = readFileSync(new URL("../../server/use-cases/structure-requirement.ts", import.meta.url), "utf8");
const analyzeAssetSource = readFileSync(new URL("../../server/use-cases/analyze-asset.ts", import.meta.url), "utf8");
const confirmRequirementRouteSource = readFileSync(new URL("../../app/api/projects/[projectId]/requirements/confirm/route.ts", import.meta.url), "utf8");
const clientReviewRouteSource = readFileSync(new URL("../../app/api/projects/[projectId]/client-reviews/route.ts", import.meta.url), "utf8");
const clientReviewUseCaseSource = readFileSync(new URL("../../server/use-cases/client-review.ts", import.meta.url), "utf8");

function componentSource(name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  const next = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

test("brief workspace keeps the work area focused on input, material directory, normalized brief, and missing-info deposit", () => {
  const briefCard = componentSource("BriefIntakeWorkflowCard");
  const rawPool = componentSource("BriefRawInputPool");

  assert.doesNotMatch(briefCard, /<BriefWorkflowSteps/);
  assert.doesNotMatch(briefCard, /<ProjectBasicsInlineSection/);
  assert.match(briefCard, /<BriefInternalConfirmBox[\s\S]*isBriefInternallyConfirmed=\{isBriefInternallyConfirmed\}/);

  assert.match(rawPool, /客户原始信息投放区/);
  assert.match(rawPool, /资料目录/);
  assert.match(rawPool, /assets\.length > 0[\s\S]*资料目录/);
  assert.doesNotMatch(rawPool, /assets\.length === 0 \?/);
  assert.match(briefCard, /<section className="ds-card-soft p-4 lg:col-span-2"[\s\S]*<BriefRawInputPool/);
  assert.doesNotMatch(briefCard, /<StageWorkCard/);
  assert.doesNotMatch(rawPool, /lg:grid-cols-\[minmax\(0,1\.1fr\)_minmax\(300px,0\.9fr\)\]/);
  assert.match(rawPool, /min-h-72/);
  assert.doesNotMatch(rawPool, /<p className="text-sm font-medium">缺失信息追问<\/p>[\s\S]*openQuestions\.length === 0/);
  assert.match(source, /待补充信息投放区/);
  assert.match(briefCard, /openQuestions\.length > 0[\s\S]*<BriefMissingInfoDeposit/);
  assert.doesNotMatch(briefCard, /SOP 1 · Brief 收集与需求结构化/);
});

test("brief workflow renders the four SOP1 sections as separate cards", () => {
  const briefCard = componentSource("BriefIntakeWorkflowCard");
  const missingDeposit = componentSource("BriefMissingInfoDeposit");
  const confirmBox = componentSource("BriefInternalConfirmBox");

  assert.match(briefCard, /<section className="ds-card-soft p-4 lg:col-span-2"[\s\S]*<BriefRawInputPool/);
  assert.match(briefCard, /<section className="ds-card-soft p-4 lg:col-span-2"[\s\S]*标准化 Brief 表格/);
  assert.match(missingDeposit, /<section className="ds-card-soft p-4 lg:col-span-2"/);
  assert.match(missingDeposit, /visibleQuestions\.map\(\(question, index\) =>/);
  assert.match(missingDeposit, /openQuestions\.filter\(\(question\) => !answeredQuestionKeys/);
  assert.match(missingDeposit, /brief-question-answer-card/);
  assert.match(missingDeposit, /answerDrafts/);
  assert.match(missingDeposit, /handleSubmitAllAnswers/);
  assert.match(missingDeposit, /提交并更新 Brief/);
  assert.doesNotMatch(missingDeposit, /提交本题并更新 Brief/);
  assert.match(confirmBox, /<section className="ds-card-soft p-4 lg:col-span-2"/);
  assert.doesNotMatch(briefCard, /<TaskCard[\s\S]*SOP 1/);
  assert.match(globalStyles, /\.workspace-main-area > section:not\(\[hidden\]\)[\s\S]*background: transparent/);
  assert.match(globalStyles, /\.workspace-main-area > section:not\(\[hidden\]\)[\s\S]*box-shadow: none/);
});

test("brief structuring result scrolls into view and keeps persisted job state visible", () => {
  const briefCard = componentSource("BriefIntakeWorkflowCard");
  const rawPool = componentSource("BriefRawInputPool");
  const missingDeposit = componentSource("BriefMissingInfoDeposit");
  const jobNotice = componentSource("BriefStructuringJobNotice");

  assert.match(briefCard, /const latestStructuringJob = jobs\.find\(\(job\) => job\.type === "requirement_structuring"\) \?\? null/);
  assert.match(briefCard, /const resultSectionRef = useRef<HTMLElement \| null>\(null\)/);
  assert.match(briefCard, /scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
  assert.match(briefCard, /ref=\{resultSectionRef\} className="ds-card-soft scroll-mt-24 p-4 lg:col-span-2"/);
  assert.match(briefCard, /<BriefStructuringJobNotice job=\{latestStructuringJob\} \/>/);
  assert.match(briefCard, /<BriefRawInputPool[\s\S]*structuringJob=\{latestStructuringJob\}/);
  assert.match(briefCard, /<BriefMissingInfoDeposit[\s\S]*structuringJob=\{latestStructuringJob\}/);
  assert.match(rawPool, /structuringJob: JobSummary \| null/);
  assert.match(rawPool, /const structuringJobRunning = isBriefStructuringJobRunning\(structuringJob\)/);
  assert.match(rawPool, /disabled=\{submitting \|\| structuringJobRunning\}/);
  assert.match(missingDeposit, /const structuringJobRunning = isBriefStructuringJobRunning\(structuringJob\)/);
  assert.match(missingDeposit, /disabled=\{submittingBriefUpdate \|\| structuringJobRunning\}/);
  assert.match(jobNotice, /Brief 已生成/);
  assert.match(source, /function isBriefStructuringJobRunning\(job: JobSummary \| null\)/);
});

test("brief intake copy stays minimal and does not reintroduce source-type helper text", () => {
  const rawPool = componentSource("BriefRawInputPool");
  const missingDeposit = componentSource("BriefMissingInfoDeposit");

  assert.match(rawPool, /客户原始信息投放区/);
  assert.match(rawPool, /placeholder=\{latest \? "粘贴客户针对缺失问题的回复，或补充新的需求信息\.\.\." : "粘贴客户原始 Brief、项目需求说明或补充材料\.\.\."\}/);
  assert.match(rawPool, /placeholder="资料链接"/);
  assert.doesNotMatch(rawPool, /微信聊天|客服回复|截图|飞书链接|本地文件/);
  assert.doesNotMatch(missingDeposit, /微信聊天|客服回复|截图|飞书链接|本地文件/);
});

test("brief generation and update loading copy stays provider-neutral", () => {
  const rawPool = componentSource("BriefRawInputPool");
  const missingDeposit = componentSource("BriefMissingInfoDeposit");
  const jobNotice = componentSource("BriefStructuringJobNotice");

  assert.match(rawPool, /setMessage\("在生成中"\)/);
  assert.match(rawPool, /\{submitting \|\| structuringJobRunning \? "在生成中" : latest \? "更新 Brief" : "AI 整理为标准 Brief"\}/);
  assert.match(missingDeposit, /setMessage\("在生成中"\)/);
  assert.match(missingDeposit, /\{submittingBriefUpdate \|\| structuringJobRunning \? "在生成中" : "提交并更新 Brief"\}/);
  assert.match(jobNotice, /isWaiting \|\| isRunning[\s\S]*\? "在生成中"/);
  assert.match(structureRequirementSource, /userMessage: "在生成中"/);
  assert.doesNotMatch(rawPool, /豆包模型|调用模型|文本模型|系统正在等待后台处理|正在创建后台任务/);
  assert.doesNotMatch(missingDeposit, /豆包模型|调用模型|文本模型|后台会生成新版标准化 Brief|系统正在整理补充信息/);
  assert.doesNotMatch(jobNotice, /豆包模型|调用模型|文本模型|系统正在调用模型整理客户需求|任务已经创建，但需要后台 worker/);
});

test("brief structuring stays in SOP1 until final Brief confirmation", () => {
  assert.match(
    structureRequirementSource,
    /await recordStageProgress\(\{[\s\S]*stageKey: "brand_requirement_intake"[\s\S]*status: "in_progress"[\s\S]*currentStage: "brand_requirement_intake"[\s\S]*title: "品牌方需求洽谈已整理"/
  );
  assert.doesNotMatch(structureRequirementSource, /title: "品牌方需求洽谈已整理"[\s\S]*currentStage: "technical_feasibility"/);
  assert.match(structureRequirementSource, /ensureBriefStageAfterStructuring/);
  assert.match(structureRequirementSource, /reviewType === "brief_confirmation" && task\.status === "approved"/);
  assert.match(structureRequirementSource, /extractAnsweredOpenQuestions/);
  assert.match(structureRequirementSource, /removeAnsweredOpenQuestions/);
  assert.match(source, /确认标准 Brief 内容无误/);
});

test("brief asset analysis does not advance SOP1 into risk check before client approval", () => {
  assert.match(analyzeAssetSource, /stageKey: "brand_requirement_intake"/);
  assert.match(analyzeAssetSource, /currentStage: "brand_requirement_intake"/);
  assert.doesNotMatch(analyzeAssetSource, /stageKey: "technical_feasibility"[\s\S]*title: "技术可行性评估资料已更新"/);
  assert.doesNotMatch(analyzeAssetSource, /stageKey: "technical_feasibility"[\s\S]*title: "技术可行性评估资料解析失败"/);
});

test("brief internal confirmation stays in SOP1 and waits for client approval", () => {
  const confirmBox = componentSource("BriefInternalConfirmBox");

  assert.doesNotMatch(confirmRequirementRouteSource, /generateRiskCheckFromProject/);
  assert.match(confirmRequirementRouteSource, /currentStage: "brand_requirement_intake"/);
  assert.match(confirmRequirementRouteSource, /internalConfirmed: true/);
  assert.doesNotMatch(confirmRequirementRouteSource, /riskCheck/);
  assert.match(confirmBox, /确认标准 Brief 内容无误/);
  assert.match(confirmBox, /标准 Brief 正在内部确认/);
  assert.match(confirmBox, /Brief 确认/);
  // Internal confirmation no longer blocks on open questions; confirming with pending items is allowed.
  assert.doesNotMatch(confirmBox, /暂不能生成甲方确认链接/);
  // Internal confirmation is decoupled from link generation; the link is created separately in ClientReviewLaunchBox.
  assert.doesNotMatch(confirmBox, /createWorkflowClientReview/);
  assert.doesNotMatch(confirmBox, /setCreatedReview/);
  assert.match(confirmBox, /setError\(result\.error\.message\);[\s\S]*await onRefresh\(\);/);
});

test("brief missing-info answers keep one input per question but submit all filled answers together", () => {
  const missingDeposit = componentSource("BriefMissingInfoDeposit");

  assert.match(missingDeposit, /const \[answerDrafts, setAnswerDrafts\]/);
  assert.match(missingDeposit, /const \[submittingBriefUpdate, setSubmittingBriefUpdate\]/);
  assert.match(missingDeposit, /const \[answeredQuestionKeys, setAnsweredQuestionKeys\]/);
  assert.match(missingDeposit, /visibleQuestions = openQuestions\.filter\(\(question\) => !answeredQuestionKeys\.has\(normalizeBriefQuestionKey\(question\)\)\)/);
  assert.match(missingDeposit, /const answeredEntries = visibleQuestions/);
  assert.match(missingDeposit, /answeredEntries\.map/);
  assert.match(missingDeposit, /【客户针对该问题的补充回复】/);
  assert.match(missingDeposit, /请至少填写一个待补充问题的客户回复，再更新标准化 Brief。/);
  assert.match(missingDeposit, /提交并更新 Brief/);
  assert.match(missingDeposit, /setAnsweredQuestionKeys\(\(current\) => \{/);
  assert.doesNotMatch(missingDeposit, /const \[supplementText, setSupplementText\]/);
  assert.doesNotMatch(missingDeposit, /handleSubmitQuestion/);
  assert.doesNotMatch(missingDeposit, /提交本题并更新 Brief/);
});

test("brief material directory excludes later review-cut videos", () => {
  const briefCard = componentSource("BriefIntakeWorkflowCard");

  assert.match(briefCard, /reviewCuts/);
  assert.match(briefCard, /briefAssets/);
  assert.match(briefCard, /reviewCutAssetIds/);
  assert.match(briefCard, /assets\.filter\(\(asset\) => !reviewCutAssetIds\.has\(asset\.id\)\)/);
  assert.match(briefCard, /<BriefRawInputPool[\s\S]*assets=\{briefAssets\}/);
  assert.match(briefCard, /<BriefMissingInfoDeposit[\s\S]*assets=\{briefAssets\}/);
});

test("project basics move from the brief work area into the project menu hover card", () => {
  const sidebar = componentSource("ProjectSidebar");
  const briefCard = componentSource("BriefIntakeWorkflowCard");

  assert.match(sidebar, /project-hover-card/);
  assert.match(sidebar, /负责人/);
  assert.match(sidebar, /截止时间/);
  assert.match(sidebar, /stageLabels\[project\.currentStage\]/);
  assert.doesNotMatch(briefCard, /项目基础信息/);
});

test("risk check copy describes order landing feasibility instead of technical feasibility review", () => {
  const riskCard = componentSource("TechnicalFeasibilityReviewCard");

  assert.match(riskCard, /接单风险评估/);
  assert.match(riskCard, /综合判断/);
  assert.doesNotMatch(riskCard, /技术可行性/);
  assert.doesNotMatch(riskCard, /风险体检卡/);
  assert.doesNotMatch(riskCard, /事实抽取/);
  assert.doesNotMatch(riskCard, /评估订单是否能够顺利落地/);
});

test("brief confirmation is a dedicated decision area after normalized brief and missing-info deposit", () => {
  const briefCard = componentSource("BriefIntakeWorkflowCard");
  const confirmBox = componentSource("BriefInternalConfirmBox");

  assert.match(briefCard, /<StructuredRequirementPreview artifact=\{latest\} \/>[\s\S]*<BriefMissingInfoDeposit[\s\S]*<BriefInternalConfirmBox/);
  assert.match(confirmBox, /Brief 确认/);
  assert.match(confirmBox, /确认标准 Brief 内容无误/);
  assert.match(confirmBox, /<ClientReviewLaunchBox/);
  assert.doesNotMatch(confirmBox, /确认进入风险体检/);
});

test("brief client review uses the existing brief_confirmation review type", () => {
  const confirmBox = componentSource("BriefInternalConfirmBox");

  assert.match(confirmBox, /isBriefInternallyConfirmed \|\| hasBriefClientReview/);
  assert.match(confirmBox, /<ClientReviewLaunchBox[\s\S]*reviewType="brief_confirmation"[\s\S]*targetScopeId=\{projectId\}/);
  assert.match(confirmBox, /title="甲方审核链接"/);
  assert.match(confirmBox, /embedded/);
  assert.doesNotMatch(confirmBox, /请先完成内部 Brief 确认，再生成甲方确认链接。/);
  assert.match(clientReviewRouteSource, /z\.enum\(\[[\s\S]*"brief_confirmation"/);
  assert.match(clientReviewUseCaseSource, /reviewType: z\.enum\(\[[\s\S]*"brief_confirmation"/);
  assert.match(clientReviewUseCaseSource, /if \(input\.reviewType === "brief_confirmation"\)/);
  assert.match(clientReviewUseCaseSource, /if \(reviewType === "brief_confirmation"\)/);
  assert.match(clientReviewUseCaseSource, /generateRiskCheckAfterBriefApproval/);
  assert.match(clientReviewUseCaseSource, /input\.reviewType === "brief_confirmation" && approved/);
});

test("brief preview removes duplicated pending-question warning and renders bold-only highlights", () => {
  const briefCard = componentSource("BriefIntakeWorkflowCard");
  const preview = componentSource("StructuredRequirementPreview");
  const missingDeposit = componentSource("BriefMissingInfoDeposit");
  const richText = `${componentSource("renderBriefRichText")}\n${componentSource("renderBriefRichToken")}`;

  assert.doesNotMatch(briefCard, /每次整理或补充都会保存为新的 Brief 版本/);
  assert.doesNotMatch(preview, /待确认项，可带入后续环节/);
  assert.doesNotMatch(preview, /openQuestions\.length > 0 &&/);
  assert.doesNotMatch(preview, /artifact\.title/);
  assert.doesNotMatch(preview, /v\{artifact\.version\}/);
  assert.match(preview, /formatArtifactValue\(value\)/);
  assert.match(source, /briefHighlightedFieldLabels = new Set\(\["产品\/服务", "视频目标", "核心卖点", "时间节点", "预算\/报价"\]\)/);
  assert.match(preview, /className="text-sm font-semibold tracking-tight text-\[var\(--text-secondary\)\]"/);
  assert.match(preview, /isHighlightedField[\s\S]*\? "font-semibold text-\[var\(--text-primary\)\]"/);
  assert.match(preview, /isEmptyValue[\s\S]*text-\[var\(--text-tertiary\)\]/);
  assert.match(richText, /token\.startsWith\("\*\*"\)/);
  assert.match(richText, /<strong key=\{key\} className="font-semibold text-\[var\(--text-primary\)\]">/);
  assert.doesNotMatch(richText, /brief-rich-highlight/);
  assert.doesNotMatch(richText, /brief-rich-bg/);
  assert.doesNotMatch(richText, /text-\[var\(--danger\)\]|text-\[var\(--accent\)\]|text-\[var\(--success\)\]/);
  assert.match(missingDeposit, /bg-\[rgba\(184,83,80,0\.08\)\]/);
});

test("brief review launch copies a complete link with hash verification code", () => {
  const launchBox = componentSource("ClientReviewLaunchBox");
  const linkBuilder = componentSource("buildReviewLinkWithVerificationCode");

  assert.match(launchBox, /copyingReviewLink/);
  assert.match(launchBox, /navigator\.clipboard\.writeText\(buildReviewLinkWithVerificationCode\(createdReview\.url, createdReview\.code\)\)/);
  assert.match(launchBox, /一键复制完整链接/);
  assert.match(launchBox, /甲方打开后会自动填入验证码，仍需手动进入审核/);
  assert.match(linkBuilder, /reviewUrl\.hash = `key=\$\{encodeURIComponent\(code\)\}`/);
});

test("risk check panel shows one concise visual conclusion panel and defers rejection details", () => {
  const riskCard = componentSource("TechnicalFeasibilityReviewCard");

  assert.match(riskCard, /buildRiskIssues/);
  assert.match(riskCard, /getRiskPanelSummary/);
  assert.match(riskCard, /getRiskDecisionStateLabel/);
  assert.match(riskCard, /riskIssues\.slice\(0, 5\)\.map/);
  assert.match(riskCard, /border-\[rgba\(190,18,60,0\.62\)\]/);
  assert.match(riskCard, /bg-\[rgba\(190,18,60,0\.12\)\]/);
  assert.match(riskCard, /text-\[rgb\(159,18,57\)\]/);
  assert.match(riskCard, /接单风险评估/);
  assert.match(source, /high: "可承受待确认"/);
  assert.doesNotMatch(source, /落地风险偏高|风险偏高/);
  assert.match(riskCard, /className="h-12 min-w-52 justify-center text-base"/);
  assert.match(riskCard, /生成接单风险评估/);
  assert.match(riskCard, /综合判断/);
  assert.match(riskCard, /当前状态/);
  assert.match(riskCard, /判断说明/);
  assert.match(riskCard, /text-base font-medium leading-7/);
  assert.match(riskCard, /影响接单的点/);
  assert.match(riskCard, /可以接/);
  assert.match(riskCard, /不可以接/);
  assert.match(riskCard, /Brief 不足/);
  assert.match(riskCard, /项目背景\/项目本身原因/);
  assert.match(riskCard, /理由补充/);
  assert.match(riskCard, /setRejectSheetOpen\(true\)/);
  assert.doesNotMatch(riskCard, /SOP 2 风险体检卡/);
  assert.doesNotMatch(riskCard, /风险体检卡/);
  assert.doesNotMatch(riskCard, /重新生成/);
  assert.doesNotMatch(riskCard, /关键依据/);
  assert.doesNotMatch(riskCard, /需要人工确认的依据/);
  assert.doesNotMatch(riskCard, /riskCheck\.redlineAlerts\.map/);
  assert.doesNotMatch(riskCard, /能接（通过）/);
  assert.doesNotMatch(riskCard, /不能接/);
  assert.doesNotMatch(riskCard, /退回原因/);
  assert.doesNotMatch(riskCard, /需要补充什么/);
  assert.doesNotMatch(riskCard, /退回上一步补资料/);
  assert.doesNotMatch(riskCard, /条件接/);
  assert.doesNotMatch(riskCard, /标记不可行/);
  assert.doesNotMatch(riskCard, /解除阻塞/);
  assert.doesNotMatch(riskCard, /人工复核通过/);
  assert.doesNotMatch(riskCard, /5 个主步骤/);
  assert.doesNotMatch(riskCard, /几 CP/);
  assert.doesNotMatch(riskCard, /三批/);
  assert.doesNotMatch(riskCard, /还没有风险体检卡/);
  assert.doesNotMatch(riskCard, /已基于当前 Brief 生成/);
});

test("technical feasibility stage renders the risk card directly without a decorative wrapper", () => {
  const stageStart = source.indexOf('<StagePanel stage="technical_feasibility"');
  assert.notEqual(stageStart, -1, "technical_feasibility stage should exist");
  const stageEnd = source.indexOf("</StagePanel>", stageStart);
  const stageBlock = source.slice(stageStart, stageEnd);

  assert.match(stageBlock, /<TechnicalFeasibilityReviewCard/);
  assert.doesNotMatch(stageBlock, /<StageWorkCard/);
  assert.doesNotMatch(stageBlock, /可行性评估/);
  assert.doesNotMatch(stageBlock, /红线告警/);
  assert.doesNotMatch(stageBlock, /人工留痕/);
});
