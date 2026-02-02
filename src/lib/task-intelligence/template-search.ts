/**
 * Task Intelligence: semantic search for task templates by user prompt.
 * Uses embeddings + cosine similarity; ensures embeddings exist before search.
 */

import type { PrismaClient } from "@prisma/client";
import { generateEmbedding, cosineSimilarity } from "@/lib/ai/embeddings";
import { ensureTaskTemplateEmbeddings } from "./ensure-task-template-embeddings";
import type { TaskTemplateForSearch, TaskTemplateMatch } from "./types";

const DEFAULT_TOP_K = 5;
const DEFAULT_MIN_SIMILARITY = 0.4;

export async function searchTaskTemplates(
  prisma: PrismaClient,
  userPrompt: string,
  options?: {
    topK?: number;
    minSimilarity?: number;
  }
): Promise<TaskTemplateMatch[]> {
  const topK = options?.topK ?? DEFAULT_TOP_K;
  const minSimilarity = options?.minSimilarity ?? DEFAULT_MIN_SIMILARITY;

  if (!userPrompt?.trim()) {
    return [];
  }

  await ensureTaskTemplateEmbeddings(prisma);

  const all = await prisma.taskTemplate.findMany();
  const templates = all.filter(
    (t) => t.embedding?.length && t.embeddingModel != null
  );

  if (templates.length === 0) {
    return [];
  }

  const promptEmbedding = await generateEmbedding(userPrompt.trim());

  const withSimilarity: TaskTemplateMatch[] = templates
    .filter((t) => t.embedding && t.embedding.length === promptEmbedding.length)
    .map((t) => ({
      template: t as TaskTemplateForSearch,
      similarity: cosineSimilarity(promptEmbedding, t.embedding as number[]),
    }))
    .filter((m) => m.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  return withSimilarity;
}

/** Get the single best template match above threshold, or null. */
export async function getBestTaskTemplateMatch(
  prisma: PrismaClient,
  userPrompt: string,
  minSimilarity: number = 0.45
): Promise<TaskTemplateMatch | null> {
  const [best] = await searchTaskTemplates(prisma, userPrompt, {
    topK: 1,
    minSimilarity,
  });
  return best ?? null;
}
