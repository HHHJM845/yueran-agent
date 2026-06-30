import { AppError, jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { createAuditLog } from "@/server/repositories/audit-logs";
import { listProjectArtifacts } from "@/server/repositories/artifacts";
import { getProjectById } from "@/server/repositories/projects";
import { recordStageProgress } from "@/server/use-cases/stage-progress";

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["business", "admin"]);

    const project = await getProjectById(projectId);
    if (!project) {
      throw new AppError({
        status: 404,
        code: "project_not_found",
        userMessage: "没有找到这个项目。请刷新项目列表后再试。",
      });
    }

    const artifacts = await listProjectArtifacts(projectId);
    const latestBrief = artifacts.find((artifact) => artifact.kind === "structured_requirement") ?? null;
    if (!latestBrief) {
      throw new AppError({
        status: 422,
        code: "structured_requirement_required",
        userMessage: "请先生成标准化 Brief，再确认是否足够进入风险体检。",
      });
    }

    const openQuestionCount = countOpenQuestions((latestBrief.data as Partial<Record<string, unknown>>).openQuestions);
    const confirmedAt = new Date().toISOString();

    const stageState = await recordStageProgress({
      projectId,
      stageKey: "brand_requirement_intake",
      status: "completed",
      currentStage: "technical_feasibility",
      projectStatus: "in_progress",
      title: "当前 Brief 已人工确认可推进",
      userMessage: "已确认当前标准化 Brief 足够进入风险体检；待确认项会继续保留并在后续环节提示人工复核。",
      errorMessage: null,
      outputRefs: [{ type: "artifact", id: latestBrief.id, kind: latestBrief.kind }],
      snapshot: {
        artifactId: latestBrief.id,
        artifactVersion: latestBrief.version,
        openQuestionCount,
        confirmedBy: user.id,
        confirmedAt,
      },
    });

    await recordStageProgress({
      projectId,
      stageKey: "technical_feasibility",
      status: "in_progress",
      currentStage: "technical_feasibility",
      projectStatus: "in_progress",
      title: "风险体检卡可开始",
      userMessage: "项目已进入风险体检卡环节；请结合 Brief 和待确认项进行风险识别。",
      errorMessage: null,
      inputRefs: [{ type: "artifact", id: latestBrief.id, kind: latestBrief.kind }],
      snapshot: {
        sourceStage: "brand_requirement_intake",
        sourceArtifactId: latestBrief.id,
        sourceArtifactVersion: latestBrief.version,
        openQuestionCount,
      },
    });

    await createAuditLog({
      actorId: user.id,
      projectId,
      action: "requirement.brief_confirmed_for_risk",
      objectType: "artifact",
      objectId: latestBrief.id,
      before: {
        currentStage: project.currentStage,
        status: project.status,
      },
      after: {
        currentStage: "technical_feasibility",
        status: "in_progress",
        artifactId: latestBrief.id,
        artifactVersion: latestBrief.version,
        openQuestionCount,
      },
    });

    return Response.json({
      ok: true,
      data: {
        stageState,
        message: "已确认当前 Brief 足够推进，项目已进入风险体检卡。待确认项会继续保留为后续风险提示。",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

function countOpenQuestions(value: unknown) {
  if (Array.isArray(value)) return value.filter(Boolean).length;
  if (typeof value === "string" && value.trim()) return 1;
  return 0;
}
