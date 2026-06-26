import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { getProjectWorkloadEstimate } from "@/server/repositories/workload-estimates";
import { saveProjectWorkloadEstimate } from "@/server/use-cases/workload-estimate";

const saveWorkloadEstimateRequestSchema = z.object({
  roleCount: z.union([z.number(), z.string()]).optional(),
  sceneCount: z.union([z.number(), z.string()]).optional(),
  shotCount: z.union([z.number(), z.string()]).optional(),
  imageCount: z.union([z.number(), z.string()]).optional(),
  videoCount: z.union([z.number(), z.string()]).optional(),
  revisionRounds: z.union([z.number(), z.string()]).optional(),
  deliverableVersions: z.array(z.string()).optional(),
  complexity: z.string().optional(),
  minPriceCny: z.union([z.number(), z.string()]).optional(),
  maxPriceCny: z.union([z.number(), z.string()]).optional(),
  rationale: z.string().optional(),
  riskNotes: z.string().optional(),
  status: z.enum(["draft", "generated"]).optional(),
});

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);

    return Response.json({
      ok: true,
      data: {
        workloadEstimate: await getProjectWorkloadEstimate(projectId),
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

    const body = saveWorkloadEstimateRequestSchema.parse(await request.json());
    const workloadEstimate = await saveProjectWorkloadEstimate({
      projectId,
      actorId: user.id,
      status: body.status,
      estimate: body,
    });

    return Response.json({
      ok: true,
      data: {
        workloadEstimate,
        message: "工作量估算已保存。报价仍需人工确认，这里只作为报价建议和交付清单输入。",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
