import type { ClaimedJob } from "@/server/repositories/jobs";
import { appendJobEvent, extendJobLock, scheduleJobRetry } from "@/server/repositories/jobs";
import { runAssetUnderstandingJob } from "@/server/use-cases/analyze-asset";
import { markGeneratedImageFailed } from "@/server/repositories/generated-images";
import { readAtmosphereGeneratedImageIdFromInput, runAtmosphereImageGenerationJob } from "@/server/use-cases/generate-atmosphere-image";
import { runCreativeDirectionGenerationJob } from "@/server/use-cases/generate-creative-directions";
import { runCreativeExpansionGenerationJob } from "@/server/use-cases/generate-creative-expansions";
import { runDocumentDraftGenerationJob } from "@/server/use-cases/generate-document-drafts";
import { runDocumentExportJob } from "@/server/use-cases/export-document";
import { runFeishuDeliveryJob } from "@/server/use-cases/feishu-delivery";
import { runRequirementStructuringJob } from "@/server/use-cases/structure-requirement";
import { runProductionReferenceImageGenerationJob } from "@/server/use-cases/production-reference-images";
import { runStoryboardImageGenerationJob, runStoryboardVideoGenerationJob } from "@/server/use-cases/storyboard-media";
import { AppError } from "@/lib/errors";

export async function runClaimedJob(job: ClaimedJob, workerId: string) {
  const heartbeat = setInterval(() => {
    void extendJobLock({ jobId: job.id, workerId }).catch((error) => {
      console.error("Failed to extend job lock", {
        jobId: job.id,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    });
  }, 60_000);

  try {
    await appendJobEvent(job.id, {
      type: "job.started",
      jobId: job.id,
      projectId: job.projectId,
      title: job.title,
      userMessage: "后台 worker 已开始处理这个任务。",
      at: new Date().toISOString(),
    });

    if (job.type === "requirement_structuring") {
      await runRequirementStructuringJob(job.id, { workerManagedFailure: true });
      return;
    }

    if (job.type === "asset_understanding") {
      await runAssetUnderstandingJob(job.id, { workerManagedFailure: true });
      return;
    }

    if (job.type === "creative_direction_generation") {
      await runCreativeDirectionGenerationJob(job.id, { workerManagedFailure: true });
      return;
    }

    if (job.type === "creative_expansion_generation") {
      await runCreativeExpansionGenerationJob(job.id, { workerManagedFailure: true });
      return;
    }

    if (job.type === "atmosphere_image_generation") {
      await runAtmosphereImageGenerationJob(job.id, { workerManagedFailure: true });
      return;
    }

    if (job.type === "storyboard_image_generation") {
      await runStoryboardImageGenerationJob(job.id);
      return;
    }

    if (job.type === "production_reference_image_generation") {
      await runProductionReferenceImageGenerationJob(job.id);
      return;
    }

    if (job.type === "storyboard_video_generation") {
      await runStoryboardVideoGenerationJob(job.id);
      return;
    }

    if (job.type === "quote_contract_generation") {
      await runDocumentDraftGenerationJob(job.id, { workerManagedFailure: true });
      return;
    }

    if (job.type === "document_export") {
      await runDocumentExportJob(job.id, { workerManagedFailure: true });
      return;
    }

    if (job.type === "feishu_delivery") {
      await runFeishuDeliveryJob(job.id, { workerManagedFailure: true });
      return;
    }

    throw new AppError({
      status: 422,
      code: "unsupported_job_type",
      userMessage: "这个任务类型还没有接入后台 worker。请联系管理员检查任务配置。",
    });
  } catch (error) {
    const userMessage =
      error instanceof AppError
        ? error.userMessage
        : "任务处理出现异常，系统会自动重试。若再次失败，再提示你手动重试或联系管理员。";
    const errorCode = error instanceof AppError ? error.code : "worker_job_failed";

    const retryResult = await scheduleJobRetry({
      jobId: job.id,
      projectId: job.projectId,
      userMessage,
      errorCode,
      delaySeconds: 90,
    });
    if (job.type === "atmosphere_image_generation" && retryResult?.status === "failed") {
      const generatedImageId = readAtmosphereGeneratedImageIdFromInput(job.input);
      if (generatedImageId) {
        await markGeneratedImageFailed({
          id: generatedImageId,
          failureReason: userMessage,
        });
      }
    }
  } finally {
    clearInterval(heartbeat);
  }
}
