import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { startJobWorker } = await import("@/server/workers/job-worker");
  const once = process.argv.includes("--once");

  await startJobWorker({ once });
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Worker failed");
  process.exit(1);
});
