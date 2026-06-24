import { jsonError } from "@/lib/errors";
import { requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { getAiUsageSummary } from "@/server/repositories/ai-usage";
import { listAuditLogs } from "@/server/repositories/audit-logs";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    requireRole(user, ["admin"]);
    const url = new URL(request.url);
    const objectType = url.searchParams.get("objectType");
    const projectId = url.searchParams.get("projectId");
    const action = url.searchParams.get("action");
    const actorId = url.searchParams.get("actorId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const limit = Number(url.searchParams.get("limit") ?? "80");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    const [aiUsage, auditLogs] = await Promise.all([
      getAiUsageSummary(),
      listAuditLogs({ objectType, projectId, action, actorId, from, to, limit, offset }),
    ]);

    return Response.json({
      ok: true,
      data: {
        aiUsage,
        auditLogs,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
