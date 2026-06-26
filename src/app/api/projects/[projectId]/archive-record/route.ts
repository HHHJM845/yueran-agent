import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { getProjectArchiveRecord } from "@/server/repositories/archive-records";
import { completeProjectArchive, saveProjectArchive, validateArchiveCompletion } from "@/server/use-cases/archive-project";

const archiveRecordSchema = z.object({
  finalFilesReady: z.boolean().optional(),
  finalTechnicalCheckPassed: z.boolean().optional(),
  tailPaymentConfirmed: z.boolean().optional(),
  clientReceivedConfirmed: z.boolean().optional(),
  rightsConfirmed: z.boolean().optional(),
  caseStudyPermission: z.enum(["allowed", "not_allowed", "pending"]).optional(),
  nasArchiveCompleted: z.boolean().optional(),
  deliveryChannel: z.string().optional(),
  archiveLocation: z.string().optional(),
  afterSalesNote: z.string().optional(),
});

const completeArchiveSchema = z.object({
  action: z.literal("complete"),
  archiveRecordId: z.string().uuid(),
});

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);

    const archiveRecord = await getProjectArchiveRecord(projectId);
    return Response.json({
      ok: true,
      data: {
        archiveRecord,
        missingItems: archiveRecord ? validateArchiveCompletion(archiveRecord) : ["请先保存结算交付与归档信息"],
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["business", "admin"]);

    const body = archiveRecordSchema.parse(await request.json());
    const archiveRecord = await saveProjectArchive({
      projectId,
      actorId: user.id,
      ...body,
    });

    return Response.json({
      ok: true,
      data: {
        archiveRecord,
        missingItems: validateArchiveCompletion(archiveRecord),
        message: "结算交付与归档信息已保存，完成前仍会逐项检查。",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["business", "admin"]);

    const body = completeArchiveSchema.parse(await request.json());
    const archiveRecord = await completeProjectArchive({
      projectId,
      archiveRecordId: body.archiveRecordId,
      actorId: user.id,
    });

    return Response.json({
      ok: true,
      data: {
        archiveRecord,
        missingItems: [],
        message: "结算交付与完整归档已完成，项目已关闭。",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
