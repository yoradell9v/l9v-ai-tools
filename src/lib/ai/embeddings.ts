import OpenAI from "openai";

const EMBEDDING_CONFIG = {
  model: "text-embedding-3-small",
  similarityThreshold: 0.9,
  batchSize: 100,
  cacheSize: 1000,
  maxRetries: 2,
  retryDelay: 1000,
} as const;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

class EmbeddingCache {
  private cache: Map<string, number[]>;
  private maxSize: number;

  constructor(maxSize: number) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(text: string): number[] | undefined {
    const normalized = this.normalizeKey(text);
    const embedding = this.cache.get(normalized);

    if (embedding) {
      this.cache.delete(normalized);
      this.cache.set(normalized, embedding);
    }

    return embedding;
  }

  set(text: string, embedding: number[]): void {
    const normalized = this.normalizeKey(text);

    if (this.cache.size >= this.maxSize && !this.cache.has(normalized)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(normalized, embedding);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  private normalizeKey(text: string): string {
    return text.toLowerCase().trim();
  }
}

const embeddingCache = new EmbeddingCache(EMBEDDING_CONFIG.cacheSize);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error("Cannot generate embedding for empty text");
  }

  const cached = embeddingCache.get(text);
  if (cached) {
    return cached;
  }

  const maxLength = 8000;
  const truncatedText =
    text.length > maxLength ? text.substring(0, maxLength) + "..." : text;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= EMBEDDING_CONFIG.maxRetries; attempt++) {
    try {
      const response = await openai.embeddings.create({
        model: EMBEDDING_CONFIG.model,
        input: truncatedText,
      });

      const embedding = response.data[0]?.embedding;
      if (!embedding || embedding.length === 0) {
        throw new Error("Empty embedding returned from OpenAI");
      }

      embeddingCache.set(text, embedding);

      return embedding;
    } catch (error: any) {
      lastError = error;
      const isLastAttempt = attempt === EMBEDDING_CONFIG.maxRetries;

      if (isLastAttempt) {
        console.error(
          `[generateEmbedding] Failed after ${
            EMBEDDING_CONFIG.maxRetries + 1
          } attempts:`,
          error.message || error
        );
        throw error;
      }

      await sleep(EMBEDDING_CONFIG.retryDelay * (attempt + 1));
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("Failed to generate embedding");
}

export async function generateEmbeddingsBatch(
  texts: string[]
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const validTexts = texts.filter((text) => text && text.trim().length > 0);
  if (validTexts.length === 0) {
    throw new Error("No valid texts provided for embedding generation");
  }

  const results: (number[] | null)[] = [];
  const textsToEmbed: string[] = [];
  const indicesToEmbed: number[] = [];

  for (let i = 0; i < validTexts.length; i++) {
    const cached = embeddingCache.get(validTexts[i]);
    if (cached) {
      results[i] = cached;
    } else {
      results[i] = null;
      textsToEmbed.push(validTexts[i]);
      indicesToEmbed.push(i);
    }
  }

  if (textsToEmbed.length === 0) {
    return results as number[][];
  }

  const allEmbeddings: number[][] = [];

  for (let i = 0; i < textsToEmbed.length; i += EMBEDDING_CONFIG.batchSize) {
    const batch = textsToEmbed.slice(i, i + EMBEDDING_CONFIG.batchSize);

    const truncatedBatch = batch.map((text) => {
      const maxLength = 8000;
      return text.length > maxLength
        ? text.substring(0, maxLength) + "..."
        : text;
    });

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= EMBEDDING_CONFIG.maxRetries; attempt++) {
      try {
        const response = await openai.embeddings.create({
          model: EMBEDDING_CONFIG.model,
          input: truncatedBatch,
        });

        const batchEmbeddings = response.data.map((item) => item.embedding);

        batch.forEach((text, idx) => {
          if (batchEmbeddings[idx]) {
            embeddingCache.set(text, batchEmbeddings[idx]);
          }
        });

        allEmbeddings.push(...batchEmbeddings);
        break;
      } catch (error: any) {
        lastError = error;
        const isLastAttempt = attempt === EMBEDDING_CONFIG.maxRetries;

        if (isLastAttempt) {
          console.error(
            `[generateEmbeddingsBatch] Failed after ${
              EMBEDDING_CONFIG.maxRetries + 1
            } attempts:`,
            error.message || error
          );
          throw error;
        }

        await sleep(EMBEDDING_CONFIG.retryDelay * (attempt + 1));
      }
    }
  }

  for (let i = 0; i < indicesToEmbed.length; i++) {
    const originalIndex = indicesToEmbed[i];
    results[originalIndex] = allEmbeddings[i];
  }

  return results as number[][];
}

export function cosineSimilarity(
  embedding1: number[],
  embedding2: number[]
): number {
  if (embedding1.length !== embedding2.length) {
    throw new Error(
      `Embedding dimension mismatch: ${embedding1.length} vs ${embedding2.length}`
    );
  }

  if (embedding1.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }

  const magnitude1 = Math.sqrt(norm1);
  const magnitude2 = Math.sqrt(norm2);

  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }

  return dotProduct / (magnitude1 * magnitude2);
}

export async function areSemanticallySimilar(
  text1: string,
  text2: string,
  threshold: number = EMBEDDING_CONFIG.similarityThreshold
): Promise<boolean> {
  if (
    !text1 ||
    !text2 ||
    text1.trim().length === 0 ||
    text2.trim().length === 0
  ) {
    return false;
  }

  try {
    const [embedding1, embedding2] = await generateEmbeddingsBatch([
      text1,
      text2,
    ]);

    const similarity = cosineSimilarity(embedding1, embedding2);

    return similarity >= threshold;
  } catch (error) {
    console.error("[areSemanticallySimilar] Error:", error);
    return false;
  }
}

export function getSimilarityThreshold(): number {
  return EMBEDDING_CONFIG.similarityThreshold;
}

export function clearEmbeddingCache(): void {
  embeddingCache.clear();
}

export function getCacheStats(): { size: number; maxSize: number } {
  return {
    size: embeddingCache.size(),
    maxSize: EMBEDDING_CONFIG.cacheSize,
  };
}
