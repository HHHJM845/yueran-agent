import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./workspace-shell.tsx", import.meta.url), "utf8");

test("project sidebar supports right-click project actions", () => {
  assert.match(source, /onContextMenu=/);
  assert.match(source, /project-context-menu/);
  assert.match(source, /打开项目/);
  assert.match(source, /移出项目列表/);
  assert.match(source, /永久删除/);
  assert.doesNotMatch(source, /hover\s*\.\.\./);
});

test("permanent delete uses two confirmation states", () => {
  assert.match(source, /永久删除项目/);
  assert.match(source, /再次确认永久删除/);
  assert.match(source, /确认永久删除/);
  assert.match(source, /canPermanentlyDeleteProject = user\.role === "admin"/);
});

test("archive visibility uses stable owner identity for business users", () => {
  assert.match(source, /canArchiveProject = \(project: ProjectSummary\) => user\.role === "admin" \|\| \(user\.role === "business" && project\.ownerId === user\.id\)/);
  assert.doesNotMatch(source, /project\.ownerName === user\.name/);
});

test("delete action calls real deleteProject api and refreshes stale permissions", () => {
  assert.match(source, /deleteProject\(/);
  assert.match(source, /mode: "archive"/);
  assert.match(source, /mode: "permanent"/);
  assert.match(source, /project_delete_forbidden/);
  assert.match(source, /fetchCurrentUser\(\)/);
  assert.match(source, /setUser\(permissionResult\.data\.user\)/);
});

test("project creation closes sheet only after successful create and shows success copy", () => {
  assert.match(source, /setCreateSheetOpen\(false\)/);
  assert.match(source, /项目已创建，可以开始录入 Brief。/);
  assert.match(source, /Promise<boolean>/);
  assert.match(source, /onSubmit=\{/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /new FormData\(event\.currentTarget\)/);
});

test("SOP 3 creative proposal UI exposes linear flow copy and avoids ambiguous round labels", () => {
  assert.match(source, /生成 4 个创意方向/);
  assert.match(source, /内部选择方向/);
  assert.match(source, /生成 Round 1 氛围图/);
  assert.match(source, /Round 1 甲方初选/);
  assert.match(source, /Round 2 深化确认/);
  assert.match(source, /创建 Round 1 提案包/);
  assert.match(source, /创建 Round 2 提案包/);
  assert.match(source, /发起最终甲方确认/);
  assert.doesNotMatch(source, /创建本轮/);
  assert.doesNotMatch(source, /生成新版本/);
});

test("SOP 5 script setup does not expose legacy parallel reference draft cards", () => {
  assert.doesNotMatch(source, /并行人物参考图/);
  assert.doesNotMatch(source, /并行场景参考图/);
  assert.doesNotMatch(source, /参考描述 \/ Prompt/);
});

test("SOP 5 script setup follows script import and approval copy", () => {
  assert.match(source, /导入完整剧本/);
  assert.match(source, /检查/);
  assert.match(source, /整理/);
  assert.match(source, /type="submit"[\s\S]{0,180}检查/);
  assert.match(source, /标准剧本格式检查/);
  assert.match(source, /只有标准剧本经甲方确认后/);
  assert.match(source, /甲方完整剧本确认/);
  assert.doesNotMatch(source, /保存完整剧本/);
  assert.doesNotMatch(source, /请先保存完整剧本/);
  assert.doesNotMatch(source, /检查并整理为标准剧本/);
  assert.doesNotMatch(source, /脚本方向标题/);
  assert.doesNotMatch(source, /方向概念/);
  assert.doesNotMatch(source, /保存脚本方向包/);
  assert.doesNotMatch(source, /甲方脚本方向审核/);
  assert.doesNotMatch(source, /3 张人物参考、2 张场景参考/);
  assert.doesNotMatch(source, /请先保存脚本方向包/);
});

test("SOP 5 storyboard sequence can be edited before production setup", () => {
  assert.match(source, /编辑序列/);
  assert.match(source, /保存序列/);
  assert.match(source, /新增分镜/);
  assert.match(source, /saveStoryboardSequence/);
  assert.match(source, /toStoryboardSequenceInput/);
});

test("SOP 5 production setup uses confirmed lists editable prompts and A2 candidate canvas", () => {
  assert.match(source, /清单确认区/);
  assert.match(source, /新增人物/);
  assert.match(source, /新增场景/);
  assert.match(source, /移入忽略列表/);
  assert.match(source, /恢复到清单/);
  assert.match(source, /确认清单/);
  assert.match(source, /设定图生成区/);
  assert.match(source, /主候选画布/);
  assert.match(source, /候选 \{activeCanvasIndex \+ 1\} \/ \{Math\.max\(referenceImages\.length, 1\)\}/);
  assert.match(source, /双击放大查看/);
  assert.match(source, /onDoubleClick=/);
  assert.match(source, /setReferenceImagePreview/);
  assert.match(source, /snap-x snap-mandatory/);
  assert.match(source, /\n\s*生成\n\s*<\/Button>/);
  assert.match(source, /handleGenerateReferenceImages\(entity, activeReference\)/);
  assert.match(source, /entityId: entity\.id/);
  assert.match(source, /prompt: getReferencePrompt\(referenceSet\)/);
  assert.match(source, /count: getReferenceCount\(referenceSet\)/);
  assert.match(source, /ratio: getReferenceRatio\(entity, referenceSet\)/);
  assert.match(source, /还没有候选图。确认当前提示词后点击“生成”。/);
  assert.match(source, /生成数量/);
  assert.match(source, /比例/);
  assert.match(source, /设为采用/);
  assert.match(source, /selectProductionReferenceImage/);
  assert.match(source, /saveProductionReferencePrompt/);
  assert.match(source, /confirmProductionEntityList/);
  assert.match(source, /regenerateProductionReferencePrompts/);
  assert.match(source, /handleRegenerateReferencePrompts/);
  assert.match(source, /正在根据剧本和已确认风格生成设定图提示词/);
  assert.match(source, /重新生成提示词/);
  assert.match(source, /请先确认清单，系统会根据剧本和视觉风格生成提示词。/);
  assert.doesNotMatch(source, /按当前提示词生成/);
  assert.doesNotMatch(source, /候选 \{referenceImages\.length\}\/4/);
  assert.doesNotMatch(source, /生成此设定图/);
  assert.doesNotMatch(source, /补图/);
});
