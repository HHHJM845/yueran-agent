import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { listScoringRules, upsertScoringRule } from "@/server/repositories/scoring-rules";

const scoringRuleSchema = z.object({
  tag: z.string().min(1, "请输入标签名称"),
  weight: z.number().positive("权重必须大于 0"),
  description: z.string().optional().default(""),
  positiveExamples: z.array(z.string()).optional().default([]),
  negativeExamples: z.array(z.string()).optional().default([]),
  isActive: z.boolean().optional().default(true),
});

export async function GET(request: Request) {
  try {
    await requireUser(request);
    const rules = await listScoringRules();
    return Response.json({ ok: true, data: rules });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    requireRole(user, ["admin"]);
    const body = scoringRuleSchema.parse(await request.json());
    const rule = await upsertScoringRule({
      tag: body.tag.trim(),
      weight: body.weight,
      description: body.description.trim(),
      positiveExamples: body.positiveExamples.map((item) => item.trim()).filter(Boolean),
      negativeExamples: body.negativeExamples.map((item) => item.trim()).filter(Boolean),
      isActive: body.isActive,
      actorId: user.id,
    });

    return Response.json({ ok: true, data: rule }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
