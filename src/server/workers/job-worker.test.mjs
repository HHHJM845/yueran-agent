import assert from "node:assert/strict";
import test from "node:test";

import { createJobWorkerRuntime, resolveWorkerConcurrency } from "./job-worker.ts";

function createClaimedJob(id) {
  return {
    id,
    projectId: "project-1",
    type: "storyboard_image_generation",
    status: "processing",
    title: `Job ${id}`,
    provider: "volcengine_ark",
    modelName: "doubao-seedream-4-0-250828",
    currentStep: "claimed_by_worker",
    retryCount: 0,
    userMessage: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    input: {},
    maxAttempts: 2,
  };
}

test("worker claims multiple jobs concurrently up to the configured limit", async () => {
  const jobs = [createClaimedJob("job-1"), createClaimedJob("job-2"), createClaimedJob("job-3")];
  const claimed = [];
  const started = [];
  let shutdown = () => {};
  let resolveAllJobsStarted;
  const allJobsStarted = new Promise((resolve) => {
    resolveAllJobsStarted = resolve;
  });

  const runtime = createJobWorkerRuntime({
    randomId: () => "worker-test",
    recoverExpiredProcessingJobs: async () => 0,
    claimNextRunnableJob: async () => {
      const job = jobs.shift() ?? null;
      if (job) claimed.push(job.id);
      return job;
    },
    runClaimedJob: async (job) => {
      started.push(job.id);
      if (started.length === 3) {
        resolveAllJobsStarted();
        shutdown();
      }
      if (job.id === "job-1") {
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
    },
    delay: async () => {},
    log: () => {},
    onSignal: (_signal, listener) => {
      shutdown = listener;
    },
  });

  await Promise.all([runtime.start({ concurrency: 3, lockSeconds: 240 }), allJobsStarted]);

  assert.deepEqual(claimed, ["job-1", "job-2", "job-3"]);
  assert.deepEqual(started.sort(), ["job-1", "job-2", "job-3"]);
});

test("worker backfills an available concurrency slot without waiting for the whole batch", async () => {
  const jobs = [createClaimedJob("job-1"), createClaimedJob("job-2"), createClaimedJob("job-3")];
  const claimed = [];
  const started = [];
  let shutdown = () => {};
  let releaseJob1;
  let resolveJob2Finished;
  let resolveJob3Started;
  const job1Blocker = new Promise((resolve) => {
    releaseJob1 = resolve;
  });
  const job2Finished = new Promise((resolve) => {
    resolveJob2Finished = resolve;
  });
  const job3Started = new Promise((resolve) => {
    resolveJob3Started = resolve;
  });

  const runtime = createJobWorkerRuntime({
    randomId: () => "worker-test",
    recoverExpiredProcessingJobs: async () => 0,
    claimNextRunnableJob: async () => {
      const job = jobs.shift() ?? null;
      if (job) claimed.push(job.id);
      return job;
    },
    runClaimedJob: async (job) => {
      started.push(job.id);
      if (job.id === "job-1") {
        await job1Blocker;
      }
      if (job.id === "job-2") {
        resolveJob2Finished();
      }
      if (job.id === "job-3") {
        resolveJob3Started();
        shutdown();
      }
    },
    delay: async () => {},
    log: () => {},
    onSignal: (_signal, listener) => {
      shutdown = listener;
    },
  });

  const workerRun = runtime.start({ concurrency: 2, lockSeconds: 240, idleDelayMs: 1 });
  await job2Finished;

  const backfilledBeforeJob1Finished = await Promise.race([
    job3Started.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 40)),
  ]);
  releaseJob1();
  await workerRun;

  assert.equal(backfilledBeforeJob1Finished, true);
  assert.deepEqual(claimed, ["job-1", "job-2", "job-3"]);
  assert.deepEqual(started, ["job-1", "job-2", "job-3"]);
});

test("worker once mode keeps the default concurrency at one", () => {
  assert.equal(resolveWorkerConcurrency({ once: true }), 1);
  assert.equal(resolveWorkerConcurrency({ once: false }), 3);
});

test("worker keeps running after a transient polling failure", async () => {
  let shutdown = () => {};
  let recoverCalls = 0;
  let delayCalls = 0;
  const logs = [];

  const runtime = createJobWorkerRuntime({
    randomId: () => "worker-test",
    recoverExpiredProcessingJobs: async () => {
      recoverCalls += 1;
      if (recoverCalls === 1) {
        throw new Error("read ETIMEDOUT");
      }
      shutdown();
      return 0;
    },
    claimNextRunnableJob: async () => null,
    runClaimedJob: async () => {},
    delay: async () => {
      delayCalls += 1;
    },
    log: (...args) => {
      logs.push(args);
    },
    onSignal: (_signal, listener) => {
      shutdown = listener;
    },
  });

  await runtime.start({ idleDelayMs: 1 });

  assert.equal(recoverCalls, 2);
  assert.equal(delayCalls, 2);
  assert.ok(logs.some((entry) => entry[0] === "AUGC job worker loop failed; retrying"));
});
