import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { saveProjectContract } from "@/server/use-cases/save-contract";

const saveContractRequestSchema = z.object({
  title: z.string(),
  templateKey: z.string().optional(),
  templateFields: z.object({
    partyAName: z.string(),
    partyBName: z.string(),
    projectName: z.string(),
    quoteTitle: z.string().optional(),
    quoteTotalAmount: z.number().optional(),
    quoteCurrency: z.string().optional(),
    deliveryScope: z.string(),
    paymentTerms: z.string(),
    effectiveDate: z.string(),
  }),
  content: z.string().optional(),
  status: z.string().optional(),
  proposalId: z.string().uuid().nullable().optional(),
  quoteId: z.string().uuid().nullable().optional(),
  clientContractAssetId: z.string().uuid().nullable().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["business", "admin"]);

    const body = saveContractRequestSchema.parse(await request.json());
    const result = await saveProjectContract({
      projectId,
      actorId: user.id,
      title: body.title,
      templateKey: body.templateKey,
      templateFields: {
        partyAName: body.templateFields.partyAName,
        partyBName: body.templateFields.partyBName,
        projectName: body.templateFields.projectName,
        quoteTitle: body.templateFields.quoteTitle ?? "",
        quoteTotalAmount: body.templateFields.quoteTotalAmount ?? 0,
        quoteCurrency: body.templateFields.quoteCurrency ?? "CNY",
        deliveryScope: body.templateFields.deliveryScope,
        paymentTerms: body.templateFields.paymentTerms,
        effectiveDate: body.templateFields.effectiveDate,
      },
      content: body.content,
      status: body.status,
      proposalId: body.proposalId,
      quoteId: body.quoteId,
      clientContractAssetId: body.clientContractAssetId,
    });

    return Response.json({
      ok: true,
      data: {
        contract: result.contract,
        snapshot: result.snapshot,
        message: `合同已保存为 v${result.contract.version}，并创建历史快照。`,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
