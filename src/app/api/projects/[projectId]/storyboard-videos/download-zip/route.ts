import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { requireProjectAccess, requireRole } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { createStoryboardVideoZipDownload } from "@/server/use-cases/storyboard-media";

const downloadZipSchema = z.object({
  videoIds: z.array(z.string().uuid()).min(1),
});

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    requireRole(user, ["creative", "admin"]);

    const body = downloadZipSchema.parse(await request.json());
    const result = await createStoryboardVideoZipDownload({
      projectId,
      videoIds: body.videoIds,
    });

    return new Response(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
