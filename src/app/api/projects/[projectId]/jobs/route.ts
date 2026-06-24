import { z } from "zod";
import { jobTypes } from "@/domain/types";
import { AppError, jsonError } from "@/lib/errors";
import { requireProjectAccess } from "@/server/auth/rbac";
import { requireUser } from "@/server/auth/session";
import { listProjectJobs } from "@/server/repositories/jobs";

const createJobSchema = z.object({
  type: z.enum(jobTypes),
  title: z.string().min(1, "请输入任务标题"),
});

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    const jobs = await listProjectJobs(projectId);
    return Response.json({ ok: true, data: jobs });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId);
    createJobSchema.parse(await request.json());
    throw new AppError({
      status: 422,
      code: "generic_job_creation_disabled",
      userMessage: "通用任务创建入口已关闭。请从对应业务动作发起任务，以便系统保存必要输入并由后台 worker 处理。",
    });
  } catch (error) {
    return jsonError(error);
  }
}
