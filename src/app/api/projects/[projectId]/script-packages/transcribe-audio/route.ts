import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { transcribeScriptRevisionAudio } from "@/server/use-cases/script-storyboard";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["creative", "admin"]);

    const formData = await request.formData();
    const audio = formData.get("audio");
    if (!(audio instanceof File)) {
      return Response.json(
        {
          ok: false,
          error: {
            code: "audio_file_required",
            message: "没有收到语音文件。请重新录音后再试。",
            recoverable: true,
          },
        },
        { status: 400 }
      );
    }

    const result = await transcribeScriptRevisionAudio({
      projectId,
      audio: Buffer.from(await audio.arrayBuffer()),
      mimeType: audio.type || "audio/webm",
      actorId: user.id,
    });

    return Response.json({ ok: true, data: result });
  } catch (error) {
    return jsonError(error);
  }
}
