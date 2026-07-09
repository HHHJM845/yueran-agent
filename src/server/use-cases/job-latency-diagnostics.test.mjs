import assert from "node:assert/strict";
import test from "node:test";

test("job latency diagnostics breaks async AI work into queue, model, and postprocess segments", async () => {
  const { buildJobLatencyDiagnostic } = await import("./job-latency-diagnostics.ts");

  const diagnostic = buildJobLatencyDiagnostic({
    job: {
      id: "job-1",
      projectId: "project-1",
      type: "storyboard_image_generation",
      status: "succeeded",
      title: "生成分镜图",
      provider: "volcengine_ark",
      modelName: "doubao-seedream-4-0-250828",
      createdAt: "2026-07-05T10:00:00.000Z",
      startedAt: "2026-07-05T10:00:05.000Z",
      completedAt: "2026-07-05T10:00:45.000Z",
      failedAt: null,
    },
    aiTaskLogs: [
      {
        id: "log-1",
        provider: "volcengine_ark",
        modelName: "doubao-seedream-4-0-250828",
        operation: "storyboard_image_generation",
        status: "succeeded",
        durationMs: 30_000,
        createdAt: "2026-07-05T10:00:40.000Z",
      },
    ],
  });

  assert.equal(diagnostic.totalMs, 45_000);
  assert.equal(diagnostic.queueWaitMs, 5_000);
  assert.equal(diagnostic.workerTotalMs, 40_000);
  assert.equal(diagnostic.modelTotalMs, 30_000);
  assert.equal(diagnostic.nonModelWorkerMs, 10_000);
  assert.equal(diagnostic.modelShare, 0.75);
  assert.equal(diagnostic.bottleneck, "model_call");
  assert.deepEqual(
    diagnostic.segments.map((segment) => [segment.key, segment.durationMs]),
    [
      ["queue_wait", 5_000],
      ["worker_non_model", 10_000],
      ["model_call", 30_000],
    ]
  );
});

test("job latency diagnostics marks missing worker timestamps as incomplete", async () => {
  const { buildJobLatencyDiagnostic } = await import("./job-latency-diagnostics.ts");

  const diagnostic = buildJobLatencyDiagnostic({
    job: {
      id: "job-2",
      projectId: "project-1",
      type: "creative_direction_generation",
      status: "queued",
      title: "生成创意方向",
      provider: "volcengine_ark",
      modelName: "doubao-seed-2-1-pro-260628",
      createdAt: "2026-07-05T10:00:00.000Z",
      startedAt: null,
      completedAt: null,
      failedAt: null,
    },
    aiTaskLogs: [],
    observedAt: "2026-07-05T10:00:12.000Z",
  });

  assert.equal(diagnostic.totalMs, 12_000);
  assert.equal(diagnostic.queueWaitMs, 12_000);
  assert.equal(diagnostic.workerTotalMs, null);
  assert.equal(diagnostic.modelTotalMs, 0);
  assert.equal(diagnostic.bottleneck, "queue_wait");
  assert.equal(diagnostic.isComplete, false);
  assert.deepEqual(diagnostic.missing, ["startedAt", "completedAt"]);
});

test("standalone AI task diagnostics intentionally marks historical request totals as unavailable", async () => {
  const diagnosticsModule = await import("./job-latency-diagnostics.ts");
  const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("./job-latency-diagnostics.ts", import.meta.url), "utf8"));

  assert.equal(typeof diagnosticsModule.listProjectStandaloneAiTaskLatencyDiagnostics, "function");
  assert.match(source, /job_id is null/);
  assert.match(source, /hasRequestTotal: false/);
  assert.match(source, /requestTotalMs: null/);
  assert.match(source, /nonModelRequestMs: null/);
});
