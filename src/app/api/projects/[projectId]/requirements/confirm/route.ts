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
        userMessage: "请先生成标准化 Brief，再确认是否足够进入接单风险评估。",
      });
    }

    const openQuestionCount = countOpenQuestions((latestBrief.data as Partial<Record<string, unknown>>).openQuestions);
    const confirmedAt = new Date().toISOString();

    const stageState = await recordStageProgress({
      projectId,
      stageKey: "brand_requirement_intake",
      status: "in_progress",
      currentStage: "brand_requirement_intake",
      projectStatus: "in_progress",
      title: "标准 Brief 已内部确认",
      userMessage: "标准 Brief 已内部确认，请生成甲方确认链接，待甲方通过后进入接单风险评估。",
      errorMessage: null,
      outputRefs: [{ type: "artifact", id: latestBrief.id, kind: latestBrief.kind }],
      snapshot: {
        artifactId: latestBrief.id,
        artifactVersion: latestBrief.version,
        openQuestionCount,
        internalConfirmed: true,
        confirmedBy: user.id,
        confirmedAt,
      },
    });

    await createAuditLog({
      actorId: user.id,
      projectId,
      action: "requirement.brief_internal_confirmed",
      objectType: "artifact",
      objectId: latestBrief.id,
      before: {
        currentStage: project.currentStage,
        status: project.status,
      },
      after: {
        currentStage: "brand_requirement_intake",
        status: "in_progress",
        artifactId: latestBrief.id,
        artifactVersion: latestBrief.version,
        openQuestionCount,
        internalConfirmed: true,
      },
    });

    return Response.json({
      ok: true,
      data: {
        stageState,
        message: "标准 Brief 已内部确认，请生成甲方确认链接，待甲方通过后进入接单风险评估。",
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
