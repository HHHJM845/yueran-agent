import { jsonError } from "@/lib/errors";
import { requireProjectAccess } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { listProjectAssetAnalyses } from "@/server/repositories/asset-analyses";
import { listProjectAssets } from "@/server/repositories/assets";
import { listProjectArtifacts } from "@/server/repositories/artifacts";
import { listProjectCreativeDirections } from "@/server/repositories/creative-directions";
import { listProjectCreativeExpansions } from "@/server/repositories/creative-expansions";
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
import { listProjectReviewCutAnnotations, listProjectReviewCuts } from "@/server/repositories/review-cuts";
import { listStoryProduction } from "@/server/repositories/story-production";
import { getProjectRiskCheck } from "@/server/repositories/risk-checks";

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    const [
      jobs,
      artifacts,
      assets,
      assetAnalyses,
      creativeDirections,
      creativeExpansions,
      generatedImages,
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
      clientReviewTasks,
      clientReviewItems,
      reviewCuts,
      reviewCutAnnotations,
      riskCheck,
    ] = await Promise.all([
      listProjectJobs(projectId),
      listProjectArtifacts(projectId),
      listProjectAssets(projectId),
      listProjectAssetAnalyses(projectId),
      listProjectCreativeDirections(projectId),
      listProjectCreativeExpansions(projectId),
      listProjectGeneratedImages(projectId),
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
      listProjectClientReviewTasks(projectId),
      listProjectClientReviewItems(projectId),
      listProjectReviewCuts(projectId),
      listProjectReviewCutAnnotations(projectId),
      getProjectRiskCheck(projectId),
    ]);
    return Response.json({
      ok: true,
      data: {
        jobs,
        artifacts,
        assets,
        assetAnalyses,
        creativeDirections,
        creativeExpansions,
        generatedImages,
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
        clientReviewTasks,
        clientReviewItems,
        reviewCuts,
        reviewCutAnnotations,
        riskCheck,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
