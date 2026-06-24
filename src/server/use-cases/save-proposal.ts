import { z } from "zod";
import { AppError } from "@/lib/errors";
import { createArtifact } from "@/server/repositories/artifacts";
import { createAuditLog } from "@/server/repositories/audit-logs";
import {
  createDocumentSnapshot,
  updateProposalLatestSnapshot,
  upsertProjectProposal,
  type ProposalView,
} from "@/server/repositories/proposals";
import { recordStageProgress } from "@/server/use-cases/stage-progress";

export const saveProposalInputSchema = z.object({
  title: z.string().trim().min(2, "请输入提案标题"),
  content: z.string().trim().min(20, "请至少填写 20 个字的提案内容"),
  status: z.enum(["draft", "waiting_review", "needs_revision", "confirmed"]).default("draft"),
});

export async function saveProjectProposal(input: {
  projectId: string;
  actorId: string;
  title: string;
  content: string;
  status?: string;
}) {
  const parsed = saveProposalInputSchema.parse({
    title: input.title,
    content: input.content,
    status: input.status ?? "draft",
  });

  const proposal = await upsertProjectProposal({
    projectId: input.projectId,
    title: parsed.title,
    content: parsed.content,
    status: parsed.status,
    actorId: input.actorId,
  });
  const snapshotData = buildProposalSnapshotData(proposal);
  const snapshot = await createDocumentSnapshot({
    projectId: input.projectId,
    documentType: "proposal",
    documentId: proposal.id,
    title: proposal.title,
    version: proposal.version,
    status: proposal.status,
    content: proposal.content,
    summary: snapshotData.summary,
    snapshot: snapshotData,
    createdBy: input.actorId,
  });

  await updateProposalLatestSnapshot({
    proposalId: proposal.id,
    snapshotId: snapshot.id,
  });

  const artifact = await createArtifact({
    projectId: input.projectId,
    kind: "proposal",
    title: `提案快照：${proposal.title}`,
    status: proposal.status,
    data: {
      proposalId: proposal.id,
      snapshotId: snapshot.id,
      title: proposal.title,
      content: proposal.content,
      status: proposal.status,
      version: proposal.version,
      summary: snapshot.summary,
    },
  });

  await recordStageProgress({
    projectId: input.projectId,
    stageKey: "creative_direction_proposal",
    status: parsed.status === "confirmed" ? "completed" : "waiting_review",
    currentStage: parsed.status === "confirmed" ? "selection_quote_contract" : "creative_direction_proposal",
    projectStatus: parsed.status === "confirmed" ? "in_progress" : "waiting_review",
    title: parsed.status === "confirmed" ? "创意方向提案已确认" : "创意方向提案等待确认",
    userMessage:
      parsed.status === "confirmed"
        ? "提案已确认，项目已进入方向初选、报价与签约阶段。"
        : "提案快照已保存，等待人工确认后进入报价与签约。",
    outputRefs: [
      { type: "proposal", id: proposal.id },
      { type: "document_snapshot", id: snapshot.id },
      { type: "artifact", id: artifact.id, kind: artifact.kind },
    ],
    snapshot: { proposalId: proposal.id, snapshotId: snapshot.id, status: proposal.status, version: proposal.version },
  });

  await createAuditLog({
    actorId: input.actorId,
    projectId: input.projectId,
    action: "proposal.saved",
    objectType: "proposal",
    objectId: proposal.id,
    after: {
      projectId: input.projectId,
      snapshotId: snapshot.id,
      status: proposal.status,
      version: proposal.version,
      title: proposal.title,
    },
  });

  return {
    proposal: {
      ...proposal,
      latestSnapshotId: snapshot.id,
    },
    snapshot,
    artifact,
  };
}

export function buildProposalSnapshotData(input: Pick<ProposalView, "id" | "title" | "content" | "status" | "version"> | {
  proposalId: string;
  title: string;
  content: string;
  status: string;
  version: number;
}) {
  const proposalId = "proposalId" in input ? input.proposalId : input.id;
  const summary = buildProposalSummary(input.content);

  if (!proposalId) {
    throw new AppError({
      status: 500,
      code: "proposal_snapshot_missing_id",
      userMessage: "提案保存成功前无法创建快照。请稍后重试。",
    });
  }

  return {
    proposalId,
    version: input.version,
    title: input.title,
    status: input.status,
    summary,
    content: input.content,
    capturedAt: new Date().toISOString(),
  };
}

function buildProposalSummary(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= 20) return normalized;
  const maxLength = Math.min(80, normalized.length - 4);
  return `${normalized.slice(0, maxLength)}...`;
}
