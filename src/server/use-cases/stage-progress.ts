import type { ProjectStage, StageStatus } from "@/domain/types";
import { appendJobEvent } from "@/server/repositories/jobs";
import { updateProjectStageProgress } from "@/server/repositories/project-stages";

export async function recordStageProgress(input: {
  projectId: string;
  stageKey: ProjectStage;
  status: StageStatus;
  currentStage?: ProjectStage;
  projectStatus?: StageStatus;
  jobId?: string;
  title?: string;
  userMessage: string;
  errorMessage?: string | null;
  inputRefs?: unknown[];
  outputRefs?: unknown[];
  snapshot?: Record<string, unknown>;
}) {
  const stage = await updateProjectStageProgress({
    projectId: input.projectId,
    stageKey: input.stageKey,
    status: input.status,
    currentStage: input.currentStage,
    projectStatus: input.projectStatus,
    errorMessage: input.errorMessage ?? null,
    inputRefs: input.inputRefs,
    outputRefs: input.outputRefs,
    snapshot: input.snapshot,
  });

  if (input.jobId) {
    await appendJobEvent(input.jobId, {
      type: "stage.updated",
      jobId: input.jobId,
      projectId: input.projectId,
      title: input.title ?? "阶段状态已更新",
      payload: {
        stageKey: input.stageKey,
        status: input.status,
        currentStage: input.currentStage ?? input.stageKey,
        stageStateId: stage.id,
      },
      userMessage: input.userMessage,
      recoverable: input.status !== "completed" && input.status !== "approved",
      at: new Date().toISOString(),
    });
  }

  return stage;
}
