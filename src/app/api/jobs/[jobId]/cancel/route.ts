import { AppError, jsonError } from "@/lib/errors";
import { requireProjectAccess } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { cancelQueuedJob, getJob } from "@/server/repositories/jobs";

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
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
    const cancelled = await cancelQueuedJob(jobId);

    if (!cancelled) {
      throw new AppError({
        status: 409,
        code: "job_not_cancellable",
        userMessage: "这个任务当前不能取消。只有等待队列中的任务可以取消；处理中任务请等待完成或失败后再处理。",
      });
    }

    return Response.json({ ok: true, data: { message: "任务已取消。" } });
  } catch (error) {
    return jsonError(error);
  }
}
