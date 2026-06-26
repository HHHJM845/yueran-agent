import { z } from "zod";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { callArkResponseJson } from "@/server/providers/ark";
import { listProjectArtifacts } from "@/server/repositories/artifacts";
import { listProjectAssetAnalyses } from "@/server/repositories/asset-analyses";
import { listProjectCreativeDirections } from "@/server/repositories/creative-directions";
import { listProjectCreativeExpansions } from "@/server/repositories/creative-expansions";
import { listProjectGeneratedImages } from "@/server/repositories/generated-images";
import { appendJobEvent, createJob, getJobInput, updateJobStatus } from "@/server/repositories/jobs";
import { getProjectById } from "@/server/repositories/projects";
import type { QuoteItem } from "@/server/repositories/quotes";
import type { ContractTemplateFields } from "@/server/repositories/contracts";
import { getProjectWorkloadEstimate } from "@/server/repositories/workload-estimates";
import { getProjectDeliveryChecklist } from "@/server/repositories/delivery-checklists";
import { saveProjectContract } from "@/server/use-cases/save-contract";
import { saveProjectProposal } from "@/server/use-cases/save-proposal";
import { saveProjectQuote } from "@/server/use-cases/save-quote";
import { recordStageProgress } from "@/server/use-cases/stage-progress";

const documentDraftJobInputSchema = z.object({
  requestedBy: z.string().uuid().nullable().optional(),
});

const flexibleString = z.preprocess((value) => formatUnknownValue(value), z.string().default(""));
const flexibleNumber = z.preprocess((value) => {
  const normalized = typeof value === "string" ? value.replace(/[^\d.-]/g, "") : value;
  const numberValue = Number(normalized);
  return Number.isFinite(numberValue) ? numberValue : 0;
}, z.number());

const generatedQuoteItemSchema = z.object({
  name: flexibleString,
  description: flexibleString.optional().default(""),
  quantity: flexibleNumber,
  unitPrice: flexibleNumber,
});

const generatedDraftResponseSchema = z.object({
  proposal: z.object({
    title: flexibleString,
    content: flexibleString,
  }),
  quote: z.object({
    title: flexibleString,
    currency: flexibleString.optional().default("CNY"),
    items: z.array(generatedQuoteItemSchema).min(1),
    notes: flexibleString.optional().default(""),
  }),
  contract: z.object({
    title: flexibleString,
    templateFields: z
      .object({
        partyAName: flexibleString.optional().default(""),
        partyBName: flexibleString.optional().default(""),
        projectName: flexibleString.optional().default(""),
        deliveryScope: flexibleString.optional().default(""),
        paymentTerms: flexibleString.optional().default(""),
        effectiveDate: flexibleString.optional().default(""),
      })
      .optional()
      .default({
        partyAName: "",
        partyBName: "",
        projectName: "",
        deliveryScope: "",
        paymentTerms: "",
        effectiveDate: "",
      }),
    content: flexibleString.optional().default(""),
  }),
});

type GeneratedDraftResponse = z.infer<typeof generatedDraftResponseSchema>;
const generatedProposalResponseSchema = generatedDraftResponseSchema.shape.proposal;
const generatedQuoteResponseSchema = generatedDraftResponseSchema.shape.quote;
const generatedContractResponseSchema = generatedDraftResponseSchema.shape.contract;

export type DocumentDraftBundle = {
  proposal: {
    title: string;
    content: string;
    status: "draft";
  };
  quote: {
    title: string;
    currency: string;
    items: QuoteItem[];
    notes: string;
    status: "draft";
  };
  contract: {
    title: string;
    templateKey: string;
    templateFields: ContractTemplateFields;
    content?: string;
    status: "draft";
  };
};

export type DocumentDraftContext = Awaited<ReturnType<typeof collectDocumentDraftContext>>;

export async function enqueueDocumentDraftGeneration(input: {
  projectId: string;
  requestedBy: string;
}) {
  const project = await getProjectById(input.projectId);
  if (!project) {
    throw new AppError({
      status: 404,
      code: "project_not_found",
      userMessage: "没有找到这个项目。请刷新项目列表后重试。",
    });
  }

  const { jobId } = await createJob({
    projectId: input.projectId,
    type: "quote_contract_generation",
    title: "生成提案、报价与合同草稿",
    provider: env.TEXT_STRUCTURING_PROVIDER,
    modelName: env.ARK_TEXT_STRUCTURING_MODEL,
    inputJson: {
      requestedBy: input.requestedBy,
    },
    createdBy: input.requestedBy,
    maxAttempts: 2,
  });

  return { jobId };
}

export async function runDocumentDraftGenerationJob(jobId: string, options: { workerManagedFailure?: boolean } = {}) {
  const job = await getJobInput<z.infer<typeof documentDraftJobInputSchema>>(jobId);
  if (!job) {
    throw new AppError({
      status: 404,
      code: "job_not_found",
      userMessage: "没有找到这个草稿生成任务。",
    });
  }

  const parsedInput = documentDraftJobInputSchema.parse(job.input);
  if (!parsedInput.requestedBy) {
    throw new AppError({
      status: 422,
      code: "draft_generation_actor_required",
      userMessage: "草稿生成任务缺少发起人信息。请从项目工作台重新发起生成。",
    });
  }
  const actorId = parsedInput.requestedBy;

  await updateJobStatus(jobId, {
    status: "processing",
    currentStep: "collecting_workspace_artifacts",
    userMessage: "正在汇总项目工作台里的需求、创意方向、故事大纲和氛围图记录。",
  });

  await appendJobEvent(jobId, {
    type: "step.started",
    jobId,
    projectId: job.projectId,
    stepId: "document_draft_generation",
    title: "开始生成商务文档草稿",
    userMessage: "系统正在从已保存的项目产物中整理提案、报价和合同输入。",
    at: new Date().toISOString(),
  });

  try {
    const context = await collectDocumentDraftContext(job.projectId);
    if (!context.hasUsableInput) {
      throw new AppError({
        status: 422,
        code: "insufficient_document_draft_context",
        userMessage: "当前项目还缺少可用于生成提案、报价和合同的真实产物。请先完成需求结构化、创意方向选择或故事大纲生成后再试。",
      });
    }

    await appendJobEvent(jobId, {
      type: "tool.started",
      jobId,
      projectId: job.projectId,
      callId: "ark_document_draft_generation",
      title: "调用豆包生成三类草稿",
      payload: {
        provider: env.TEXT_STRUCTURING_PROVIDER,
        model: env.ARK_TEXT_STRUCTURING_MODEL,
        structuredRequirementCount: context.structuredRequirements.length,
        assetAnalysisCount: context.assetAnalyses.length,
        creativeDirectionCount: context.creativeDirections.length,
        creativeExpansionCount: context.creativeExpansions.length,
      },
      at: new Date().toISOString(),
    });

    const parsed = await generateDraftResponse(context, jobId, async (step, userMessage) => {
      await updateJobStatus(jobId, {
        status: "processing",
        currentStep: step,
        userMessage,
      });
    });
    const draft = normalizeDocumentDraftBundle(parsed, context);

    const proposalResult = await saveProjectProposal({
      projectId: job.projectId,
      actorId,
      title: draft.proposal.title,
      content: draft.proposal.content,
      status: draft.proposal.status,
    });

    const quoteResult = await saveProjectQuote({
      projectId: job.projectId,
      actorId,
      title: draft.quote.title,
      currency: draft.quote.currency,
      items: draft.quote.items,
      notes: draft.quote.notes,
      status: draft.quote.status,
    });

    const contractFields = {
      ...draft.contract.templateFields,
      quoteTitle: quoteResult.quote.title,
      quoteTotalAmount: quoteResult.quote.totalAmount,
      quoteCurrency: quoteResult.quote.currency,
    };
    const contractResult = await saveProjectContract({
      projectId: job.projectId,
      actorId,
      title: draft.contract.title,
      templateKey: draft.contract.templateKey,
      templateFields: contractFields,
      content: draft.contract.content,
      status: draft.contract.status,
      proposalId: proposalResult.proposal.id,
      quoteId: quoteResult.quote.id,
    });

    await appendJobEvent(jobId, {
      type: "tool.completed",
      jobId,
      projectId: job.projectId,
      callId: "ark_document_draft_generation",
      title: "豆包已返回三类草稿",
      payload: {
        proposalId: proposalResult.proposal.id,
        quoteId: quoteResult.quote.id,
        contractId: contractResult.contract.id,
      },
      userMessage: "提案、报价和合同草稿已经生成，并保存为可追溯快照。",
      at: new Date().toISOString(),
    });

    await recordStageProgress({
      projectId: job.projectId,
      stageKey: "selection_quote_contract",
      status: "in_progress",
      currentStage: "selection_quote_contract",
      projectStatus: "in_progress",
      jobId,
      title: "提案、报价和合同草稿已生成",
      userMessage: "三类商务文档草稿已保存。请人工检查报价、合同条款和交付范围后再确认或发送飞书。",
      inputRefs: buildDraftInputRefs(context),
      outputRefs: [
        { type: "proposal", id: proposalResult.proposal.id },
        { type: "quote", id: quoteResult.quote.id },
        { type: "contract", id: contractResult.contract.id },
        { type: "document_snapshot", id: proposalResult.snapshot.id },
        { type: "document_snapshot", id: quoteResult.snapshot.id },
        { type: "document_snapshot", id: contractResult.snapshot.id },
      ],
      snapshot: {
        proposalId: proposalResult.proposal.id,
        proposalSnapshotId: proposalResult.snapshot.id,
        quoteId: quoteResult.quote.id,
        quoteSnapshotId: quoteResult.snapshot.id,
        contractId: contractResult.contract.id,
        contractSnapshotId: contractResult.snapshot.id,
        quoteTotalAmount: quoteResult.quote.totalAmount,
        quoteCurrency: quoteResult.quote.currency,
      },
    });

    await appendJobEvent(jobId, {
      type: "job.completed",
      jobId,
      projectId: job.projectId,
      title: "商务文档草稿生成完成",
      userMessage: "提案、报价和合同草稿已生成完成。",
      at: new Date().toISOString(),
    });

    await updateJobStatus(jobId, {
      status: "succeeded",
      currentStep: "completed",
      userMessage: "提案、报价和合同草稿已生成，并已保存为历史快照。",
    });

    return {
      jobId,
      proposal: proposalResult.proposal,
      quote: quoteResult.quote,
      contract: contractResult.contract,
      snapshots: {
        proposal: proposalResult.snapshot,
        quote: quoteResult.snapshot,
        contract: contractResult.snapshot,
      },
    };
  } catch (error) {
    const userMessage =
      error instanceof AppError
        ? error.userMessage
        : "提案、报价和合同草稿生成失败。系统已保存失败状态，你可以补充项目资料后重试，或联系管理员查看服务端日志。";

    await recordStageProgress({
      projectId: job.projectId,
      stageKey: "selection_quote_contract",
      status: "needs_revision",
      currentStage: "selection_quote_contract",
      projectStatus: "needs_revision",
      jobId,
      title: "商务文档草稿生成需要处理",
      userMessage,
      errorMessage: userMessage,
    });

    await appendJobEvent(jobId, {
      type: "step.failed",
      jobId,
      projectId: job.projectId,
      stepId: "document_draft_generation",
      title: "商务文档草稿生成失败",
      userMessage,
      recoverable: true,
      at: new Date().toISOString(),
    });

    if (!options.workerManagedFailure) {
      await updateJobStatus(jobId, {
        status: "failed",
        currentStep: "failed",
        userMessage,
        errorCode: error instanceof AppError ? error.code : "document_draft_generation_failed",
      });
    }

    throw error;
  }
}

async function generateDraftResponse(
  context: DocumentDraftContext,
  jobId: string,
  onStep: (step: string, userMessage: string) => Promise<void>
): Promise<GeneratedDraftResponse> {
  const basePrompt = buildDocumentDraftPrompt(context).slice(0, 4200);

  await onStep("generating_proposal_draft", "正在生成创意提案草稿。");
  const proposal = generatedProposalResponseSchema.parse(
    await callArkResponseJson({
      model: env.ARK_TEXT_STRUCTURING_MODEL,
      timeoutMs: 90_000,
      maxOutputTokens: 2600,
      temperature: 0.2,
      telemetry: {
        projectId: context.project.id,
        jobId,
        callId: "ark_document_proposal_draft_generation",
        provider: env.TEXT_STRUCTURING_PROVIDER,
        operation: "document_proposal_draft_generation",
        metadata: buildDraftTelemetryMetadata(context),
      },
      messages: [
        {
          role: "system",
          content:
            "你是内部 AIGC 视频商业项目的提案策划。只基于输入产物生成内部待审核提案，只输出严格 JSON：{ title, content }。content 包含项目目标、需求洞察、推荐创意、执行路径、风险和待确认事项。",
        },
        { role: "user", content: basePrompt },
      ],
    })
  );

  await onStep("generating_quote_draft", "提案草稿已生成，正在生成报价明细。");
  const quote = generatedQuoteResponseSchema.parse(
    await callArkResponseJson({
      model: env.ARK_TEXT_STRUCTURING_MODEL,
      timeoutMs: 90_000,
      maxOutputTokens: 1500,
      temperature: 0.15,
      telemetry: {
        projectId: context.project.id,
        jobId,
        callId: "ark_document_quote_draft_generation",
        provider: env.TEXT_STRUCTURING_PROVIDER,
        operation: "document_quote_draft_generation",
        metadata: buildDraftTelemetryMetadata(context),
      },
      messages: [
        {
          role: "system",
          content:
            "你是 AIGC 视频制片报价助理。只基于输入产物生成内部报价草稿，只输出严格 JSON：{ title, currency, items, notes }。items 每项包含 name、description、quantity、unitPrice；金额必须是数字，currency 默认 CNY。",
        },
        { role: "user", content: basePrompt },
      ],
    })
  );

  await onStep("generating_contract_draft", "报价草稿已生成，正在生成合同正文。");
  const contract = generatedContractResponseSchema.parse(
    await callArkResponseJson({
      model: env.ARK_TEXT_STRUCTURING_MODEL,
      timeoutMs: 90_000,
      maxOutputTokens: 3200,
      temperature: 0.1,
      telemetry: {
        projectId: context.project.id,
        jobId,
        callId: "ark_document_contract_draft_generation",
        provider: env.TEXT_STRUCTURING_PROVIDER,
        operation: "document_contract_draft_generation",
        metadata: buildDraftTelemetryMetadata(context),
      },
      messages: [
        {
          role: "system",
          content:
            "你是 AIGC 视频服务合同助理。只基于输入产物生成内部待审核合同，只输出严格 JSON：{ title, templateFields, content }。templateFields 包含 partyAName、partyBName、projectName、deliveryScope、paymentTerms、effectiveDate。必须列出待人工确认项，不冒充正式法律意见。",
        },
        {
          role: "user",
          content: `${basePrompt}\n\n报价草稿：${JSON.stringify(quote).slice(0, 2400)}`,
        },
      ],
    })
  );

  return generatedDraftResponseSchema.parse({ proposal, quote, contract });
}

function buildDraftTelemetryMetadata(context: DocumentDraftContext) {
  return {
    structuredRequirementCount: context.structuredRequirements.length,
    assetAnalysisCount: context.assetAnalyses.length,
    creativeDirectionCount: context.creativeDirections.length,
    creativeExpansionCount: context.creativeExpansions.length,
    generatedImageCount: context.generatedImages.length,
  };
}

async function collectDocumentDraftContext(projectId: string) {
  const [project, artifacts, assetAnalyses, creativeDirections, creativeExpansions, generatedImages, workloadEstimate, deliveryChecklist] = await Promise.all([
    getProjectById(projectId),
    listProjectArtifacts(projectId),
    listProjectAssetAnalyses(projectId),
    listProjectCreativeDirections(projectId),
    listProjectCreativeExpansions(projectId),
    listProjectGeneratedImages(projectId),
    getProjectWorkloadEstimate(projectId),
    getProjectDeliveryChecklist(projectId),
  ]);

  if (!project) {
    throw new AppError({
      status: 404,
      code: "project_not_found",
      userMessage: "没有找到这个项目。请刷新项目列表后重试。",
    });
  }

  const structuredRequirements = artifacts.filter((artifact) => artifact.kind === "structured_requirement").slice(0, 3);
  const scoreResults = artifacts.filter((artifact) => artifact.kind === "score_result").slice(0, 8);
  const successfulAnalyses = assetAnalyses.filter((analysis) => analysis.status === "succeeded").slice(0, 5);
  const selectedDirections = creativeDirections.filter((direction) => direction.isSelected);
  const directionsForDraft = (selectedDirections.length ? selectedDirections : creativeDirections).slice(0, 5);
  const directionIds = new Set(directionsForDraft.map((direction) => direction.id));
  const expansionsForDraft = creativeExpansions
    .filter((expansion) => directionIds.size === 0 || directionIds.has(expansion.directionId))
    .slice(0, 8);
  const expansionIds = new Set(expansionsForDraft.map((expansion) => expansion.id));
  const imagesForDraft = generatedImages
    .filter(
      (image) =>
        image.status === "succeeded" &&
        ((image.directionId && directionIds.has(image.directionId)) || (image.expansionId && expansionIds.has(image.expansionId)))
    )
    .slice(0, 5);

  return {
    project,
    structuredRequirements,
    scoreResults,
    assetAnalyses: successfulAnalyses,
    creativeDirections: directionsForDraft,
    creativeExpansions: expansionsForDraft,
    generatedImages: imagesForDraft,
    workloadEstimate,
    deliveryChecklist,
    hasUsableInput:
      structuredRequirements.length > 0 ||
      successfulAnalyses.length > 0 ||
      directionsForDraft.length > 0 ||
      expansionsForDraft.length > 0 ||
      Boolean(workloadEstimate) ||
      Boolean(deliveryChecklist),
  };
}

export function normalizeDocumentDraftBundle(
  response: GeneratedDraftResponse,
  context: Pick<DocumentDraftContext, "project" | "structuredRequirements" | "assetAnalyses" | "creativeDirections" | "creativeExpansions">,
  now: Date = new Date()
): DocumentDraftBundle {
  const brandName = context.project.brandName.trim();
  const projectName = context.project.projectName.trim();
  const fullProjectName = `${brandName}${projectName ? ` ${projectName}` : ""}`.trim();
  const proposalTitle = response.proposal.title.trim() || `${fullProjectName} AIGC 视频创意提案`;
  const proposalContent = normalizeLongContent(response.proposal.content, buildFallbackProposalContent(context, fullProjectName));
  const quoteItems = response.quote.items
    .map((item) => ({
      name: item.name.trim(),
      description: item.description.trim(),
      quantity: Math.max(1, item.quantity),
      unitPrice: Math.max(0, Math.round(item.unitPrice * 100) / 100),
    }))
    .filter((item) => item.name && item.quantity > 0 && item.unitPrice >= 0);

  if (quoteItems.length === 0) {
    throw new AppError({
      status: 502,
      code: "draft_quote_items_missing",
      userMessage: "模型没有返回可保存的报价明细。请稍后重试，或先补充交付范围和预算信息。",
    });
  }

  const quoteTitle = response.quote.title.trim() || `${fullProjectName} AIGC 视频服务报价`;
  const currency = normalizeCurrency(response.quote.currency);
  const totalAmount = quoteItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const contractFields = response.contract.templateFields;
  const deliveryScope = normalizeLongContent(
    contractFields.deliveryScope,
    buildDeliveryScope(context, quoteItems),
    12
  );
  const paymentTerms = normalizeLongContent(contractFields.paymentTerms, "合同签署后支付 50%，项目验收通过后支付 50%。", 8);
  const effectiveDate = contractFields.effectiveDate.trim() || formatDate(now);

  return {
    proposal: {
      title: proposalTitle,
      content: proposalContent,
      status: "draft",
    },
    quote: {
      title: quoteTitle,
      currency,
      items: quoteItems,
      notes:
        response.quote.notes.trim() ||
        "本报价为系统根据项目工作台产物生成的内部草稿，需人工确认交付范围、修改轮次、授权边界和税费口径后再对外发送。",
      status: "draft",
    },
    contract: {
      title: response.contract.title.trim() || `${fullProjectName} AIGC 视频服务合同`,
      templateKey: "default_aigc_video_contract",
      templateFields: {
        partyAName: contractFields.partyAName.trim() || brandName || "甲方待确认",
        partyBName: contractFields.partyBName.trim() || "跃然 AIGC 视频团队",
        projectName: contractFields.projectName.trim() || fullProjectName,
        quoteTitle,
        quoteTotalAmount: totalAmount,
        quoteCurrency: currency,
        deliveryScope,
        paymentTerms,
        effectiveDate,
      },
      content: response.contract.content.trim() || undefined,
      status: "draft",
    },
  };
}

function buildDocumentDraftPrompt(context: DocumentDraftContext) {
  const requirementText = context.structuredRequirements
    .map((artifact) => `需求产物：${formatUnknownValue(artifact.data).slice(0, 900)}`)
    .join("\n");
  const analysisText = context.assetAnalyses
    .map((analysis) => `资料解析：${analysis.summary}；标签：${analysis.labels.slice(0, 8).join("、")}；文本：${analysis.extractedText.slice(0, 320)}`)
    .join("\n");
  const directionText = context.creativeDirections
    .map(
      (direction) =>
        `创意方向：${direction.title}；核心：${direction.coreIdea}；适配：${direction.fitReason}；风险：${direction.riskNotes}；成本：${direction.costEstimate}；周期：${direction.cycleEstimate}；难度：${direction.technicalDifficulty}`
    )
    .join("\n");
  const expansionText = context.creativeExpansions
    .map(
      (expansion) =>
        `故事大纲：${expansion.title}；概念：${expansion.oneLiner}；结构：${formatUnknownValue(expansion.storyArc)}；视觉：${expansion.visualHighlights.join("、")}；风险：${expansion.riskNotes}`
    )
    .join("\n");
  const imageText = context.generatedImages
    .map((image) => `氛围图：${image.prompt.slice(0, 360)}；OSS：${image.ossUrl ? "已保存" : "未保存"}`)
    .join("\n");
  const scoreText = context.scoreResults.map((artifact) => `评分产物：${formatUnknownValue(artifact.data).slice(0, 420)}`).join("\n");
  const workloadText = formatWorkloadEstimateForPrompt(context.workloadEstimate);
  const deliveryChecklistText = formatDeliveryChecklistForPrompt(context.deliveryChecklist);

  return [
    "请基于下面项目工作台已有产物，生成内部待审核的提案、报价和合同草稿。",
    `品牌：${context.project.brandName}`,
    `项目：${context.project.projectName}`,
    `负责人：${context.project.ownerName}`,
    context.project.dueDate ? `截止时间：${context.project.dueDate}` : "",
    "报价要求：用 CNY 作为默认币种；按创意深化、氛围图/视觉资产、AIGC 视频生成、项目管理或后期交付拆分明细；金额必须是数字。",
    "合同要求：不要写成正式法律意见；必须明确交付范围、付款条款、生效日期、待人工确认事项。",
    requirementText,
    analysisText,
    directionText,
    expansionText,
    imageText,
    scoreText,
    workloadText,
    deliveryChecklistText,
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 9000);
}

export function formatWorkloadEstimateForPrompt(estimate: DocumentDraftContext["workloadEstimate"]) {
  if (!estimate) return "";
  return [
    "工作量估算：",
    `角色 ${estimate.roleCount} 个，场景 ${estimate.sceneCount} 个，镜头 ${estimate.shotCount} 个，图片 ${estimate.imageCount} 张，视频 ${estimate.videoCount} 条，修改轮次 ${estimate.revisionRounds} 轮。`,
    `交付版本：${estimate.deliverableVersions.length ? estimate.deliverableVersions.join("、") : "待人工确认"}。`,
    `建议价格区间：CNY ${estimate.priceRange.minCny} - CNY ${estimate.priceRange.maxCny}；复杂度：${estimate.complexity}。`,
    estimate.rationale ? `估算依据：${estimate.rationale}` : "",
    estimate.riskNotes ? `估算风险：${estimate.riskNotes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatDeliveryChecklistForPrompt(checklist: DocumentDraftContext["deliveryChecklist"]) {
  if (!checklist) return "";
  const items = checklist.items
    .map((item) => `${item.title}（${item.quantity}，${deliveryChecklistItemKindLabel(item.itemKind)}，${item.status}）：${item.description}`)
    .join("\n");
  return [
    `交付清单：状态 ${checklist.status}，版本 v${checklist.version}。`,
    checklist.notes ? `清单备注：${checklist.notes}` : "",
    items,
  ]
    .filter(Boolean)
    .join("\n");
}

function deliveryChecklistItemKindLabel(kind: string) {
  const labels: Record<string, string> = {
    horizontal_final: "横版成片",
    vertical_final: "竖版成片",
    no_subtitle_final: "无字幕版",
    cover: "封面图",
    project_file: "项目文件",
    generated_assets: "生成资产",
    other: "其他",
  };
  return labels[kind] ?? kind;
}

function buildDraftInputRefs(context: DocumentDraftContext) {
  return [
    ...context.structuredRequirements.map((artifact) => ({ type: "artifact", id: artifact.id, kind: artifact.kind })),
    ...context.scoreResults.map((artifact) => ({ type: "artifact", id: artifact.id, kind: artifact.kind })),
    ...context.assetAnalyses.map((analysis) => ({ type: "asset_analysis", id: analysis.id })),
    ...context.creativeDirections.map((direction) => ({ type: "creative_direction", id: direction.id })),
    ...context.creativeExpansions.map((expansion) => ({ type: "creative_expansion", id: expansion.id })),
    ...context.generatedImages.map((image) => ({ type: "generated_image", id: image.id })),
  ].slice(0, 40);
}

function buildFallbackProposalContent(
  context: Pick<DocumentDraftContext, "project" | "structuredRequirements" | "assetAnalyses" | "creativeDirections" | "creativeExpansions">,
  fullProjectName: string
) {
  const directions = context.creativeDirections.map((direction) => `${direction.title}：${direction.coreIdea}`).join("\n");
  const expansions = context.creativeExpansions.map((expansion) => `${expansion.title}：${expansion.oneLiner}`).join("\n");
  const analyses = context.assetAnalyses.map((analysis) => `${analysis.summary}`).join("\n");

  return [
    `${fullProjectName} AIGC 视频创意提案草稿`,
    "",
    "一、项目背景",
    `本草稿基于项目工作台中已保存的客户需求、资料解析、创意方向和故事大纲生成，供内部商务与创意团队审核。`,
    "",
    "二、推荐创意方向",
    directions || "待补充已选创意方向。",
    "",
    "三、故事与视觉表达",
    expansions || analyses || "待补充故事大纲、样片解析或视觉参考。",
    "",
    "四、待确认事项",
    "请人工确认品牌禁忌、素材授权、交付规格、修改轮次、报价口径和合同条款后再对外发送。",
  ].join("\n");
}

function buildDeliveryScope(
  context: Pick<DocumentDraftContext, "creativeDirections" | "creativeExpansions">,
  quoteItems: QuoteItem[]
) {
  const directionTitles = context.creativeDirections.map((direction) => direction.title).join("、");
  const expansionTitles = context.creativeExpansions.map((expansion) => expansion.title).slice(0, 5).join("、");
  const itemNames = quoteItems.map((item) => item.name).join("、");
  return [
    itemNames ? `交付内容包括：${itemNames}。` : "",
    directionTitles ? `创意方向参考：${directionTitles}。` : "",
    expansionTitles ? `故事大纲参考：${expansionTitles}。` : "",
    "具体交付数量、格式、修改轮次和验收口径以双方最终确认版本为准。",
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeLongContent(content: string, fallback: string, minLength = 20) {
  const trimmed = content.trim();
  if (trimmed.length >= minLength) return trimmed;
  return fallback;
}

function normalizeCurrency(currency: string) {
  const normalized = currency.trim().toUpperCase();
  return normalized.length >= 3 && normalized.length <= 8 ? normalized : "CNY";
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatUnknownValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(formatUnknownValue).filter(Boolean).join("、");
  if (typeof value === "object") return Object.values(value).map(formatUnknownValue).filter(Boolean).join("、");
  return String(value);
}
