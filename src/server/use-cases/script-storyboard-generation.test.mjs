import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  generatePlainScriptPackage,
  generateStandardizedScriptFromPlain,
  revisePlainScriptPackage,
  saveStandardizedScriptEdit,
  splitScriptIntoStoryboard,
  transcribeScriptRevisionAudio,
} from "./script-storyboard.ts";

test("SOP5 script generation use-cases are exported", () => {
  assert.equal(typeof generatePlainScriptPackage, "function");
  assert.equal(typeof revisePlainScriptPackage, "function");
  assert.equal(typeof transcribeScriptRevisionAudio, "function");
  assert.equal(typeof generateStandardizedScriptFromPlain, "function");
  assert.equal(typeof saveStandardizedScriptEdit, "function");
  assert.equal(typeof splitScriptIntoStoryboard, "function");
});

test("script revision voice transcription uses the dedicated Ark speech model", async () => {
  const useCaseSource = await readFile(new URL("./script-storyboard.ts", import.meta.url), "utf8");
  const envSource = await readFile(new URL("../../lib/env.ts", import.meta.url), "utf8");
  const providerSource = await readFile(new URL("../providers/ai.ts", import.meta.url), "utf8");

  assert.match(envSource, /ARK_SPEECH_TRANSCRIPTION_MODEL: z\.string\(\)\.default\("doubao-seed-2-0-mini"\)/);
  assert.match(providerSource, /assertSpeechTranscriptionReady/);
  assert.match(providerSource, /env\.SPEECH_TRANSCRIPTION_PROVIDER/);
  assert.match(providerSource, /env\.ARK_SPEECH_TRANSCRIPTION_MODEL/);
  assert.match(useCaseSource, /transcribeArkAudio/);
  assert.match(useCaseSource, /operation: "script_revision_speech_transcription"/);
});

test("plain script generation requires a confirmed final creative proposal round", async () => {
  const source = await readFile(new URL("./script-storyboard.ts", import.meta.url), "utf8");

  assert.match(source, /const finalRound = resolveFinalCreativeProposalRound\(creativeRounds\.rounds\)/);
  assert.match(source, /final_creative_proposal_required/);
  assert.match(source, /round\.roundNumber === 2 && finalStatuses\.has\(round\.status\)/);
  assert.doesNotMatch(source, /creativeRounds\.rounds\.at\(-1\)/);
  assert.doesNotMatch(source, /confirmedRounds\.at\(-1\)/);
});

test("script text and full_script persistence uses single statement helpers", async () => {
  const useCase = await readFile(new URL("./script-storyboard.ts", import.meta.url), "utf8");
  const repository = await readFile(new URL("../repositories/story-production.ts", import.meta.url), "utf8");

  assert.match(repository, /export async function createScriptPackageWithPlainScript/);
  assert.match(repository, /plain_script, full_script/);
  assert.match(repository, /export async function updateScriptPackagePlainAndFullScript/);
  assert.match(repository, /export async function updateScriptPackageStandardizedAndFullScript/);
  assert.doesNotMatch(useCase, /updateScriptPackagePlainScript/);
  assert.doesNotMatch(useCase, /updateScriptPackageStandardizedScript/);
});

test("recoverable script generation validation and config failures record stage progress", async () => {
  const source = await readFile(new URL("./script-storyboard.ts", import.meta.url), "utf8");

  assert.match(source, /try\s*\{\s*ensureArkConfigured\("豆包文本模型还没有配置，暂时不能自动生成朴素剧本/);
  assert.match(source, /try\s*\{[\s\S]*plain_script_required[\s\S]*recordScriptGenerationFailure\(input\.projectId, error, "standardized_script_from_plain", input\.packageId\)/);
  assert.match(source, /try\s*\{[\s\S]*standardized_script_required[\s\S]*recordScriptGenerationFailure\(input\.projectId, error, "standardized_script_manual_edit", input\.packageId\)/);
});

test("revision and standardization prompts include current project context", async () => {
  const source = await readFile(new URL("./script-storyboard.ts", import.meta.url), "utf8");

  assert.match(source, /const context = await collectScriptGenerationContext\(input\.projectId\)/);
  assert.match(source, /buildRevisionPrompt\(\{\s*context,/);
  assert.match(source, /buildStandardizationPrompt\(\{\s*context,/);
  assert.match(source, /当前项目补充上下文/);
  assert.match(source, /STANDARD_SCRIPT_FORMAT_SPEC/);
  assert.match(source, /输出格式硬约束/);
  assert.match(source, /标准剧本格式规范（必须严格遵守，逐条对齐）/);
  assert.match(source, /集-场/);
  assert.match(source, /人物：/);
  assert.match(source, /△/);
  assert.match(source, /【闪回】\/【闪出】/);
  assert.match(source, /不新增剧情、不删关键信息/);
  assert.match(source, /无法确定的信息用“待补充”标注/);
  assert.match(source, /每场必须至少有一行“人名（情绪）：台词”或“VO：\.\.\.”格式的台词行/);
  assert.match(source, /人名（独白）：待补充。/);
  assert.match(source, /STANDARDIZATION_PLAIN_SCRIPT_MAX_CHARS/);
});

test("standardized script generation accepts Ark standardizedScript field", async () => {
  const source = await readFile(new URL("./script-storyboard.ts", import.meta.url), "utf8");

  assert.match(source, /const flexibleScriptGenerationResponseSchema = z/);
  assert.match(source, /const optionalAiTextFieldSchema = z\.preprocess\(\s*normalizeAiTextField/);
  assert.match(source, /standardizedScript: optionalAiTextFieldSchema/);
  assert.match(source, /function normalizeAiTextField\(value: unknown\): unknown/);
  assert.match(source, /typeof value === "object"/);
  assert.match(source, /script: parsed\.data\.script \?\? parsed\.data\.standardizedScript \?\? parsed\.data\.plainScript \?\? parsed\.data\.fullScript/);
  assert.match(source, /generateStandardizedScriptFromPlain[\s\S]*flexibleScriptGenerationResponseSchema\.parse/);
  assert.match(source, /generatePlainScriptPackage[\s\S]*scriptGenerationResponseSchema\.parse/);
});

test("script package client review normalizes scripts with the shared standard format spec", async () => {
  const source = await readFile(new URL("./script-storyboard.ts", import.meta.url), "utf8");
  const clientReviewSource = await readFile(new URL("./client-review.ts", import.meta.url), "utf8");

  assert.match(source, /export const STANDARD_SCRIPT_FORMAT_SPEC/);
  assert.match(source, /export async function ensureScriptPackageStandardizedForReview/);
  assert.match(source, /client_review_standard_script_normalization/);
  assert.match(source, /validateStandardScriptFormat\(currentScript\)/);
  assert.match(source, /validateStandardScriptFormat\(parsed\.script\)/);
  assert.match(source, /updateScriptPackageStandardizedAndFullScript/);
  assert.match(clientReviewSource, /ensureScriptPackageStandardizedForReview/);
  assert.match(clientReviewSource, /content: pkg\.standardizedScript/);
});

test("plain script prompts ban standardized performance format until confirmation", async () => {
  const source = await readFile(new URL("./script-storyboard.ts", import.meta.url), "utf8");

  assert.match(source, /大白话剧本/);
  assert.match(source, /不要写成标准剧本格式/);
  assert.match(source, /不要使用“场次、内外、日夜、人物、画面、台词”这些字段标题/);
  assert.match(source, /不要使用三角形、星号或分镜编号/);
  assert.match(source, /像小说或导演口述故事/);
  assert.match(source, /确认提交后/);
});

test("split storyboard generation consumes standardized script without the old client approval gate", async () => {
  const source = await readFile(new URL("./script-storyboard.ts", import.meta.url), "utf8");

  assert.match(source, /const storyboardSourceScript = resolveStoryboardSplitSourceScript\(pkg\)/);
  assert.match(source, /assertStandardizedScriptReadyForStoryboard\(storyboardSourceScript\)/);
  assert.match(source, /validateStandardScriptFormat\(script\)/);
  assert.match(source, /标准剧本：\\n\$\{storyboardSourceScript\}/);
  assert.doesNotMatch(source, /assertScriptPackageStandardized\(\{ projectId: input\.projectId, packageId: input\.packageId \}\)/);
  assert.doesNotMatch(source, /pkg\.status !== "client_approved" && pkg\.status !== "locked"/);
  assert.doesNotMatch(source, /script_package_client_approval_required/);
  assert.doesNotMatch(source, /等待提交甲方审核后再进入分镜图片阶段/);
});

test("successful split storyboard generation stays in SOP5 for storyboard and production setup confirmation", async () => {
  const source = await readFile(new URL("./script-storyboard.ts", import.meta.url), "utf8");
  const match = source.match(/export async function splitScriptIntoStoryboard[\s\S]*?\nfunction resolveStoryboardSplitSourceScript/);
  assert.ok(match, "splitScriptIntoStoryboard source should be present");
  const splitSource = match[0];

  assert.match(splitSource, /stageKey: "script_storyboard_confirmation"/);
  assert.match(splitSource, /currentStage: "script_storyboard_confirmation"/);
  assert.doesNotMatch(splitSource, /stageKey: "storyboard_image_canvas"/);
  assert.doesNotMatch(splitSource, /currentStage: "storyboard_image_canvas"/);
  assert.match(splitSource, /请先确认文字分镜/);
  assert.match(splitSource, /再确认人物和场景设定/);
});
