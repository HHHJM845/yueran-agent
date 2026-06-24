import { jsonError } from "@/lib/errors";
import { clearSessionCookie } from "@/server/auth/session";

export async function POST(request: Request) {
  try {
    const cookie = await clearSessionCookie(request);
    return Response.json(
      { ok: true, data: { message: "已退出登录。" } },
      {
        headers: {
          "Set-Cookie": cookie,
        },
      }
    );
  } catch (error) {
    return jsonError(error);
  }
}
