import { AppError, jsonError } from "@/lib/errors";
import { requireProjectAccess } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { getJob, retryFailedJobNow } from "@/server/repositories/jobs";

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
    const retried = await retryFailedJobNow(jobId);

    if (!retried) {
      throw new AppError({
        status: 409,
        code: "job_not_retryable",
        userMessage: "这个任务当前不能重试。只有失败状态的任务可以重新入队。",
      });
    }

    return Response.json({ ok: true, data: { message: "任务已重新进入队列。" } });
  } catch (error) {
    return jsonError(error);
  }
}
