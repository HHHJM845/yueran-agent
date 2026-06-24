import { jsonError } from "@/lib/errors";
import { requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { listAuditLogsPage } from "@/server/repositories/audit-logs";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    requireRole(user, ["admin"]);

    const url = new URL(request.url);
    const page = await listAuditLogsPage({
      objectType: emptyToNull(url.searchParams.get("objectType")),
      projectId: emptyToNull(url.searchParams.get("projectId")),
      action: emptyToNull(url.searchParams.get("action")),
      actorId: emptyToNull(url.searchParams.get("actorId")),
      from: emptyToNull(url.searchParams.get("from")),
      to: emptyToNull(url.searchParams.get("to")),
      limit: Number(url.searchParams.get("limit") ?? "20"),
      offset: Number(url.searchParams.get("offset") ?? "0"),
    });

    return Response.json({
      ok: true,
      data: page,
    });
  } catch (error) {
    return jsonError(error);
  }
}

function emptyToNull(value: string | null) {
  const normalized = value?.trim() ?? "";
  return normalized ? normalized : null;
}
