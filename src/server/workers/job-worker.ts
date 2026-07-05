import { randomUUID } from "node:crypto";
import { claimNextRunnableJob, recoverExpiredProcessingJobs } from "@/server/repositories/jobs";
import { runClaimedJob } from "@/server/workers/handlers";
import type { ClaimedJob } from "@/server/repositories/jobs";

type WorkerOptions = {
  once?: boolean;
  idleDelayMs?: number;
  lockSeconds?: number;
  concurrency?: number;
};

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type JobWorkerRuntimeDependencies = {
  randomId: () => string;
  recoverExpiredProcessingJobs: () => Promise<unknown>;
  claimNextRunnableJob: (input: { workerId: string; lockSeconds?: number }) => Promise<ClaimedJob | null>;
  runClaimedJob: (job: ClaimedJob, workerId: string) => Promise<void>;
  delay: (ms: number) => Promise<void>;
  log: (...args: unknown[]) => void;
  onSignal: (signal: NodeJS.Signals, listener: () => void) => void;
};

const defaultWorkerConcurrency = 3;

export async function startJobWorker(options: WorkerOptions = {}) {
  const runtime = createJobWorkerRuntime({
    randomId: randomUUID,
    recoverExpiredProcessingJobs,
    claimNextRunnableJob,
    runClaimedJob,
    delay,
    log: console.log,
    onSignal: (signal, listener) => process.once(signal, listener),
  });

  await runtime.start(options);
}

export function createJobWorkerRuntime(dependencies: JobWorkerRuntimeDependencies) {
  return {
    start: (options: WorkerOptions = {}) => runJobWorkerLoop(dependencies, options),
  };
}

export function resolveWorkerConcurrency(options: Pick<WorkerOptions, "once" | "concurrency"> = {}) {
  if (options.once) return 1;
  const rawValue = options.concurrency ?? Number(process.env.JOB_WORKER_CONCURRENCY ?? defaultWorkerConcurrency);
  if (!Number.isFinite(rawValue)) return defaultWorkerConcurrency;
  return Math.max(1, Math.min(8, Math.floor(rawValue)));
}

async function runJobWorkerLoop(dependencies: JobWorkerRuntimeDependencies, options: WorkerOptions = {}) {
  const workerId = `worker-${dependencies.randomId()}`;
  const idleDelayMs = options.idleDelayMs ?? 3000;
  const lockSeconds = options.lockSeconds ?? 240;
  const concurrency = resolveWorkerConcurrency(options);

  let shuttingDown = false;
  const shutdown = () => {
    shuttingDown = true;
  };

  dependencies.onSignal("SIGINT", shutdown);
  dependencies.onSignal("SIGTERM", shutdown);

  dependencies.log("AUGC job worker started", { workerId, once: Boolean(options.once), concurrency });

  while (!shuttingDown) {
    try {
      await dependencies.recoverExpiredProcessingJobs();
      const jobs = await claimRunnableJobs({ workerId, lockSeconds, concurrency, claimNextJob: dependencies.claimNextRunnableJob });

      if (jobs.length === 0) {
        if (options.once) break;
        await dependencies.delay(idleDelayMs);
        continue;
      }

      await Promise.all(
        jobs.map((job) => {
          dependencies.log("Claimed job", { workerId, jobId: job.id, type: job.type });
          return dependencies.runClaimedJob(job, workerId);
        })
      );

      if (options.once) break;
    } catch (error) {
      if (options.once) throw error;
      dependencies.log("AUGC job worker loop failed; retrying", formatWorkerLoopError(error));
      await dependencies.delay(idleDelayMs);
    }
  }

  dependencies.log("AUGC job worker stopped", { workerId });
}

function formatWorkerLoopError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { message: "Unknown worker loop error" };
}

async function claimRunnableJobs(input: {
  workerId: string;
  lockSeconds: number;
  concurrency: number;
  claimNextJob: (claimInput: { workerId: string; lockSeconds?: number }) => Promise<ClaimedJob | null>;
}) {
  const jobs: ClaimedJob[] = [];
  for (let index = 0; index < input.concurrency; index += 1) {
    const job = await input.claimNextJob({ workerId: input.workerId, lockSeconds: input.lockSeconds });
    if (!job) break;
    jobs.push(job);
  }
  return jobs;
}
