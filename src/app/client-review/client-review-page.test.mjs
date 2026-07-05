import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./[token]/page.tsx", import.meta.url), "utf8");
const clientReviewUseCaseSource = readFileSync(new URL("../../server/use-cases/client-review.ts", import.meta.url), "utf8");

function componentSource(name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  const next = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

test("storyboard image batch review uses per-shot OK decisions without scoring or package decision buttons", () => {
  assert.match(source, /isStoryboardImageBatchReview/);
  assert.match(source, /分镜逐张审核/);
  assert.match(source, /computeStoryboardBatchDecision/);
  assert.match(source, /variant=\{isStoryboardImageBatchReview \? "storyboard" : "default"\}/);
  assert.match(source, /storyboard-review-direct-actions/);
  assert.match(source, /type="hidden"\s+name=\{`decision-\$\{item\.itemId\}`\}/);
  assert.match(source, /setItemDecision\("approved"\)/);
  assert.match(source, /setItemDecision\("rejected"\)/);
  assert.match(source, /不 OK 后请填写原因和修改意见/);
  assert.doesNotMatch(source, /请选择 OK 或不 OK/);
  assert.doesNotMatch(source, /showScore=\{isImageReview \|\| candidateImages\.length > 0\}/);
  assert.doesNotMatch(source, /整体通过/);
  assert.doesNotMatch(source, /整体打回/);
  assert.doesNotMatch(source, /评分/);
});

test("client review page hides business content until the review key unlocks it", () => {
  assert.match(source, /UnlockReviewGate/);
  assert.match(source, /\/api\/client-review\/\$\{token\}\/unlock/);
  assert.match(source, /请输入审核密钥/);
  assert.match(source, /校验通过后才会展示本次审核材料/);
  assert.match(source, /setVerificationCode\(code\)/);
  assert.match(source, /readVerificationCodeFromHash/);
  assert.match(source, /params\.get\("key"\) \?\? params\.get\("code"\) \?\? params\.get\("verificationCode"\)/);
  assert.match(source, /initialVerificationCode=\{verificationCode\}/);
  assert.match(source, /value=\{codeInput\}/);
  assert.match(source, /<input type="hidden" name="verificationCode" value=\{verificationCode\}/);
  assert.match(source, /useState\(\(\) => readVerificationCodeFromHash\(\)\)/);
  assert.doesNotMatch(source, /setVerificationCode\(\(current\) => current \|\| code\);/);
  assert.doesNotMatch(source, /const code = readVerificationCodeFromHash\(\);[\s\S]{0,220}unlock\(/);
});

test("client review page renders full contract and standard script content instead of summaries", () => {
  assert.match(source, /ContractReviewItemCard/);
  assert.match(source, /完整合同正文/);
  assert.match(source, /readMetadataString\(item\.metadata, "content"\)/);
  assert.match(source, /ScriptReviewItemCard/);
  assert.match(source, /标准剧本/);
  assert.match(source, /whitespace-pre-wrap/);
});

test("brief confirmation review mirrors the internal structured requirement template card", () => {
  const genericCard = componentSource("GenericReviewItemCard");
  const briefCard = componentSource("BriefReviewItemCard");

  assert.match(clientReviewUseCaseSource, /brief: \(structuredRequirement\?\.data \?\? null\)/);
  assert.match(genericCard, /item\.itemType === "brief"[\s\S]*<BriefReviewItemCard/);
  assert.match(briefCard, /item\.itemLabel/);
  assert.match(briefCard, /grid gap-2 text-sm md:grid-cols-2/);
  assert.match(source, /品牌信息[\s\S]*产品\/服务[\s\S]*目标受众[\s\S]*视频目标[\s\S]*期望风格[\s\S]*参考样片[\s\S]*核心卖点[\s\S]*禁忌点[\s\S]*交付规格[\s\S]*时间节点[\s\S]*预算\/报价[\s\S]*项目摘要/);
  assert.match(source, /未提及/);
  assert.match(source, /join\("、"\)/);
  assert.match(briefCard, /readBriefReviewData\(item\)/);
  assert.match(briefCard, /brief-review-document/);
  assert.doesNotMatch(briefCard, /md:grid-cols-\[260px_minmax\(0,1fr\)\]/);
  assert.doesNotMatch(briefCard, /ReviewDecisionFields/);
  assert.doesNotMatch(briefCard, /reviewItemPreview\(item\)/);
  assert.doesNotMatch(briefCard, /Creative Brief/);
  assert.doesNotMatch(briefCard, /Overview/);
  assert.doesNotMatch(briefCard, /Open Questions/);
});

test("brief confirmation review uses one global feedback field and OK buttons", () => {
  const briefCard = componentSource("BriefReviewItemCard");

  assert.match(source, /const isBriefConfirmationReview = displayedTask\?\.reviewType === "brief_confirmation"/);
  assert.match(source, /审核意见/);
  assert.match(source, /name="decision" value="approved"[\s\S]*OK/);
  assert.match(source, /name="decision" value="rejected"[\s\S]*不 OK/);
  assert.doesNotMatch(briefCard, /name=\{`feedback-\$\{item\.itemId\}`\}/);
  assert.doesNotMatch(briefCard, /name=\{`decision-\$\{item\.itemId\}`\}/);
});

test("client review item decisions use direct OK buttons instead of select menus", () => {
  const decisionFields = componentSource("ReviewDecisionFields");

  assert.match(decisionFields, /storyboard-review-direct-actions/);
  assert.match(decisionFields, /client-review-direct-actions/);
  assert.match(decisionFields, /type="hidden"\s+name=\{`decision-\$\{item\.itemId\}`\}/);
  assert.match(decisionFields, /current === "approved" \? "" : "approved"/);
  assert.match(decisionFields, /current === "rejected" \? "" : "rejected"/);
  assert.match(source, /itemDecision \|\| \(isCreativeRound1Submission \|\| isStoryboardImageBatchSubmission \? "rejected" : submittedDecision\)/);
  assert.doesNotMatch(decisionFields, /<select/);
  assert.doesNotMatch(source, /单条结论/);
  assert.doesNotMatch(source, /跟随本轮结论/);
  assert.doesNotMatch(source, /确认通过/);
  assert.doesNotMatch(source, /打回修改/);
});
