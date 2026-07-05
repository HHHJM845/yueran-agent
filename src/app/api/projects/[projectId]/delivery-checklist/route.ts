import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { getProjectDeliveryChecklist, updateDeliveryChecklistItem } from "@/server/repositories/delivery-checklists";
import { createDeliveryChecklistFromEstimate, saveProjectDeliveryChecklist } from "@/server/use-cases/workload-estimate";

const checklistItemSchema = z.object({
  id: z.string().uuid().optional(),
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
  status: z.enum(["planned", "confirmed", "changed"]).optional(),
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
    status: z.enum(["draft", "confirmed", "changed"]).optional(),
    notes: z.string().optional(),
    items: z.array(checklistItemSchema),
    removedItemIds: z.array(z.string().uuid()).optional(),
  }),
  z.object({
    action: z.literal("update_item_status"),
    itemId: z.string().uuid(),
    status: z.enum(["planned", "confirmed", "changed"]),
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
        : body.action === "update_item_status"
          ? await updateDeliveryChecklistItem({
              projectId,
              itemId: body.itemId,
              status: body.status,
              actorId: user.id,
            })
          : await saveProjectDeliveryChecklist({
              projectId,
              actorId: user.id,
              estimateId: body.estimateId,
              status: body.status,
              notes: body.notes,
              items: body.items,
              removedItemIds: body.removedItemIds,
            });

    return Response.json({
      ok: true,
      data: {
        deliveryChecklist,
        message:
          body.action === "create_from_estimate"
            ? "交付清单已根据工作量估算生成，请在签约前逐项核对。"
            : body.action === "update_item_status"
              ? "交付清单项状态已更新，B copy 定稿确认会读取最新结果。"
              : deliveryChecklist.status === "confirmed"
                ? "交付清单已确认，项目进入脚本、人物场景设定与文字分镜确认。"
                : "交付清单已保存为草稿，确认清单前项目会继续停留在 SOP4。",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
