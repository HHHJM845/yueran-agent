import { randomUUID } from "node:crypto";
import { claimNextRunnableJob, recoverExpiredProcessingJobs } from "@/server/repositories/jobs";
import { runClaimedJob } from "@/server/workers/handlers";

type WorkerOptions = {
  once?: boolean;
  idleDelayMs?: number;
  lockSeconds?: number;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function startJobWorker(options: WorkerOptions = {}) {
  const workerId = `worker-${randomUUID()}`;
  const idleDelayMs = options.idleDelayMs ?? 3000;
  const lockSeconds = options.lockSeconds ?? 240;

  let shuttingDown = false;
  const shutdown = () => {
    shuttingDown = true;
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  console.log("AUGC job worker started", { workerId, once: Boolean(options.once) });

  while (!shuttingDown) {
    await recoverExpiredProcessingJobs();
    const job = await claimNextRunnableJob({ workerId, lockSeconds });

    if (!job) {
      if (options.once) break;
      await delay(idleDelayMs);
      continue;
    }

    console.log("Claimed job", { workerId, jobId: job.id, type: job.type });
    await runClaimedJob(job, workerId);

    if (options.once) break;
  }

  console.log("AUGC job worker stopped", { workerId });
}
