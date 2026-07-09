import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

type BenchmarkRow = {
  inputChars: number;
  round: number;
  status: "succeeded" | "failed";
  durationMs: number;
  outputChars: number;
  error: string;
};

type BenchmarkResponse = {
  summary?: string;
  inputChars?: number;
  points?: string[];
};

async function main() {
  const { env } = await import("@/lib/env");
  const { callArkJson } = await import("@/server/providers/ark");
  const inputSizes = parseNumberList(readArg("chars"), [500, 2000, 5000, 10000]);
  const rounds = clampPositiveInteger(Number(readArg("rounds") ?? 2), 1, 5);
  const timeoutMs = clampPositiveInteger(Number(readArg("timeout-ms") ?? 180_000), 30_000, 300_000);
  const rows: BenchmarkRow[] = [];

  if (!env.ARK_API_KEY) {
    throw new Error("ARK_API_KEY 未配置，无法执行豆包文本延迟测试。");
  }

  for (const inputChars of inputSizes) {
    const text = buildChineseText(inputChars);
    for (let round = 1; round <= rounds; round += 1) {
      const startedAt = Date.now();
      try {
        const response = await callArkJson<BenchmarkResponse>({
          model: env.ARK_TEXT_STRUCTURING_MODEL,
          timeoutMs,
          temperature: 0,
          maxOutputTokens: 220,
          messages: [
            {
              role: "system",
              content:
                "你是延迟测试助手。只输出严格 JSON：{\"summary\":\"\",\"inputChars\":0,\"points\":[\"\"]}。summary 不超过 30 个中文字符，points 恰好 2 条，每条不超过 18 个中文字符。",
            },
            {
              role: "user",
              content: `请阅读下面这段测试文本，返回极短摘要。测试文本字符数约为 ${inputChars}。\n\n${text}`,
            },
          ],
        });
        rows.push({
          inputChars,
          round,
          status: "succeeded",
          durationMs: Date.now() - startedAt,
          outputChars: JSON.stringify(response).length,
          error: "",
        });
      } catch (error) {
        rows.push({
          inputChars,
          round,
          status: "failed",
          durationMs: Date.now() - startedAt,
          outputChars: 0,
          error: error instanceof Error ? error.message.slice(0, 160) : "Unknown error",
        });
      }
      console.log(formatProgress(rows.at(-1)!));
    }
  }

  const summary = inputSizes.map((inputChars) => summarizeRows(rows.filter((row) => row.inputChars === inputChars)));
  console.log("豆包文本模型输入长度延迟测试");
  console.table(rows.map((row) => ({ ...row, duration: formatMs(row.durationMs) })));
  console.log("按输入长度汇总");
  console.table(summary);
  console.log(JSON.stringify({ model: env.ARK_TEXT_STRUCTURING_MODEL, generatedAt: new Date().toISOString(), rows, summary }, null, 2));
}

function readArg(name: string) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match?.slice(prefix.length).trim() || null;
}

function parseNumberList(value: string | null, fallback: number[]) {
  if (!value) return fallback;
  const parsed = value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0)
    .map((item) => Math.floor(item));
  return parsed.length > 0 ? parsed : fallback;
}

function clampPositiveInteger(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function buildChineseText(targetChars: number) {
  const seed =
    "这是一段用于测试模型输入长度影响的客户项目背景。品牌希望用自然、真实、可执行的语言描述创意方向，包含人物、场景、情绪、产品露出和画面节奏。";
  let text = "";
  while (text.length < targetChars) {
    text += seed;
  }
  return text.slice(0, targetChars);
}

function summarizeRows(rows: BenchmarkRow[]) {
  const succeeded = rows.filter((row) => row.status === "succeeded");
  const durations = succeeded.map((row) => row.durationMs).sort((left, right) => left - right);
  const average = durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0;
  return {
    inputChars: rows[0]?.inputChars ?? 0,
    runs: rows.length,
    succeeded: succeeded.length,
    average: formatMs(average),
    min: formatMs(durations[0] ?? 0),
    max: formatMs(durations.at(-1) ?? 0),
  };
}

function formatMs(value: number) {
  if (value < 1000) return `${value}ms`;
  return `${(value / 1000).toFixed(2)}s`;
}

function formatProgress(row: BenchmarkRow) {
  return `input=${row.inputChars} round=${row.round} status=${row.status} duration=${formatMs(row.durationMs)} outputChars=${row.outputChars}`;
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "豆包文本延迟测试失败。");
  process.exit(1);
});
