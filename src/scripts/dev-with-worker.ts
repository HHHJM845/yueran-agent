import { spawn } from "node:child_process";
import type { Readable } from "node:stream";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createInterface } from "node:readline";

type DevProcessSpec = {
  name: "web" | "worker";
  command: string;
  args: string[];
};

export function getDevProcessSpecs(cwd = process.cwd(), platform = process.platform): DevProcessSpec[] {
  const binSuffix = platform === "win32" ? ".cmd" : "";

  return [
    {
      name: "web",
      command: path.join(cwd, "node_modules", ".bin", `next${binSuffix}`),
      args: ["dev"],
    },
    {
      name: "worker",
      command: path.join(cwd, "node_modules", ".bin", `tsx${binSuffix}`),
      args: ["src/scripts/job-worker.ts"],
    },
  ];
}

function prefixStream(child: { stdout: Readable; stderr: Readable }, name: string) {
  createInterface({ input: child.stdout }).on("line", (line) => {
    console.log(`[${name}] ${line}`);
  });
  createInterface({ input: child.stderr }).on("line", (line) => {
    console.error(`[${name}] ${line}`);
  });
}

function startDevProcess(spec: DevProcessSpec) {
  const child = spawn(spec.command, spec.args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["inherit", "pipe", "pipe"],
  });
  prefixStream(child, spec.name);
  return child;
}

async function main() {
  const processes = getDevProcessSpecs().map((spec) => ({
    spec,
    child: startDevProcess(spec),
  }));

  let shuttingDown = false;
  const stopAll = (signal: NodeJS.Signals = "SIGTERM") => {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const { child } of processes) {
      if (!child.killed) child.kill(signal);
    }
  };

  process.once("SIGINT", stopAll);
  process.once("SIGTERM", stopAll);

  await new Promise<void>((resolve, reject) => {
    for (const { spec, child } of processes) {
      child.once("error", (error) => {
        stopAll();
        reject(error);
      });
      child.once("exit", (code, signal) => {
        if (shuttingDown) {
          resolve();
          return;
        }
        stopAll();
        if (code === 0 || signal) {
          resolve();
          return;
        }
        reject(new Error(`${spec.name} dev process exited with code ${code}`));
      });
    }
  });
}

export function isMainModule(metaUrl: string, argvScript = process.argv[1], cwd = process.cwd()) {
  if (!argvScript) return false;
  return metaUrl === pathToFileURL(path.resolve(cwd, argvScript)).href;
}

if (isMainModule(import.meta.url)) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Dev runner failed");
    process.exit(1);
  });
}
