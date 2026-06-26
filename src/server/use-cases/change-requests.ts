import { AppError } from "@/lib/errors";
import {
  createChangeRequest as insertChangeRequest,
  listProjectChangeRequests,
  updateChangeRequestStatus as setChangeRequestStatus,
  type ChangeRequestStatus,
  type ChangeRequestView,
} from "@/server/repositories/change-requests";

const changeRequestStatuses: ChangeRequestStatus[] = ["draft", "submitted", "approved", "rejected", "implemented", "cancelled"];

export type { ChangeRequestView };

export function shouldSuggestChangeRequestForReviewCut(input: {
  contractedRounds: number;
  nextRoundNumber: number;
  clientRejected: boolean;
}) {
  return input.clientRejected && input.nextRoundNumber > input.contractedRounds;
}

export async function listOpenChangeRequests(projectId: string) {
  const requests = await listProjectChangeRequests(projectId);
  return requests.filter((request) => request.status === "draft" || request.status === "submitted" || request.status === "approved");
}

export async function createChangeRequest(input: {
  projectId: string;
  sourceSop: string;
  originalScope: string;
  requestedScope: string;
  impactJson: unknown;
  actorId: string;
  sourceObjectType?: string;
  sourceObjectId?: string | null;
}) {
  return insertChangeRequest({
    projectId: input.projectId,
    sourceSop: input.sourceSop.trim(),
    originalScope: input.originalScope.trim(),
    requestedScope: input.requestedScope.trim(),
    impactJson: input.impactJson,
    actorId: input.actorId,
    sourceObjectType: input.sourceObjectType,
    sourceObjectId: input.sourceObjectId,
    status: "submitted",
  });
}

export async function updateChangeRequestStatus(input: {
  projectId: string;
  changeRequestId: string;
  status: ChangeRequestStatus;
  decisionReason?: string;
  actorId: string;
}) {
  if (!changeRequestStatuses.includes(input.status)) {
    throw new AppError({
      status: 400,
      code: "invalid_change_request_status",
      userMessage: "需求变更状态不合法。请刷新工作台后重新选择状态。",
    });
  }

  const request = await setChangeRequestStatus({
    projectId: input.projectId,
    changeRequestId: input.changeRequestId,
    status: input.status,
    decisionReason: input.decisionReason,
    actorId: input.actorId,
  });
  if (!request) {
    throw new AppError({
      status: 404,
      code: "change_request_not_found",
      userMessage: "没有找到这条需求变更。请刷新项目工作台后重试。",
    });
  }
  return request;
}
