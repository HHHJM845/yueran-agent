import { AppError, jsonError } from "@/lib/errors";
import { requireProjectAccess } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { getJob, listJobEvents } from "@/server/repositories/jobs";

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const user = await requireUser(request);
    const { jobId } = await context.params;
    const job = await getJob(jobId);

    if (!job) {
      throw new AppError({
        status: 404,
        code: "job_not_found",
        userMessage: "没有找到这个任务。它可能已经被删除，或你没有权限查看。",
      });
    }

    await requireProjectAccess(user, job.projectId);
    const events = await listJobEvents(jobId);
    return Response.json({ ok: true, data: { job, events } });
  } catch (error) {
    return jsonError(error);
  }
}
