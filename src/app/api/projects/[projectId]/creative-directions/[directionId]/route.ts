import { z } from "zod";
import { AppError, jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { createAuditLog } from "@/server/repositories/audit-logs";
import {
  updateCreativeDirectionContent,
  updateCreativeDirectionSelection,
} from "@/server/repositories/creative-directions";

const patchDirectionSchema = z.object({
  isSelected: z.boolean().optional(),
  title: z.string().min(1, "请输入创意标题").optional(),
  coreIdea: z.string().min(1, "请输入核心创意").optional(),
  fitReason: z.string().min(1, "请输入适配理由").optional(),
  riskNotes: z.string().optional(),
  costEstimate: z.string().optional(),
  cycleEstimate: z.string().optional(),
  technicalDifficulty: z.string().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ projectId: string; directionId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId, directionId } = await context.params;
    await requireProjectAccess(user, projectId);

    const body = patchDirectionSchema.parse(await request.json());

    if (typeof body.isSelected === "boolean" && Object.keys(body).length === 1) {
      requireRole(user, ["business", "creative", "admin"]);
      const direction = await updateCreativeDirectionSelection({
        projectId,
        directionId,
        isSelected: body.isSelected,
      });

      if (!direction) {
        throw new AppError({
          status: 404,
          code: "creative_direction_not_found",
          userMessage: "没有找到这张创意方向卡片。它可能已经被归档或删除。",
        });
      }

      await createAuditLog({
        actorId: user.id,
        projectId,
        action: body.isSelected ? "creative_direction.selected" : "creative_direction.unselected",
        objectType: "creative_direction",
        objectId: direction.id,
        after: { projectId, isSelected: direction.isSelected, title: direction.title },
      });

      return Response.json({
        ok: true,
        data: {
          direction,
          message: body.isSelected ? "已选中这个创意方向。" : "已取消选中这个创意方向。",
        },
      });
    }

    requireRole(user, ["creative", "admin"]);
    const direction = await updateCreativeDirectionContent({
      projectId,
      directionId,
      title: body.title ?? "",
      coreIdea: body.coreIdea ?? "",
      fitReason: body.fitReason ?? "",
      riskNotes: body.riskNotes ?? "",
      costEstimate: body.costEstimate ?? "",
      cycleEstimate: body.cycleEstimate ?? "",
      technicalDifficulty: body.technicalDifficulty ?? "",
    });

    if (!direction) {
      throw new AppError({
        status: 404,
        code: "creative_direction_not_found",
        userMessage: "没有找到这张创意方向卡片。它可能已经被归档或删除。",
      });
    }

    await createAuditLog({
      actorId: user.id,
      projectId,
      action: "creative_direction.updated",
      objectType: "creative_direction",
      objectId: direction.id,
      after: {
        projectId,
        title: direction.title,
        score: direction.score,
        costEstimate: direction.costEstimate,
        cycleEstimate: direction.cycleEstimate,
        technicalDifficulty: direction.technicalDifficulty,
      },
    });

    return Response.json({
      ok: true,
      data: {
        direction,
        message: "创意方向已保存。刷新页面后也会保留这次人工改写。",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
