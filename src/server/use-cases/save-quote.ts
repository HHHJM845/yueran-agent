import { z } from "zod";
import { createArtifact } from "@/server/repositories/artifacts";
import { createAuditLog } from "@/server/repositories/audit-logs";
import { createDocumentSnapshot } from "@/server/repositories/proposals";
import { updateQuoteLatestSnapshot, upsertProjectQuote, type QuoteItem, type QuoteView } from "@/server/repositories/quotes";
import { recordStageProgress } from "@/server/use-cases/stage-progress";

const quoteItemSchema = z.object({
  name: z.string().trim().min(1, "请输入报价项目名称"),
  description: z.string().trim().optional().default(""),
  quantity: z.coerce.number().positive("数量必须大于 0"),
  unitPrice: z.coerce.number().nonnegative("单价不能为负数"),
});

export const saveQuoteInputSchema = z.object({
  title: z.string().trim().min(2, "请输入报价标题"),
  currency: z.string().trim().min(3).max(8).default("CNY"),
  items: z.array(quoteItemSchema).min(1, "请至少填写一条报价明细"),
  notes: z.string().trim().optional().default(""),
  status: z.enum(["draft", "waiting_review", "needs_revision", "confirmed", "sent", "signed", "terminated"]).default("draft"),
});

export async function saveProjectQuote(input: {
  projectId: string;
  actorId: string;
  title: string;
  currency?: string;
  items: QuoteItem[];
  notes?: string;
  status?: string;
}) {
  const parsed = saveQuoteInputSchema.parse({
    title: input.title,
    currency: input.currency ?? "CNY",
    items: input.items,
    notes: input.notes ?? "",
    status: input.status ?? "draft",
  });
  const totalAmount = calculateQuoteTotal(parsed.items);
  const quote = await upsertProjectQuote({
    projectId: input.projectId,
    title: parsed.title,
    currency: parsed.currency,
    items: parsed.items,
    notes: parsed.notes,
    totalAmount,
    status: parsed.status,
    actorId: input.actorId,
  });
  const snapshotData = buildQuoteSnapshotData(quote);
  const snapshot = await createDocumentSnapshot({
    projectId: input.projectId,
    documentType: "quote",
    documentId: quote.id,
    title: quote.title,
    version: quote.version,
    status: quote.status,
    content: JSON.stringify(snapshotData),
    summary: snapshotData.summary,
    snapshot: snapshotData,
    createdBy: input.actorId,
  });

  await updateQuoteLatestSnapshot({
    quoteId: quote.id,
    snapshotId: snapshot.id,
  });

  const artifact = await createArtifact({
    projectId: input.projectId,
    kind: "quote",
    title: `报价快照：${quote.title}`,
    status: quote.status,
    data: {
      quoteId: quote.id,
      snapshotId: snapshot.id,
      title: quote.title,
      currency: quote.currency,
      items: quote.items,
      notes: quote.notes,
      totalAmount: quote.totalAmount,
      status: quote.status,
      version: quote.version,
      summary: snapshot.summary,
    },
  });

  await recordStageProgress({
    projectId: input.projectId,
    stageKey: "selection_quote_contract",
    status: quote.status === "confirmed" || quote.status === "sent" || quote.status === "signed" ? "waiting_review" : "in_progress",
    currentStage: "selection_quote_contract",
    projectStatus: quote.status === "needs_revision" ? "needs_revision" : "in_progress",
    title: "报价快照已保存",
    userMessage: "报价已保存到项目快照，后续合同会引用这一版报价记录。",
    outputRefs: [
      { type: "quote", id: quote.id },
      { type: "document_snapshot", id: snapshot.id },
      { type: "artifact", id: artifact.id, kind: artifact.kind },
    ],
    snapshot: {
      quoteId: quote.id,
      snapshotId: snapshot.id,
      status: quote.status,
      version: quote.version,
      totalAmount: quote.totalAmount,
    },
  });

  await createAuditLog({
    actorId: input.actorId,
    projectId: input.projectId,
    action: "quote.saved",
    objectType: "quote",
    objectId: quote.id,
    after: {
      projectId: input.projectId,
      snapshotId: snapshot.id,
      status: quote.status,
      version: quote.version,
      totalAmount: quote.totalAmount,
      currency: quote.currency,
    },
  });

  return {
    quote: {
      ...quote,
      latestSnapshotId: snapshot.id,
    },
    snapshot,
    artifact,
  };
}

export function buildQuoteSnapshotData(input: Pick<QuoteView, "id" | "title" | "currency" | "items" | "notes" | "totalAmount" | "status" | "version"> | {
  quoteId: string;
  title: string;
  currency: string;
  items: QuoteItem[];
  notes: string;
  status: string;
  version: number;
}) {
  const quoteId = "quoteId" in input ? input.quoteId : input.id;
  const totalAmount = "totalAmount" in input ? input.totalAmount : calculateQuoteTotal(input.items);
  const summaryItems = input.items.slice(0, 3).map((item) => `${item.name} ${formatMoney(item.quantity * item.unitPrice, input.currency)}`);

  return {
    quoteId,
    version: input.version,
    title: input.title,
    status: input.status,
    currency: input.currency,
    items: input.items,
    notes: input.notes,
    totalAmount,
    summary: `${summaryItems.join("；")}；合计 ${formatMoney(totalAmount, input.currency)}`,
    capturedAt: new Date().toISOString(),
  };
}

function calculateQuoteTotal(items: QuoteItem[]) {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

function formatMoney(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}
