import { jsonError } from "@/lib/errors";
import { requireUser } from "@/server/auth/session";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    return Response.json({ ok: true, data: { user } });
  } catch (error) {
    return jsonError(error);
  }
}
