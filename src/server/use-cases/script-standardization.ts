import { z } from "zod";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { callArkResponseJson } from "@/server/providers/ark";
import { createArtifact, listProjectArtifacts } from "@/server/repositories/artifacts";
import {
  getScriptDirectionPackage,
  updateScriptDirectionPackageScript,
  type ScriptDirectionPackageView,
} from "@/server/repositories/story-production";
import { recordStageProgress } from "@/server/use-cases/stage-progress";

export type ScriptFormatIssueSeverity = "error" | "warning";

export type ScriptFormatIssue = {
  severity: ScriptFormatIssueSeverity;
  code: string;
  message: string;
  suggestion?: string;
  line?: number;
};

export type ScriptFormatValidationResult = {
  issues: ScriptFormatIssue[];
  hasBlockingIssues: boolean;
};

const metadataDialogueLabels = new Set([
  "剧情简介",
  "故事简介",
  "人物小传",
  "人物",
  "角色",
  "角色小传",
  "画面",
  "画面切换",
  "剧名",
  "标题",
  "集数",
  "场景",
  "地点",
  "时间",
  "内外",
  "备注",
]);

const standardizeResponseSchema = z.object({
  title: z.string().trim().min(1).optional(),
  standardizedScript: z.string().trim().min(1),
  notes: z.array(z.string().trim()).optional(),
});

const sceneTimeTokenPattern =
  "(?:日|夜|白天|晚上|清晨|早晨|晨|上午|中午|下午|傍晚|黄昏|破晓|拂晓|黎明|日出|凌晨|午夜|深夜)";

export function validateStandardScriptFormat(script: string): ScriptFormatValidationResult {
  const lines = parseScriptLines(script);
  const issues: ScriptFormatIssue[] = [];

  if (!lines.some((line) => /^《[^》]+》$/.test(line.text))) {
    issues.push({
      severity: "error",
      code: "missing_title",
      message: "缺少书名号包裹的剧名，例如《重生之还是她》。",
      suggestion: "把剧名放在文件最顶部，并使用中文书名号。",
    });
  }

  const sceneIndexes = lines
    .map((line, index) => (isSceneHeading(line.text) ? index : -1))
    .filter((index) => index >= 0);

  if (!lines.some((line) => isEpisodeLine(line.text))) {
    issues.push({
      severity: "error",
      code: "missing_episode",
      message: "缺少集数标记，例如“第一集”或“第 1 集”。",
      suggestion: "每集开头单独成行标注集数。",
    });
  }

  if (sceneIndexes.length === 0) {
    issues.push({
      severity: "error",
      code: "missing_scene_number",
      message: "缺少场次编号，例如“1-1”或“第 1-1 场”。",
      suggestion: "每场戏使用集数-场次格式标注唯一编号。",
    });
  }

  for (const sceneIndex of sceneIndexes) {
    const heading = lines[sceneIndex];
    const sceneLines = sliceSceneLines(lines, sceneIndex, sceneIndexes);
    if (!isCompleteSceneHeading(heading.text)) {
      issues.push({
        severity: "error",
        code: "missing_scene_location_time_interior",
        message: "场景行需要同时包含场次编号、地点、日/夜和内/外。",
        suggestion: "示例：1-1 日 外 江边广场。",
        line: heading.line,
      });
    }
    if (!sceneLines.some((line) => /^人物[:：]/.test(line.text))) {
      issues.push({
        severity: "error",
        code: "missing_characters",
        message: "场次缺少人物列表。",
        suggestion: "示例：人物：小帅、小美。",
        line: heading.line,
      });
    }
    if (!sceneLines.some((line) => isVisualActionLine(line.text))) {
      issues.push({
        severity: "error",
        code: "missing_visual_action",
        message: "场次缺少画面或动作描述。",
        suggestion: "使用 △ 开头描述画面动作，或写明“画面：...”。",
        line: heading.line,
      });
    }
    if (!sceneLines.some((line) => isDialogueLine(line.text))) {
      issues.push({
        severity: "error",
        code: "missing_dialogue",
        message: "场次缺少符合“人名：台词”格式的台词。",
        suggestion: "示例：小帅（开心）：没想到在这里遇见了你。",
        line: heading.line,
      });
    }
  }

  if (hasUnpairedOrMisorderedFlashback(lines.map((line) => line.text))) {
    issues.push({
      severity: "error",
      code: "unpaired_flashback",
      message: "【闪回】和【闪出】必须成对出现，并且先闪回、后闪出。",
      suggestion: "检查回忆段落的开始和结束标记。",
    });
  }

  if (!lines.some((line) => /^剧情简介[:：]/.test(line.text))) {
    issues.push({
      severity: "warning",
      code: "missing_synopsis",
      message: "建议补充剧情简介，方便甲方和后续 AI 理解故事核心。",
    });
  }

  if (!lines.some((line) => /^人物小传[:：]/.test(line.text))) {
    issues.push({
      severity: "warning",
      code: "missing_character_bio",
      message: "建议补充人物小传，方便后续人物设定图生成。",
    });
  }

  return {
    issues: dedupeIssues(issues),
    hasBlockingIssues: issues.some((issue) => issue.severity === "error"),
  };
}

export async function standardizeScriptPackage(input: {
  projectId: string;
  packageId: string;
  actorId: string;
}): Promise<{
  package: ScriptDirectionPackageView;
  artifact: Awaited<ReturnType<typeof createArtifact>>;
  validation: ScriptFormatValidationResult;
  message: string;
}> {
  const pkg = await getScriptDirectionPackage({ projectId: input.projectId, packageId: input.packageId });
  if (!pkg) {
    throw new AppError({
      status: 404,
      code: "script_package_not_found",
      userMessage: "没有找到完整剧本记录。请刷新后重新选择剧本。",
    });
  }

  const rawScript = pkg.fullScript.trim();
  if (!rawScript) {
    throw new AppError({
      status: 422,
      code: "script_package_empty_script",
      userMessage: "完整剧本为空，请先粘贴完整剧本再做格式检查。",
    });
  }

  const localValidation = validateStandardScriptFormat(rawScript);
  let standardizedScript = rawScript;
  let title = extractScriptTitle(rawScript) ?? pkg.title;
  let modelNotes: string[] = [];

  if (localValidation.hasBlockingIssues) {
    if (!env.ARK_API_KEY) {
      await recordScriptStandardizationFailure({
        projectId: input.projectId,
        packageId: pkg.id,
        userMessage: "剧本存在必填格式缺失，但当前服务端没有配置豆包文本模型，暂时无法自动整理成标准格式。请补齐 ARK_API_KEY 后重试，或先人工改成标准格式再检查。",
      });
    }

    try {
      const parsed = standardizeResponseSchema.parse(
        await callArkResponseJson({
          model: env.ARK_TEXT_STRUCTURING_MODEL,
          temperature: 0.1,
          maxOutputTokens: 12000,
          timeoutMs: 300_000,
          thinking: "disabled",
          telemetry: {
            projectId: input.projectId,
            callId: "script_standardization",
            provider: env.TEXT_STRUCTURING_PROVIDER,
            operation: "script_standardization",
            metadata: { packageId: input.packageId },
          },
          messages: [
            {
              role: "system",
              content:
                "你是短剧/广告片剧本整理助理。请把输入的非标准剧本整理为标准剧本格式，必须保留原始剧情、人物关系、台词和画面细节。不要删减有效信息。输出严格 JSON，字段为 title、standardizedScript、notes。standardizedScript 必须包含：书名号剧名、剧情简介、人物小传、集数、场次编号、场景地点/日夜/内外、人物、画面描述、台词。无法从上下文确定的信息用“待补充”标记，不要编造事实。",
            },
            {
              role: "user",
              content: `标准剧本格式要求：
1. 剧名必须用《》放在顶部。
2. 建议包含剧情简介和人物小传。
3. 每场戏必须包含集数、场次编号、场景地点/日夜/内外、人物、画面、台词。
4. △ 表示画面动作；OS 表示内心独白；VO 表示画外音；【闪回】和【闪出】必须成对。

原始剧本：
${rawScript}`,
            },
          ],
        })
      );
      standardizedScript = parsed.standardizedScript.trim();
      title = parsed.title?.trim() || extractScriptTitle(standardizedScript) || title;
      modelNotes = parsed.notes ?? [];
    } catch (error) {
      const userMessage =
        error instanceof AppError
          ? error.userMessage
          : error instanceof z.ZodError
            ? "豆包已返回剧本整理结果，但 JSON 结构不完整。系统没有覆盖当前剧本，请稍后重试或先人工整理格式。"
            : "剧本标准化调用失败，系统没有覆盖当前剧本。请稍后重试；如果持续失败，请联系管理员检查模型配置。";
      await recordScriptStandardizationFailure({
        projectId: input.projectId,
        packageId: pkg.id,
        userMessage,
      });
      throw error instanceof AppError
        ? error
        : new AppError({
            status: 502,
            code: error instanceof z.ZodError ? "script_standardization_invalid_schema" : "script_standardization_failed",
            userMessage,
          });
    }
  }

  const validation = validateStandardScriptFormat(standardizedScript);
  const updated = await updateScriptDirectionPackageScript({
    projectId: input.projectId,
    packageId: pkg.id,
    title,
    concept: "完整剧本标准化整理",
    fullScript: standardizedScript,
    status: validation.hasBlockingIssues ? "draft" : "internal_review",
    actorId: input.actorId,
  });
  if (!updated) {
    throw new AppError({
      status: 404,
      code: "script_package_not_found",
      userMessage: "剧本标准化已完成，但保存时没有找到当前剧本记录。请刷新后重试。",
    });
  }

  const artifact = await createArtifact({
    projectId: input.projectId,
    kind: "script_direction_package",
    title: `标准剧本格式检查：${updated.title}`,
    status: validation.hasBlockingIssues ? "needs_revision" : "confirmed",
    data: {
      operation: "script_format_standardization",
      packageId: updated.id,
      packageVersion: updated.version,
      rawScript,
      standardizedScript,
      validation,
      modelNotes,
      standardizedAt: new Date().toISOString(),
    },
    createdBy: input.actorId,
  });

  await recordStageProgress({
    projectId: input.projectId,
    stageKey: "script_storyboard_confirmation",
    status: validation.hasBlockingIssues ? "needs_revision" : "in_progress",
    currentStage: "script_storyboard_confirmation",
    projectStatus: validation.hasBlockingIssues ? "needs_revision" : "in_progress",
    userMessage: validation.hasBlockingIssues
      ? "剧本已整理并保存，但仍有必填格式问题需要人工补齐后再次检查。"
      : "剧本已通过标准格式检查，可以提交甲方确认。",
    inputRefs: [{ type: "script_direction_package", id: pkg.id }],
    outputRefs: [{ type: "artifact", id: artifact.id, kind: artifact.kind }],
    snapshot: {
      packageId: updated.id,
      artifactId: artifact.id,
      operation: "script_format_standardization",
      blockingIssueCount: validation.issues.filter((issue) => issue.severity === "error").length,
      warningCount: validation.issues.filter((issue) => issue.severity === "warning").length,
    },
  });

  return {
    package: updated,
    artifact,
    validation,
    message: validation.hasBlockingIssues
      ? "剧本已整理，但仍有必填格式问题；请补齐后再次检查。"
      : "剧本已整理成标准格式，可以提交甲方审核。",
  };
}

export async function checkScriptPackageFormat(input: {
  projectId: string;
  packageId: string;
  actorId: string;
}): Promise<{
  package: ScriptDirectionPackageView;
  artifact: Awaited<ReturnType<typeof createArtifact>>;
  validation: ScriptFormatValidationResult;
  message: string;
}> {
  const pkg = await getScriptDirectionPackage({ projectId: input.projectId, packageId: input.packageId });
  if (!pkg) {
    throw new AppError({
      status: 404,
      code: "script_package_not_found",
      userMessage: "没有找到完整剧本记录。请刷新后重新检查。",
    });
  }

  const rawScript = pkg.fullScript.trim();
  if (!rawScript) {
    throw new AppError({
      status: 422,
      code: "script_package_empty_script",
      userMessage: "完整剧本为空，请先粘贴完整剧本再检查。",
    });
  }

  const validation = validateStandardScriptFormat(rawScript);
  const updated = await updateScriptDirectionPackageScript({
    projectId: input.projectId,
    packageId: pkg.id,
    title: extractScriptTitle(rawScript) ?? pkg.title,
    concept: "完整剧本格式检查",
    fullScript: rawScript,
    status: validation.hasBlockingIssues ? "draft" : "internal_review",
    actorId: input.actorId,
  });
  if (!updated) {
    throw new AppError({
      status: 404,
      code: "script_package_not_found",
      userMessage: "剧本检查已完成，但保存检查记录时没有找到当前剧本。请刷新后重试。",
    });
  }

  const artifact = await createArtifact({
    projectId: input.projectId,
    kind: "script_direction_package",
    title: `标准剧本格式检查：${updated.title}`,
    status: validation.hasBlockingIssues ? "needs_revision" : "confirmed",
    data: {
      operation: "script_format_standardization",
      packageId: updated.id,
      packageVersion: updated.version,
      rawScript,
      standardizedScript: rawScript,
      validation,
      modelNotes: [],
      standardizedAt: new Date().toISOString(),
      checkOnly: true,
    },
    createdBy: input.actorId,
  });

  await recordStageProgress({
    projectId: input.projectId,
    stageKey: "script_storyboard_confirmation",
    status: validation.hasBlockingIssues ? "needs_revision" : "in_progress",
    currentStage: "script_storyboard_confirmation",
    projectStatus: validation.hasBlockingIssues ? "needs_revision" : "in_progress",
    userMessage: validation.hasBlockingIssues
      ? "剧本格式检查发现必填缺失。请人工补齐，或点击整理让模型辅助整理。"
      : "剧本格式检查通过，可以提交甲方确认。",
    inputRefs: [{ type: "script_direction_package", id: pkg.id }],
    outputRefs: [{ type: "artifact", id: artifact.id, kind: artifact.kind }],
    snapshot: {
      packageId: updated.id,
      artifactId: artifact.id,
      operation: "script_format_check",
      blockingIssueCount: validation.issues.filter((issue) => issue.severity === "error").length,
      warningCount: validation.issues.filter((issue) => issue.severity === "warning").length,
    },
  });

  return {
    package: updated,
    artifact,
    validation,
    message: validation.hasBlockingIssues ? "检查发现格式问题；需要系统辅助时请点击整理。" : "格式检查通过，可以进入下一步。",
  };
}

export function getLatestScriptStandardizationArtifact(input: {
  artifacts: Array<{ kind: string; status: string; data: unknown; updatedAt: string }>;
  packageId: string;
}) {
  return input.artifacts.find((artifact) => {
    const data = asRecord(artifact.data);
    return artifact.kind === "script_direction_package" && data.operation === "script_format_standardization" && data.packageId === input.packageId;
  });
}

export async function assertScriptPackageStandardized(input: {
  projectId: string;
  packageId: string;
}) {
  const artifacts = await listProjectArtifacts(input.projectId);
  const artifact = getLatestScriptStandardizationArtifact({ artifacts, packageId: input.packageId });
  if (!artifact) {
    throw new AppError({
      status: 422,
      code: "script_standardization_required",
      userMessage: "请先完成剧本格式检查，把完整剧本整理成标准格式后再继续。",
    });
  }
  const validation = asRecord(asRecord(artifact.data).validation);
  const hasBlockingIssues = validation.hasBlockingIssues === true;
  if (hasBlockingIssues || artifact.status === "needs_revision") {
    throw new AppError({
      status: 422,
      code: "script_standardization_has_issues",
      userMessage: "标准剧本仍有必填格式问题。请先补齐缺失项并重新检查，再提交甲方或拆分文字分镜。",
    });
  }
  return artifact;
}

async function recordScriptStandardizationFailure(input: {
  projectId: string;
  packageId: string;
  userMessage: string;
}): Promise<never> {
  await recordStageProgress({
    projectId: input.projectId,
    stageKey: "script_storyboard_confirmation",
    status: "needs_revision",
    currentStage: "script_storyboard_confirmation",
    projectStatus: "needs_revision",
    userMessage: input.userMessage,
    errorMessage: input.userMessage,
    inputRefs: [{ type: "script_direction_package", id: input.packageId }],
    snapshot: { packageId: input.packageId, operation: "script_format_standardization" },
  });
  throw new AppError({
    status: 503,
    code: "script_standardization_unavailable",
    userMessage: input.userMessage,
  });
}

function parseScriptLines(script: string) {
  return script
    .split(/\r?\n/)
    .map((text, index) => ({ text: text.trim(), line: index + 1 }))
    .filter((line) => line.text.length > 0);
}

function sliceSceneLines(
  lines: Array<{ text: string; line: number }>,
  sceneIndex: number,
  sceneIndexes: number[]
) {
  const currentPosition = sceneIndexes.indexOf(sceneIndex);
  const nextSceneIndex = sceneIndexes[currentPosition + 1] ?? lines.length;
  return lines.slice(sceneIndex + 1, nextSceneIndex);
}

function isEpisodeLine(line: string) {
  return /^第\s*[\d一二三四五六七八九十百]+\s*集(?:[:：].*)?$/.test(line) || /^[\d一二三四五六七八九十百]+\s*集$/.test(line);
}

function isSceneHeading(line: string) {
  return /^(?:第\s*)?[\d一二三四五六七八九十百]+\s*[-－]\s*[\d一二三四五六七八九十百]+\s*场?\b/.test(line);
}

function isCompleteSceneHeading(line: string) {
  if (!isSceneHeading(line)) return false;
  const headingBody = line.replace(/^(?:第\s*)?[\d一二三四五六七八九十百]+\s*[-－]\s*[\d一二三四五六七八九十百]+\s*场?\s*/, "").trim();
  const timeTokenRegex = new RegExp(`(^|[\\s/])${sceneTimeTokenPattern}(?=$|[\\s/])`);
  const timeTokenGlobalRegex = new RegExp(`(^|[\\s/])${sceneTimeTokenPattern}(?=$|[\\s/])`, "g");
  const hasTime = timeTokenRegex.test(headingBody);
  const hasInterior = /(^|[\s/])(?:内|外|内外)(?=$|[\s/])/.test(headingBody);
  const location = headingBody
    .replace(timeTokenGlobalRegex, " ")
    .replace(/(^|[\s/])(?:内|外|内外)(?=$|[\s/])/g, " ")
    .trim();
  return hasTime && hasInterior && location.length > 0;
}

function isVisualActionLine(line: string) {
  return /^△/.test(line) || /^画面[:：]/.test(line) || /^画面切换[:：]/.test(line) || /^镜头[:：]/.test(line);
}

function isDialogueLine(line: string) {
  if (/^(OS|VO|画外音)[:：].+/.test(line)) return true;
  const match = line.match(/^([\u4e00-\u9fa5A-Za-z0-9_·]{1,24})(?:（[^）]+）)?[:：](.+)$/);
  if (!match) return false;
  const speaker = match[1]?.trim();
  const content = match[2]?.trim();
  return Boolean(speaker && content && !metadataDialogueLabels.has(speaker));
}

function hasUnpairedOrMisorderedFlashback(lines: string[]) {
  let depth = 0;
  for (const line of lines) {
    for (const match of line.matchAll(/【闪回】|【闪出】/g)) {
      if (match[0] === "【闪回】") {
        depth += 1;
      } else {
        if (depth === 0) return true;
        depth -= 1;
      }
    }
  }
  return depth !== 0;
}

function dedupeIssues(issues: ScriptFormatIssue[]) {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.code}:${issue.line ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractScriptTitle(script: string) {
  const title = parseScriptLines(script).find((line) => /^《[^》]+》$/.test(line.text));
  return title?.text.replace(/^《|》$/g, "") ?? null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
