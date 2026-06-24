import { z } from "zod";
import { AppError, jsonError } from "@/lib/errors";
import { requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import {
  listScoringRuleVersions,
  scoringRuleExists,
} from "@/server/repositories/scoring-rules";

const ruleIdSchema = z.string().uuid("评分规则 ID 格式不正确");

export async function GET(
  request: Request,
  context: { params: Promise<{ ruleId: string }> }
) {
  try {
    const user = await requireUser(request);
    requireRole(user, ["admin"]);
    const { ruleId: rawRuleId } = await context.params;
    const ruleId = ruleIdSchema.parse(rawRuleId);

    if (!(await scoringRuleExists(ruleId))) {
      throw new AppError({
        status: 404,
        code: "scoring_rule_not_found",
        userMessage: "没有找到这条评分规则。它可能已被删除，请刷新规则列表后重试。",
      });
    }

    const versions = await listScoringRuleVersions(ruleId);
    return Response.json({ ok: true, data: versions });
  } catch (error) {
    return jsonError(error);
  }
}
