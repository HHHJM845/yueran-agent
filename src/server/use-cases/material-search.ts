import { createHash } from "node:crypto";
import { env } from "@/lib/env";
import { callArkEmbedding } from "@/server/providers/ark";
import type { AssetAnalysisView } from "@/server/repositories/asset-analyses";
import {
  createMaterialSearchResult,
  findMaterialEmbedding,
  listProjectMaterialEmbeddings,
  upsertMaterialEmbedding,
  type MaterialSearchMatch,
} from "@/server/repositories/material-search";

export async function searchProjectMaterials(input: {
  projectId: string;
  queryText: string;
  analyses: AssetAnalysisView[];
  sourceJobId?: string | null;
  limit?: number;
}) {
  const successfulAnalyses = input.analyses.filter((analysis) => analysis.status === "succeeded");
  if (successfulAnalyses.length === 0 || !input.queryText.trim()) {
    return [];
  }

  await ensureProjectMaterialEmbeddings({
    projectId: input.projectId,
    analyses: successfulAnalyses,
    sourceJobId: input.sourceJobId ?? null,
  });

  const [queryEmbedding, storedEmbeddings] = await Promise.all([
    callArkEmbedding({
      model: env.ARK_MATERIAL_EMBEDDING_MODEL,
      text: input.queryText,
      timeoutMs: 90_000,
      telemetry: {
        projectId: input.projectId,
        jobId: input.sourceJobId ?? null,
        callId: "ark_material_query_embedding",
        provider: env.MATERIAL_EMBEDDING_PROVIDER,
        operation: "material_query_embedding",
        metadata: { queryChars: input.queryText.length },
      },
    }),
    listProjectMaterialEmbeddings(input.projectId, env.ARK_MATERIAL_EMBEDDING_MODEL),
  ]);

  const results = storedEmbeddings
    .map((embedding): MaterialSearchMatch => ({
      embeddingId: embedding.id,
      assetAnalysisId: embedding.assetAnalysisId,
      score: cosineSimilarity(queryEmbedding, embedding.embedding),
      contentPreview: embedding.contentText.slice(0, 420),
      labels: embedding.labels.slice(0, 10),
    }))
    .filter((item) => Number.isFinite(item.score))
    .sort((left, right) => right.score - left.score)
    .slice(0, input.limit ?? 5);

  await createMaterialSearchResult({
    projectId: input.projectId,
    queryText: input.queryText,
    provider: env.MATERIAL_EMBEDDING_PROVIDER,
    modelName: env.ARK_MATERIAL_EMBEDDING_MODEL,
    results,
    sourceJobId: input.sourceJobId ?? null,
  });

  return results;
}

async function ensureProjectMaterialEmbeddings(input: {
  projectId: string;
  analyses: AssetAnalysisView[];
  sourceJobId?: string | null;
}) {
  for (const analysis of input.analyses.slice(0, 30)) {
    const contentText = buildMaterialContent(analysis);
    const contentHash = hashText(contentText);
    const existing = await findMaterialEmbedding({
      assetAnalysisId: analysis.id,
      modelName: env.ARK_MATERIAL_EMBEDDING_MODEL,
      contentHash,
    });
    if (existing) continue;

    const embedding = await callArkEmbedding({
      model: env.ARK_MATERIAL_EMBEDDING_MODEL,
      text: contentText,
      timeoutMs: 90_000,
      telemetry: {
        projectId: input.projectId,
        jobId: input.sourceJobId ?? null,
        callId: "ark_material_asset_embedding",
        provider: env.MATERIAL_EMBEDDING_PROVIDER,
        operation: "material_asset_embedding",
        metadata: {
          assetAnalysisId: analysis.id,
          contentHash,
          contentChars: contentText.length,
        },
      },
    });
    await upsertMaterialEmbedding({
      projectId: input.projectId,
      assetAnalysisId: analysis.id,
      contentText,
      labels: analysis.labels,
      provider: env.MATERIAL_EMBEDDING_PROVIDER,
      modelName: env.ARK_MATERIAL_EMBEDDING_MODEL,
      contentHash,
      embedding,
      sourceJobId: input.sourceJobId ?? null,
    });
  }
}

function buildMaterialContent(analysis: AssetAnalysisView) {
  return [
    analysis.summary,
    analysis.labels.length > 0 ? `标签：${analysis.labels.join("、")}` : "",
    analysis.extractedText.slice(0, 3000),
    typeof analysis.metadata === "string" ? analysis.metadata : JSON.stringify(analysis.metadata ?? {}).slice(0, 1200),
  ]
    .filter(Boolean)
    .join("\n");
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function cosineSimilarity(left: number[], right: number[]) {
  const length = Math.min(left.length, right.length);
  if (length === 0) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}
