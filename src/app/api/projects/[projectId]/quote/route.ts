import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { saveProjectQuote } from "@/server/use-cases/save-quote";

const saveQuoteRequestSchema = z.object({
  title: z.string(),
  currency: z.string().optional(),
  items: z.array(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      quantity: z.number(),
      unitPrice: z.number(),
    })
  ),
  notes: z.string().optional(),
  status: z.string().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["business", "admin"]);

    const body = saveQuoteRequestSchema.parse(await request.json());
    const result = await saveProjectQuote({
      projectId,
      actorId: user.id,
      title: body.title,
      currency: body.currency,
      items: body.items.map((item) => ({
        name: item.name,
        description: item.description ?? "",
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      notes: body.notes,
      status: body.status,
    });

    return Response.json({
      ok: true,
      data: {
        quote: result.quote,
        snapshot: result.snapshot,
        message: `报价已保存为 v${result.quote.version}，并创建历史快照。`,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
