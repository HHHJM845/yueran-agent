import { AppError, jsonError } from "@/lib/errors";
import { projectStages, type ProjectStage, type Role } from "@/domain/types";
import { requireProjectAccess } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { createReadUrl, createReadUrlFromOssUrl } from "@/server/providers/oss";
import { listProjectAssetAnalyses } from "@/server/repositories/asset-analyses";
import { listProjectAssets } from "@/server/repositories/assets";
import { listProjectArtifacts } from "@/server/repositories/artifacts";
import { listProjectCreativeDirections } from "@/server/repositories/creative-directions";
import { listProjectCreativeExpansions } from "@/server/repositories/creative-expansions";
import { listCreativeProposalRounds } from "@/server/repositories/creative-proposals";
import { getProjectContract } from "@/server/repositories/contracts";
import { listProjectDocumentExports } from "@/server/repositories/document-exports";
import { listProjectFeishuDeliveries } from "@/server/repositories/feishu-deliveries";
import { listProjectFeishuReceivers } from "@/server/repositories/feishu-receivers";
import { listProjectGeneratedImages } from "@/server/repositories/generated-images";
import { listProjectJobs } from "@/server/repositories/jobs";
import { listProjectStageStates } from "@/server/repositories/project-stages";
import { getProjectProposal, listProjectDocumentSnapshots } from "@/server/repositories/proposals";
import { getProjectQuote } from "@/server/repositories/quotes";
import { listProjectClientReviewItems, listProjectClientReviewTasks } from "@/server/repositories/client-reviews";
import { listProjectChangeRequests } from "@/server/repositories/change-requests";
import { listProjectReviewCutAnnotations, listProjectReviewCuts } from "@/server/repositories/review-cuts";
import { listProductionEntities, listProductionReferenceSets } from "@/server/repositories/production-entities";
import { listStoryProduction } from "@/server/repositories/story-production";
import { getStoryboardImageBatchWorkspace } from "@/server/use-cases/storyboard-image-batches";
import { getProjectRiskCheck } from "@/server/repositories/risk-checks";
import { getProjectWorkloadEstimate } from "@/server/repositories/workload-estimates";
import { getProjectDeliveryChecklist } from "@/server/repositories/delivery-checklists";
import { getProjectArchiveRecord } from "@/server/repositories/archive-records";
import { getProjectById } from "@/server/repositories/projects";

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode");
    if (mode === "stage") {
      const stage = parseStage(url.searchParams.get("stage"));
      const data = await loadStageWorkspaceData(projectId, stage, user.role);
      return Response.json({ ok: true, data });
    }

    const [
      project,
      jobs,
      artifacts,
      assets,
      assetAnalyses,
      creativeDirections,
      creativeExpansions,
      generatedImages,
      creativeProposalRounds,
      proposal,
      proposalSnapshots,
      quote,
      quoteSnapshots,
      contract,
      contractSnapshots,
      contractExports,
      feishuDeliveries,
      feishuReceivers,
      stageStates,
      storyProduction,
      storyboardImageBatchWorkspace,
      productionEntities,
      productionReferenceSets,
      clientReviewTasks,
      clientReviewItems,
      reviewCuts,
      reviewCutAnnotations,
      riskCheck,
      workloadEstimate,
      deliveryChecklist,
      archiveRecord,
      changeRequests,
    ] = await Promise.all([
      getProjectById(projectId),
      listProjectJobs(projectId),
      listProjectArtifacts(projectId),
      listProjectAssets(projectId),
      listProjectAssetAnalyses(projectId),
      listProjectCreativeDirections(projectId),
      listProjectCreativeExpansions(projectId),
      listProjectGeneratedImages(projectId),
      listCreativeProposalRounds(projectId),
      getProjectProposal(projectId),
      listProjectDocumentSnapshots(projectId, "proposal"),
      getProjectQuote(projectId),
      listProjectDocumentSnapshots(projectId, "quote"),
      getProjectContract(projectId),
      listProjectDocumentSnapshots(projectId, "contract"),
      listProjectDocumentExports(projectId, "contract"),
      listProjectFeishuDeliveries(projectId),
      user.role === "business" || user.role === "admin" ? listProjectFeishuReceivers(projectId) : Promise.resolve([]),
      listProjectStageStates(projectId),
      listStoryProduction(projectId),
      getStoryboardImageBatchWorkspace(projectId),
      listProductionEntities(projectId),
      listProductionReferenceSets(projectId),
      listProjectClientReviewTasks(projectId),
      listProjectClientReviewItems(projectId),
      listProjectReviewCuts(projectId),
      listProjectReviewCutAnnotations(projectId),
      getProjectRiskCheck(projectId),
      getProjectWorkloadEstimate(projectId),
      getProjectDeliveryChecklist(projectId),
      getProjectArchiveRecord(projectId),
      listProjectChangeRequests(projectId),
    ]);
    if (!project) {
      throw new AppError({
        status: 404,
        code: "project_not_found",
        userMessage: "没有找到这个项目。它可能已经被移出项目列表，或你没有权限查看。",
      });
    }
    return Response.json({
      ok: true,
      data: {
        project,
        jobs,
        artifacts,
        assets,
        assetAnalyses,
        creativeDirections,
        creativeExpansions,
        generatedImages: mapGeneratedImages(generatedImages),
        creativeProposalRounds: mapCreativeProposalRounds(creativeProposalRounds),
        proposal,
        proposalSnapshots,
        quote,
        quoteSnapshots,
        contract,
        contractSnapshots,
        contractExports,
        feishuDeliveries,
        feishuReceivers,
        stageStates,
        ...storyProduction,
        ...storyboardImageBatchWorkspace,
        productionEntities,
        productionReferenceSets,
        clientReviewTasks,
        clientReviewItems,
        reviewCuts,
        reviewCutAnnotations,
        riskCheck,
        workloadEstimate,
        deliveryChecklist,
        archiveRecord,
        changeRequests,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

function parseStage(stage: string | null): ProjectStage {
  if (stage && projectStages.includes(stage as ProjectStage)) return stage as ProjectStage;
  throw new AppError({
    status: 422,
    code: "workspace_stage_required",
    userMessage: "请提供要刷新的工作台阶段。请刷新页面后重试。",
  });
}

async function loadStageWorkspaceData(projectId: string, stage: ProjectStage, role: Role) {
  const [project, jobs, stageStates, changeRequests] = await Promise.all([
    getProjectById(projectId),
    listProjectJobs(projectId),
    listProjectStageStates(projectId),
    listProjectChangeRequests(projectId),
  ]);
  if (!project) {
    throw new AppError({
      status: 404,
      code: "project_not_found",
      userMessage: "没有找到这个项目。它可能已经被移出项目列表，或你没有权限查看。",
    });
  }

  const common = { project, jobs, stageStates, changeRequests };
  if (stage === "brand_requirement_intake") {
    const [assets, assetAnalyses, artifacts, reviewCuts] = await Promise.all([
      listProjectAssets(projectId),
      listProjectAssetAnalyses(projectId),
      listProjectArtifacts(projectId),
      listProjectReviewCuts(projectId),
    ]);
    return { ...common, assets, assetAnalyses, artifacts, reviewCuts };
  }

  if (stage === "technical_feasibility") {
    const riskCheck = await getProjectRiskCheck(projectId);
    return { ...common, riskCheck };
  }

  if (stage === "creative_direction_proposal") {
    const [creativeDirections, creativeExpansions, generatedImages, creativeProposalRounds, clientReviewTasks, artifacts] =
      await Promise.all([
        listProjectCreativeDirections(projectId),
        listProjectCreativeExpansions(projectId),
        listProjectGeneratedImages(projectId),
        listCreativeProposalRounds(projectId),
        listProjectClientReviewTasks(projectId),
        listProjectArtifacts(projectId),
      ]);
    return {
      ...common,
      creativeDirections,
      creativeExpansions,
      generatedImages: mapGeneratedImages(generatedImages),
      creativeProposalRounds: mapCreativeProposalRounds(creativeProposalRounds),
      clientReviewTasks,
      artifacts,
    };
  }

  if (stage === "selection_quote_contract") {
    const [
      assets,
      workloadEstimate,
      creativeDirections,
      generatedImages,
      quote,
      quoteSnapshots,
      contract,
      proposal,
      contractSnapshots,
      contractExports,
      deliveryChecklist,
      clientReviewTasks,
      feishuDeliveries,
      feishuReceivers,
      proposalSnapshots,
    ] = await Promise.all([
      listProjectAssets(projectId),
      getProjectWorkloadEstimate(projectId),
      listProjectCreativeDirections(projectId),
      listProjectGeneratedImages(projectId),
      getProjectQuote(projectId),
      listProjectDocumentSnapshots(projectId, "quote"),
      getProjectContract(projectId),
      getProjectProposal(projectId),
      listProjectDocumentSnapshots(projectId, "contract"),
      listProjectDocumentExports(projectId, "contract"),
      getProjectDeliveryChecklist(projectId),
      listProjectClientReviewTasks(projectId),
      listProjectFeishuDeliveries(projectId),
      role === "business" || role === "admin" ? listProjectFeishuReceivers(projectId) : Promise.resolve([]),
      listProjectDocumentSnapshots(projectId, "proposal"),
    ]);
    return {
      ...common,
      assets,
      workloadEstimate,
      creativeDirections,
      generatedImages: mapGeneratedImages(generatedImages),
      quote,
      quoteSnapshots,
      contract,
      proposal,
      contractSnapshots,
      contractExports,
      deliveryChecklist,
      clientReviewTasks,
      feishuDeliveries,
      feishuReceivers,
      proposalSnapshots,
    };
  }

  if (stage === "script_storyboard_confirmation") {
    const [generatedImages, storyProduction, productionEntities, productionReferenceSets, clientReviewTasks] = await Promise.all([
      listProjectGeneratedImages(projectId),
      listStoryProduction(projectId),
      listProductionEntities(projectId),
      listProductionReferenceSets(projectId),
      listProjectClientReviewTasks(projectId),
    ]);
    return {
      ...common,
      generatedImages: mapGeneratedImages(generatedImages),
      ...storyProduction,
      productionEntities,
      productionReferenceSets,
      clientReviewTasks,
    };
  }

  if (stage === "storyboard_image_canvas") {
    const [
      storyProduction,
      storyboardImageBatchWorkspace,
      productionEntities,
      productionReferenceSets,
      generatedImages,
      clientReviewTasks,
      clientReviewItems,
    ] = await Promise.all([
      listStoryProduction(projectId),
      getStoryboardImageBatchWorkspace(projectId),
      listProductionEntities(projectId),
      listProductionReferenceSets(projectId),
      listProjectGeneratedImages(projectId),
      listProjectClientReviewTasks(projectId),
      listProjectClientReviewItems(projectId),
    ]);
    return {
      ...common,
      ...storyProduction,
      ...storyboardImageBatchWorkspace,
      productionEntities,
      productionReferenceSets,
      generatedImages: mapGeneratedImages(generatedImages),
      clientReviewTasks,
      clientReviewItems,
    };
  }

  if (stage === "ai_video_canvas") {
    const storyProduction = await listStoryProduction(projectId);
    return { ...common, ...storyProduction };
  }

  if (stage === "a_copy_revision" || stage === "b_copy_final_confirmation") {
    const [reviewCuts, reviewCutAnnotations, clientReviewTasks] = await Promise.all([
      listProjectReviewCuts(projectId),
      listProjectReviewCutAnnotations(projectId),
      listProjectClientReviewTasks(projectId),
    ]);
    return { ...common, reviewCuts, reviewCutAnnotations, clientReviewTasks };
  }

  const [archiveRecord, deliveryChecklist] = await Promise.all([
    getProjectArchiveRecord(projectId),
    getProjectDeliveryChecklist(projectId),
  ]);
  return { ...common, archiveRecord, deliveryChecklist };
}

function mapGeneratedImages(generatedImages: Awaited<ReturnType<typeof listProjectGeneratedImages>>) {
  return generatedImages.map((image) => ({
    ...image,
    ossUrl: image.ossKey
      ? createReadUrl(image.ossKey, 60 * 60, {
          disposition: "inline",
          fileName: "atmosphere.png",
        })
      : image.ossUrl,
  }));
}

function mapCreativeProposalRounds(creativeProposalRounds: Awaited<ReturnType<typeof listCreativeProposalRounds>>) {
  return {
    rounds: creativeProposalRounds.rounds.map((round) => ({
      ...round,
      concepts: round.concepts.map((concept) => ({
        ...concept,
        images: concept.images.map((image) => ({
          ...image,
          ossUrl: image.ossUrl
            ? createReadUrlFromOssUrl(image.ossUrl, 60 * 60, {
                disposition: "inline",
                fileName: `creative-candidate-${image.sortOrder}.png`,
              })
            : null,
        })),
      })),
    })),
  };
}
