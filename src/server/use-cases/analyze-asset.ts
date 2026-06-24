import { z } from "zod";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { callArkJson, callArkMultimodalJson } from "@/server/providers/ark";
import { readFeishuDocumentPlainText } from "@/server/providers/feishu";
import { createReadUrl, downloadOssObject } from "@/server/providers/oss";
import { createArtifact } from "@/server/repositories/artifacts";
import { getProjectAsset, updateAssetParseStatus } from "@/server/repositories/assets";
import { upsertAssetAnalysis } from "@/server/repositories/asset-analyses";
import { appendJobEvent, createJob, getJobInput, updateJobStatus } from "@/server/repositories/jobs";
import { listScoringRules } from "@/server/repositories/scoring-rules";
import { recordStageProgress } from "@/server/use-cases/stage-progress";

const assetUnderstandingInputSchema = z.object({
  assetId: z.string().uuid(),
});

const textAssetAnalysisSchema = z.object({
  summary: z.string().default(""),
  labels: z.array(z.string()).default([]),
  keyObservations: z.array(z.string()).default([]),
  style: z.string().default(""),
  technicalRisks: z.array(z.string()).default([]),
});

const multimodalAnalysisSchema = textAssetAnalysisSchema.extend({
  visualStyle: z.string().default(""),
  shotLanguage: z.array(z.string()).default([]),
  motionAndRhythm: z.string().default(""),
});

export async function enqueueAssetUnderstanding(input: {
  projectId: string;
  assetId: string;
}) {
  const asset = await getProjectAsset(input.projectId, input.assetId);
  if (!asset) {
    throw new AppError({
      status: 404,
      code: "asset_not_found",
      userMessage: "没有找到这份资料。它可能已被删除，或你没有权限操作。",
    });
  }

  const { jobId } = await createJob({
    projectId: input.projectId,
    type: "asset_understanding",
    title: `解析资料：${asset.fileName ?? asset.assetType}`,
    provider: env.IMAGE_VIDEO_UNDERSTANDING_PROVIDER,
    modelName: resolveAssetModel(asset.assetType),
    inputJson: { assetId: input.assetId },
    maxAttempts: 2,
  });

  await updateAssetParseStatus({ assetId: input.assetId, parseStatus: "queued", failureReason: null });
  return { jobId };
}

export async function runAssetUnderstandingJob(jobId: string, options: { workerManagedFailure?: boolean } = {}) {
  const job = await getJobInput<z.infer<typeof assetUnderstandingInputSchema>>(jobId);
  if (!job) {
    throw new AppError({
      status: 404,
      code: "job_not_found",
      userMessage: "没有找到这个资料解析任务。",
    });
  }

  const input = assetUnderstandingInputSchema.parse(job.input);
  const asset = await getProjectAsset(job.projectId, input.assetId);
  if (!asset) {
    throw new AppError({
      status: 404,
      code: "asset_not_found",
      userMessage: "没有找到这份资料。它可能已被删除，或你没有权限操作。",
    });
  }

  await updateAssetParseStatus({ assetId: asset.id, parseStatus: "processing", failureReason: null });
  await updateJobStatus(jobId, {
    status: "processing",
    currentStep: "asset_understanding",
    userMessage: "正在解析资料并提取可用于标签评分的信息。",
  });

  await appendJobEvent(jobId, {
    type: "step.started",
    jobId,
    projectId: job.projectId,
    stepId: "asset_understanding",
    title: "开始解析资料",
    userMessage: "系统正在读取资料内容，并准备提取样片标签。",
    at: new Date().toISOString(),
  });

  try {
    const analysis = await analyzeAssetContent(asset, { projectId: job.projectId, jobId });
    const rules = await listScoringRules({ activeOnly: true });
    const scoreResult = scoreAnalysis(analysis, rules);

    const savedAnalysis = await upsertAssetAnalysis({
      projectId: job.projectId,
      assetId: asset.id,
      status: "succeeded",
      summary: analysis.summary,
      extractedText: analysis.extractedText,
      labels: analysis.labels,
      metadata: analysis.metadata,
      modelName: analysis.modelName,
      sourceJobId: jobId,
    });

    const analysisArtifact = await createArtifact({
      projectId: job.projectId,
      kind: "sample_analysis",
      title: `资料解析：${asset.fileName ?? asset.assetType}`,
      status: "draft",
      data: {
        assetId: asset.id,
        analysisId: savedAnalysis.id,
        summary: analysis.summary,
        labels: analysis.labels,
        extractedTextPreview: analysis.extractedText.slice(0, 1200),
        metadata: analysis.metadata,
      },
      sourceJobId: jobId,
    });

    if (rules.length > 0) {
      await createArtifact({
        projectId: job.projectId,
        kind: "score_result",
        title: `标签评分：${asset.fileName ?? asset.assetType}`,
        status: "draft",
        data: {
          assetId: asset.id,
          analysisId: savedAnalysis.id,
          totalScore: scoreResult.totalScore,
          matchedRules: scoreResult.matchedRules,
          ruleCount: rules.length,
        },
        sourceJobId: jobId,
      });
    }

    await updateAssetParseStatus({ assetId: asset.id, parseStatus: "succeeded", failureReason: null });
    await recordStageProgress({
      projectId: job.projectId,
      stageKey: "technical_feasibility",
      status: "in_progress",
      currentStage: "technical_feasibility",
      projectStatus: "in_progress",
      jobId,
      title: "技术可行性评估资料已更新",
      userMessage: rules.length > 0 ? "资料解析和标签评分已保存，技术可行性评估正在推进。" : "资料解析已保存，配置评分规则后可继续完成技术评估。",
      inputRefs: [{ type: "asset", id: asset.id }],
      outputRefs: [
        { type: "asset_analysis", id: savedAnalysis.id },
        { type: "artifact", id: analysisArtifact.id, kind: analysisArtifact.kind },
      ],
      snapshot: {
        analysisId: savedAnalysis.id,
        labels: analysis.labels,
        scoreTotal: scoreResult.totalScore,
      },
    });
    await appendJobEvent(jobId, {
      type: "artifact.created",
      jobId,
      projectId: job.projectId,
      artifactId: analysisArtifact.id,
      title: "资料解析结果已保存",
      userMessage: "资料解析完成，样片标签和摘要已保存到项目产物。",
      at: new Date().toISOString(),
    });
    await appendJobEvent(jobId, {
      type: "job.completed",
      jobId,
      projectId: job.projectId,
      title: "资料解析完成",
      userMessage: rules.length > 0 ? "资料解析和标签评分已完成。" : "资料解析已完成。配置评分规则后可生成标签评分。",
      at: new Date().toISOString(),
    });
    await updateJobStatus(jobId, {
      status: "succeeded",
      currentStep: "completed",
      userMessage: "资料解析完成。",
    });

    return { jobId, analysis: savedAnalysis };
  } catch (error) {
    const userMessage = error instanceof AppError ? error.userMessage : "资料解析失败。请稍后重试，或检查资料格式是否受支持。";
    await recordStageProgress({
      projectId: job.projectId,
      stageKey: "technical_feasibility",
      status: "blocked",
      currentStage: "technical_feasibility",
      projectStatus: "blocked",
      jobId,
      title: "技术可行性评估资料解析失败",
      userMessage,
      errorMessage: userMessage,
      inputRefs: [{ type: "asset", id: asset.id }],
    });
    await updateAssetParseStatus({ assetId: asset.id, parseStatus: "failed", failureReason: userMessage });
    await upsertAssetAnalysis({
      projectId: job.projectId,
      assetId: asset.id,
      status: "failed",
      summary: "",
      labels: [],
      metadata: {},
      modelName: resolveAssetModel(asset.assetType),
      sourceJobId: jobId,
      failureReason: userMessage,
    });
    await appendJobEvent(jobId, {
      type: "step.failed",
      jobId,
      projectId: job.projectId,
      stepId: "asset_understanding",
      title: "资料解析失败",
      userMessage,
      recoverable: true,
      at: new Date().toISOString(),
    });

    if (!options.workerManagedFailure) {
      await updateJobStatus(jobId, {
        status: "failed",
        currentStep: "failed",
        userMessage,
        errorCode: error instanceof AppError ? error.code : "asset_understanding_failed",
      });
    }

    throw error;
  }
}

type AssetForAnalysis = NonNullable<Awaited<ReturnType<typeof getProjectAsset>>>;

async function analyzeAssetContent(asset: AssetForAnalysis, telemetry: { projectId: string; jobId: string }) {
  if (asset.sourceType === "external_link") {
    if (asset.assetType === "feishu_doc" && asset.externalUrl) {
      const document = await readFeishuDocumentPlainText({ url: asset.externalUrl });
      return analyzeTextContent({
        extractedText: document.text,
        metadata: {
          sourceType: "feishu_doc",
          externalProvider: asset.externalProvider,
          externalUrl: asset.externalUrl,
          feishuDocumentToken: document.token,
        },
        telemetry,
      });
    }

    throw new AppError({
      status: 422,
      code: "external_link_parser_not_ready",
      userMessage: "当前只支持解析飞书文档链接。其他外部链接请先下载为 PDF、Word、文本、图片或视频后上传。",
    });
  }

  if (!asset.ossKey) {
    throw new AppError({
      status: 422,
      code: "missing_asset_file",
      userMessage: "这份资料没有可读取的 OSS 文件。请重新上传后再解析。",
    });
  }

  if (asset.assetType === "image" || asset.assetType === "video") {
    return analyzeVisualAsset(asset, telemetry);
  }

  const buffer = await downloadOssObject(asset.ossKey);
  const extractedText = await extractDocumentText(asset, buffer);
  return analyzeTextContent({
    extractedText,
    metadata: {
      sourceType: asset.assetType,
    },
    telemetry,
  });
}

async function analyzeTextContent(input: {
  extractedText: string;
  metadata: Record<string, unknown>;
  telemetry: { projectId: string; jobId: string };
}) {
  const extractedText = input.extractedText;
  if (!extractedText.trim()) {
    throw new AppError({
      status: 422,
      code: "empty_extracted_text",
      userMessage: "系统没有从这份资料中提取到可分析文本。请检查文件内容，或换成可复制文本的版本。",
    });
  }

  const result = textAssetAnalysisSchema.parse(
    await callArkJson({
      model: env.ARK_TEXT_STRUCTURING_MODEL,
      timeoutMs: 150_000,
      maxOutputTokens: 6000,
      telemetry: {
        projectId: input.telemetry.projectId,
        jobId: input.telemetry.jobId,
        callId: "ark_asset_text_understanding",
        provider: env.TEXT_STRUCTURING_PROVIDER,
        operation: "asset_text_understanding",
        metadata: {
          sourceType: input.metadata.sourceType,
          extractedTextChars: extractedText.length,
        },
      },
      messages: [
        {
          role: "system",
          content:
            "你是 AIGC 视频项目资料分析师。请从客户资料中提取可用于创意评估和技术评估的信息，输出 JSON 字段 summary, labels, keyObservations, style, technicalRisks。",
        },
        {
          role: "user",
          content: extractedText.slice(0, 20_000),
        },
      ],
    })
  );

  return {
    summary: result.summary,
    labels: normalizeLabels([...result.labels, result.style]),
    extractedText,
    metadata: {
      keyObservations: result.keyObservations,
      style: result.style,
      technicalRisks: result.technicalRisks,
      ...input.metadata,
    },
    modelName: env.ARK_TEXT_STRUCTURING_MODEL,
  };
}

async function analyzeVisualAsset(asset: AssetForAnalysis, telemetry?: { projectId: string; jobId: string }) {
  if (!asset.ossKey) {
    throw new AppError({
      status: 422,
      code: "missing_visual_asset_file",
      userMessage: "这份视觉资料没有可读取的 OSS 文件。请重新上传后再解析。",
    });
  }

  const mediaUrl = createReadUrl(asset.ossKey, 1800);
  const result = multimodalAnalysisSchema.parse(
    await callArkMultimodalJson({
      model: env.ARK_IMAGE_VIDEO_UNDERSTANDING_MODEL,
      timeoutMs: 180_000,
      maxOutputTokens: 6000,
      media: [{ type: asset.assetType === "video" ? "video" : "image", url: mediaUrl }],
      telemetry: telemetry
        ? {
            projectId: telemetry.projectId,
            jobId: telemetry.jobId,
            callId: "ark_asset_visual_understanding",
            provider: env.IMAGE_VIDEO_UNDERSTANDING_PROVIDER,
            operation: "asset_visual_understanding",
            metadata: {
              assetId: asset.id,
              assetType: asset.assetType,
            },
          }
        : undefined,
      prompt:
        "请分析这份 AIGC 视频项目参考资料。输出 JSON 字段 summary, labels, keyObservations, style, technicalRisks, visualStyle, shotLanguage, motionAndRhythm。标签要覆盖三维风格、写实风格、镜头语言、节奏、质感、技术难度等。",
    })
  );

  return {
    summary: result.summary,
    labels: normalizeLabels([...result.labels, result.style, result.visualStyle, ...result.shotLanguage]),
    extractedText: "",
    metadata: {
      keyObservations: result.keyObservations,
      style: result.style,
      visualStyle: result.visualStyle,
      shotLanguage: result.shotLanguage,
      motionAndRhythm: result.motionAndRhythm,
      technicalRisks: result.technicalRisks,
      sourceType: asset.assetType,
    },
    modelName: env.ARK_IMAGE_VIDEO_UNDERSTANDING_MODEL,
  };
}

async function extractDocumentText(asset: AssetForAnalysis, buffer: Buffer) {
  const name = asset.fileName?.toLowerCase() ?? "";
  const mimeType = asset.mimeType?.toLowerCase() ?? "";

  if (asset.assetType === "text" || mimeType.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md")) {
    return buffer.toString("utf8");
  }

  if (asset.assetType === "pdf" || mimeType.includes("pdf") || name.endsWith(".pdf")) {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const parsed = await parser.getText();
      return parsed.text;
    } finally {
      await parser.destroy();
    }
  }

  if (asset.assetType === "word" || mimeType.includes("word") || mimeType.includes("officedocument") || name.endsWith(".docx")) {
    if (name.endsWith(".doc")) {
      throw new AppError({
        status: 422,
        code: "legacy_doc_not_supported",
        userMessage: "当前只支持解析 .docx Word 文件。.doc 文件请先另存为 .docx 后再上传。",
      });
    }
    const mammoth = await import("mammoth");
    const parsed = await mammoth.extractRawText({ buffer });
    return parsed.value;
  }

  throw new AppError({
    status: 422,
    code: "unsupported_parse_type",
    userMessage: "这份资料类型暂时不能进行文本解析。请上传 PDF、DOCX 或文本文件。",
  });
}

function normalizeLabels(labels: string[]) {
  return Array.from(
    new Set(
      labels
        .map((label) => label.trim())
        .filter(Boolean)
        .slice(0, 30)
    )
  );
}

function scoreAnalysis(analysis: { summary: string; labels: string[]; extractedText: string; metadata: unknown }, rules: Awaited<ReturnType<typeof listScoringRules>>) {
  const haystack = `${analysis.summary}\n${analysis.labels.join("\n")}\n${analysis.extractedText}\n${JSON.stringify(analysis.metadata)}`.toLowerCase();
  const matchedRules = rules.map((rule) => {
    const examples = [rule.tag, ...rule.positiveExamples].map((item) => item.toLowerCase()).filter(Boolean);
    const negatives = rule.negativeExamples.map((item) => item.toLowerCase()).filter(Boolean);
    const matchedPositive = examples.filter((example) => haystack.includes(example));
    const matchedNegative = negatives.filter((example) => haystack.includes(example));
    const score = Math.max(0, matchedPositive.length - matchedNegative.length) * rule.weight;
    return {
      tag: rule.tag,
      weight: rule.weight,
      score,
      matchedPositive,
      matchedNegative,
      reason: matchedPositive.length ? "命中标签或正向样例" : "未命中",
    };
  });

  return {
    totalScore: matchedRules.reduce((sum, rule) => sum + rule.score, 0),
    matchedRules,
  };
}

function resolveAssetModel(assetType: string) {
  if (assetType === "image" || assetType === "video") return env.ARK_IMAGE_VIDEO_UNDERSTANDING_MODEL;
  return env.ARK_TEXT_STRUCTURING_MODEL;
}
