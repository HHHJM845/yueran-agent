import { AppError } from "@/lib/errors";
import {
  completeArchiveRecord,
  getProjectArchiveRecord,
  saveArchiveRecord,
  type ArchiveRecordView,
  type CaseStudyPermission,
  type SaveArchiveRecordInput,
} from "@/server/repositories/archive-records";
import { getProjectById } from "@/server/repositories/projects";
import { recordStageProgress } from "@/server/use-cases/stage-progress";

export type { ArchiveRecordView };

export type ArchiveCompletionInput = {
  finalFilesReady: boolean;
  finalTechnicalCheckPassed: boolean;
  tailPaymentConfirmed: boolean;
  clientReceivedConfirmed: boolean;
  rightsConfirmed: boolean;
  caseStudyPermission: CaseStudyPermission;
  nasArchiveCompleted: boolean;
};

export type SaveProjectArchiveInput = SaveArchiveRecordInput;

export function validateArchiveCompletion(input: ArchiveCompletionInput) {
  const missing: string[] = [];
  if (!input.finalFilesReady) missing.push("最终交付文件尚未准备完成");
  if (!input.finalTechnicalCheckPassed) missing.push("最终技术检查尚未通过");
  if (!input.tailPaymentConfirmed) missing.push("尾款尚未确认到账");
  if (!input.clientReceivedConfirmed) missing.push("甲方尚未确认收到文件");
  if (!input.rightsConfirmed) missing.push("版权和授权尚未确认");
  if (input.caseStudyPermission === "pending") missing.push("案例展示权尚未确认");
  if (!input.nasArchiveCompleted) missing.push("NAS 归档尚未完成");
  return missing;
}

export async function saveProjectArchive(input: SaveProjectArchiveInput): Promise<ArchiveRecordView> {
  const project = await getProjectById(input.projectId);
  if (!project) {
    throw new AppError({
      status: 404,
      code: "project_not_found",
      userMessage: "没有找到这个项目。请刷新项目列表后重试。",
    });
  }

  const existing = await getProjectArchiveRecord(input.projectId);
  assertArchiveRecordMutable(existing);
  return saveArchiveRecord(input);
}

export function assertArchiveRecordMutable(existing: ArchiveRecordView | null) {
  if (!existing || (existing.status !== "completed" && existing.status !== "archived")) return;

  throw new AppError({
    status: 409,
    code: "archive_record_closed",
    userMessage: "这个项目归档已经完成或关闭，不能通过普通保存修改归档证据。如需调整，请先走重新打开或管理员处理流程。",
  });
}

export async function completeProjectArchive(input: {
  projectId: string;
  archiveRecordId: string;
  actorId: string;
}): Promise<ArchiveRecordView> {
  const project = await getProjectById(input.projectId);
  if (!project) {
    throw new AppError({
      status: 404,
      code: "project_not_found",
      userMessage: "没有找到这个项目。请刷新项目列表后重试。",
    });
  }

  const archiveRecord = await getProjectArchiveRecord(input.projectId);
  if (!archiveRecord || archiveRecord.id !== input.archiveRecordId) {
    throw new AppError({
      status: 404,
      code: "archive_record_not_found",
      userMessage: "没有找到这个项目的归档记录。请先保存归档信息后再完成项目。",
    });
  }

  const missingItems = validateArchiveCompletion(archiveRecord);
  if (missingItems.length > 0) {
    throw new AppError({
      status: 422,
      code: "archive_not_ready",
      userMessage: `归档还不能完成，请先补齐：${missingItems.join("、")}。`,
    });
  }

  const completed = await completeArchiveRecord(input);
  if (!completed) {
    throw new AppError({
      status: 404,
      code: "archive_record_not_found",
      userMessage: "归档记录已不存在。请刷新工作台后重试。",
    });
  }

  await recordStageProgress({
    projectId: input.projectId,
    stageKey: "settlement_delivery_archive",
    status: "completed",
    currentStage: "settlement_delivery_archive",
    projectStatus: "completed",
    userMessage: "结算交付与完整归档已完成，项目已关闭。",
    snapshot: {
      archiveRecordId: completed.id,
      completedAt: completed.completedAt,
      deliveryChannel: completed.deliveryChannel,
      archiveLocation: completed.archiveLocation,
    },
  });

  return completed;
}
