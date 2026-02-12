/**
 * Task Intelligence: populate TaskTemplate.embedding for templates that don't have one.
 * Used before template search so similarity can be computed.
 */

import type { PrismaClient } from "@prisma/client";
import { generateEmbedding } from "@/lib/ai/embeddings";

const EMBEDDING_MODEL = "text-embedding-3-small";

/** Build searchable text for embedding (title + description + keyConsiderations). */
export function templateToSearchText(t: {
  title: string;
  description: string;
  keyConsiderations: string;
}): string {
  return [t.title, t.description, t.keyConsiderations].filter(Boolean).join("\n\n");
}

export async function ensureTaskTemplateEmbeddings(
  prisma: PrismaClient
): Promise<{ updated: number }> {
  const all = await prisma.taskTemplate.findMany();
  const templates = all.filter(
    (t) => !t.embedding?.length || t.embeddingModel == null
  );

  if (templates.length === 0) {
    return { updated: 0 };
  }

  let updated = 0;
  for (const t of templates) {
    const text = templateToSearchText(t);
    if (!text.trim()) continue;
    try {
      const embedding = await generateEmbedding(text);
      await prisma.taskTemplate.update({
        where: { id: t.id },
        data: {
          embedding,
          embeddingModel: EMBEDDING_MODEL,
        },
      });
      updated++;
    } catch (err) {
      console.error(`[ensureTaskTemplateEmbeddings] Failed for template ${t.id}:`, err);
    }
  }
  return { updated };
}
