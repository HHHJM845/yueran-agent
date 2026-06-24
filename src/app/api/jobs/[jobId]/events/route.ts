import { AppError, jsonError } from "@/lib/errors";
import { requireProjectAccess } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { getJob, listJobEvents } from "@/server/repositories/jobs";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const user = await requireUser(request);
    const { jobId } = await context.params;
    const initialJob = await getJob(jobId);

    if (!initialJob) {
      throw new AppError({
        status: 404,
        code: "job_not_found",
        userMessage: "没有找到这个任务。它可能已经被删除，或你没有权限查看。",
      });
    }

    await requireProjectAccess(user, initialJob.projectId);

    const url = new URL(request.url);
  const afterFromQuery = Number(url.searchParams.get("after") ?? "0");
  const afterFromHeader = Number(request.headers.get("last-event-id") ?? "0");
  let lastSequence = Number.isFinite(afterFromQuery) ? afterFromQuery : 0;
  lastSequence = Math.max(lastSequence, Number.isFinite(afterFromHeader) ? afterFromHeader : 0);

  const encoder = new TextEncoder();

    return new Response(
    new ReadableStream({
      async start(controller) {
        async function sendAvailableEvents() {
          const job = await getJob(jobId);

          if (!job) {
            throw new AppError({
              status: 404,
              code: "job_not_found",
              userMessage: "没有找到这个任务。它可能已经被删除，或你没有权限查看。",
            });
          }

          const events = await listJobEvents(jobId, lastSequence);
          for (const { id, event } of events) {
            lastSequence = Number(id);
            controller.enqueue(encoder.encode(`id: ${id}\n`));
            controller.enqueue(encoder.encode(`event: ${event.type}\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          }
        }

        try {
          await sendAvailableEvents();
        } catch (error) {
          const message = error instanceof AppError ? error.userMessage : "任务进度流暂时无法读取。请刷新页面后重试。";
          controller.enqueue(
            encoder.encode(
              `event: step.failed\ndata: ${JSON.stringify({
                type: "step.failed",
                jobId,
                projectId: "",
                stepId: "event_stream",
                userMessage: message,
                recoverable: true,
                at: new Date().toISOString(),
              })}\n\n`
            )
          );
          controller.close();
          return;
        }

        const interval = setInterval(async () => {
          try {
            await sendAvailableEvents();
          } catch {
            controller.close();
            clearInterval(interval);
          }
        }, 2000);

        request.signal.addEventListener("abort", () => {
          clearInterval(interval);
          controller.close();
        });
      },
    }),
    {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    }
    );
  } catch (error) {
    return jsonError(error);
  }
}
