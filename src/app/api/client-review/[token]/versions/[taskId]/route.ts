import { jsonError } from "@/lib/errors";
import { loadClientReviewVersionByToken } from "@/server/use-cases/client-review";

export async function GET(request: Request, context: { params: Promise<{ token: string; taskId: string }> }) {
  try {
    const { token, taskId } = await context.params;
    const url = new URL(request.url);
    const verificationCode =
      request.headers.get("x-client-review-code") ??
      url.searchParams.get("key") ??
      url.searchParams.get("code") ??
      url.searchParams.get("verificationCode") ??
      "";
    const result = await loadClientReviewVersionByToken(token, taskId, { verificationCode });
    return Response.json({ ok: true, data: result });
  } catch (error) {
    return jsonError(error);
  }
}
