import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { getProjectDeliveryChecklist } from "@/server/repositories/delivery-checklists";
import { createDeliveryChecklistFromEstimate, saveProjectDeliveryChecklist } from "@/server/use-cases/workload-estimate";

const checklistItemSchema = z.object({
  itemKind: z.enum([
    "horizontal_final",
    "vertical_final",
    "no_subtitle_final",
    "cover",
    "project_file",
    "generated_assets",
    "other",
  ]),
  title: z.string(),
  description: z.string().optional(),
  quantity: z.number(),
  status: z.enum(["planned", "confirmed", "changed", "delivered", "cancelled"]).optional(),
  sortOrder: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const saveChecklistRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_from_estimate"),
    estimateId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("save"),
    estimateId: z.string().uuid().nullable().optional(),
    status: z.enum(["draft", "confirmed", "changed", "archived"]).optional(),
    notes: z.string().optional(),
    items: z.array(checklistItemSchema),
  }),
]);

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);

    return Response.json({
      ok: true,
      data: {
        deliveryChecklist: await getProjectDeliveryChecklist(projectId),
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

    const body = saveChecklistRequestSchema.parse(await request.json());
    const deliveryChecklist =
      body.action === "create_from_estimate"
        ? await createDeliveryChecklistFromEstimate({
            projectId,
            estimateId: body.estimateId,
            actorId: user.id,
          })
        : await saveProjectDeliveryChecklist({
            projectId,
            actorId: user.id,
            estimateId: body.estimateId,
            status: body.status,
            notes: body.notes,
            items: body.items,
          });

    return Response.json({
      ok: true,
      data: {
        deliveryChecklist,
        message:
          body.action === "create_from_estimate"
            ? "交付清单已根据工作量估算生成，请在签约前逐项核对。"
            : "交付清单已保存，后续合同和归档会读取这版清单。",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
