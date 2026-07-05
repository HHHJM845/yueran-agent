import { jsonError } from "@/lib/errors";
import { loadClientReviewUnlockPrompt, submitClientReviewByToken } from "@/server/use-cases/client-review";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    await context.params;
    return Response.json({ ok: true, data: loadClientReviewUnlockPrompt() });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const result = await submitClientReviewByToken(token, await request.json());
    return Response.json({ ok: true, data: result });
  } catch (error) {
    return jsonError(error);
  }
}
