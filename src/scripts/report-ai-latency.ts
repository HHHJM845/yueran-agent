import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

type LatencyReportRow = {
  jobId: string;
  type: string;
  status: string;
  title: string;
  total: string;
  queue: string;
  worker: string;
  model: string;
  nonModel: string;
  modelShare: string;
  bottleneck: string;
  modelCalls: number;
};

type StandaloneLatencyReportRow = {
  aiTaskLogId: string;
  operation: string;
  status: string;
  modelName: string;
  model: string;
  requestTotal: string;
  nonModelRequest: string;
  tokens: string;
  chars: string;
  images: string;
  createdAt: string;
};

async function main() {
  const {
    getJobLatencyDiagnostic,
    listProjectJobLatencyDiagnostics,
    listProjectStandaloneAiTaskLatencyDiagnostics,
  } = await import("@/server/use-cases/job-latency-diagnostics");
  const jobId = readArg("job-id") ?? readArg("jobId");
  const projectId = readArg("project-id") ?? readArg("projectId");
  const limit = Number(readArg("limit") ?? 20);
  const type = readArg("type");
  const operation = readArg("operation");

  const diagnostics = jobId
    ? [await getJobLatencyDiagnostic(jobId)].filter((item): item is NonNullable<typeof item> => Boolean(item))
    : projectId
      ? await listProjectJobLatencyDiagnostics({ projectId, limit, type })
      : [];
  const standaloneDiagnostics =
    projectId && !jobId
      ? await listProjectStandaloneAiTaskLatencyDiagnostics({ projectId, limit, operation })
      : [];

  if (!jobId && !projectId) {
    throw new Error("请提供 --job-id=<id> 或 --project-id=<id>。");
  }

  if (diagnostics.length === 0 && standaloneDiagnostics.length === 0) {
    console.log("没有找到可诊断的 AI 任务。");
    return;
  }

  const rows: LatencyReportRow[] = diagnostics.map((diagnostic) => ({
    jobId: diagnostic.job.id,
    type: String(diagnostic.job.type),
    status: String(diagnostic.job.status),
    title: diagnostic.job.title,
    total: formatMs(diagnostic.totalMs),
    queue: formatNullableMs(diagnostic.queueWaitMs),
    worker: formatNullableMs(diagnostic.workerTotalMs),
    model: formatMs(diagnostic.modelTotalMs),
    nonModel: formatNullableMs(diagnostic.nonModelWorkerMs),
    modelShare: diagnostic.modelShare === null ? "-" : `${Math.round(diagnostic.modelShare * 100)}%`,
    bottleneck: diagnostic.bottleneck,
    modelCalls: diagnostic.aiTaskLogs.length,
  }));
  const standaloneRows: StandaloneLatencyReportRow[] = standaloneDiagnostics.map((diagnostic) => ({
    aiTaskLogId: diagnostic.id,
    operation: diagnostic.operation,
    status: diagnostic.status,
    modelName: diagnostic.modelName,
    model: formatMs(diagnostic.durationMs),
    requestTotal: "历史不可还原",
    nonModelRequest: "需浏览器实测",
    tokens: formatCount(diagnostic.totalTokens),
    chars: [diagnostic.inputChars, diagnostic.outputChars].every((value) => value === null)
      ? "-"
      : `${formatCount(diagnostic.inputChars)} / ${formatCount(diagnostic.outputChars)}`,
    images: formatCount(diagnostic.imageCount),
    createdAt: diagnostic.createdAt,
  }));

  if (rows.length > 0) {
    console.log("后台异步任务耗时拆分（jobs + ai_task_logs）");
    console.table(rows);
  }
  if (standaloneRows.length > 0) {
    console.log("同步模型调用历史记录（只含模型耗时，完整请求耗时需浏览器实时测量）");
    console.table(standaloneRows);
  }
  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        asyncJobCount: diagnostics.length,
        standaloneAiCallCount: standaloneDiagnostics.length,
        rows,
        standaloneRows,
        details: diagnostics.map((diagnostic) => ({
          jobId: diagnostic.job.id,
          segments: diagnostic.segments,
          aiTaskLogs: diagnostic.aiTaskLogs.map((log) => ({
            operation: log.operation,
            modelName: log.modelName,
            status: log.status,
            duration: formatMs(log.durationMs),
            createdAt: log.createdAt,
          })),
          missing: diagnostic.missing,
        })),
        standaloneDetails: standaloneDiagnostics.map((diagnostic) => ({
          aiTaskLogId: diagnostic.id,
          operation: diagnostic.operation,
          provider: diagnostic.provider,
          modelName: diagnostic.modelName,
          status: diagnostic.status,
          modelDuration: formatMs(diagnostic.durationMs),
          requestTotal: "historically_unavailable",
          nonModelRequest: "measure_prospectively_in_browser",
          callId: diagnostic.callId,
          createdAt: diagnostic.createdAt,
          errorCode: diagnostic.errorCode,
        })),
      },
      null,
      2
    )
  );
}

function readArg(name: string) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match?.slice(prefix.length).trim() || null;
}

function formatNullableMs(value: number | null) {
  return value === null ? "-" : formatMs(value);
}

function formatMs(value: number) {
  if (value < 1000) return `${value}ms`;
  return `${(value / 1000).toFixed(2)}s`;
}

function formatCount(value: number | null) {
  return value === null ? "-" : String(value);
}

const isMain = process.argv[1] ? import.meta.url === new URL(process.argv[1], "file:").href : false;

if (isMain) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : "AI 任务耗时诊断失败。");
    process.exit(1);
  });
}
