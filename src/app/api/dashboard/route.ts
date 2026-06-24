import { jsonError } from "@/lib/errors";
import { requireUser } from "@/server/auth/session";
import { getRoleDashboard } from "@/server/repositories/dashboard";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const dashboard = await getRoleDashboard(user);
    return Response.json({ ok: true, data: dashboard });
  } catch (error) {
    return jsonError(error);
  }
}
