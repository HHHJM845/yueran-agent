import { getConfigurationStatus } from "@/lib/env";
import { jsonError } from "@/lib/errors";
import { requireUser } from "@/server/auth/session";

export async function GET(request: Request) {
  try {
    await requireUser(request);
    return Response.json({ ok: true, data: getConfigurationStatus() });
  } catch (error) {
    return jsonError(error);
  }
}
