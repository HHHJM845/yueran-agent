import { jsonError } from "@/lib/errors";
import { unlockClientReviewByToken } from "@/server/use-cases/client-review";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const result = await unlockClientReviewByToken(token, await request.json());
    return Response.json({ ok: true, data: result });
  } catch (error) {
    return jsonError(error);
  }
}
